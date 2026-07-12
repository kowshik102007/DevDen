document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const tabLogin = document.getElementById('tab-login');
    const tabRegister = document.getElementById('tab-register');
    const errorDiv = document.getElementById('auth-error');

    // Tab Switching
    tabLogin.addEventListener('click', () => {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        tabLogin.className = 'btn btn-primary';
        tabRegister.className = 'btn btn-secondary';
        errorDiv.textContent = '';
    });

    tabRegister.addEventListener('click', () => {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        tabLogin.className = 'btn btn-secondary';
        tabRegister.className = 'btn btn-primary';
        errorDiv.textContent = '';
    });

    // Login Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.textContent = '';
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const data = await API.request('/auth/login', 'POST', { email, password });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            window.location.href = data.user.role === 'admin' ? 'admin-dashboard.html' : 'user-dashboard.html';
        } catch (err) {
            errorDiv.textContent = err.message;
        }
    });

    // Register Handler
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorDiv.textContent = '';
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        try {
            const data = await API.request('/auth/register', 'POST', { name, email, password });
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            window.location.href = 'user-dashboard.html';
        } catch (err) {
            errorDiv.textContent = err.message;
        }
    });
});
