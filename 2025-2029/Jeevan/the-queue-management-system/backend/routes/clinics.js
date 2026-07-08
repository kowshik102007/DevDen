const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Get all clinics
router.get('/', (req, res) => {
    try {
        const clinics = db.prepare('SELECT * FROM clinics').all();
        res.json(clinics);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get single clinic
router.get('/:id', (req, res) => {
    try {
        const clinic = db.prepare('SELECT * FROM clinics WHERE id = ?').get(req.params.id);
        if (!clinic) return res.status(404).json({ error: 'Clinic not found' });
        res.json(clinic);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Create clinic (Admin)
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
    const { name, description, avg_service_time } = req.body;
    
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const result = db.prepare('INSERT INTO clinics (name, description, avg_service_time) VALUES (?, ?, ?)')
            .run(name, description || '', avg_service_time || 15);
        res.status(201).json({ id: result.lastInsertRowid, name, description, avg_service_time });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update clinic (Admin)
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
    const { name, description, avg_service_time, status } = req.body;
    
    try {
        db.prepare('UPDATE clinics SET name = COALESCE(?, name), description = COALESCE(?, description), avg_service_time = COALESCE(?, avg_service_time), status = COALESCE(?, status) WHERE id = ?')
            .run(name, description, avg_service_time, status, req.params.id);
        res.json({ message: 'Clinic updated' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete clinic (Admin)
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
        db.prepare('DELETE FROM clinics WHERE id = ?').run(req.params.id);
        res.json({ message: 'Clinic deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
