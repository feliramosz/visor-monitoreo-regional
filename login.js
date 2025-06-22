document.addEventListener('DOMContentLoaded', () => {
    // Redirigir si el usuario ya tiene un token
    if (localStorage.getItem('session_token')) {
        window.location.href = '/admin.html';
    }

    const loginForm = document.getElementById('login-form');
    const errorMessageDiv = document.getElementById('error-message');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorMessageDiv.textContent = '';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Login exitoso, guardar token y redirigir
                localStorage.setItem('session_token', data.token);
                window.location.href = '/admin.html';
            } else {
                // Mostrar error
                errorMessageDiv.textContent = data.error || 'Ocurrió un error.';
            }
        } catch (error) {
            errorMessageDiv.textContent = 'Error de conexión con el servidor.';
        }
    });
});