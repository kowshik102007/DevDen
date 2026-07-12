const API = {
    async request(endpoint, method = 'GET', body = null) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        try {
            const response = await fetch(`${CONFIG.API_URL}${endpoint}`, options);
            const data = await response.json();
            
            if (!response.ok) {
                if (response.status === 401 && !endpoint.includes('/auth/')) {
                    // Token expired or invalid
                    localStorage.clear();
                    window.location.href = 'auth.html';
                }
                throw new Error(data.error || 'Request failed');
            }
            return data;
        } catch (err) {
            console.error(`API Error (${endpoint}):`, err);
            throw err;
        }
    }
};
