/**
 * File Parser Module — CSV & JSON Parser with Validation
 * Parses uploaded student and room data files for UniAlign AI.
 */

/**
 * Parse CSV text into an array of objects.
 * Handles quoted fields, commas inside quotes, and newlines.
 */
function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row.');

    // Parse header
    const headers = splitCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, ''));

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const values = splitCSVLine(line);
        const obj = {};
        headers.forEach((header, idx) => {
            obj[header] = (values[idx] || '').trim();
        });
        rows.push(obj);
    }
    return rows;
}

/**
 * Split a single CSV line into fields, respecting quoted strings.
 */
function splitCSVLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            fields.push(current);
            current = '';
        } else {
            current += ch;
        }
    }
    fields.push(current);
    return fields;
}

/**
 * Normalize various header name variations to canonical field names.
 */
function normalizeStudentField(key) {
    const k = key.toLowerCase().replace(/[\s_\-\.]+/g, '');
    const map = {
        'name': 'name', 'fullname': 'name', 'studentname': 'name',
        'rollnumber': 'rollNumber', 'rollno': 'rollNumber', 'roll': 'rollNumber', 'rollnum': 'rollNumber',
        'erpid': 'erpId', 'erp': 'erpId', 'erpno': 'erpId',
        'examid': 'examId', 'exam': 'examId', 'courseid': 'examId', 'course': 'examId', 'coursename': 'examId',
        'department': 'department', 'dept': 'department',
        'semester': 'semester', 'sem': 'semester',
        'email': 'email', 'emailid': 'email', 'emailaddress': 'email',
        'id': 'id', 'studentid': 'id', 'sid': 'id'
    };
    return map[k] || key;
}

function normalizeRoomField(key) {
    const k = key.toLowerCase().replace(/[\s_\-\.]+/g, '');
    const map = {
        'name': 'name', 'roomname': 'name', 'room': 'name',
        'rows': 'rows', 'row': 'rows', 'numrows': 'rows',
        'cols': 'cols', 'columns': 'cols', 'col': 'cols', 'numcols': 'cols',
        'id': 'id', 'roomid': 'id'
    };
    return map[k] || key;
}

/**
 * Validate and normalize student data.
 */
function validateStudents(rawRows) {
    const errors = [];
    const students = [];

    if (!rawRows || rawRows.length === 0) {
        return { students: [], errors: ['No student data found in the file.'] };
    }

    // Check if we have the required fields
    const sampleKeys = Object.keys(rawRows[0]);
    const normalizedKeys = sampleKeys.map(k => normalizeStudentField(k));
    const hasName = normalizedKeys.includes('name');
    
    if (!hasName) {
        errors.push('Missing required field: "name". Please check your CSV/JSON headers.');
    }

    // Collect all unique course/exam IDs for auto-generating course data
    const courseSet = new Set();

    rawRows.forEach((row, idx) => {
        const normalized = {};
        Object.keys(row).forEach(key => {
            normalized[normalizeStudentField(key)] = row[key];
        });

        if (!normalized.name || normalized.name.trim() === '') {
            errors.push(`Row ${idx + 1}: Missing student name.`);
            return;
        }

        const student = {
            id: normalized.id || `STU${1000 + idx}`,
            name: normalized.name.trim(),
            rollNumber: normalized.rollNumber || `ROLL${String(idx + 1).padStart(3, '0')}`,
            erpId: normalized.erpId || `ERP${String(idx + 1).padStart(4, '0')}`,
            examId: (normalized.examId || 'general').toLowerCase().replace(/\s+/g, '_'),
            department: normalized.department || 'Unknown',
            semester: parseInt(normalized.semester) || 1,
            email: normalized.email || `${normalized.name.trim().toLowerCase().replace(/\s+/g, '.')}@university.edu`
        };

        courseSet.add(student.examId);
        students.push(student);
    });

    return { students, errors, courses: [...courseSet] };
}

/**
 * Validate and normalize room data.
 */
function validateRooms(rawRows) {
    const errors = [];
    const rooms = [];

    if (!rawRows || rawRows.length === 0) {
        return { rooms: [], errors: ['No room data found in the file.'] };
    }

    rawRows.forEach((row, idx) => {
        const normalized = {};
        Object.keys(row).forEach(key => {
            normalized[normalizeRoomField(key)] = row[key];
        });

        const name = normalized.name || `Room ${idx + 1}`;
        const rows = parseInt(normalized.rows);
        const cols = parseInt(normalized.cols);

        if (!rows || rows < 1) {
            errors.push(`Room "${name}": Invalid rows value.`);
            return;
        }
        if (!cols || cols < 1) {
            errors.push(`Room "${name}": Invalid cols value.`);
            return;
        }

        rooms.push({
            id: normalized.id || `R-${String.fromCharCode(65 + idx)}${idx + 1}`,
            name: name,
            rows: rows,
            cols: cols
        });
    });

    return { rooms, errors };
}

/**
 * Main entry point: Parse a file (File object) and return structured data.
 * @param {File} file
 * @param {'students'|'rooms'} dataType
 * @returns {Promise<{data: any[], errors: string[], courses?: string[]}>}
 */
export async function parseFile(file, dataType = 'students') {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const text = e.target.result;
                const ext = file.name.split('.').pop().toLowerCase();
                let rawRows;

                if (ext === 'json') {
                    const parsed = JSON.parse(text);
                    rawRows = Array.isArray(parsed) ? parsed : (parsed.students || parsed.rooms || parsed.data || [parsed]);
                } else if (ext === 'csv') {
                    rawRows = parseCSV(text);
                } else {
                    resolve({ data: [], errors: [`Unsupported file type: .${ext}. Please use CSV or JSON.`] });
                    return;
                }

                if (dataType === 'rooms') {
                    const result = validateRooms(rawRows);
                    resolve({ data: result.rooms, errors: result.errors });
                } else {
                    const result = validateStudents(rawRows);
                    resolve({ data: result.students, errors: result.errors, courses: result.courses });
                }
            } catch (err) {
                resolve({ data: [], errors: [`Failed to parse file: ${err.message}`] });
            }
        };

        reader.onerror = () => resolve({ data: [], errors: ['Failed to read the file. Please try again.'] });
        reader.readAsText(file);
    });
}

/**
 * Generate course metadata from a list of course IDs.
 */
export function generateCourseMetadata(courseIds) {
    const colorClasses = ['course-0badge', 'course-1badge', 'course-2badge', 'course-3badge'];
    const extraColors = ['#8b5cf6', '#06b6d4', '#f97316', '#84cc16', '#e11d48', '#14b8a6'];

    return courseIds.map((id, idx) => ({
        id: id,
        name: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        colorClass: idx < colorClasses.length ? colorClasses[idx] : colorClasses[idx % colorClasses.length],
        department: 'Imported',
        code: id.toUpperCase().replace(/_/g, '').substring(0, 5),
        count: 0 // will be computed from actual data
    }));
}

/**
 * Generate a template CSV string for download.
 */
export function getStudentTemplateCSV() {
    return `name,rollNumber,erpId,course,department,semester,email
John Doe,CS2024001,23BTCSE0100,Computer Science,Computer Science & Engineering,3,john.doe@university.edu
Jane Smith,BBA2024001,23BBA0100,BBA,Business Administration,2,jane.smith@university.edu
Rahul Kumar,BCOM2024001,23BCOM0100,B.Com,Commerce,4,rahul.kumar@university.edu`;
}

export function getRoomTemplateCSV() {
    return `name,rows,cols
Main Hall,10,10
Lecture Theater 1,7,8
Science Lab,5,6`;
}
