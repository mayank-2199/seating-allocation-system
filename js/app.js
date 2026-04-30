import { runAllocationOptimization } from './allocator.js';
import { runAIAllocation } from './aiAllocator.js';
import { parseFile, generateCourseMetadata, getStudentTemplateCSV, getRoomTemplateCSV } from './fileParser.js';

// Backend API base URL
const API_BASE = '/api';

let courses = [];
let systemStudents = [];
let systemRooms = [];
let latestAllocationResult = null;
let currentRoomAllocation = null;
let currentSortMode = 'default';
let dragModeEnabled = false;
let dragSourceData = null;
let chartRoomUtil = null;
let chartCourseDist = null;
let userUploadedStudents = false;
let userUploadedRooms = false;

// Default Gemini API key
const DEFAULT_API_KEY = 'AIzaSyCCJ4RBP3Su5kxl95182j2FjGm-lHMgupQ';

// ========================
// Load Data from Backend DB
// ========================
async function loadInitialData() {
    try {
        const [coursesRes, studentsRes, roomsRes] = await Promise.all([
            fetch(`${API_BASE}/courses`),
            fetch(`${API_BASE}/students`),
            fetch(`${API_BASE}/rooms`)
        ]);

        if (coursesRes.ok) courses = await coursesRes.json();
        if (studentsRes.ok) systemStudents = await studentsRes.json();
        if (roomsRes.ok) systemRooms = await roomsRes.json();

        console.log(`✅ Loaded from DB: ${courses.length} courses, ${systemStudents.length} students, ${systemRooms.length} rooms`);
    } catch (err) {
        console.error('❌ Failed to load data from backend:', err);
        showToast('Failed to connect to backend database. Is the server running?', 'error', 8000);
    }
}

