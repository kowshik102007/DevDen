document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user || user.role !== 'admin') return window.location.href = 'auth.html';

    const clinicFilter = document.getElementById('admin-clinic-filter');
    const queueBody = document.getElementById('admin-queue-body');
    const callingNow = document.getElementById('calling-now');
    const activeText = document.getElementById('active-calling-text');

    async function loadClinics() {
        try {
            const clinics = await API.request('/clinics');
            clinicFilter.innerHTML = '<option value="">All Clinics</option>' + 
                clinics.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
            document.getElementById('stat-clinics').textContent = clinics.length;
            
            // Mini list for management
            const miniList = document.getElementById('clinic-list-mini');
            miniList.innerHTML = clinics.map(c => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--glass-border);">
                    <span>${c.name}</span>
                    <button class="btn btn-secondary" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="deleteClinic(${c.id})">Delete</button>
                </div>
            `).join('');
        } catch (err) { console.error(err); }
    }

    async function refreshQueue() {
        const clinic_id = clinicFilter.value;
        const endpoint = clinic_id ? `/queues?clinic_id=${clinic_id}` : '/queues';
        
        try {
            const tickets = await API.request(endpoint);
            
            // Update Stats
            const waiting = tickets.filter(t => t.status === 'waiting').length;
            const served = tickets.filter(t => t.status === 'completed').length;
            document.getElementById('stat-waiting').textContent = waiting;
            document.getElementById('stat-served').textContent = served;

            // Find currently active (called) for this clinic
            const active = tickets.find(t => t.status === 'called');
            if (active) {
                callingNow.style.display = 'block';
                activeText.textContent = `Ticket #${active.ticket_number} (${active.user_name})`;
                callingNow.dataset.id = active.id;
            } else {
                callingNow.style.display = 'none';
            }

            // Fill Table
            if (tickets.length === 0) {
                queueBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No tickets found</td></tr>';
            } else {
                queueBody.innerHTML = tickets.map(t => `
                    <tr>
                        <td style="font-weight: 700;">#${t.ticket_number}</td>
                        <td>${t.user_name}</td>
                        <td style="font-size: 0.8rem; color: var(--text-secondary);">${new Date(t.created_at).toLocaleTimeString()}</td>
                        <td><span class="badge badge-${t.status}">${t.status}</span></td>
                        <td>
                            ${t.status === 'waiting' ? `<button class="btn btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.7rem;" onclick="callTicket('${t.id}', ${t.clinic_id})">Call</button>` : ''}
                            ${t.status === 'called' ? '<strong>CURRENT</strong>' : ''}
                        </td>
                    </tr>
                `).join('');
            }
        } catch (err) { console.error(err); }
    }

    // Handlers
    window.callTicket = async (id, clinic_id) => {
        try {
            // If already calling someone, complete them first? Or admin manual. 
            // In this simple version, we just call.
            await API.request('/admin/queue/next', 'POST', { clinic_id });
            refreshQueue();
        } catch (err) { alert(err.message); }
    };

    document.getElementById('call-next-btn').addEventListener('click', async () => {
        const cid = clinicFilter.value;
        if (!cid) return alert('Select a clinic first');
        window.callTicket(null, cid);
    });

    document.getElementById('complete-active-btn').addEventListener('click', async () => {
        const id = callingNow.dataset.id;
        await API.request(`/admin/queue/${id}`, 'PUT', { status: 'completed' });
        refreshQueue();
    });

    document.getElementById('skip-active-btn').addEventListener('click', async () => {
        const id = callingNow.dataset.id;
        await API.request(`/admin/queue/${id}`, 'PUT', { status: 'skipped' });
        refreshQueue();
    });

    document.getElementById('reset-btn').addEventListener('click', async () => {
        const cid = clinicFilter.value;
        if (!cid) return alert('Select a clinic to reset');
        if (confirm('Reset ALL tickets for this clinic? This cannot be undone.')) {
            await API.request('/admin/queue/reset', 'POST', { clinic_id: cid });
            refreshQueue();
        }
    });

    clinicFilter.addEventListener('change', refreshQueue);

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.clear();
        window.location.href = 'index.html';
    });

    // Modal Handling
    const modal = document.getElementById('clinic-modal');
    document.getElementById('add-clinic-btn').addEventListener('click', () => modal.style.display = 'flex');
    document.getElementById('close-modal-btn').addEventListener('click', () => modal.style.display = 'none');
    
    document.getElementById('save-clinic-btn').addEventListener('click', async () => {
        const name = document.getElementById('clinic-name-input').value;
        const avg = document.getElementById('clinic-time-input').value;
        if (!name) return;
        try {
            await API.request('/clinics', 'POST', { name, avg_service_time: parseInt(avg) });
            modal.style.display = 'none';
            loadClinics();
        } catch (err) { alert(err.message); }
    });

    window.deleteClinic = async (id) => {
        if (confirm('Delete this clinic and all associated data?')) {
            await API.request(`/clinics/${id}`, 'DELETE');
            loadClinics();
        }
    }

    // WS
    const ws = new WebSocket(CONFIG.WS_URL);
    ws.onmessage = () => refreshQueue();

    await loadClinics();
});
