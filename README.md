# 🎓 UniAlign AI — AI-Driven University Seating & Room Allocation System

> An intelligent university exam seating arrangement system powered by **Google Gemini AI** and a **Node.js + SQLite** backend. It uses constraint-satisfaction algorithms and AI to optimally place 900+ students across 36 exam rooms while preventing academic malpractice.

---

## 📑 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Project Architecture](#project-architecture)
- [File Structure](#file-structure)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Backend API Reference](#backend-api-reference)
- [Database Schema](#database-schema)
- [Detailed Module Breakdown](#detailed-module-breakdown)
  - [Backend — Server Layer](#1-backend--server-layer)
  - [AI Allocator Engine — `allocator.js`](#2-ai-allocator-engine--allocatorjs)
  - [AI API Integration — `aiAllocator.js`](#3-ai-api-integration--aiallocatorjs)
  - [File Parser — `fileParser.js`](#4-file-parser--fileparserjs)
  - [Application Controller — `app.js`](#5-application-controller--appjs)
  - [User Interface — `index.html`](#6-user-interface--indexhtml)
  - [Design System — `style.css`](#7-design-system--stylecss)
- [Algorithm Deep Dive](#algorithm-deep-dive)
- [Export System](#export-system)
- [Sorting Techniques](#sorting-techniques)
- [Student Info Tooltip & Modal](#student-info-tooltip--modal)
- [Screenshots Walkthrough](#screenshots-walkthrough)
- [Contributors](#contributors)
- [License](#license)

---

## Overview

**UniAlign AI** is a full-stack web application designed for universities and educational institutions to automate the exam seating arrangement process. The system stores 900 students, 4 courses, and 36 rooms in a persistent **SQLite database**, allocates students using both a local constraint-satisfaction greedy algorithm and the **Google Gemini AI API**, and provides rich visualization, drag-and-drop seat swapping, multi-format export (PDF, Excel, CSV), and a premium dark glassmorphism UI.

### The Problem It Solves

Manual exam seating arrangement is:
- **Time-consuming** — Coordinators spend hours assigning hundreds of students to seats
- **Error-prone** — Adjacent students taking the same exam can copy from each other
- **Hard to document** — Paper-based records are difficult to share and archive
- **Non-persistent** — Arrangements are lost and must be redone every exam cycle

UniAlign AI automates all of this with a persistent backend and AI-powered optimization.

---

## Key Features

| Feature | Description |
|---------|-------------|
| 🤖 **Dual AI Engines** | Local constraint-satisfaction algorithm + Google Gemini AI API for intelligent seating |
| 💾 **SQLite Database** | Persistent backend — students, rooms, courses, and allocations survive server restarts |
| 🔌 **REST API** | Full CRUD API for students, courses, rooms, and allocations |
| 📊 **Dashboard** | Real-time metrics showing total students, active exams, available rooms, and optimization score |
| 🗺️ **Room Visualization** | Interactive grid-based seat map with color-coded course badges and 2D matrix display |
| 🔄 **8 Sorting Modes** | Sort by name, roll number, ERP ID, or group by course (ascending/descending) |
| 🔀 **Drag-to-Swap** | Toggle drag mode to rearrange students between seats with real-time visual feedback |
| 🔍 **Student Directory** | Searchable, filterable, sortable table of all 900+ students with allocation info |
| 💬 **Hover Tooltip** | Rich popup showing full student profile when hovering over any occupied desk |
| 📋 **Click Modal** | Detailed student information modal on clicking any desk or table row |
| 📄 **PDF Export** | Export single room, all rooms, or student directory as professional styled PDFs |
| 📗 **Excel Export** | Export room allocations and student directory as `.xlsx` files with summary sheets |
| 📝 **CSV Export** | Export structured CSV files for spreadsheet and data analysis tools |
| 🖨️ **Print Chart** | Clean 2D matrix print layout without row/column labels, showing grid dimensions |
| 📂 **File Upload** | Drag-and-drop CSV/JSON upload for custom student and room data (syncs to database) |
| 🔐 **Login System** | Secure login overlay with animated UI on application startup |
| 🎨 **Glassmorphism UI** | Premium dark theme with animated gradients, glass panels, and micro-animations |
| 🏠 **Landing Page** | Animated metrics, feature cards, and upload zones on the home page |
| 👥 **Contributors Footer** | Team credits displayed in the application footer |

---

## Project Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐      │
│  │  index.html   │  │  style.css   │  │  CDN Libraries    │      │
│  │  (Structure)  │  │  (Design)    │  │  Lucide, Chart.js │      │
│  │              │  │              │  │  jsPDF, SheetJS   │      │
│  └──────────────┘  └──────────────┘  └───────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                     APPLICATION LAYER                             │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                      js/app.js                           │    │
│  │  • View Router & Navigation     • Drag-to-Swap Manager  │    │
│  │  • API Data Fetching            • Room Grid Renderer     │    │
│  │  • Event Handlers               • PDF/Excel/CSV Export   │    │
│  │  • Tooltip & Modal Manager      • Student Directory      │    │
│  └──────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                     BUSINESS LOGIC LAYER                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐       │
│  │ allocator.js  │  │aiAllocator.js│  │  fileParser.js   │       │
│  │ Local greedy  │  │ Gemini AI    │  │  CSV/JSON parser │       │
│  │ algorithm     │  │ API client   │  │  with validation │       │
│  └──────────────┘  └──────────────┘  └──────────────────┘       │
├─────────────────────────────────────────────────────────────────┤
│                     BACKEND LAYER                                 │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              server/app.js (Express.js)                   │    │
│  │  • REST API (15+ endpoints)     • Static file serving    │    │
│  │  • CORS middleware              • JSON body parsing      │    │
│  ├──────────────────────────────────────────────────────────┤    │
│  │              server/database.js (SQLite via sql.js)       │    │
│  │  • Schema management            • CRUD helpers           │    │
│  │  • Auto-seeding (900 students)  • Disk persistence       │    │
│  │  • Transaction support          • Filtered queries       │    │
│  └──────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              server/unialign.db (SQLite Database)          │    │
│  │  Tables: courses, students, rooms, allocations,           │    │
│  │          allocation_assignments                            │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
seating-allocation-system/
│
├── index.html                  # Main HTML — all views, modals, login overlay
├── style.css                   # Complete CSS design system (2600+ lines)
├── README.md                   # This file
│
├── js/
│   ├── app.js                  # Application controller — all UI logic & exports
│   ├── allocator.js            # Local AI allocation algorithm (constraint-satisfaction)
│   ├── aiAllocator.js          # Google Gemini AI API integration
│   └── fileParser.js           # CSV/JSON file parser with validation
│
└── server/
    ├── app.js                  # Express.js REST API server
    ├── database.js             # SQLite database (schema, seed, CRUD)
    ├── package.json            # npm dependencies
    ├── package-lock.json       # Dependency lock file
    ├── node_modules/           # Installed packages
    └── unialign.db             # SQLite database file (auto-generated)
```

| File | Role |
|------|------|
| `index.html` | Structure — all views, modals, login overlay, footer |
| `style.css` | Full design system — dark glassmorphism theme, animations, responsive |
| `js/app.js` | Frontend logic — data fetching from API, rendering, events, exports |
| `js/allocator.js` | Local constraint-satisfaction greedy allocation algorithm |
| `js/aiAllocator.js` | Gemini AI API client — sends data to AI for smart allocation |
| `js/fileParser.js` | CSV/JSON file parser with field normalization and validation |
| `server/app.js` | Express server — 15+ REST API endpoints + static file hosting |
| `server/database.js` | SQLite module — schema, seed data (900 students, 36 rooms), queries |
| `server/unialign.db` | Persistent SQLite database (auto-created on first run) |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Node.js v24 + Express.js | REST API server |
| **Database** | SQLite (via sql.js) | Persistent data storage |
| **Frontend** | HTML5 + Vanilla JavaScript (ES6+) | UI structure & logic |
| **Styling** | Vanilla CSS3 | Custom properties, glassmorphism, animations |
| **AI Engine** | Google Gemini 2.5 Flash API | AI-powered seating optimization |
| **Typography** | Google Fonts (Outfit) | Modern, clean typeface |
| **Icons** | Lucide Icons | Lightweight SVG icon library |
| **Charts** | Chart.js | Dashboard visualizations |
| **PDF** | jsPDF + AutoTable | Client-side PDF generation |
| **Excel** | SheetJS (xlsx) | Client-side Excel file generation |
| **CORS** | cors (npm) | Cross-origin API access |

---

## Getting Started

### Prerequisites

- **Node.js** v18+ (check: `node --version`)
- **npm** v8+ (bundled with Node.js)
- A modern web browser (Chrome 90+, Firefox 88+, Edge 90+)
- Internet connection (for CDN resources and Gemini AI API)

### Installation

```bash
# 1. Clone the project
git clone <repository-url>
cd seating-allocation-system

# 2. Install backend dependencies
cd server
npm install

# 3. Start the server
node app.js
```

> **Note:** If Node.js is not in your PATH on Windows, use the full path:
> ```powershell
> & "C:\Program Files\nodejs\node.exe" app.js
> ```

### Server Startup Output

```
╔══════════════════════════════════════════════╗
║     🎓 UniAlign AI — Backend Server         ║
╠══════════════════════════════════════════════╣
║  🌐 Frontend:  http://localhost:5000          ║
║  🔌 API:       http://localhost:5000/api      ║
║  💾 Database:  SQLite (server/unialign.db)   ║
╚══════════════════════════════════════════════╝
```

### Usage Workflow

1. **Start the server** → `node server/app.js`
2. **Open** → `http://localhost:5000` in your browser
3. **Login** → Enter credentials on the login page
4. **Home Page** → View animated stats (900 students, 100% accuracy, etc.)
5. **Upload Data** (optional) → Drag & drop CSV/JSON files for custom students/rooms
6. **Dashboard** → View metrics (Total Students, Active Exams, Available Rooms)
7. **Run AI Optimization** → Click the button to allocate all students to rooms
8. **Room Allocation AI** → Select a room, visualize the 5×5 seating matrix
9. **Hover/Click seats** → View student profiles in tooltip/modal
10. **Sort** → Change sorting mode (alphabetical, roll number, course, etc.)
11. **Drag to Swap** → Toggle drag mode to rearrange students between seats
12. **Export** → Download as PDF, Excel (.xlsx), or CSV
13. **Print Chart** → Print a clean 2D matrix layout
14. **Student Directory** → Browse, search, filter, and export all students

---

## Backend API Reference

All endpoints are prefixed with `/api`.

### Health & Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/stats` | Returns `{ students, courses, rooms }` counts |

### Courses

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/courses` | List all courses |
| `POST` | `/api/courses` | Add a course `{ id, name, colorClass, department, code, count }` |
| `POST` | `/api/courses/bulk` | Bulk import `{ courses: [...] }` |
| `DELETE` | `/api/courses/:id` | Delete a course by ID |

### Students

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/students` | List all students. Supports `?course=` and `?search=` query params |
| `POST` | `/api/students` | Add a student |
| `POST` | `/api/students/bulk` | Bulk import `{ students: [...], clearExisting: bool }` |
| `DELETE` | `/api/students/:id` | Delete a student by ID |

### Rooms

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/rooms` | List all rooms |
| `POST` | `/api/rooms` | Add a room `{ id, name, rows, cols }` |
| `POST` | `/api/rooms/bulk` | Bulk import `{ rooms: [...], clearExisting: bool }` |
| `DELETE` | `/api/rooms/:id` | Delete a room by ID |

### Allocations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/allocations` | Save allocation `{ totalPlaced, totalStudents, assignments: [...] }` |
| `GET` | `/api/allocations/latest` | Get the most recent allocation result |

---

## Database Schema

The SQLite database (`server/unialign.db`) contains 5 tables:

```sql
courses (id, name, color_class, department, code, count)
students (id, name, roll_number, erp_id, exam_id, department, semester, email)
rooms (id, name, building, floor, rows, cols)
allocations (id, created_at, total_placed, total_students)
allocation_assignments (id, allocation_id, student_id, room_id, seat_row, seat_col)
```

### Default Seed Data

| Entity | Count | Details |
|--------|-------|---------|
| **Courses** | 4 | BBA (250), B.Com (250), BCA (150), B.Tech CSE (250) |
| **Students** | 900 | Generated with realistic Indian names, roll numbers, ERP IDs |
| **Rooms** | 36 | 4 Buildings × 3 Floors × 3 Rooms, each 5×5 (25 seats) |
| **Total Capacity** | 900 seats | 36 rooms × 25 seats = 900 (100% utilization possible) |

---

## Detailed Module Breakdown

### 1. Backend — Server Layer

#### `server/app.js` — Express REST API

- Serves the frontend as static files from the parent directory
- Exposes 15+ REST API endpoints for full CRUD operations
- JSON body parsing with 50MB limit (for bulk imports)
- CORS enabled for development flexibility
- Graceful shutdown with database save on `SIGINT`/`SIGTERM`

#### `server/database.js` — SQLite Database

- Uses **sql.js** (pure JavaScript SQLite — no native dependencies required)
- Auto-creates `unialign.db` on first run and seeds with default data
- Persists to disk after every write operation
- Prepared statements for efficient bulk inserts (900 students in milliseconds)
- Filtered query support (search by name, roll number, ERP ID, email)

---

### 2. AI Allocator Engine — `allocator.js`

**Purpose:** Local constraint-satisfaction greedy algorithm for exam seating.

#### Algorithm: Constraint-Satisfaction Greedy Allocation

```
Input:  List of students (with examId), List of rooms (with rows × cols)
Output: Grid assignments per room, unallocated student list, placement score
```

**Process:**

1. **Sort rooms** by capacity (descending) — fill largest rooms first
2. **For each room**, create an empty 2D grid (`rows × cols`, initialized to `null`)
3. **For each seat** `(row, col)`:
   - Check candidate students against **orthogonal adjacency constraints** (top & left neighbors must have different exams)
   - Place the first valid student, or leave seat empty if no valid candidate exists
4. **Return** all allocations + unallocated students

```
            ┌─────────────┐
            │  TOP SEAT    │
            │ Must differ  │
            └──────┬───────┘
                   │
    ┌──────────────┼──────────────┐
    │ LEFT SEAT    │ CURRENT SEAT │
    │ Must differ  │ (Placing     │
    │ in exam      │  student)    │
    └──────────────┴──────────────┘
```

---

### 3. AI API Integration — `aiAllocator.js`

**Purpose:** Sends student and room data to **Google Gemini AI** for intelligent allocation.

- Builds a structured prompt with all student IDs, exam IDs, and room dimensions
- Calls the Gemini API (`gemini-2.5-flash-preview`) with `responseMimeType: "application/json"`
- Parses the AI response (student grids + exam grids per room)
- Validates placement count — falls back to local algorithm if AI places < 30% of students
- Automatic fallback to local algorithm on API errors or missing API key

---

### 4. File Parser — `fileParser.js`

**Purpose:** Parses uploaded CSV and JSON files with flexible field normalization.

- Handles CSV (with quoted fields, commas in quotes) and JSON formats
- Auto-normalizes header names (e.g., `roll_number`, `rollNo`, `Roll Number` → `rollNumber`)
- Validates required fields and reports row-level errors
- Generates course metadata from unique exam IDs in uploaded data
- Includes downloadable CSV templates for students and rooms

---

### 5. Application Controller — `js/app.js`

**Purpose:** All frontend logic — data fetching, UI rendering, events, and exports.

| Component | Description |
|-----------|-------------|
| **API Data Loading** | `loadInitialData()` fetches courses, students, rooms from backend on startup |
| **View Router** | CSS class toggling for Dashboard, Room Allocation, Student Directory, etc. |
| **AI Optimization** | Triggers allocation via Gemini AI with local fallback |
| **Room Grid Renderer** | Builds interactive desk HTML with color-coded badges |
| **Drag-to-Swap** | Drag students between seats with visual feedback |
| **Sorting System** | 8 sort modes for both grid and directory views |
| **Tooltip & Modal** | Hover popups and click modals with student profiles |
| **PDF/Excel/CSV Export** | Multi-format export with styled output |
| **Print Chart** | Clean 2D matrix print layout showing grid dimensions |
| **File Upload Handler** | Parses files and syncs to backend database |
| **Login Page** | Animated login overlay with particle effects |
| **Home Page** | Animated stat counters, feature cards, upload zones |

---

### 6. User Interface — `index.html`

**Purpose:** Semantic HTML5 structure for all views.

#### Views

| View | Description |
|------|-------------|
| **Login Overlay** | Animated login with particle effects and glassmorphism card |
| **Home** | Landing page with animated stats, feature cards, data upload zones |
| **Dashboard** | Metric cards + recent allocation panel + charts |
| **Room Allocation AI** | Room selector, sort/search, desk grid, export buttons |
| **Student Directory** | Searchable/filterable table with inline course pills |
| **System Data** | Data summary with upload zones |
| **Settings** | API key management, model selection |

#### External Dependencies (CDN)

| Library | Purpose |
|---------|---------|
| Google Fonts (Outfit) | Modern typography |
| Lucide Icons | SVG icon library |
| Chart.js | Dashboard charts |
| jsPDF + AutoTable | PDF generation |
| SheetJS (xlsx) | Excel file generation |

---

### 7. Design System — `style.css`

**Purpose:** Premium dark glassmorphism theme with 2600+ lines of CSS.

#### CSS Custom Properties

```css
--bg-main: #0a0a0f              /* Deep black background */
--bg-sidebar: rgba(18,18,25,0.7) /* Semi-transparent sidebar */
--bg-card: rgba(30,30,42,0.6)    /* Glass card background */
--accent-primary: #6366f1        /* Indigo — primary accent */
--accent-secondary: #0ea5e9      /* Sky blue — secondary accent */
--text-primary: #f8fafc           /* Near white text */
--glass-blur: blur(12px)          /* Backdrop blur intensity */
```

#### Key Animations

| Animation | Duration | Effect |
|-----------|----------|--------|
| `drift` / `drift2` | 15–20s | Background gradient orb floating |
| `pulse` | 2s | System status dot breathing |
| `fadeIn` | 0.4s | View transition entrance |
| `slideUp` | 0.3s | Modal entrance from below |
| `loginCardIn` | 0.6s | Login card scale-in |
| `floatParticle` | Variable | Login page particle animation |
| `toastSlideIn` | 0.4s | Toast notification entrance |

---

## Algorithm Deep Dive

### Dual Allocation Approach

| Approach | Engine | Pros | Cons |
|----------|--------|------|------|
| **Local Greedy** | `allocator.js` | Instant (<1ms), offline, deterministic | May leave empty seats |
| **Gemini AI** | `aiAllocator.js` | Smarter distribution, handles complex scenarios | Requires API key, network latency |

The system tries AI first and falls back to local if the API fails or returns poor results.

### Edge Cases Handled

| Case | Behavior |
|------|----------|
| More students than seats | Excess reported as "unallocated" |
| All students same exam | Alternating seats, empties between |
| No API key | Automatic fallback to local algorithm |
| AI returns invalid data | Fallback with error logging |
| File upload errors | Row-level validation with user feedback |

---

## Export System

### PDF Export

| Mode | Scope | Filename |
|------|-------|----------|
| Export Room PDF | Current room | `Seating_RoomName_Date.pdf` |
| Export All PDF | All rooms + summary | `Complete_Seating_Allocation_Date.pdf` |
| Student Directory PDF | Filtered student list | `Student_Directory_Date.pdf` |

### Excel Export (.xlsx)

| Mode | Scope | Details |
|------|-------|---------|
| Room Excel | Current room | Sheet with student allocations |
| All Excel | All rooms | Multiple sheets + Summary sheet |
| Directory Excel | All students | Full student list with allocation info |

### CSV Export

| Mode | Scope | Details |
|------|-------|---------|
| Room CSV | Current room | Flat table with proper escaping |
| All CSV | All rooms | Combined table with room column |
| Directory CSV | All students | Full student records |

### Print Chart

Clean 2D matrix display showing `Rows×Cols` dimensions (e.g., `5×5`) without row/column labels.

---

## Sorting Techniques

| Mode | Sort Key | Direction |
|------|----------|-----------|
| `alpha` | Name | Ascending |
| `alpha-desc` | Name | Descending |
| `roll` | Roll Number | Ascending |
| `roll-desc` | Roll Number | Descending |
| `erp` | ERP ID | Ascending |
| `erp-desc` | ERP ID | Descending |
| `course` | Course → Name | Grouped ascending |
| `default` | — | AI-optimized order |

---

## Student Info Tooltip & Modal

### Hover Tooltip
- Appears on desk hover with glassmorphism design
- Shows: Avatar initials, name, ID, roll number, ERP ID, course, semester, department
- Auto-repositions to stay within viewport

### Click Modal
- Opens on desk or table row click
- Shows all tooltip fields + email address
- Close via: ✕ button, backdrop click, or Escape key

---

## Screenshots Walkthrough

| View | Description |
|------|-------------|
| **Login** | Animated glassmorphism login with floating particles |
| **Home** | Landing page with animated stat counters and feature cards |
| **Dashboard** | 4 metric cards + recent allocations + course distribution chart |
| **Room Allocation AI** | Room selector, 5×5 desk grid, PDF/Excel/CSV export buttons |
| **Student Directory** | Searchable table with course pills and export options |
| **System Data** | Upload zones for custom CSV/JSON data |
| **Settings** | Gemini API key configuration and model selection |

---

## Contributors

See the application footer for the full list of contributors.

---

## License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  Built with ❤️ for smarter exam management<br>
  <strong>UniAlign AI</strong> — AI-Driven University Seating & Room Allocation System
</p>
