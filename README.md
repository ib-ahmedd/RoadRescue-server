# RoadRescue API Server

A high-performance Express.js REST API server written in TypeScript and backed by SQLite (`better-sqlite3`).

This server replaces the original Next.js internal API routes, offering a standalone backend service, structured database layer, automatic migrations/seeding, and concurrency optimizations.

---

## Technical Stack

- **Core**: Express.js (Node.js REST API framework)
- **Database**: SQLite via `better-sqlite3` (with WAL mode enabled for rapid concurrency)
- **Language**: TypeScript
- **Port**: `5000`

---

## Features

- **Automatic Seeding**: Seeds the SQLite database directly from the frontend's original `db.json` data on the very first start.
- **Unified Schema**:
  - `providers`: Dispatched technicians, vehicles, status, and reviews.
  - `requests`: Stranded driver coordinates, vehicle info, dispatch statuses, and notes.
  - `contacts`: Customer support form submissions.
- **State Transition Hooks**: Automatically manages provider availability (e.g. marking a technician as `Dispatched` when assigned, and restoring them to `Available` once a request is marked `completed`).
- **CORS Configured**: Ready to accept connections from frontend web applications on port `3000` and `3001`.

---

## Getting Started

### 1. Installation

Run this command inside the `server/` directory:

```bash
npm install
```

### 2. Running in Development

Starts the server with hot-reloading:

```bash
npm run dev
```

### 3. Production Build & Execution

Builds TypeScript to `/dist` and runs the JavaScript output:

```bash
npm run build
npm start
```

---

## API Documentation

### Providers (`/api/providers`)
- `GET /api/providers` - Get all providers.
- `GET /api/providers?id=SP-001` - Get a specific provider by ID.
- `POST /api/providers` - Add a new provider.
- `PATCH /api/providers` - Update an existing provider (e.g., status, reviews, rating).

### Requests (`/api/requests`)
- `GET /api/requests` - Get all assistance requests (newest first).
- `GET /api/requests?id=RR-DEMO1` - Get details of a specific request.
- `POST /api/requests` - Submit a new roadside rescue request.
- `PATCH /api/requests` - Update request status, assigned technician, and communication logs.

### Contacts (`/api/contact`)
- `POST /api/contact` - Submit a customer message/contact form.

### Health check (`/health`)
- `GET /health` - Check backend live status.
