/* Kerala Railway Gate Status App — Frontend JavaScript */

const API_BASE = '/api';
let map, gateMarkers = {}, refreshTimer;

// Color mapping for gate statuses
const STATUS_COLORS = {
    OPEN: '#4caf50',
    WARNING: '#ff9800',
    CLOSED: '#f44336',
    UNKNOWN: '#9e9e9e',
};

// --- Map Page ---

function initMap() {
    // Center on Kerala
    map = L.map('map').setView([10.5, 76.3], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
    }).addTo(map);

    loadGates();

    // Auto-refresh every 60 seconds
    refreshTimer = setInterval(loadGates, 60000);
}

async function loadGates() {
    try {
        const resp = await fetch(`${API_BASE}/gates`);
        const gates = await resp.json();
        updateMapMarkers(gates);
        updateStatsBar(gates);
    } catch (err) {
        console.error('Failed to load gates:', err);
    }
}

function updateMapMarkers(gates) {
    gates.forEach(gate => {
        const color = STATUS_COLORS[gate.status] || STATUS_COLORS.UNKNOWN;

        if (gateMarkers[gate.gate_id]) {
            // Update existing marker
            gateMarkers[gate.gate_id].setStyle({ fillColor: color, color: color });
            gateMarkers[gate.gate_id].unbindPopup();
        } else {
            // Create new marker
            const marker = L.circleMarker([gate.lat, gate.lon], {
                radius: 6,
                fillColor: color,
                color: color,
                weight: 1,
                opacity: 0.9,
                fillOpacity: 0.8,
            }).addTo(map);

            gateMarkers[gate.gate_id] = marker;
        }

        // Build popup content
        let popupHtml = `<div class="gate-popup">`;
        popupHtml += `<h3>${escapeHtml(gate.display_name)}</h3>`;
        popupHtml += `<span class="status-badge ${gate.status.toLowerCase()}">${gate.status}</span>`;

        if (gate.next_train) {
            popupHtml += `<div class="train-info">`;
            popupHtml += `Next: ${escapeHtml(gate.next_train.train_name)} (#${gate.next_train.train_number})`;
            if (gate.minutes_until_closing !== null) {
                popupHtml += `<br>Crossing in ~${Math.round(gate.minutes_until_closing)} min`;
            }
            popupHtml += `</div>`;
        }

        popupHtml += `<a class="detail-link" href="/gate?id=${encodeURIComponent(gate.gate_id)}">View details &rarr;</a>`;
        popupHtml += `</div>`;

        gateMarkers[gate.gate_id].bindPopup(popupHtml);
    });
}

function updateStatsBar(gates) {
    const counts = { OPEN: 0, WARNING: 0, CLOSED: 0, UNKNOWN: 0 };
    gates.forEach(g => {
        counts[g.status] = (counts[g.status] || 0) + 1;
    });

    const el = document.getElementById('stats-bar');
    if (el) {
        el.innerHTML = `
            <div class="stat-item"><span class="stat-dot open"></span> ${counts.OPEN} Open</div>
            <div class="stat-item"><span class="stat-dot warning"></span> ${counts.WARNING} Warning</div>
            <div class="stat-item"><span class="stat-dot closed"></span> ${counts.CLOSED} Closed</div>
            <div class="stat-item"><span class="stat-dot unknown"></span> ${counts.UNKNOWN} Unknown</div>
        `;
    }
}

function locateMe() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        pos => {
            const { latitude, longitude } = pos.coords;
            map.setView([latitude, longitude], 14);

            // Mark user position
            L.marker([latitude, longitude], {
                icon: L.divIcon({
                    className: '',
                    html: '<div style="width:14px;height:14px;background:#2196f3;border:3px solid white;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.3)"></div>',
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                }),
            }).addTo(map).bindPopup('You are here');

            // Load nearby gates
            loadNearbyGates(latitude, longitude);
        },
        err => {
            alert('Could not get your location. Please allow location access.');
        }
    );
}

async function loadNearbyGates(lat, lon) {
    try {
        const resp = await fetch(`${API_BASE}/gates/nearby?lat=${lat}&lon=${lon}&radius=5`);
        const gates = await resp.json();
        if (gates.length === 0) {
            alert('No railway gates found within 5 km.');
        }
    } catch (err) {
        console.error('Failed to load nearby gates:', err);
    }
}


// --- Gate Detail Page ---

async function loadGateDetail() {
    const params = new URLSearchParams(window.location.search);
    const gateId = params.get('id');
    if (!gateId) {
        document.getElementById('gate-content').innerHTML = '<p>No gate ID provided.</p>';
        return;
    }

    try {
        const resp = await fetch(`${API_BASE}/gates/${encodeURIComponent(gateId)}`);
        if (!resp.ok) throw new Error('Gate not found');
        const gate = await resp.json();
        renderGateDetail(gate);
    } catch (err) {
        document.getElementById('gate-content').innerHTML = `<p>Error loading gate: ${err.message}</p>`;
    }
}