// ========================
// Toast Notification System
// ========================
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = {
        success: 'check-circle',
        error: 'alert-circle',
        info: 'info',
        warning: 'alert-triangle'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i data-lucide="${icons[type] || 'info'}"></i><span>${message}</span>`;
    container.appendChild(toast);
    lucide.createIcons({ nodes: [toast] });

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ========================
// DOMContentLoaded
// ========================
document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    // ========================
    // Login Page Setup
    // ========================
    initLoginPage();

    // Load data from backend database
    loadInitialData().then(() => {
        refreshDashboardMetrics();
        populateCourseFilter();
        animateHomeStats();
        try {
            if (typeof Chart !== 'undefined') initCourseDistChart();
        } catch(e) { console.warn('Chart init after data load failed:', e); }
    });

    // ========================
    // View Navigation
    // ========================
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');

            const viewName = target.getAttribute('data-view');
            document.querySelectorAll('.view-section').forEach(v => {
                v.classList.remove('active');
                v.classList.add('hidden');
            });
            
            const activeView = document.getElementById(`view-${viewName}`);
            if (activeView) {
                activeView.classList.remove('hidden');
                activeView.classList.add('active');
            }

            const headings = {
                home: ['Welcome', 'AI-powered seating allocation tool.'],
                dashboard: ['Overview', 'AI-driven seating and logic matrix.'],
                allocation: ['Room Allocation', 'Visualize AI-optimized seating arrangements.'],
                students: ['Student Directory', 'Browse, search, and sort all enrolled students.'],
                data: ['System Data', 'Raw system configuration data.'],
                settings: ['Settings', 'Configure AI API and system parameters.']
            };
            const [title, sub] = headings[viewName] || ['Overview', ''];
            document.querySelector('.topbar .greeting h2').textContent = title;
            document.querySelector('.topbar .greeting .subtitle').textContent = sub;

            if (viewName === 'students') renderStudentDirectory();
            if (viewName === 'dashboard') refreshDashboardMetrics();
            if (viewName === 'home') animateHomeStats();
            if (viewName === 'settings') loadSettingsValues();
            
            // Close mobile sidebar
            closeMobileSidebar();
        });
    });

    // ========================
    // Mobile Sidebar
    // ========================
    document.getElementById('mobile-menu-btn')?.addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('open');
        document.getElementById('sidebar-overlay').classList.toggle('active');
    });

    document.getElementById('sidebar-overlay')?.addEventListener('click', closeMobileSidebar);

    // AI Visualize Sidebar Button
    document.getElementById('ai-visualize-btn')?.addEventListener('click', () => {
        const allocNavBtn = document.querySelector('.nav-item[data-view="allocation"]');
        if (allocNavBtn) allocNavBtn.click();
    });

    // ========================
    // Homepage Setup
    // ========================
    initHomePage();

    // ========================
    // AI Optimization Button
    // ========================
    document.getElementById('run-ai-btn').addEventListener('click', handleRunAI);
    
    // ========================
    // Room Selector
    // ========================
    document.getElementById('room-selector').addEventListener('change', (e) => {
        const roomId = e.target.value;
        if (!roomId || !latestAllocationResult) return;
        const alloc = latestAllocationResult.allocations.find(a => a.room.id === roomId);
        if (alloc) {
            currentRoomAllocation = alloc;
            renderRoomGrid(alloc);
        }
    });

    // Sort Selector
    document.getElementById('sort-selector').addEventListener('change', (e) => {
        currentSortMode = e.target.value;
        if (currentRoomAllocation) renderRoomGrid(currentRoomAllocation);
    });

    // ========================
    // Room Search
    // ========================
    document.getElementById('room-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        document.querySelectorAll('.desk.occupied').forEach(desk => {
            desk.classList.remove('highlight-match');
        });
        if (!query) return;
        document.querySelectorAll('.desk.occupied').forEach(desk => {
            const id = desk.dataset.studentId || '';
            const name = desk.dataset.studentName || '';
            const roll = desk.dataset.studentRoll || '';
            const erp = desk.dataset.studentErp || '';
            if (id.toLowerCase().includes(query) || name.toLowerCase().includes(query) ||
                roll.toLowerCase().includes(query) || erp.toLowerCase().includes(query)) {
                desk.classList.add('highlight-match');
            }
        });
    });

    // ========================
    // Drag Mode Toggle
    // ========================
    document.getElementById('drag-mode-toggle').addEventListener('change', (e) => {
        dragModeEnabled = e.target.checked;
        if (currentRoomAllocation) renderRoomGrid(currentRoomAllocation);
    });

    // ========================
    // Student Directory Events
    // ========================
    document.getElementById('student-search').addEventListener('input', () => renderStudentDirectory());
    document.getElementById('student-sort-selector').addEventListener('change', () => renderStudentDirectory());
    document.getElementById('student-filter-course').addEventListener('change', () => renderStudentDirectory());

    document.querySelectorAll('.sortable-th').forEach(th => {
        th.addEventListener('click', () => {
            const sortKey = th.dataset.sort;
            const selector = document.getElementById('student-sort-selector');
            const mapping = { name: 'alpha', roll: 'roll', erp: 'erp', course: 'course' };
            const base = mapping[sortKey] || sortKey;
            selector.value = (selector.value === base) ? base + '-desc' : base;
            renderStudentDirectory();
        });
    });

    // ========================
    // Modal Close
    // ========================
    document.getElementById('close-modal').addEventListener('click', () => {
        document.getElementById('student-modal').classList.add('hidden');
    });
    
    document.getElementById('student-modal').addEventListener('click', (e) => {
        if (e.target.id === 'student-modal') e.target.classList.add('hidden');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.getElementById('student-modal').classList.add('hidden');
    });

    // Tooltip hide on scroll
    document.querySelector('.main-content').addEventListener('scroll', hideTooltip);

    // ========================
    // PDF Export Buttons
    // ========================
    document.getElementById('export-room-pdf').addEventListener('click', () => {
        if (!currentRoomAllocation) { alert('Please select a room first.'); return; }
        exportRoomPDF(currentRoomAllocation);
    });

    document.getElementById('export-all-pdf').addEventListener('click', () => {
        if (!latestAllocationResult) { alert('Please run AI Optimization first.'); return; }
        exportAllRoomsPDF();
    });

    document.getElementById('export-directory-pdf').addEventListener('click', () => {
        exportStudentDirectoryPDF();
    });

    // ========================
    // Excel Export Buttons
    // ========================
    document.getElementById('export-room-excel').addEventListener('click', () => {
        if (!currentRoomAllocation) { alert('Please select a room first.'); return; }
        exportRoomExcel(currentRoomAllocation);
    });

    document.getElementById('export-all-excel').addEventListener('click', () => {
        if (!latestAllocationResult) { alert('Please run AI Optimization first.'); return; }
        exportAllRoomsExcel();
    });

    document.getElementById('export-directory-excel').addEventListener('click', () => {
        exportStudentDirectoryExcel();
    });

    // ========================
    // CSV Export Buttons
    // ========================
    document.getElementById('export-room-csv').addEventListener('click', () => {
        if (!currentRoomAllocation) { alert('Please select a room first.'); return; }
        exportRoomCSV(currentRoomAllocation);
    });

    document.getElementById('export-all-csv').addEventListener('click', () => {
        if (!latestAllocationResult) { alert('Please run AI Optimization first.'); return; }
        exportAllRoomsCSV();
    });

    document.getElementById('export-directory-csv').addEventListener('click', () => {
        exportStudentDirectoryCSV();
    });

    // ========================
    // Print Seating Chart
    // ========================
    document.getElementById('print-seating-chart').addEventListener('click', () => {
        if (!currentRoomAllocation) { alert('Please select a room first.'); return; }
        generatePrintChart(currentRoomAllocation);
        setTimeout(() => window.print(), 300);
    });

    // ========================
    // Settings Events
    // ========================
    initSettingsPage();

    // Charts and stats animation are handled after loadInitialData() resolves
});

// ========================
// Homepage Initialization
// ========================
function initHomePage() {
    // Get Started button → navigate to Dashboard
    document.getElementById('home-get-started')?.addEventListener('click', () => {
        const dashNav = document.querySelector('.nav-item[data-view="dashboard"]');
        if (dashNav) dashNav.click();
    });

    // Learn More button → scroll to features (or just show info)
    document.getElementById('home-learn-more')?.addEventListener('click', () => {
        const featuresSection = document.querySelector('.home-features');
        if (featuresSection) featuresSection.scrollIntoView({ behavior: 'smooth' });
    });

    // Proceed to Dashboard (after upload)
    document.getElementById('proceed-to-dashboard')?.addEventListener('click', () => {
        const dashNav = document.querySelector('.nav-item[data-view="dashboard"]');
        if (dashNav) dashNav.click();
    });

    // ========================
    // Drag & Drop File Upload
    // ========================
    setupUploadZone('student-upload-zone', 'student-file-input', 'students');
    setupUploadZone('room-upload-zone', 'room-file-input', 'rooms');

    // Template downloads
    document.getElementById('download-student-template')?.addEventListener('click', () => {
        downloadCSV(getStudentTemplateCSV(), 'student_template.csv');
        showToast('Student template downloaded!', 'success');
    });

    document.getElementById('download-room-template')?.addEventListener('click', () => {
        downloadCSV(getRoomTemplateCSV(), 'room_template.csv');
        showToast('Room template downloaded!', 'success');
    });
}

function setupUploadZone(zoneId, inputId, dataType) {
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    if (!zone || !input) return;

    // Click on zone inner to trigger file input
    zone.querySelector('.upload-zone-inner')?.addEventListener('click', () => {
        input.click();
    });

    // Drag events
    zone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        // Only remove if we're leaving the zone itself
        if (!zone.contains(e.relatedTarget)) {
            zone.classList.remove('drag-over');
        }
    });

    zone.addEventListener('drop', async (e) => {
        e.preventDefault();
        zone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            await handleFileUpload(files[0], dataType, zoneId);
        }
    });

    // File input change
    input.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            await handleFileUpload(e.target.files[0], dataType, zoneId);
        }
    });
}

async function handleFileUpload(file, dataType, zoneId) {
    const zone = document.getElementById(zoneId);
    const statusId = dataType === 'students' ? 'student-upload-status' : 'room-upload-status';
    const statusEl = document.getElementById(statusId);

    try {
        const result = await parseFile(file, dataType);

        if (result.errors.length > 0 && result.data.length === 0) {
            // Only errors, no data
            zone.classList.add('upload-error');
            zone.classList.remove('upload-success');
            statusEl.classList.remove('hidden');
            statusEl.innerHTML = `<i data-lucide="alert-circle" class="upload-status-icon error"></i><span class="upload-status-text">${result.errors[0]}</span>`;
            lucide.createIcons({ nodes: [statusEl] });
            showToast(result.errors[0], 'error');
            return;
        }

        // Success
        zone.classList.add('upload-success');
        zone.classList.remove('upload-error');

        if (dataType === 'students') {
            systemStudents = result.data;
            userUploadedStudents = true;

            // Update courses from uploaded data
            if (result.courses && result.courses.length > 0) {
                courses = generateCourseMetadata(result.courses);
                // Update actual counts
                courses.forEach(c => {
                    c.count = systemStudents.filter(s => s.examId === c.id).length;
                });
            }

            // Sync uploaded students to backend database
            try {
                await fetch(`${API_BASE}/students/bulk`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ students: result.data, clearExisting: true })
                });
                if (result.courses && result.courses.length > 0) {
                    await fetch(`${API_BASE}/courses/bulk`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ courses })
                    });
                }
            } catch (syncErr) {
                console.warn('Backend sync failed (students):', syncErr);
            }

            statusEl.classList.remove('hidden');
            statusEl.innerHTML = `<i data-lucide="check-circle" class="upload-status-icon success"></i><span class="upload-status-text">${result.data.length} students loaded from ${file.name}</span>`;
            showToast(`✅ ${result.data.length} students loaded successfully!`, 'success');
        } else {
            systemRooms = result.data;
            userUploadedRooms = true;

            // Sync uploaded rooms to backend database
            try {
                await fetch(`${API_BASE}/rooms/bulk`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rooms: result.data, clearExisting: true })
                });
            } catch (syncErr) {
                console.warn('Backend sync failed (rooms):', syncErr);
            }

            statusEl.classList.remove('hidden');
            statusEl.innerHTML = `<i data-lucide="check-circle" class="upload-status-icon success"></i><span class="upload-status-text">${result.data.length} rooms loaded from ${file.name}</span>`;
            showToast(`✅ ${result.data.length} rooms loaded successfully!`, 'success');
        }

        lucide.createIcons({ nodes: [statusEl] });

        // Show warnings if any
        if (result.errors.length > 0) {
            result.errors.forEach(err => showToast(err, 'warning', 6000));
        }

        updateUploadSummary();
        refreshDashboardMetrics();
        populateCourseFilter();

    } catch (err) {
        zone.classList.add('upload-error');
        showToast(`Failed to process file: ${err.message}`, 'error');
    }
}

function updateUploadSummary() {
    const summary = document.getElementById('upload-summary');
    if (!summary) return;

    document.getElementById('uploaded-student-count').textContent = systemStudents.length;
    document.getElementById('uploaded-room-count').textContent = systemRooms.length;

    if (systemStudents.length > 0 || systemRooms.length > 0) {
        summary.classList.remove('hidden');
    }
}

function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ========================
// Stats Counter Animation
// ========================
function animateHomeStats() {
    document.querySelectorAll('.home-stat-value[data-target]').forEach(el => {
        const target = parseInt(el.dataset.target);
        const suffix = el.dataset.suffix || '';
        const duration = 1500;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(target * eased);
            el.textContent = current + suffix;

            if (progress < 1) {
                requestAnimationFrame(update);
            }
        }

        requestAnimationFrame(update);
    });
}

// ========================
// Dashboard Metrics Refresh
// ========================
function refreshDashboardMetrics() {
    document.getElementById('metric-students').textContent = systemStudents.length;
    document.getElementById('metric-exams').textContent = courses.length;
    document.getElementById('metric-rooms').textContent = systemRooms.length;

    // Populate Data Summary
    const summaryContainer = document.getElementById('data-summary');
    if (summaryContainer) {
        let summaryHTML = '<ul>';
        systemRooms.forEach(r => summaryHTML += `<li><strong>Room:</strong> ${r.name} (${r.rows * r.cols} capacity)</li>`);
        courses.forEach(c => summaryHTML += `<li><strong>Course:</strong> ${c.name} (${c.id})</li>`);
        summaryHTML += `</ul><p class="subtitle" style="margin-top: 1rem">System has ${systemStudents.length} students loaded for allocation.</p>`;
        summaryContainer.innerHTML = summaryHTML;
    }
}

// ========================
// AI Optimization Handler
// ========================
async function handleRunAI() {
    const btn = document.getElementById('run-ai-btn');
    btn.innerHTML = '<i data-lucide="loader" class="spin"></i> Processing...';
    lucide.createIcons();

    try {
        // Use local algorithm
        await new Promise(resolve => setTimeout(resolve, 600));
        const result = runAllocationOptimization(systemStudents, systemRooms);
        showToast('✅ Allocation complete!', 'success');

        latestAllocationResult = result;

        const score = (result.totalPlaced / systemStudents.length) * 100;
        document.getElementById('metric-score').textContent = `${score.toFixed(1)}%`;
        
        const allocList = document.getElementById('allocations-list');
        allocList.innerHTML = '';
        
        result.allocations.forEach(alloc => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <i data-lucide="check-circle" style="color: #10b981;"></i>
                    <div>
                        <strong>${alloc.room.name}</strong>
                        <div style="font-size: 0.85rem; color: var(--text-secondary)">Placed: ${alloc.assignments.length}/${alloc.capacity}</div>
                    </div>
                </div>
                <div style="font-size: 0.85rem; background: rgba(255,255,255,0.05); padding: 0.25rem 0.5rem; border-radius: 4px; display:flex; align-items:center;">
                    ⚡ Optimized | Occupancy: ${alloc.occupancy}%
                </div>
            `;
            allocList.appendChild(li);
        });

        if (result.unallocatedStudents.length > 0) {
            const li = document.createElement('li');
            li.innerHTML = `
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <i data-lucide="alert-triangle" style="color: #f59e0b;"></i>
                    <div>
                        <strong>Unallocated Students</strong>
                        <div style="font-size: 0.85rem; color: var(--text-secondary)">${result.unallocatedStudents.length} students could not be seated.</div>
                    </div>
                </div>`;
            allocList.appendChild(li);
        }

        populateRoomSelector();
        try { updateRoomUtilChart(); } catch(e) { console.warn('Chart update failed:', e); }
        lucide.createIcons();
        
        btn.innerHTML = '<i data-lucide="zap"></i> Optimization Complete';
        setTimeout(() => {
            btn.innerHTML = '<i data-lucide="zap"></i> Run AI Optimization';
            lucide.createIcons();
        }, 3000);

    } catch (err) {
        console.error('Optimization failed:', err);
        showToast(`Optimization failed: ${err.message}`, 'error');
        btn.innerHTML = '<i data-lucide="zap"></i> Run AI Optimization';
        lucide.createIcons();
    }
}

