const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// Get own profile
router.get('/profile', authMiddleware, (req, res) => {
    try {
        const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(req.user.id);
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update profile
router.put('/profile', authMiddleware, (req, res) => {
    const { name, email } = req.body;
    try {
        db.prepare('UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?')
            .run(name, email, req.user.id);
        res.json({ message: 'Profile updated' });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get own queue history
router.get('/history', authMiddleware, (req, res) => {
    try {
        const history = db.prepare(`
            SELECT q.*, c.name as clinic_name 
            FROM queue_tickets q 
            JOIN clinics c ON q.clinic_id = c.id 
            WHERE q.user_id = ? 
            ORDER BY q.created_at DESC
        `).all(req.user.id);
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
