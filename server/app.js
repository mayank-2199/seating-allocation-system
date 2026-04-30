/**
 * app.js — Express REST API Server for UniAlign AI
 * Serves the frontend as static files and exposes REST API endpoints.
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const {
    initDB, closeDB,
    getCourses, getStudents, getRooms, getStats,
    addCourse, addStudent, addRoom,
    bulkInsertStudents, bulkInsertRooms,
    deleteStudent, deleteRoom, deleteCourse,
    clearStudents, clearRooms,
    saveAllocation, getLatestAllocation
} = require('./database');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const dbReady = initDB();

app.use('/api', async (req, res, next) => {
    try {
        await dbReady;
        next();
    } catch (err) {
        console.error('Database initialization failed:', err);
        res.status(500).json({ error: 'Database initialization failed' });
    }
});

// Serve frontend static files from parent directory
app.use(express.static(path.join(__dirname, '..')));

// ========================
// API Routes
// ========================

// --- Health ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'UniAlign AI Backend is running', timestamp: new Date().toISOString() });
});

// --- Stats ---
app.get('/api/stats', (req, res) => {
    try {
        const stats = getStats();
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Courses ---
app.get('/api/courses', (req, res) => {
    try {
        const courses = getCourses();
        res.json(courses);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/courses', (req, res) => {
    try {
        const course = req.body;
        if (!course.id || !course.name) {
            return res.status(400).json({ error: 'Course id and name are required' });
        }
        addCourse(course);
        res.json({ success: true, course });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/courses/:id', (req, res) => {
    try {
        deleteCourse(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Students ---
app.get('/api/students', (req, res) => {
    try {
        const filters = {};
        if (req.query.course) filters.course = req.query.course;
        if (req.query.search) filters.search = req.query.search;
        const students = getStudents(filters);
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/students', (req, res) => {
    try {
        const student = req.body;
        if (!student.id || !student.name) {
            return res.status(400).json({ error: 'Student id and name are required' });
        }
        addStudent(student);
        res.json({ success: true, student });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/students/bulk', (req, res) => {
    try {
        const { students, clearExisting } = req.body;
        if (!Array.isArray(students)) {
            return res.status(400).json({ error: 'students must be an array' });
        }
        if (clearExisting) clearStudents();
        bulkInsertStudents(students);
        res.json({ success: true, count: students.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/students/:id', (req, res) => {
    try {
        deleteStudent(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Rooms ---
app.get('/api/rooms', (req, res) => {
    try {
        const rooms = getRooms();
        res.json(rooms);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/rooms', (req, res) => {
    try {
        const room = req.body;
        if (!room.id || !room.name || !room.rows || !room.cols) {
            return res.status(400).json({ error: 'Room id, name, rows, and cols are required' });
        }
        addRoom(room);
        res.json({ success: true, room });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/rooms/bulk', (req, res) => {
    try {
        const { rooms, clearExisting } = req.body;
        if (!Array.isArray(rooms)) {
            return res.status(400).json({ error: 'rooms must be an array' });
        }
        if (clearExisting) clearRooms();
        bulkInsertRooms(rooms);
        res.json({ success: true, count: rooms.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/rooms/:id', (req, res) => {
    try {
        deleteRoom(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Allocations ---
app.post('/api/allocations', (req, res) => {
    try {
        const { totalPlaced, totalStudents, assignments } = req.body;
        if (!assignments || !Array.isArray(assignments)) {
            return res.status(400).json({ error: 'assignments array is required' });
        }
        const allocId = saveAllocation(totalPlaced || 0, totalStudents || 0, assignments);
        res.json({ success: true, allocationId: allocId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/allocations/latest', (req, res) => {
    try {
        const alloc = getLatestAllocation();
        res.json(alloc || { message: 'No allocations found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Bulk Course Update (from file upload) ---
app.post('/api/courses/bulk', (req, res) => {
    try {
        const { courses } = req.body;
        if (!Array.isArray(courses)) {
            return res.status(400).json({ error: 'courses must be an array' });
        }
        for (const c of courses) {
            addCourse(c);
        }
        res.json({ success: true, count: courses.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ========================
// Catch-all: serve index.html for any non-API route (local dev only)
// ========================
if (!process.env.VERCEL) {
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(path.join(__dirname, '..', 'index.html'));
        }
    });
}

// ========================
// Initialize Database & Start Server
// ========================
// On Vercel: export the app as a module (serverless function)
// Locally: start listening on a port
if (process.env.VERCEL) {
    module.exports = app;
} else {
    const PORT = process.env.PORT || 5000;
    dbReady.then(() => app.listen(PORT, () => {
        console.log('');
        console.log('╔══════════════════════════════════════════════╗');
        console.log('║     🎓 UniAlign AI — Backend Server         ║');
        console.log('╠══════════════════════════════════════════════╣');
        console.log(`║  🌐 Frontend:  http://localhost:${PORT}          ║`);
        console.log(`║  🔌 API:       http://localhost:${PORT}/api      ║`);
        console.log('║  💾 Database:  SQLite (server/unialign.db)   ║');
        console.log('╚══════════════════════════════════════════════╝');
        console.log('');
    })).catch((err) => {
        console.error('Failed to start server:', err);
        process.exit(1);
    });

    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        closeDB();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        closeDB();
        process.exit(0);
    });

    module.exports = app;
}