// ========================
// Settings Page
// ========================
function initSettingsPage() {
    // API settings removed — key is hardcoded
}

function showApiStatus(type, message) {
    const statusEl = document.getElementById('api-status');
    if (!statusEl) return;

    statusEl.classList.remove('hidden', 'success', 'error');
    if (type) statusEl.classList.add(type);
    
    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-circle' : 'loader';
    statusEl.innerHTML = `<i data-lucide="${iconName}" ${type === '' ? 'class="spin"' : ''}></i><span id="api-status-text">${message}</span>`;
    lucide.createIcons({ nodes: [statusEl] });
}

// ========================
// Mobile Sidebar
// ========================
function closeMobileSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('active');
}

// ========================
// Room Selector Population
// ========================
function populateRoomSelector() {
    const selector = document.getElementById('room-selector');
    selector.innerHTML = '<option value="">Select Room to Visualize</option>';
    if (!latestAllocationResult) return;
    
    latestAllocationResult.allocations.forEach(alloc => {
        const opt = document.createElement('option');
        opt.value = alloc.room.id;
        opt.textContent = `${alloc.room.name} (${alloc.occupancy}% Full)`;
        selector.appendChild(opt);
    });

    document.getElementById('room-legend').innerHTML = `
        <div class="legend-item"><span class="legend-color empty"></span> Empty Seat</div>
        ${courses.map(c => `<div class="legend-item"><span class="legend-color ${c.colorClass}"></span> ${c.name}</div>`).join('')}
    `;
}

function populateCourseFilter() {
    const selector = document.getElementById('student-filter-course');
    selector.innerHTML = '<option value="">All Courses</option>';
    courses.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        selector.appendChild(opt);
    });
}

// ========================
// Sorting
// ========================
function sortStudents(students, mode) {
    const sorted = [...students];
    switch (mode) {
        case 'alpha': sorted.sort((a, b) => a.name.localeCompare(b.name)); break;
        case 'alpha-desc': sorted.sort((a, b) => b.name.localeCompare(a.name)); break;
        case 'roll': sorted.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber)); break;
        case 'roll-desc': sorted.sort((a, b) => b.rollNumber.localeCompare(a.rollNumber)); break;
        case 'erp': sorted.sort((a, b) => a.erpId.localeCompare(b.erpId)); break;
        case 'erp-desc': sorted.sort((a, b) => b.erpId.localeCompare(a.erpId)); break;
        case 'course': sorted.sort((a, b) => a.examId.localeCompare(b.examId) || a.name.localeCompare(b.name)); break;
    }
    return sorted;
}

// ========================
// Room Grid Renderer
// ========================
function renderRoomGrid(allocation) {
    const container = document.getElementById('room-grid');
    container.innerHTML = '';

    let occupiedStudents = [];
    allocation.grid.forEach((rowArr, rowIdx) => {
        rowArr.forEach((seat, colIdx) => {
            if (seat) occupiedStudents.push({ ...seat, originalRow: rowIdx, originalCol: colIdx });
        });
    });

    if (currentSortMode !== 'default') {
        occupiedStudents = sortStudents(occupiedStudents, currentSortMode);
    }

    const numRows = allocation.room.rows;
    const numCols = allocation.room.cols;
    let studentIdx = 0;

    // Column labels
    const colLabelsDiv = document.createElement('div');
    colLabelsDiv.className = 'col-labels';
    for (let c = 0; c < numCols; c++) {
        const lbl = document.createElement('div');
        lbl.className = 'col-label';
        lbl.textContent = `C${c + 1}`;
        colLabelsDiv.appendChild(lbl);
    }
    container.appendChild(colLabelsDiv);

    for (let r = 0; r < numRows; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'row';

        // Row label
        const rowLabel = document.createElement('div');
        rowLabel.className = 'row-label';
        rowLabel.textContent = `R${r + 1}`;
        rowDiv.appendChild(rowLabel);
        
        for (let c = 0; c < numCols; c++) {
            const deskDiv = document.createElement('div');
            
            let seat = null;
            if (currentSortMode === 'default') {
                seat = allocation.grid[r][c];
            } else {
                if (studentIdx < occupiedStudents.length) {
                    seat = occupiedStudents[studentIdx];
                    studentIdx++;
                }
            }
            
            if (seat) {
                const course = courses.find(co => co.id === seat.examId);
                const colorClass = course ? course.colorClass : '';
                const shortName = seat.name ? seat.name.split(' ')[0] : '';
                
                deskDiv.className = 'desk occupied' + (dragModeEnabled ? ' drag-mode' : '');
                deskDiv.dataset.studentId = seat.id;
                deskDiv.dataset.studentName = seat.name || '';
                deskDiv.dataset.studentRoll = seat.rollNumber || '';
                deskDiv.dataset.studentErp = seat.erpId || '';
                deskDiv.dataset.gridRow = r;
                deskDiv.dataset.gridCol = c;

                deskDiv.innerHTML = `
                    <div class="course-badge ${colorClass}"></div>
                    <span class="student-id">${seat.id}</span>
                    <span class="student-name">${shortName}</span>
                `;
                
                // Click → modal (only if not dragging)
                deskDiv.addEventListener('click', (e) => {
                    if (dragModeEnabled) return;
                    showStudentDetails(seat, course);
                });

                // Hover → tooltip
                deskDiv.addEventListener('mouseenter', (e) => {
                    if (dragModeEnabled) return;
                    showTooltipFn(seat, course, e);
                });
                deskDiv.addEventListener('mousemove', (e) => {
                    if (!dragModeEnabled) positionTooltip(e);
                });
                deskDiv.addEventListener('mouseleave', hideTooltip);

                // Drag and drop
                if (dragModeEnabled) {
                    deskDiv.draggable = true;
                    deskDiv.addEventListener('dragstart', (e) => handleDragStart(e, seat, r, c));
                    deskDiv.addEventListener('dragend', handleDragEnd);
                }
            } else {
                deskDiv.className = 'desk empty';
                deskDiv.dataset.gridRow = r;
                deskDiv.dataset.gridCol = c;
            }

            // Drop target for all desks
            if (dragModeEnabled) {
                deskDiv.addEventListener('dragover', handleDragOver);
                deskDiv.addEventListener('dragleave', handleDragLeave);
                deskDiv.addEventListener('drop', (e) => handleDrop(e, r, c));
            }

            rowDiv.appendChild(deskDiv);
        }
        
        container.appendChild(rowDiv);
    }
}

