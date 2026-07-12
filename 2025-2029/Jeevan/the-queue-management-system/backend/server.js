require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const clinicRoutes = require('./routes/clinics');
const queueRoutes = require('./routes/queues');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/users');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

// Routes
app.use('/auth', authRoutes);
app.use('/clinics', clinicRoutes);
app.use('/queues', queueRoutes);
app.use('/admin', adminRoutes);
app.use('/users', userRoutes);

// Root route
app.get('/', (req, res) => {
    res.json({ message: 'Queue Management System API by Jeevan A Jacob' });
});

// WebSocket Handling
const clients = new Set();
wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
});

// Global notifier for queue changes
global.notifyQueueChange = (clinicId) => {
    const message = JSON.stringify({ type: 'QUEUE_UPDATE', clinicId });
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