function renderGateDetail(gate) {
    const statusClass = gate.status.toLowerCase();

    let countdownText = '';
    if (gate.minutes_until_closing !== null && gate.status !== 'OPEN') {
        const mins = Math.round(gate.minutes_until_closing);
        countdownText = `<span class="countdown">${mins} min</span>`;
    }

    let trainsHtml = '';
    if (gate.upcoming_trains && gate.upcoming_trains.length > 0) {
        trainsHtml = gate.upcoming_trains.map(t => {
            let delayBadge = '';
            if (t.delay_minutes > 0) {
                delayBadge = `<span class="delay-badge">+${t.delay_minutes} min late</span>`;
            } else if (t.delay_minutes === 0) {
                delayBadge = `<span class="ontime-badge">On time</span>`;
            }
            return `
            <div class="train-row">
                <div>
                    <div class="train-name">${escapeHtml(t.train_name)}</div>
                    <div class="train-number">#${t.train_number} | ${t.prev_station} &rarr; ${t.next_station}</div>
                </div>
                <div>
                    <div class="train-time">${t.estimated_time} ${delayBadge}</div>
                    <div class="train-eta">${Math.round(t.minutes_away)} min away</div>
                </div>
            </div>
        `}).join('');
    } else {
        trainsHtml = '<div class="no-trains">No upcoming trains in the next 15 minutes</div>';
    }

    document.getElementById('gate-content').innerHTML = `
        <div id="detail-map"></div>
        <div class="gate-header">
            <h2>${escapeHtml(gate.display_name)}</h2>
            <div class="gate-meta">
                <span>${escapeHtml(gate.road_name || 'Unknown road')}</span>
                <span>${escapeHtml(gate.nearest_place || '')}</span>
                <span>${escapeHtml(gate.district || '')}</span>
            </div>
            <div class="status-large ${statusClass}">
                ${gate.status} ${countdownText}
            </div>
        </div>
        <div class="train-list">
            <h3>Upcoming Trains</h3>
            ${trainsHtml}
        </div>
    `;

    // Initialize mini map
    const miniMap = L.map('detail-map').setView([gate.lat, gate.lon], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OSM',
        maxZoom: 18,
    }).addTo(miniMap);

    const color = STATUS_COLORS[gate.status] || STATUS_COLORS.UNKNOWN;
    L.circleMarker([gate.lat, gate.lon], {
        radius: 10,
        fillColor: color,
        color: color,
        weight: 2,
        fillOpacity: 0.8,
    }).addTo(miniMap);

    // Auto-refresh detail page every 60 seconds
    setTimeout(loadGateDetail, 60000);
}


// --- Search Page ---

let allGatesCache = null;

async function initSearch() {
    const searchInput = document.getElementById('search-input');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // Load all gates
    try {
        const resp = await fetch(`${API_BASE}/gates`);
        allGatesCache = await resp.json();
        renderSearchResults(allGatesCache);
    } catch (err) {
        document.getElementById('search-results').innerHTML = '<p>Error loading gates.</p>';
    }

    // Search input handler
    searchInput.addEventListener('input', () => {
        filterAndRender();
    });

    // Filter button handlers
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.classList.toggle('active');
            filterAndRender();
        });
    });
}

function filterAndRender() {
    if (!allGatesCache) return;

    const query = document.getElementById('search-input').value.toLowerCase().trim();
    const activeFilters = Array.from(document.querySelectorAll('.filter-btn.active'))
        .map(btn => btn.dataset.status);

    let filtered = allGatesCache;

    if (query) {
        filtered = filtered.filter(g =>
            g.display_name.toLowerCase().includes(query) ||
            (g.district || '').toLowerCase().includes(query) ||
            g.gate_id.toLowerCase().includes(query)
        );
    }

    if (activeFilters.length > 0) {
        filtered = filtered.filter(g => activeFilters.includes(g.status));
    }

    renderSearchResults(filtered);
}

function renderSearchResults(gates) {
    const container = document.getElementById('search-results');

    if (gates.length === 0) {
        container.innerHTML = '<div class="no-trains">No gates found matching your search.</div>';
        return;
    }

    container.innerHTML = gates.map(g => {
        const statusClass = g.status.toLowerCase();
        let extra = '';
        if (g.next_train) {
            extra = `Next: ${g.next_train.train_name} in ~${Math.round(g.minutes_until_closing)} min`;
        }

        return `
            <a class="gate-card" href="/gate?id=${encodeURIComponent(g.gate_id)}">
                <div class="gate-card-info">
                    <h4>${escapeHtml(g.display_name)}</h4>
                    <p>${escapeHtml(g.district || '')}</p>
                </div>
                <div class="gate-card-status">
                    <span class="status-badge ${statusClass}">${g.status}</span>
                    <div style="font-size:11px;color:#888;margin-top:4px">${extra}</div>
                </div>
            </a>
        `;
    }).join('');
}


// --- Utility ---

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
