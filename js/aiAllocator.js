/**
 * AI Allocator Module — AI API-based Seating Allocation
 * Sends student and room data to an AI API to generate optimized
 * seating arrangements as two 2D arrays per room.
 */

import { runAllocationOptimization } from './allocator.js';

/**
 * Build the prompt for the AI to generate seating arrangements.
 */
function buildAllocationPrompt(students, rooms) {
    const studentSummary = students.map(s => ({
        id: s.id,
        name: s.name,
        examId: s.examId
    }));

    const roomSummary = rooms.map(r => ({
        id: r.id,
        name: r.name,
        rows: r.rows,
        cols: r.cols,
        capacity: r.rows * r.cols
    }));

    return `You are a university seating arrangement AI. Generate an optimized exam seating allocation.

CONSTRAINTS:
1. No two adjacent students (up, down, left, right) should be taking the SAME exam/course.
2. Room capacity must not be exceeded.
3. Try to place ALL students. Leave seats as null if no valid student can be placed.
4. Distribute students across rooms efficiently.

STUDENTS (${students.length} total):
${JSON.stringify(studentSummary)}

ROOMS:
${JSON.stringify(roomSummary)}

RESPOND WITH ONLY valid JSON in this exact format (no markdown, no explanation):
{
  "allocations": [
    {
      "roomId": "R-A1",
      "studentGrid": [["STU1001", null, "STU1002"], ["STU1003", "STU1004", null]],
      "examGrid": [["bba", null, "bcom"], ["bca", "bba", null]]
    }
  ]
}

Where:
- studentGrid[row][col] = student ID string or null (empty seat)
- examGrid[row][col] = examId string or null (empty seat)
- Each room's grid dimensions must match its rows x cols exactly.
- IMPORTANT: Every student ID used must be from the provided students list.
- IMPORTANT: Respond ONLY with the JSON object, no other text.`;
}

/**
 * Call the AI API to generate seating allocation.
 * Supports Gemini API format.
 */
async function callAIAPI(prompt, apiKey, model = 'gemini-2.5-flash-preview-04-17') {
    // Gemini API endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.1,
                topP: 0.95,
                maxOutputTokens: 65536,
                responseMimeType: "application/json"
            }
        })
    });

    if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`AI API error (${response.status}): ${errBody}`);
    }

    const data = await response.json();

    // Extract text from Gemini response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('AI returned an empty response.');

    // Parse JSON from response (strip markdown code fences if present)
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    return JSON.parse(jsonStr);
}

/**
 * Convert AI response into the app's allocation format.
 */
function convertAIResponse(aiResult, students, rooms) {
    const studentMap = {};
    students.forEach(s => { studentMap[s.id] = s; });

    const roomMap = {};
    rooms.forEach(r => { roomMap[r.id] = r; });

    const allocations = [];
    const placedStudentIds = new Set();

    (aiResult.allocations || []).forEach(roomAlloc => {
        const room = roomMap[roomAlloc.roomId];
        if (!room) return;

        const studentGrid = roomAlloc.studentGrid || [];
        const examGrid = roomAlloc.examGrid || [];
        const numRows = room.rows;
        const numCols = room.cols;

        // Build the grid in app format
        const grid = Array(numRows).fill(null).map(() => Array(numCols).fill(null));
        const assignments = [];

        for (let r = 0; r < numRows; r++) {
            for (let c = 0; c < numCols; c++) {
                const studentId = studentGrid[r]?.[c];
                if (studentId && studentMap[studentId]) {
                    const student = studentMap[studentId];
                    grid[r][c] = student;
                    placedStudentIds.add(studentId);
                    assignments.push({
                        studentId: student.id,
                        examId: student.examId,
                        row: r,
                        col: c
                    });
                }
            }
        }

        const capacity = numRows * numCols;
        allocations.push({
            room,
            grid,
            assignments,
            occupancy: Math.round((assignments.length / capacity) * 100),
            capacity
        });
    });

    const unallocatedStudents = students.filter(s => !placedStudentIds.has(s.id));

    return {
        allocations,
        unallocatedStudents,
        totalPlaced: placedStudentIds.size
    };
}

/**
 * Main entry: Run AI-powered seating allocation.
 * Falls back to local algorithm if API call fails.
 * 
 * @param {Array} students
 * @param {Array} rooms
 * @param {string} apiKey - Gemini API key
 * @param {string} model - Model name (default: gemini-2.0-flash)
 * @returns {Promise<Object>} allocation result
 */
export async function runAIAllocation(students, rooms, apiKey, model = 'gemini-2.0-flash') {
    if (!apiKey) {
        console.warn('No API key provided, falling back to local algorithm.');
        return { result: runAllocationOptimization(students, rooms), usedAI: false };
    }

    try {
        const prompt = buildAllocationPrompt(students, rooms);
        const aiResult = await callAIAPI(prompt, apiKey, model);
        const result = convertAIResponse(aiResult, students, rooms);

        // Validate: if AI placed very few students, fallback
        if (result.totalPlaced < students.length * 0.3) {
            console.warn('AI placed too few students, falling back to local algorithm.');
            return { result: runAllocationOptimization(students, rooms), usedAI: false };
        }

        return { result, usedAI: true };
    } catch (err) {
        console.error('AI allocation failed:', err);
        return {
            result: runAllocationOptimization(students, rooms),
            usedAI: false,
            error: err.message
        };
    }
}
