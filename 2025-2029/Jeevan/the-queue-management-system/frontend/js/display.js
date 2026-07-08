document.addEventListener('DOMContentLoaded', async () => {
    const displayGrid = document.getElementById('display-grid');

    async function refreshDisplay() {
        try {
            const clinics = await API.request('/clinics');
            const allTickets = await API.request('/queues');

            displayGrid.innerHTML = clinics.map(clinic => {
                const tickets = allTickets.filter(t => t.clinic_id === clinic.id);
                const active = tickets.find(t => t.status === 'called');
                const waiting = tickets.filter(t => t.status === 'waiting')
                                    .sort((a,b) => new Date(a.created_at) - new Date(b.created_at))
                                    .slice(0, 5); // Show next 5 waiting

                return `
                    <div class="clinic-display-card glass">
                        <div style="padding: 1rem; border-bottom: 1px solid var(--glass-border); text-align: center;">
                            <h2 style="color: var(--text-primary); font-size: 1.5rem;">${clinic.name}</h2>
                        </div>
                        <div class="now-calling">
                            <span style="font-size: 0.9rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 2px;">
                                ${active ? 'Now Calling' : 'Please Wait'}
                            </span>
                            <div class="number ${active ? 'blink' : ''}">
                                ${active ? '#' + active.ticket_number : '---'}
                            </div>
                            <div style="color: var(--accent); font-weight: 500;">
                                ${active ? active.user_name : 'No Active Patient'}
                            </div>
                        </div>
                        <div class="waiting-list">
                            <div style="color: var(--text-secondary); white-space: nowrap;">NEXT IN LINE:</div>
                            ${waiting.map(w => `<span style="font-weight: 600;">#${w.ticket_number}</span>`).join('<span style="color: var(--glass-border)">|</span>') || '<span style="color: var(--text-secondary)">-</span>'}
                        </div>
                    </div>
                `;
            }).join('');
        } catch (err) {
            console.error('Display refresh failed', err);
        }
    }

    // WebSocket for real-time updates
    const ws = new WebSocket(CONFIG.WS_URL);
    ws.onmessage = () => {
        // Optional: play a sound when someone is called
        // const audio = new Audio('notification.mp3'); audio.play();
        refreshDisplay();
    };
    ws.onopen = () => console.log('WebSocket connected to display');

    refreshDisplay();
});
