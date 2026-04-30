/**
 * database.js — SQLite Database Module for UniAlign AI
 * Uses sql.js (pure JavaScript SQLite, no native dependencies).
 * Persists to disk at server/unialign.db
 */

const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'unialign.db');
let db = null;

// ========================
// Initialize Database
// ========================
async function initDB() {
    const SQL = await initSqlJs();

    // Load existing database file if it exists
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
        console.log(`📂 Loaded existing database from ${DB_PATH}`);
    } else {
        db = new SQL.Database();
        console.log(`🆕 Created new database`);
    }

    // Create tables
    db.run(`
        CREATE TABLE IF NOT EXISTS courses (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color_class TEXT DEFAULT '',
            department TEXT DEFAULT '',
            code TEXT DEFAULT '',
            count INTEGER DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            roll_number TEXT DEFAULT '',
            erp_id TEXT DEFAULT '',
            exam_id TEXT DEFAULT '',
            department TEXT DEFAULT '',
            semester INTEGER DEFAULT 1,
            email TEXT DEFAULT ''
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            building TEXT DEFAULT '',
            floor INTEGER DEFAULT 0,
            rows INTEGER NOT NULL DEFAULT 5,
            cols INTEGER NOT NULL DEFAULT 5
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS allocations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT DEFAULT (datetime('now')),
            total_placed INTEGER DEFAULT 0,
            total_students INTEGER DEFAULT 0
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS allocation_assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            allocation_id INTEGER NOT NULL,
            student_id TEXT NOT NULL,
            room_id TEXT NOT NULL,
            seat_row INTEGER NOT NULL,
            seat_col INTEGER NOT NULL
        )
    `);

    // Seed if empty
    const result = db.exec('SELECT COUNT(*) as count FROM courses');
    const courseCount = result.length > 0 ? result[0].values[0][0] : 0;
    if (courseCount === 0) {
        seedData();
    }

    saveToDisk();
    console.log(`✅ Database ready (${DB_PATH})`);
    return db;
}

// ========================
// Persist to disk
// ========================
function saveToDisk() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

