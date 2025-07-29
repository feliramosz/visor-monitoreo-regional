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

                // --- Inicio: Lógica para determinar el destino y manejar el pop-up de audio ---
                const userAgent = navigator.userAgent.toLowerCase();
                const isMobile = /mobi|iphone|ipad|android|tablet/.test(userAgent);

                const finalRedirectUrl = redirectTo || (isMobile ? '/version_mobil/mobile.html' : '/dashboard.html');

                // Mostrar el pop-up solo en la vista móvil si aún no ha dado permiso
                if (isMobile && !localStorage.getItem('audioPermitido')) {
                    const audioPopup = document.getElementById('audio-popup');
                    const btnAudioYes = document.getElementById('btn-audio-yes');
                    const btnAudioNo = document.getElementById('btn-audio-no');

                    if (audioPopup) {
                        audioPopup.style.display = 'flex';

                        // Asignar los eventos a los botones del pop-up
                        btnAudioYes.onclick = () => {
                            localStorage.setItem('audioPermitido', 'si');
                            window.location.href = finalRedirectUrl;
                        };
                        btnAudioNo.onclick = () => {
                            localStorage.setItem('audioPermitido', 'no');
                            window.location.href = finalRedirectUrl;
                        };
                    } else {
                        window.location.href = finalRedirectUrl; // Si el pop-up no existe por alguna razón, redirigir
                    }
                } else {
                    // Si no es un dispositivo móvil o si ya tiene la preferencia guardada, redirigir directamente
                    window.location.href = finalRedirectUrl;
                }

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