// ========================
// Drag & Drop
// ========================
function handleDragStart(e, student, row, col) {
    dragSourceData = { student, row, col };
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    hideTooltip();
}

function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    document.querySelectorAll('.desk.drag-over').forEach(d => d.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e, targetRow, targetCol) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    if (!dragSourceData || !currentRoomAllocation) return;

    const { row: srcRow, col: srcCol } = dragSourceData;
    if (srcRow === targetRow && srcCol === targetCol) return;

    // Swap in the allocation grid
    const grid = currentRoomAllocation.grid;
    const temp = grid[targetRow][targetCol];
    grid[targetRow][targetCol] = grid[srcRow][srcCol];
    grid[srcRow][srcCol] = temp;

    // Update assignments
    currentRoomAllocation.assignments = [];
    grid.forEach((rowArr, ri) => {
        rowArr.forEach((seat, ci) => {
            if (seat) {
                currentRoomAllocation.assignments.push({
                    studentId: seat.id,
                    examId: seat.examId,
                    row: ri,
                    col: ci
                });
            }
        });
    });

    dragSourceData = null;
    renderRoomGrid(currentRoomAllocation);
}

// ========================
// Tooltip
// ========================
function showTooltipFn(student, course, event) {
    const tooltip = document.getElementById('student-tooltip');
    const initials = student.name ? student.name.split(' ').map(n => n[0]).join('').toUpperCase() : student.id.substring(0, 2);

    document.getElementById('tooltip-avatar').textContent = initials;
    document.getElementById('tooltip-name').textContent = student.name || student.id;
    document.getElementById('tooltip-id').textContent = student.id;
    document.getElementById('tooltip-roll').textContent = student.rollNumber || '--';
    document.getElementById('tooltip-erp').textContent = student.erpId || '--';
    document.getElementById('tooltip-course').textContent = course ? course.name : student.examId;
    document.getElementById('tooltip-semester').textContent = student.semester ? `Sem ${student.semester}` : '--';
    document.getElementById('tooltip-department').textContent = student.department || '--';
    
    tooltip.classList.remove('hidden');
    positionTooltip(event);
}

function positionTooltip(event) {
    const tooltip = document.getElementById('student-tooltip');
    const rect = tooltip.getBoundingClientRect();
    const pad = 16;
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    if (x + rect.width > window.innerWidth - pad) x = event.clientX - rect.width - pad;
    if (y + rect.height > window.innerHeight - pad) y = event.clientY - rect.height - pad;
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
}

function hideTooltip() {
    document.getElementById('student-tooltip').classList.add('hidden');
}

// ========================
// Modal
// ========================
function showStudentDetails(student, course) {
    const initials = student.name ? student.name.split(' ').map(n => n[0]).join('').toUpperCase() : student.id.substring(0, 2);
    document.getElementById('modal-avatar').textContent = initials;
    document.getElementById('modal-student-name').textContent = student.name || student.id;
    document.getElementById('modal-student-email').textContent = student.email || '';
    document.getElementById('modal-student-id').textContent = student.id;
    document.getElementById('modal-student-roll').textContent = student.rollNumber || '--';
    document.getElementById('modal-student-erp').textContent = student.erpId || '--';
    document.getElementById('modal-student-exam').textContent = course ? course.name : student.examId;
    document.getElementById('modal-student-dept').textContent = student.department || '--';
    document.getElementById('modal-student-sem').textContent = student.semester ? `Semester ${student.semester}` : '--';
    document.getElementById('modal-student-email-detail').textContent = student.email || '--';
    document.getElementById('student-modal').classList.remove('hidden');
}

// ========================
// Student Directory
// ========================
function renderStudentDirectory() {
    const searchQuery = document.getElementById('student-search').value.toLowerCase().trim();
    const sortMode = document.getElementById('student-sort-selector').value;
    const courseFilter = document.getElementById('student-filter-course').value;

    let filtered = [...systemStudents];
    if (courseFilter) filtered = filtered.filter(s => s.examId === courseFilter);
    if (searchQuery) {
        filtered = filtered.filter(s =>
            s.name.toLowerCase().includes(searchQuery) ||
            s.rollNumber.toLowerCase().includes(searchQuery) ||
            s.erpId.toLowerCase().includes(searchQuery) ||
            s.id.toLowerCase().includes(searchQuery) ||
            (s.email || '').toLowerCase().includes(searchQuery)
        );
    }
    filtered = sortStudents(filtered, sortMode);

    const allocationMap = {};
    if (latestAllocationResult) {
        latestAllocationResult.allocations.forEach(alloc => {
            alloc.assignments.forEach(a => {
                allocationMap[a.studentId] = { roomName: alloc.room.name, row: a.row + 1, col: a.col + 1 };
            });
        });
    }

    document.getElementById('student-count-label').textContent = `${filtered.length} student${filtered.length !== 1 ? 's' : ''}`;
    const tbody = document.getElementById('student-table-body');

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="no-results">No students match your search criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(student => {
        const course = courses.find(c => c.id === student.examId);
        const colorClass = course ? course.colorClass : '';
        const alloc = allocationMap[student.id];
        return `
            <tr data-student-id="${student.id}">
                <td>
                    <div style="display:flex; align-items:center; gap:0.6rem;">
                        <div style="width:30px; height:30px; border-radius:50%; background:linear-gradient(135deg, var(--accent-primary), var(--accent-secondary)); display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700; color:white; flex-shrink:0;">
                            ${student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </div>
                        <div>
                            <div style="font-weight:500;">${student.name}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${student.id}</div>
                        </div>
                    </div>
                </td>
                <td>${student.rollNumber}</td>
                <td>${student.erpId}</td>
                <td><span class="course-pill"><span class="pill-dot ${colorClass}"></span>${course ? course.name : student.examId}</span></td>
                <td>Sem ${student.semester}</td>
                <td>${alloc ? alloc.roomName : '<span style="color:var(--text-muted)">--</span>'}</td>
                <td>${alloc ? `<span class="seat-badge">R${alloc.row} C${alloc.col}</span>` : '<span style="color:var(--text-muted)">--</span>'}</td>
            </tr>`;
    }).join('');

    tbody.querySelectorAll('tr[data-student-id]').forEach(row => {
        row.addEventListener('click', () => {
            const student = systemStudents.find(s => s.id === row.dataset.studentId);
            if (student) showStudentDetails(student, courses.find(c => c.id === student.examId));
        });
    });

    lucide.createIcons();
}

// ========================
// Charts
// ========================
function initCourseDistChart() {
    const ctx = document.getElementById('chart-course-dist').getContext('2d');
    const courseCounts = courses.map(c => systemStudents.filter(s => s.examId === c.id).length);
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];

    chartCourseDist = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: courses.map(c => c.name),
            datasets: [{
                data: courseCounts,
                backgroundColor: colors.slice(0, courses.length),
                borderColor: 'rgba(10, 10, 15, 0.8)',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 11 },
                        padding: 12,
                        usePointStyle: true,
                        pointStyleWidth: 10
                    }
                }
            },
            cutout: '55%'
        }
    });
}

