const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authMiddleware } = require('../middleware/auth');

// Get queue status for a clinic
router.get('/', (req, res) => {
    const { clinic_id } = req.query;
    try {
        let query = 'SELECT q.*, u.name as user_name FROM queue_tickets q JOIN users u ON q.user_id = u.id';
        const params = [];

        if (clinic_id) {
            query += ' WHERE clinic_id = ?';
            params.push(clinic_id);
        }

        query += ' ORDER BY created_at ASC';
        const tickets = db.prepare(query).all(...params);
        res.json(tickets);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Join queue
router.post('/', authMiddleware, (req, res) => {
    const { clinic_id } = req.body;
    const user_id = req.user.id;

    if (!clinic_id) return res.status(400).json({ error: 'Clinic ID is required' });

    try {
        // Check if already in queue for this clinic (waiting or called)
        const existing = db.prepare('SELECT id FROM queue_tickets WHERE user_id = ? AND clinic_id = ? AND status IN ("waiting", "called")').get(user_id, clinic_id);
        if (existing) return res.status(400).json({ error: 'You are already in queue for this clinic' });

        // Get next ticket number for today
        const today = new Date().toISOString().split('T')[0];
        const lastTicket = db.prepare('SELECT MAX(ticket_number) as max_num FROM queue_tickets WHERE clinic_id = ? AND date(created_at) = ?').get(clinic_id, today);
        const nextNumber = (lastTicket.max_num || 0) + 1;

        const ticketId = uuidv4();
        db.prepare('INSERT INTO queue_tickets (id, user_id, clinic_id, ticket_number) VALUES (?, ?, ?, ?)')
            .run(ticketId, user_id, clinic_id, nextNumber);

        // Calculate position
        const position = db.prepare('SELECT COUNT(*) as count FROM queue_tickets WHERE clinic_id = ? AND status = "waiting" AND created_at <= (SELECT created_at FROM queue_tickets WHERE idIdx = ?)')
            // Note: need to handle index properly or just use created_at comparison
            .get(clinic_id, ticketId);
            
        // Simplified position: count waiting tickets created before this one
        const ticket = db.prepare('SELECT * FROM queue_tickets WHERE id = ?').get(ticketId);
        const waitingCount = db.prepare('SELECT COUNT(*) as count FROM queue_tickets WHERE clinic_id = ? AND status = "waiting" AND created_at <= ?').get(clinic_id, ticket.created_at).count;

        res.status(201).json({ ...ticket, position: waitingCount });
        
        // Notify via WebSocket in server.js
        if (global.notifyQueueChange) global.notifyQueueChange(clinic_id);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Cancel ticket
router.delete('/:id', authMiddleware, (req, res) => {
    try {
        const ticket = db.prepare('SELECT * FROM queue_tickets WHERE id = ?').get(req.params.id);
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
        
        // Only owner or admin can cancel
        if (ticket.user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        db.prepare('UPDATE queue_tickets SET status = "cancelled" WHERE id = ?').run(req.params.id);
        res.json({ message: 'Ticket cancelled' });
        
        if (global.notifyQueueChange) global.notifyQueueChange(ticket.clinic_id);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
