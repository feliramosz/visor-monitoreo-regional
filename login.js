document.addEventListener('DOMContentLoaded', () => {
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
                // Login exitoso, guardar token
                localStorage.setItem('session_token', data.token);

                // Lógica de redirección inteligente
                const urlParams = new URLSearchParams(window.location.search);
                const redirectTo = urlParams.get('redirect_to');
                
                // Si hay un parámetro de redirección, úsalo. Si no, ve al dashboard por defecto.
                window.location.href = redirectTo || '/dashboard.html';

            } else {
                // Mostrar error del servidor (ej. "Usuario o contraseña inválidos")
                errorMessageDiv.textContent = data.error || 'Ocurrió un error.';
            }
        } catch (error) {
            // Mostrar error de conexión (ej. el servidor está caído)
            errorMessageDiv.textContent = 'Error de conexión con el servidor.';
        }
    });
});