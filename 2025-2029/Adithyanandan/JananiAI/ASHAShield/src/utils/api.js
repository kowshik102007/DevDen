/**
 * utils/api.js
 *
 * WHY THIS FILE EXISTS:
 * When WiFi is opportunistically available, the app syncs unsynced visits to
 * the FastAPI backend (run by the backend teammate) so the ANM supervisor
 * dashboard gets updated.
 *
 * ALL calls are wrapped in try/catch — if there is no internet, the call
 * silently fails and the data stays in SQLite until the next sync opportunity.
 *
 * BASE URL points to the local FastAPI dev server.
 * In production this would be the NIC cloud endpoint.
 */

const BASE_URL = 'http://10.0.2.2:8000'; // 10.0.2.2 = host machine from Android emulator

/**
 * syncVisit(visitData)
 * Sends a single visit record to POST /visits on the backend.
 * Called by the sync button on the supervisor screen.
 * Returns true on success, false on failure.
 */
export const syncVisit = async (visitData) => {
  try {
    const response = await fetch(`${BASE_URL}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visitData),
    });
    return response.ok; // HTTP 200–299 = success
  } catch (_) {
    return false; // no connectivity — will retry next time
  }
};

/**
 * fetchSupervisorStats(district)
 * GET /supervisor/stats?district=Barmer
 * Returns aggregate stats for the supervisor dashboard.
 * Only called when supervisor is on WiFi.
 */
export const fetchSupervisorStats = async (district) => {
  try {
    const res = await fetch(`${BASE_URL}/supervisor/stats?district=${district}`);
    if (res.ok) return await res.json();
    return null;
  } catch (_) {
    return null; // offline — show local-only data
  }
};

/**
 * checkBackendHealth()
 * Simple ping to know if backend is reachable before attempting sync.
 * Returns boolean.
 */
export const checkBackendHealth = async () => {
  try {
    const res = await fetch(`${BASE_URL}/health`, { method: 'GET' });
    return res.ok;
  } catch (_) {
    return false;
  }
};