function updateRoomUtilChart() {
    document.getElementById('chart-room-empty').classList.add('hidden');
    const ctx = document.getElementById('chart-room-util').getContext('2d');

    if (chartRoomUtil) chartRoomUtil.destroy();

    const labels = latestAllocationResult.allocations.map(a => a.room.name);
    const placed = latestAllocationResult.allocations.map(a => a.assignments.length);
    const empty = latestAllocationResult.allocations.map(a => a.capacity - a.assignments.length);

    chartRoomUtil = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Occupied',
                    data: placed,
                    backgroundColor: '#6366f1',
                    borderRadius: 6,
                    barPercentage: 0.6
                },
                {
                    label: 'Empty',
                    data: empty,
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 6,
                    barPercentage: 0.6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#94a3b8',
                        font: { family: 'Outfit', size: 11 },
                        padding: 12,
                        usePointStyle: true,
                        pointStyleWidth: 10
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: { color: '#64748b', font: { family: 'Outfit', size: 11 } },
                    grid: { display: false }
                },
                y: {
                    stacked: true,
                    ticks: { color: '#64748b', font: { family: 'Outfit', size: 11 } },
                    grid: { color: 'rgba(255,255,255,0.05)' }
                }
            }
        }
    });
}

// ========================
// Print-Friendly Chart
// ========================
function generatePrintChart(allocation) {
    const container = document.getElementById('print-container');
    const room = allocation.room;
    const grid = allocation.grid;
    const courseColors = { 'course_c1': '#ef4444', 'course_c2': '#3b82f6', 'course_c3': '#10b981', 'course_c4': '#f59e0b' };

    let html = `
        <div class="print-header">
            <h1>Seating Chart — ${room.name}</h1>
            <p>Room ID: ${room.id} | 2D Matrix: ${room.rows}×${room.cols} | Capacity: ${room.rows * room.cols} | Occupancy: ${allocation.occupancy}% | Generated: ${new Date().toLocaleString()}</p>
        </div>
        <div class="print-grid print-grid-matrix">
    `;

    grid.forEach((rowArr) => {
        html += `<div class="print-row print-row-matrix">`;
        rowArr.forEach(seat => {
            if (seat) {
                const course = courses.find(c => c.id === seat.examId);
                const colorVar = course ? course.colorClass.replace('badge', '') : '';
                const bgColor = colorVar ? (courseColors[colorVar.replace('-', '_')] || '#ddd') : '#ddd';
                html += `
                    <div class="print-seat" style="border-left: 4px solid ${bgColor};">
                        <div class="p-name">${seat.name || seat.id}</div>
                        <div class="p-roll">${seat.rollNumber || seat.id}</div>
                        <div class="p-course">${course ? course.name : seat.examId}</div>
                    </div>`;
            } else {
                html += '<div class="print-seat empty">Empty</div>';
            }
        });
        html += '</div>';
    });

    html += '</div>';

    // Legend
    html += '<div class="print-legend">';
    const legendColors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'];
    courses.forEach((c, i) => {
        html += `<span><span class="print-legend-dot" style="background:${legendColors[i % legendColors.length]}"></span>${c.name}</span>`;
    });
    html += '</div>';

    html += `<div class="print-footer">UniAlign AI — AI Driven University Seating & Room Allocation System</div>`;
    container.innerHTML = html;
}

// ========================
// PDF Export Functions
// ========================
function getFormattedDate() {
    return new Date().toLocaleDateString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function createPDFDoc(title, orientation = 'portrait') {
    if (!window.jspdf || !window.jspdf.jsPDF) {
        throw new Error('jsPDF library not loaded. Please check your internet connection and refresh the page.');
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
    doc.setFillColor(30, 30, 45);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), 28, 'F');
    doc.setFillColor(99, 102, 241);
    doc.rect(0, 28, doc.internal.pageSize.getWidth(), 1.5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text(title, 14, 18);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 180, 200);
    doc.text(`Generated: ${getFormattedDate()}  |  UniAlign AI`, 14, 24);
    return doc;
}

function getAutoTableStyles() {
    return {
        headStyles: { fillColor: [40, 40, 60], textColor: [248, 250, 252], fontStyle: 'bold', fontSize: 9, halign: 'left', cellPadding: 3 },
        bodyStyles: { textColor: [30, 30, 50], fontSize: 8.5, cellPadding: 2.5 },
        alternateRowStyles: { fillColor: [240, 242, 248] },
        styles: { lineColor: [200, 200, 220], lineWidth: 0.3, font: 'helvetica' },
        margin: { top: 36, left: 14, right: 14 },
        tableLineColor: [200, 200, 220],
        tableLineWidth: 0.3
    };
}

function addPageFooter(doc) {
    const pc = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pc; i++) {
        doc.setPage(i);
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();
        doc.setDrawColor(200, 200, 220);
        doc.setLineWidth(0.3);
        doc.line(14, h - 12, w - 14, h - 12);
        doc.setFontSize(8);
        doc.setTextColor(130, 130, 150);
        doc.text('UniAlign AI — AI Driven University Seating & Room Allocation System', 14, h - 7);
        doc.text(`Page ${i} of ${pc}`, w - 14, h - 7, { align: 'right' });
    }
}

function generateQRDataURL(text) {
    try {
        if (typeof qrcode === 'undefined') return null;
        const qr = qrcode(0, 'L');
        qr.addData(text);
        qr.make();
        return qr.createDataURL(4, 0);
    } catch (err) {
        console.warn('QR generation failed:', err);
        return null;
    }
}

function drawSeatingGrid(doc, allocation, startY) {
    const grid = allocation.grid;
    const room = allocation.room;
    const pageW = doc.internal.pageSize.getWidth();
    const courseColorMap = {};
    const defaultColors = [[239,68,68],[59,130,246],[16,185,129],[245,158,11],[139,92,246],[6,182,212],[249,115,22],[132,204,22]];
    courses.forEach((c, i) => { courseColorMap[c.id] = defaultColors[i % defaultColors.length]; });

    // Calculate cell size to fit the page
    const availableW = pageW - 44;
    const cellW = Math.min(Math.floor(availableW / room.cols), 26);
    const cellH = 18;
    const labelW = 14;
    const gridStartX = 14 + labelW + 2;
    let y = startY;

    // Grid title
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 50);
    doc.text('SEATING ARRANGEMENT MAP', 14, y);
    y += 6;

    // Column headers
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 100, 120);
    for (let c = 0; c < room.cols; c++) {
        const cx = gridStartX + (c * cellW) + cellW / 2;
        doc.text(`Col ${c + 1}`, cx, y, { align: 'center' });
    }
    y += 4;

    // Draw grid rows
    for (let r = 0; r < room.rows; r++) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 120);
        doc.text(`R${r + 1}`, 14 + labelW / 2, y + cellH / 2 + 1, { align: 'center' });

        for (let c = 0; c < room.cols; c++) {
            const seat = grid[r][c];
            const cx = gridStartX + (c * cellW);

            if (seat) {
                const color = courseColorMap[seat.examId] || [150, 150, 150];

                doc.setFillColor(color[0], color[1], color[2]);
                doc.rect(cx, y, 2.5, cellH, 'F');

                doc.setFillColor(248, 249, 252);
                doc.rect(cx + 2.5, y, cellW - 2.5, cellH, 'F');

                doc.setDrawColor(200, 200, 215);
                doc.setLineWidth(0.3);
                doc.rect(cx, y, cellW, cellH, 'S');

                const shortName = (seat.name || seat.id).length > 10
                    ? (seat.name || seat.id).substring(0, 10) + '..'
                    : (seat.name || seat.id);
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(30, 30, 50);
                doc.text(shortName, cx + 3.5, y + 6);

                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(100, 100, 120);
                doc.text(seat.rollNumber || seat.id, cx + 3.5, y + 10.5);

                const courseShort = seat.examId.toUpperCase().replace(/(_)/g, ' ');
                doc.setFontSize(5);
                doc.setTextColor(color[0], color[1], color[2]);
                doc.text(courseShort, cx + 3.5, y + 14.5);
            } else {
                doc.setFillColor(240, 240, 240);
                doc.rect(cx, y, cellW, cellH, 'F');
                doc.setDrawColor(215, 215, 225);
                doc.setLineWidth(0.2);
                doc.rect(cx, y, cellW, cellH, 'S');

                doc.setFontSize(6);
                doc.setTextColor(180, 180, 190);
                doc.text('Empty', cx + cellW / 2, y + cellH / 2 + 1, { align: 'center' });
            }
        }
        y += cellH + 1;
    }

    // Legend below grid
    y += 4;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 100);
    doc.text('LEGEND:', 14, y);
    let legendX = 34;
    courses.forEach(c => {
        const color = courseColorMap[c.id] || [150, 150, 150];
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(legendX, y - 3, 4, 4, 'F');
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 80);
        doc.text(c.name, legendX + 6, y);
        legendX += doc.getTextWidth(c.name) + 12;
    });

    return y + 6;
}

