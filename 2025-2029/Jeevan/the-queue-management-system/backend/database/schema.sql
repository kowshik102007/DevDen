-- Database schema for Queue Management System
-- A project by Jeevan A Jacob

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user', -- 'user' or 'admin'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clinics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    avg_service_time INTEGER DEFAULT 15, -- in minutes
    status TEXT DEFAULT 'open', -- 'open' or 'closed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS queue_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    clinic_id INTEGER NOT NULL,
    ticket_number INTEGER NOT NULL,
    status TEXT DEFAULT 'waiting', -- 'waiting', 'called', 'completed', 'skipped', 'cancelled'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    called_at DATETIME,
    completed_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (clinic_id) REFERENCES clinics(id)
);
