const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Call next person
router.post('/queue/next', authMiddleware, adminMiddleware, (req, res) => {
    const { clinic_id } = req.body;
    if (!clinic_id) return res.status(400).json({ error: 'Clinic ID is required' });

    try {
        // Mark current 'called' tickets as 'completed' or 'skipped'? 
        // For simplicity, we just find the oldest 'waiting' and mark as 'called'
        
        const nextTicket = db.prepare('SELECT id FROM queue_tickets WHERE clinic_id = ? AND status = "waiting" ORDER BY created_at ASC LIMIT 1').get(clinic_id);
        
        if (!nextTicket) return res.status(404).json({ error: 'No one in queue' });

        db.prepare('UPDATE queue_tickets SET status = "called", called_at = CURRENT_TIMESTAMP WHERE id = ?').run(nextTicket.id);
        
        res.json({ message: 'Next person called', ticket_id: nextTicket.id });
        
        if (global.notifyQueueChange) global.notifyQueueChange(clinic_id);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Reset daily queue
router.post('/queue/reset', authMiddleware, adminMiddleware, (req, res) => {
    const { clinic_id } = req.body;
    if (!clinic_id) return res.status(400).json({ error: 'Clinic ID is required' });

    try {
        db.prepare('UPDATE queue_tickets SET status = "cancelled" WHERE clinic_id = ? AND status IN ("waiting", "called")').run(clinic_id);
        res.json({ message: 'Queue reset' });
        
        if (global.notifyQueueChange) global.notifyQueueChange(clinic_id);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Update ticket status (Complete / Skip)
router.put('/queue/:id', authMiddleware, adminMiddleware, (req, res) => {
    const { status } = req.body; // 'completed', 'skipped', 'cancelled'
    
    try {
        const ticket = db.prepare('SELECT clinic_id FROM queue_tickets WHERE id = ?').get(req.params.id);
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const completedAtSnippet = status === 'completed' ? ', completed_at = CURRENT_TIMESTAMP' : '';
        db.prepare(`UPDATE queue_tickets SET status = ? ${completedAtSnippet} WHERE id = ?`).run(status, req.params.id);
        
        res.json({ message: `Ticket marked as ${status}` });
        
        if (global.notifyQueueChange) global.notifyQueueChange(ticket.clinic_id);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