function drawQRVerification(doc, allocation, students, yStart) {
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    let y = yStart;
    if (y > pageH - 55) {
        doc.addPage();
        y = 20;
    }

    doc.setFillColor(245, 246, 252);
    doc.roundedRect(14, y, pageW - 28, 45, 3, 3, 'F');
    doc.setDrawColor(99, 102, 241);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, y, pageW - 28, 45, 3, 3, 'S');

    doc.setFillColor(99, 102, 241);
    doc.roundedRect(18, y + 4, 8, 8, 1, 1, 'F');
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);
    doc.text('✓', 22, y + 9.5, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 60);
    doc.text('VERIFICATION & AUTHENTICITY', 30, y + 10);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 100);

    const details = [
        `Room: ${allocation.room.name} (${allocation.room.id})`,
        `Layout: ${allocation.room.rows} rows x ${allocation.room.cols} columns = ${allocation.capacity} seats`,
        `Students Placed: ${students.length} / ${allocation.capacity} (${allocation.occupancy}% occupancy)`,
        `Generated: ${new Date().toLocaleString('en-IN')}`,
        `Document ID: SA-${allocation.room.id}-${Date.now().toString(36).toUpperCase()}`
    ];

    details.forEach((d, i) => {
        doc.text(d, 20, y + 18 + (i * 5));
    });

    try {
        const docId = `SA-${allocation.room.id}-${Date.now().toString(36).toUpperCase()}`;
        const qrPayload = JSON.stringify({
            system: 'UniAlignAI',
            room: allocation.room.name,
            roomId: allocation.room.id,
            capacity: allocation.capacity,
            placed: students.length,
            occupancy: `${allocation.occupancy}%`,
            date: new Date().toISOString(),
            docId: docId,
            courses: [...new Set(students.map(s => s.examId))].join(',')
        });
        const qrImg = generateQRDataURL(qrPayload);
        if (qrImg) {
            doc.addImage(qrImg, 'PNG', pageW - 52, y + 4, 30, 30);
            doc.setFontSize(6);
            doc.setTextColor(99, 102, 241);
            doc.setFont('helvetica', 'bold');
            doc.text('SCAN TO VERIFY', pageW - 37, y + 37, { align: 'center' });
            doc.setFontSize(5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(130, 130, 150);
            doc.text('Authenticity Check', pageW - 37, y + 41, { align: 'center' });
        }
    } catch (qrErr) { console.warn('QR skipped:', qrErr); }

    return y + 50;
}