// ========================
// Seed Default Data
// ========================
function seedData() {
    console.log('🌱 Seeding default data...');

    // Courses
    const courses = [
        ['bba', 'BBA', 'course-0badge', 'Business Administration', 'BBA', 250],
        ['bcom', 'B.Com', 'course-1badge', 'Commerce', 'BCOM', 250],
        ['bca', 'BCA', 'course-2badge', 'Computer Applications', 'BCA', 150],
        ['btech', 'B.Tech CSE', 'course-3badge', 'Computer Science & Engineering', 'BTCSE', 250]
    ];

    for (const c of courses) {
        db.run('INSERT OR IGNORE INTO courses (id, name, color_class, department, code, count) VALUES (?, ?, ?, ?, ?, ?)', c);
    }

    // Students (generate 900)
    const firstNames = [
        'Aarav','Vivaan','Aditya','Vihaan','Arjun','Sai','Reyansh','Ayaan',
        'Krishna','Ishaan','Ananya','Diya','Saanvi','Anika','Pooja','Riya',
        'Neha','Kavya','Meera','Ishita','Rahul','Rohan','Vikram','Amit',
        'Priya','Shreya','Tanvi','Nisha','Sakshi','Divya','Aryan','Dev',
        'Karan','Nikhil','Manish','Sneha','Pallavi','Anjali','Swati','Ritika',
        'Harsh','Pranav','Siddharth','Varun','Dhruv','Akash','Tushar','Gaurav',
        'Kritika','Simran','Jasmine','Zara','Fatima','Aisha','Omar','Ali',
        'Sara','Layla','Arham','Kabir','Rudra','Shaurya','Atharv','Advait',
        'Navya','Tara','Mira','Kiara','Aahana','Pari','Myra','Avni',
        'Mayank','Kunal','Gautam','Mohit','Sahil','Deepak','Rajat','Vishal',
        'Suresh','Ramesh','Pankaj','Rakesh','Vikas','Ashish','Ajay','Vijay',
        'Shivam','Ravi','Arun','Tarun','Ankit','Sumit','Yash','Lakshya',
        'Bhavya','Charu','Dipti','Ekta','Garima','Himani','Isha','Jaya',
        'Komal','Lavanya','Mansi','Nandini','Ojasvi','Payal','Riddhi','Suhani'
    ];

    const lastNames = [
        'Sharma','Patel','Singh','Kumar','Gupta','Verma','Reddy','Joshi',
        'Iyer','Nair','Malhotra','Kapoor','Mehta','Chopra','Bhat','Desai',
        'Khan','Roy','Das','Mishra','Chauhan','Yadav','Pandey','Saxena',
        'Agarwal','Banerjee','Mukherjee','Chatterjee','Sen','Ghosh',
        'Tiwari','Dubey','Srivastava','Thakur','Kulkarni','Patil',
        'Kashyap','Tackwal','Rawat','Bhatt'
    ];

    const semesters = [1, 2, 3, 4, 5, 6];
    const admissionYears = [22, 23, 24];
    const usedNames = new Set();
    let globalIdx = 0;

    const courseData = [
        { id: 'bba', code: 'BBA', department: 'Business Administration', count: 250 },
        { id: 'bcom', code: 'BCOM', department: 'Commerce', count: 250 },
        { id: 'bca', code: 'BCA', department: 'Computer Applications', count: 150 },
        { id: 'btech', code: 'BTCSE', department: 'Computer Science & Engineering', count: 250 }
    ];

    const insertStmt = db.prepare('INSERT OR IGNORE INTO students (id, name, roll_number, erp_id, exam_id, department, semester, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    for (const course of courseData) {
        const admYear = admissionYears[Math.floor(Math.random() * admissionYears.length)];

        for (let i = 0; i < course.count; i++) {
            let firstName, lastName, fullName;
            let attempts = 0;
            do {
                firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
                lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
                fullName = `${firstName} ${lastName}`;
                attempts++;
                if (attempts > 200) {
                    fullName = `${firstName} ${lastName} ${globalIdx}`;
                    break;
                }
            } while (usedNames.has(fullName));
            usedNames.add(fullName);

            const seqId = String(100 + i).padStart(4, '0');
            const erpId = `${admYear}${course.code}${seqId}`;
            const rollNumber = `${course.code}${admYear}${String(i + 1).padStart(3, '0')}`;
            const semester = semesters[Math.floor(Math.random() * semesters.length)];
            const studentId = `STU${1000 + globalIdx}`;
            const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@university.edu`;

            insertStmt.bind([studentId, fullName, rollNumber, erpId, course.id, course.department, semester, email]);
            insertStmt.step();
            insertStmt.reset();
            globalIdx++;
        }
    }
    insertStmt.free();

    // Rooms (4 Buildings × 3 Floors × 3 Rooms = 36)
    const buildings = [
        { num: 1, name: 'Main Building' },
        { num: 2, name: 'SOEC Building' },
        { num: 3, name: 'SOMC Building' },
        { num: 4, name: 'Civil Building' }
    ];
    const floorNames = ['Ground Floor', 'First Floor', 'Second Floor'];

    for (const building of buildings) {
        for (let floor = 0; floor < 3; floor++) {
            for (let room = 1; room <= 3; room++) {
                const classroomNum = 10 + room;
                const roomCode = `${building.num}${floor}${classroomNum}`;
                const roomName = `${building.name} — ${floorNames[floor]} — Room ${roomCode}`;
                db.run('INSERT OR IGNORE INTO rooms (id, name, building, floor, rows, cols) VALUES (?, ?, ?, ?, ?, ?)',
                    [roomCode, roomName, building.name, floor, 5, 5]);
            }
        }
    }

    console.log('✅ Seed complete: 4 courses, 900 students, 36 rooms');
}

// ========================
// Query Helpers
// ========================
function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

function queryOne(sql, params = []) {
    const results = queryAll(sql, params);
    return results.length > 0 ? results[0] : null;
}

function runSql(sql, params = []) {
    db.run(sql, params);
    saveToDisk();
}

// ========================
// Public API
// ========================
function getCourses() {
    return queryAll('SELECT id, name, color_class AS colorClass, department, code, count FROM courses ORDER BY name');
}

function getStudents(filters = {}) {
    let sql = 'SELECT id, name, roll_number AS rollNumber, erp_id AS erpId, exam_id AS examId, department, semester, email FROM students';
    const conditions = [];
    const params = [];

    if (filters.course) {
        conditions.push('exam_id = ?');
        params.push(filters.course);
    }
    if (filters.search) {
        conditions.push('(name LIKE ? OR roll_number LIKE ? OR erp_id LIKE ? OR id LIKE ? OR email LIKE ?)');
        const q = `%${filters.search}%`;
        params.push(q, q, q, q, q);
    }

    if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY name';

    return queryAll(sql, params);
}

function getRooms() {
    return queryAll('SELECT id, name, building, floor, rows, cols FROM rooms ORDER BY name');
}

function getStats() {
    const students = queryOne('SELECT COUNT(*) as count FROM students');
    const coursesResult = queryOne('SELECT COUNT(*) as count FROM courses');
    const roomsResult = queryOne('SELECT COUNT(*) as count FROM rooms');
    return {
        students: students ? students.count : 0,
        courses: coursesResult ? coursesResult.count : 0,
        rooms: roomsResult ? roomsResult.count : 0
    };
}

function addCourse(course) {
    runSql('INSERT OR REPLACE INTO courses (id, name, color_class, department, code, count) VALUES (?, ?, ?, ?, ?, ?)',
        [course.id, course.name, course.colorClass || '', course.department || '', course.code || '', course.count || 0]);
}

function addStudent(student) {
    runSql('INSERT OR REPLACE INTO students (id, name, roll_number, erp_id, exam_id, department, semester, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [student.id, student.name, student.rollNumber || '', student.erpId || '', student.examId || '', student.department || '', student.semester || 1, student.email || '']);
}

function addRoom(room) {
    runSql('INSERT OR REPLACE INTO rooms (id, name, building, floor, rows, cols) VALUES (?, ?, ?, ?, ?, ?)',
        [room.id, room.name, room.building || '', room.floor || 0, room.rows, room.cols]);
}

function bulkInsertStudents(students) {
    const stmt = db.prepare('INSERT OR REPLACE INTO students (id, name, roll_number, erp_id, exam_id, department, semester, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const s of students) {
        stmt.bind([s.id, s.name, s.rollNumber || '', s.erpId || '', s.examId || '', s.department || '', s.semester || 1, s.email || '']);
        stmt.step();
        stmt.reset();
    }
    stmt.free();
    saveToDisk();
}

function bulkInsertRooms(rooms) {
    const stmt = db.prepare('INSERT OR REPLACE INTO rooms (id, name, building, floor, rows, cols) VALUES (?, ?, ?, ?, ?, ?)');
    for (const r of rooms) {
        stmt.bind([r.id, r.name, r.building || '', r.floor || 0, r.rows, r.cols]);
        stmt.step();
        stmt.reset();
    }
    stmt.free();
    saveToDisk();
}

function deleteStudent(id) { runSql('DELETE FROM students WHERE id = ?', [id]); }
function deleteRoom(id) { runSql('DELETE FROM rooms WHERE id = ?', [id]); }
function deleteCourse(id) { runSql('DELETE FROM courses WHERE id = ?', [id]); }
function clearStudents() { runSql('DELETE FROM students'); }
function clearRooms() { runSql('DELETE FROM rooms'); }

function saveAllocation(totalPlaced, totalStudents, assignments) {
    db.run('INSERT INTO allocations (total_placed, total_students) VALUES (?, ?)', [totalPlaced, totalStudents]);
    const allocIdResult = queryOne('SELECT last_insert_rowid() as id');
    const allocId = allocIdResult ? allocIdResult.id : 1;

    const stmt = db.prepare('INSERT INTO allocation_assignments (allocation_id, student_id, room_id, seat_row, seat_col) VALUES (?, ?, ?, ?, ?)');
    for (const a of assignments) {
        stmt.bind([allocId, a.studentId, a.roomId, a.seatRow, a.seatCol]);
        stmt.step();
        stmt.reset();
    }
    stmt.free();
    saveToDisk();
    return allocId;
}

function getLatestAllocation() {
    const alloc = queryOne('SELECT * FROM allocations ORDER BY id DESC LIMIT 1');
    if (!alloc) return null;
    const assignments = queryAll(
        'SELECT student_id AS studentId, room_id AS roomId, seat_row AS seatRow, seat_col AS seatCol FROM allocation_assignments WHERE allocation_id = ?',
        [alloc.id]
    );
    return { ...alloc, assignments };
}

function closeDB() {
    if (db) {
        saveToDisk();
        db.close();
        db = null;
    }
}

module.exports = {
    initDB, closeDB,
    getCourses, getStudents, getRooms, getStats,
    addCourse, addStudent, addRoom,
    bulkInsertStudents, bulkInsertRooms,
    deleteStudent, deleteRoom, deleteCourse,
    clearStudents, clearRooms,
    saveAllocation, getLatestAllocation
};
