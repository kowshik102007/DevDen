# The Queue Management System (QueneEase)

A model project by **Jeevan A Jacob**. 

QueueEase is a modern, full-stack solution for clinic and office queue management. It eliminates physical waiting lines by allowing users to join queues digitally and track their turn in real-time.

![Design Preview](https://img.shields.io/badge/Design-Glassmorphism-blue)
![Frontend](https://img.shields.io/badge/Frontend-HTML%2FCSS%2FJS-green)
![Backend](https://img.shields.io/badge/Backend-Node.js%20%7C%20Express-lightgrey)
![Database](https://img.shields.io/badge/Database-SQLite-blue)

## Features

### 👤 User (Patient)
- **Digital Registration:** Create an account to manage your tickets.
- **Join Queues:** Select a clinic and join the line from anywhere.
- **Live Tracking:** See your ticket number, position ahead of you, and estimated wait time.
- **WebSocket Alerts:** Dashboard updates automatically when you are called.
- **History:** Keep track of your past clinic visits.

### 🔐 Admin (Clinic Staff)
- **Live Dashboard:** Real-time view of everyone waiting in line.
- **One-Click Calling:** Call the next patient, skip, or mark as completed.
- **Clinic Management:** Add or edit clinics/offices and set average service times.
- **Queue Reset:** Clear the daily queue with one click.

### 📺 Public Display
- **Live Screen:** A dedicated page (`display.html`) for waiting rooms to show currently called numbers.

## Tech Stack
- **Frontend:** Vanilla HTML5, CSS3 (Glassmorphism), ES6 JavaScript.
- **Backend:** Node.js, Express.js.
- **Database:** SQLite (Better-SQLite3) for local storage.
- **Real-time:** WebSockets (ws) for instant status propagation.
- **Authentication:** JWT (JSON Web Tokens) with Bcrypt password hashing.

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v14+)
- npm (Node Package Manager)

### Installation
1. Clone or download the project.
2. Open terminal in the `backend` folder:
   ```bash
   cd backend
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   The server will run on `http://localhost:3000`.

### Running the Frontend
Simply open `frontend/index.html` in your web browser. 

> [!TIP]
> **Admin Credentials:**
> - Email: `admin@clinic.com`
> - Password: `admin123`

## Project Structure
```text
queue-management-system
├── backend/             # Express API & SQLite Database
│   ├── database/        # Schema and initialization
│   ├── middleware/      # Auth & Security
│   ├── routes/          # API Endpoints
│   └── server.js        # Main entry point
├── frontend/            # HTML/CSS/JS Interface
│   ├── css/             # Design System
│   ├── js/              # Client-side Logic
│   └── *.html           # Application Pages
├── api-docs/            # API reference
└── README.md            # You are here
```

Created by **Jeevan A Jacob**.