function exportRoomPDF(allocation) {
    try {
        const doc = createPDFDoc(`Room Allocation: ${allocation.room.name}`);
        const sortMode = document.getElementById('sort-selector').value;

        let students = [];
        allocation.grid.forEach((rowArr, rowIdx) => {
            rowArr.forEach((seat, colIdx) => {
                if (seat) students.push({ ...seat, seatRow: rowIdx + 1, seatCol: colIdx + 1 });
            });
        });
        if (sortMode !== 'default') students = sortStudents(students, sortMode);

        doc.setFontSize(9);
        doc.setTextColor(60, 60, 80);
        doc.text(`Room: ${allocation.room.name}  •  Capacity: ${allocation.capacity} seats  •  Occupancy: ${allocation.occupancy}%  •  ${students.length} students placed`, 14, 34);

        let afterGridY = drawSeatingGrid(doc, allocation, 40);
        afterGridY = drawQRVerification(doc, allocation, students, afterGridY);

        if (afterGridY > doc.internal.pageSize.getHeight() - 60) {
            doc.addPage();
            doc.setFillColor(30, 30, 45);
            doc.rect(0, 0, doc.internal.pageSize.getWidth(), 22, 'F');
            doc.setFillColor(99, 102, 241);
            doc.rect(0, 22, doc.internal.pageSize.getWidth(), 1.5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(`Student Details — ${allocation.room.name}`, 14, 15);
            afterGridY = 30;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 50);
        doc.text('DETAILED STUDENT LIST', 14, afterGridY + 4);

        const tableData = students.map((s, idx) => {
            const course = courses.find(c => c.id === s.examId);
            return [idx + 1, s.name || '--', s.id, s.rollNumber || '--', s.erpId || '--',
                course ? course.name : s.examId, s.department || '--', `Sem ${s.semester || '--'}`, `R${s.seatRow} C${s.seatCol}`];
        });

        doc.autoTable({
            head: [['#', 'Name', 'Student ID', 'Roll No.', 'ERP ID', 'Course', 'Department', 'Semester', 'Seat']],
            body: tableData,
            ...getAutoTableStyles(),
            startY: afterGridY + 7,
            margin: { top: 14, left: 14, right: 14 }
        });

        addPageFooter(doc);
        doc.save(`Seating_${allocation.room.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('Room PDF exported successfully!', 'success');
    } catch (err) {
        console.error('Export Room PDF failed:', err);
        alert('PDF export failed: ' + err.message);
    }
}

function exportAllRoomsPDF() {
    try {
        const doc = createPDFDoc('Complete Seating Allocation Report', 'landscape');
        let isFirst = true;

        latestAllocationResult.allocations.forEach(allocation => {
            let students = [];
            allocation.grid.forEach((rowArr, rowIdx) => {
                rowArr.forEach((seat, colIdx) => {
                    if (seat) students.push({ ...seat, seatRow: rowIdx + 1, seatCol: colIdx + 1 });
                });
            });

            if (!isFirst) doc.addPage();
            isFirst = false;

            const pageW = doc.internal.pageSize.getWidth();

            if (doc.internal.getCurrentPageInfo().pageNumber > 1) {
                doc.setFillColor(30, 30, 45);
                doc.rect(0, 0, pageW, 28, 'F');
                doc.setFillColor(99, 102, 241);
                doc.rect(0, 28, pageW, 1.5, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.text(`Room: ${allocation.room.name}`, 14, 18);
                doc.setFontSize(9);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(180, 180, 200);
                doc.text(`Capacity: ${allocation.capacity}  |  Occupancy: ${allocation.occupancy}%  |  Students: ${students.length}`, 14, 24);
            }

            let afterGridY = drawSeatingGrid(doc, allocation, 36);
            afterGridY = drawQRVerification(doc, allocation, students, afterGridY);

            doc.addPage();
            doc.setFillColor(30, 30, 45);
            doc.rect(0, 0, pageW, 22, 'F');
            doc.setFillColor(99, 102, 241);
            doc.rect(0, 22, pageW, 1.5, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.text(`Student Details - ${allocation.room.name}`, 14, 15);

            const tableData = students.map((s, idx) => {
                const course = courses.find(c => c.id === s.examId);
                return [idx + 1, s.name || '--', s.id, s.rollNumber || '--', s.erpId || '--',
                    course ? course.name : s.examId, s.department || '--', `Sem ${s.semester || '--'}`, `R${s.seatRow} C${s.seatCol}`];
            });

            doc.autoTable({
                head: [['#', 'Name', 'Student ID', 'Roll No.', 'ERP ID', 'Course', 'Department', 'Sem', 'Seat']],
                body: tableData,
                ...getAutoTableStyles(),
                startY: 28,
                margin: { top: 28, left: 14, right: 14 }
            });
        });

        // Summary page
        doc.addPage();
        const pageW = doc.internal.pageSize.getWidth();
        doc.setFillColor(30, 30, 45);
        doc.rect(0, 0, pageW, 28, 'F');
        doc.setFillColor(99, 102, 241);
        doc.rect(0, 28, pageW, 1.5, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('Allocation Summary', 14, 18);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(180, 180, 200);
        doc.text(`Generated: ${getFormattedDate()}`, 14, 24);

        const summaryData = latestAllocationResult.allocations.map(a => [
            a.room.name, a.room.id, a.capacity.toString(), a.assignments.length.toString(), `${a.occupancy}%`
        ]);
        summaryData.push(['TOTAL', '--',
            latestAllocationResult.allocations.reduce((s, a) => s + a.capacity, 0).toString(),
            latestAllocationResult.totalPlaced.toString(),
            `${((latestAllocationResult.totalPlaced / systemStudents.length) * 100).toFixed(1)}%`
        ]);

        doc.autoTable({
            head: [['Room', 'Room ID', 'Capacity', 'Placed', 'Occupancy']],
            body: summaryData,
            ...getAutoTableStyles(),
            margin: { top: 36, left: 14, right: 14 }
        });

        if (latestAllocationResult.unallocatedStudents.length > 0) {
            try {
                doc.setFontSize(10);
                doc.setTextColor(200, 50, 50);
                const yPos = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 100;
                doc.text(`Warning: ${latestAllocationResult.unallocatedStudents.length} student(s) could not be allocated.`, 14, yPos);
            } catch (e) { /* skip */ }
        }

        try {
            const sumFinalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 15 : 100;
            const qrPayload = JSON.stringify({
                system: 'UniAlignAI',
                report: 'Complete Allocation',
                totalStudents: systemStudents.length,
                totalPlaced: latestAllocationResult.totalPlaced,
                rooms: latestAllocationResult.allocations.map(a => a.room.name).join(', '),
                date: new Date().toISOString()
            });
            const qrImg = generateQRDataURL(qrPayload);
            if (qrImg) {
                doc.setFillColor(245, 246, 252);
                doc.roundedRect(14, sumFinalY, pageW - 28, 35, 3, 3, 'F');
                doc.setDrawColor(99, 102, 241);
                doc.setLineWidth(0.5);
                doc.roundedRect(14, sumFinalY, pageW - 28, 35, 3, 3, 'S');

                doc.addImage(qrImg, 'PNG', 20, sumFinalY + 3, 28, 28);

                doc.setFontSize(9);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(40, 40, 60);
                doc.text('REPORT VERIFICATION', 54, sumFinalY + 12);
                doc.setFontSize(7.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(80, 80, 100);
                doc.text('Scan QR code to verify the authenticity of this allocation report.', 54, sumFinalY + 19);
                doc.text(`Document generated on ${getFormattedDate()} by UniAlign AI.`, 54, sumFinalY + 25);
            }
        } catch (qrErr) { console.warn('Summary QR skipped:', qrErr); }

        addPageFooter(doc);
        doc.save(`Complete_Seating_Allocation_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('Complete PDF exported successfully!', 'success');
    } catch (err) {
        console.error('Export All PDF failed:', err);
        alert('PDF export failed. Check browser console for details.');
    }
}

function exportStudentDirectoryPDF() {
    try {
        const search = document.getElementById('student-search').value.toLowerCase().trim();
        const sortMode = document.getElementById('student-sort-selector').value;
        const courseFilter = document.getElementById('student-filter-course').value;

        let filtered = [...systemStudents];
        if (courseFilter) filtered = filtered.filter(s => s.examId === courseFilter);
        if (search) {
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(search) || s.rollNumber.toLowerCase().includes(search) ||
                s.erpId.toLowerCase().includes(search) || s.id.toLowerCase().includes(search) ||
                (s.email || '').toLowerCase().includes(search)
            );
        }
        filtered = sortStudents(filtered, sortMode);

        const allocationMap = {};
        if (latestAllocationResult) {
            latestAllocationResult.allocations.forEach(alloc => {
                alloc.assignments.forEach(a => {
                    allocationMap[a.studentId] = { roomName: alloc.room.name, row: a.row + 1, col: a.col + 1 };
                });
            });
        }

        const courseLabel = courseFilter ? (courses.find(c => c.id === courseFilter)?.name || courseFilter) : 'All Courses';
        const doc = createPDFDoc(`Student Directory - ${courseLabel}`, 'landscape');

        const tableData = filtered.map((s, idx) => {
            const course = courses.find(c => c.id === s.examId);
            const alloc = allocationMap[s.id];
            return [idx + 1, s.name, s.id, s.rollNumber, s.erpId,
                course ? course.name : s.examId, s.department || '--', `Sem ${s.semester}`,
                alloc ? alloc.roomName : '--', alloc ? `R${alloc.row} C${alloc.col}` : '--'];
        });

        doc.autoTable({
            head: [['#', 'Name', 'Student ID', 'Roll No.', 'ERP ID', 'Course', 'Department', 'Sem', 'Room', 'Seat']],
            body: tableData,
            ...getAutoTableStyles()
        });

        try {
            const qrData = `UniAlignAI|Directory|Course:${courseLabel}|Count:${filtered.length}|Date:${new Date().toISOString().slice(0, 10)}`;
            const qrImg = generateQRDataURL(qrData);
            if (qrImg && doc.lastAutoTable) {
                const finalY = doc.lastAutoTable.finalY + 5;
                doc.addImage(qrImg, 'PNG', doc.internal.pageSize.getWidth() - 38, finalY, 20, 20);
                doc.setFontSize(6.5);
                doc.setTextColor(130, 130, 150);
                doc.text('QR Verify', doc.internal.pageSize.getWidth() - 28, finalY + 22, { align: 'center' });
            }
        } catch (qrErr) { console.warn('QR skipped:', qrErr); }

        addPageFooter(doc);
        doc.save(`Student_Directory_${new Date().toISOString().slice(0, 10)}.pdf`);
        showToast('Directory PDF exported successfully!', 'success');
    } catch (err) {
        console.error('Export Directory PDF failed:', err);
        alert('PDF export failed. Check browser console for details.');
    }
}

// ========================
// Excel & CSV Export Functions
// ========================

function getAllocationData(allocation) {
    const students = [];
    allocation.grid.forEach((rowArr, rowIdx) => {
        rowArr.forEach((seat, colIdx) => {
            if (seat) {
                const course = courses.find(c => c.id === seat.examId);
                students.push({
                    'S.No': students.length + 1,
                    'Name': seat.name || '--',
                    'Student ID': seat.id,
                    'Roll Number': seat.rollNumber || '--',
                    'ERP ID': seat.erpId || '--',
                    'Course': course ? course.name : seat.examId,
                    'Department': seat.department || '--',
                    'Semester': seat.semester ? `Sem ${seat.semester}` : '--',
                    'Room': allocation.room.name,
                    'Seat': `R${rowIdx + 1} C${colIdx + 1}`
                });
            }
        });
    });
    return students;
}

function getDirectoryData() {
    const search = document.getElementById('student-search').value.toLowerCase().trim();
    const sortMode = document.getElementById('student-sort-selector').value;
    const courseFilter = document.getElementById('student-filter-course').value;

    let filtered = [...systemStudents];
    if (courseFilter) filtered = filtered.filter(s => s.examId === courseFilter);
    if (search) {
        filtered = filtered.filter(s =>
            s.name.toLowerCase().includes(search) || s.rollNumber.toLowerCase().includes(search) ||
            s.erpId.toLowerCase().includes(search) || s.id.toLowerCase().includes(search) ||
            (s.email || '').toLowerCase().includes(search)
        );
    }
    filtered = sortStudents(filtered, sortMode);

    const allocationMap = {};
    if (latestAllocationResult) {
        latestAllocationResult.allocations.forEach(alloc => {
            alloc.assignments.forEach(a => {
                allocationMap[a.studentId] = { roomName: alloc.room.name, row: a.row + 1, col: a.col + 1 };
            });
        });
    }

    return filtered.map((s, idx) => {
        const course = courses.find(c => c.id === s.examId);
        const alloc = allocationMap[s.id];
        return {
            'S.No': idx + 1,
            'Name': s.name,
            'Student ID': s.id,
            'Roll Number': s.rollNumber,
            'ERP ID': s.erpId,
            'Course': course ? course.name : s.examId,
            'Department': s.department || '--',
            'Semester': `Sem ${s.semester}`,
            'Room': alloc ? alloc.roomName : '--',
            'Seat': alloc ? `R${alloc.row} C${alloc.col}` : '--'
        };
    });
}

function styleWorksheet(ws, data) {
    // Set column widths for better readability
    const colWidths = [
        { wch: 6 },   // S.No
        { wch: 22 },  // Name
        { wch: 14 },  // Student ID
        { wch: 14 },  // Roll Number
        { wch: 14 },  // ERP ID
        { wch: 20 },  // Course
        { wch: 16 },  // Department
        { wch: 10 },  // Semester
        { wch: 14 },  // Room
        { wch: 10 },  // Seat
    ];
    ws['!cols'] = colWidths;
    return ws;
}

// --- Excel Exports ---
function exportRoomExcel(allocation) {
    try {
        if (typeof XLSX === 'undefined') { alert('SheetJS library not loaded. Please refresh the page.'); return; }
        const data = getAllocationData(allocation);
        const ws = XLSX.utils.json_to_sheet(data);
        styleWorksheet(ws, data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, allocation.room.name.substring(0, 31));

        // Add a summary sheet
        const summaryData = [{
            'Room': allocation.room.name,
            'Room ID': allocation.room.id,
            'Capacity': allocation.capacity,
            'Students Placed': data.length,
            'Occupancy': `${allocation.occupancy}%`,
            'Generated': getFormattedDate()
        }];
        const summaryWs = XLSX.utils.json_to_sheet(summaryData);
        summaryWs['!cols'] = [{ wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }, { wch: 28 }];
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

        XLSX.writeFile(wb, `Seating_${allocation.room.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Room Excel exported successfully!', 'success');
    } catch (err) {
        console.error('Export Room Excel failed:', err);
        alert('Excel export failed: ' + err.message);
    }
}

function exportAllRoomsExcel() {
    try {
        if (typeof XLSX === 'undefined') { alert('SheetJS library not loaded. Please refresh the page.'); return; }
        const wb = XLSX.utils.book_new();

        // Add a sheet per room
        latestAllocationResult.allocations.forEach(allocation => {
            const data = getAllocationData(allocation);
            const ws = XLSX.utils.json_to_sheet(data);
            styleWorksheet(ws, data);
            const sheetName = allocation.room.name.substring(0, 31);
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        });

        // Summary sheet
        const summaryData = latestAllocationResult.allocations.map(a => ({
            'Room': a.room.name,
            'Room ID': a.room.id,
            'Capacity': a.capacity,
            'Students Placed': a.assignments.length,
            'Occupancy': `${a.occupancy}%`
        }));
        summaryData.push({
            'Room': 'TOTAL',
            'Room ID': '--',
            'Capacity': latestAllocationResult.allocations.reduce((s, a) => s + a.capacity, 0),
            'Students Placed': latestAllocationResult.totalPlaced,
            'Occupancy': `${((latestAllocationResult.totalPlaced / systemStudents.length) * 100).toFixed(1)}%`
        });
        const summaryWs = XLSX.utils.json_to_sheet(summaryData);
        summaryWs['!cols'] = [{ wch: 18 }, { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

        // Unallocated students sheet (if any)
        if (latestAllocationResult.unallocatedStudents.length > 0) {
            const unallocData = latestAllocationResult.unallocatedStudents.map((s, idx) => {
                const course = courses.find(c => c.id === s.examId);
                return {
                    'S.No': idx + 1,
                    'Name': s.name || '--',
                    'Student ID': s.id,
                    'Roll Number': s.rollNumber || '--',
                    'ERP ID': s.erpId || '--',
                    'Course': course ? course.name : s.examId,
                    'Department': s.department || '--',
                    'Semester': s.semester ? `Sem ${s.semester}` : '--'
                };
            });
            const unallocWs = XLSX.utils.json_to_sheet(unallocData);
            XLSX.utils.book_append_sheet(wb, unallocWs, 'Unallocated');
        }

        XLSX.writeFile(wb, `Complete_Seating_Allocation_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Complete Excel exported successfully!', 'success');
    } catch (err) {
        console.error('Export All Excel failed:', err);
        alert('Excel export failed: ' + err.message);
    }
}

function exportStudentDirectoryExcel() {
    try {
        if (typeof XLSX === 'undefined') { alert('SheetJS library not loaded. Please refresh the page.'); return; }
        const data = getDirectoryData();
        const ws = XLSX.utils.json_to_sheet(data);
        styleWorksheet(ws, data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Student Directory');
        XLSX.writeFile(wb, `Student_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast('Directory Excel exported successfully!', 'success');
    } catch (err) {
        console.error('Export Directory Excel failed:', err);
        alert('Excel export failed: ' + err.message);
    }
}

// --- CSV Exports ---
function arrayToCSVString(dataArray) {
    if (dataArray.length === 0) return '';
    const headers = Object.keys(dataArray[0]);
    const csvRows = [headers.join(',')];
    dataArray.forEach(row => {
        const values = headers.map(h => {
            let val = String(row[h] ?? '');
            // Escape commas, quotes, and newlines
            if (val.includes(',') || val.includes('"') || val.includes('\n')) {
                val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val;
        });
        csvRows.push(values.join(','));
    });
    return csvRows.join('\n');
}

function downloadCSVFile(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function exportRoomCSV(allocation) {
    try {
        const data = getAllocationData(allocation);
        const csv = arrayToCSVString(data);
        downloadCSVFile(csv, `Seating_${allocation.room.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
        showToast('Room CSV exported successfully!', 'success');
    } catch (err) {
        console.error('Export Room CSV failed:', err);
        alert('CSV export failed: ' + err.message);
    }
}

function exportAllRoomsCSV(allocation) {
    try {
        let allData = [];
        latestAllocationResult.allocations.forEach(alloc => {
            const data = getAllocationData(alloc);
            allData = allData.concat(data);
        });
        // Renumber
        allData.forEach((row, idx) => { row['S.No'] = idx + 1; });
        const csv = arrayToCSVString(allData);
        downloadCSVFile(csv, `Complete_Seating_Allocation_${new Date().toISOString().slice(0, 10)}.csv`);
        showToast('Complete CSV exported successfully!', 'success');
    } catch (err) {
        console.error('Export All CSV failed:', err);
        alert('CSV export failed: ' + err.message);
    }
}

function exportStudentDirectoryCSV() {
    try {
        const data = getDirectoryData();
        const csv = arrayToCSVString(data);
        downloadCSVFile(csv, `Student_Directory_${new Date().toISOString().slice(0, 10)}.csv`);
        showToast('Directory CSV exported successfully!', 'success');
    } catch (err) {
        console.error('Export Directory CSV failed:', err);
        alert('CSV export failed: ' + err.message);
    }
}

// ========================
// Login Page
// ========================
function initLoginPage() {
    // Generate floating particles
    const particlesContainer = document.getElementById('login-particles');
    if (particlesContainer) {
        for (let i = 0; i < 30; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.animationDuration = `${6 + Math.random() * 10}s`;
            particle.style.animationDelay = `${Math.random() * 8}s`;
            particle.style.width = `${2 + Math.random() * 4}px`;
            particle.style.height = particle.style.width;

            const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#0ea5e9'];
            particle.style.background = colors[Math.floor(Math.random() * colors.length)];

            particlesContainer.appendChild(particle);
        }
    }

    // Password visibility toggle
    const toggleBtn = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('login-password');
    if (toggleBtn && passwordInput) {
        toggleBtn.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            const eyeIcon = toggleBtn.querySelector('i');
            if (eyeIcon) {
                eyeIcon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
                lucide.createIcons();
            }
        });
    }

    // Login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const loginBtn = document.getElementById('login-btn');
            const errorDiv = document.getElementById('login-error');

            errorDiv.classList.add('hidden');
            loginBtn.classList.add('loading');

            setTimeout(() => {
                if (email && password) {
                    const overlay = document.getElementById('login-overlay');
                    const appContainer = document.getElementById('app-container');

                    overlay.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                    overlay.style.opacity = '0';
                    overlay.style.transform = 'scale(1.02)';

                    setTimeout(() => {
                        overlay.classList.add('hidden');
                        appContainer.classList.remove('hidden');
                        appContainer.style.animation = 'fadeIn 0.5s ease';
                        lucide.createIcons();
                        refreshDashboardMetrics();
                        animateHomeStats();
                    }, 500);

                } else {
                    loginBtn.classList.remove('loading');
                    document.getElementById('login-error-msg').textContent = 'Please enter both email and password.';
                    errorDiv.classList.remove('hidden');
                    lucide.createIcons();
                }
            }, 1500);
        });
    }
}
