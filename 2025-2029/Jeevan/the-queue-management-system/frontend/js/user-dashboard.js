document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'user') return window.location.href = 'auth.html';

    document.getElementById('user-name').textContent = `Hello, ${user.name}`;
    
    const clinicSelect = document.getElementById('clinic-select');
    const joinSection = document.getElementById('join-section');
    const activeTicketSection = document.getElementById('active-ticket-section');
    const historyBody = document.getElementById('history-body');

    // Load Clinics
    async function loadClinics() {
        try {
            const clinics = await API.request('/clinics');
            clinicSelect.innerHTML = clinics.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        } catch (err) {
            console.error('Failed to load clinics');
        }
    }

    // Refresh Dashboard Data
    async function refreshDashboard() {
        try {
            const history = await API.request('/users/history');
            
            // Check for active ticket (waiting or called)
            const active = history.find(t => t.status === 'waiting' || t.status === 'called');
            
            if (active) {
                joinSection.style.display = 'none';
                activeTicketSection.style.display = 'block';
                document.getElementById('ticket-num').textContent = `#${active.ticket_number}`;
                document.getElementById('active-clinic-name').textContent = active.clinic_name;
                
                const statusBadge = document.getElementById('active-status');
                statusBadge.textContent = active.status;
                statusBadge.className = `badge badge-${active.status}`;
                
                // Get all tickets for this clinic to calculate position
                const allQueue = await API.request(`/queues?clinic_id=${active.clinic_id}`);
                const waitingList = allQueue.filter(t => t.status === 'waiting').sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
                
                const myIndex = waitingList.findIndex(t => t.id === active.id);
                if (active.status === 'called') {
                    document.getElementById('people-ahead').textContent = 'NOW CALLED';
                    document.getElementById('wait-time').textContent = 'Please proceed to counter';
                } else if (myIndex !== -1) {
                    document.getElementById('people-ahead').textContent = myIndex;
                    document.getElementById('wait-time').textContent = `${(myIndex + 1) * 15} mins`; // Mock estimation
                }
            } else {
                joinSection.style.display = 'block';
                activeTicketSection.style.display = 'none';
            }

            // Update History Table
            if (history.length > 0) {
                historyBody.innerHTML = history.map(h => `
                    <tr>
                        <td>${new Date(h.created_at).toLocaleDateString()}</td>
                        <td>${h.clinic_name}</td>
                        <td>#${h.ticket_number}</td>
                        <td><span class="badge badge-${h.status}">${h.status}</span></td>
                    </tr>
                `).join('');
            }
        } catch (err) {
            console.error('Refresh failed', err);
        }
    }

    // Join Queue Handler
    document.getElementById('join-btn').addEventListener('click', async () => {
        const clinic_id = clinicSelect.value;
        if (!clinic_id) return;
        try {
            await API.request('/queues', 'POST', { clinic_id });
            refreshDashboard();
        } catch (err) {
            alert(err.message);
        }
    });

    // Cancel Handler
    document.getElementById('cancel-btn').addEventListener('click', async () => {
        const history = await API.request('/users/history');
        const active = history.find(t => t.status === 'waiting' || t.status === 'called');
        if (!active) return;
        
        if (confirm('Are you sure you want to cancel your ticket?')) {
            try {
                await API.request(`/queues/${active.id}`, 'DELETE');
                refreshDashboard();
            } catch (err) {
                alert(err.message);
            }
        }
    });

    // WebSocket for live updates
    function connectWS() {
        const ws = new WebSocket(CONFIG.WS_URL);
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'QUEUE_UPDATE') {
                refreshDashboard();
            }
        };
        ws.onclose = () => setTimeout(connectWS, 2000);
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

    await loadClinics();
    await refreshDashboard();
    connectWS();
});
