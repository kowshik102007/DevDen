const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, 'queue.db');
const db = new Database(dbPath);

// Create tables from schema.sql
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Seed default data if empty
function seed() {
    // Seed default admin
    const adminEmail = 'admin@clinic.com';
    const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
    
    if (!existingAdmin) {
        const passwordHash = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
            .run('admin-root-id', 'Root Admin', adminEmail, passwordHash, 'admin');
        console.log('Default admin created: admin@clinic.com / admin123');
    }

    // Seed some clinics
    const clinicsCount = db.prepare('SELECT COUNT(*) as count FROM clinics').get().count;
    if (clinicsCount === 0) {
        const insertClinic = db.prepare('INSERT INTO clinics (name, description, avg_service_time) VALUES (?, ?, ?)');
        insertClinic.run('General Clinic', 'General checkups and common illness treatment', 15);
        insertClinic.run('Dental Care', 'Restorative and cosmetic dentistry', 30);
        insertClinic.run('Eye Specialist', 'Ophthalmology and vision care', 20);
        console.log('Sample clinics seeded.');
    }
}

seed();

module.exports = db;
