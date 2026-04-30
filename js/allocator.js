/**
 * AI Allocator function that assigns students to rooms securely.
 * Constraints:
 * 1. A student cannot sit adjacent (top, bottom, left, right) to another student taking the SAME exam.
 * 2. Room capacity must not be exceeded.
 */
export function runAllocationOptimization(students, rooms) {
    let unallocatedStudents = [...students];
    const allocations = [];

    // Sort rooms by descending capacity to fit as many as possible first
    const sortedRooms = [...rooms].sort((a,b) => (b.rows*b.cols) - (a.rows*a.cols));

    sortedRooms.forEach(room => {
        const grid = Array(room.rows).fill(null).map(() => Array(room.cols).fill(null));
        const roomAssignments = [];

        for (let r = 0; r < room.rows; r++) {
            for (let c = 0; c < room.cols; c++) {
                if (unallocatedStudents.length === 0) break;

                // Priority: find a student who violates NO constraints
                let placedStudentIdx = -1;
                
                for (let i = 0; i < unallocatedStudents.length; i++) {
                    const student = unallocatedStudents[i];
                    
                    // Check orthogonal adjacencies
                    const top = r > 0 ? grid[r-1][c] : null;
                    const left = c > 0 ? grid[r][c-1] : null;

                    let collision = false;
                    if (top && top.examId === student.examId) collision = true;
                    if (left && left.examId === student.examId) collision = true;

                    if (!collision) {
                        placedStudentIdx = i;
                        break;
                    }
                }

                // If a valid student is found, place them. Otherwise leave empty to prevent cheating.
                if (placedStudentIdx !== -1) {
                    const student = unallocatedStudents.splice(placedStudentIdx, 1)[0];
                    grid[r][c] = student;
                    roomAssignments.push({
                        studentId: student.id,
                        examId: student.examId,
                        row: r,
                        col: c
                    });
                }
            }
        }

        const capacity = room.rows * room.cols;
        allocations.push({
            room: room,
            grid: grid,
            assignments: roomAssignments,
            occupancy: Math.round((roomAssignments.length / capacity) * 100),
            capacity: capacity
        });
    });

    return {
        allocations,
        unallocatedStudents,
        totalPlaced: students.length - unallocatedStudents.length
    };
}
