/**
 * Lógica de la página de Login
 */

// Elementos del DOM
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const btnLogin = document.getElementById('btnLogin');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const loader = document.getElementById('loader');

/**
 * Muestra el loader
 */
function showLoader() {
    loader.style.display = 'flex';
    btnLogin.disabled = true;
}

/**
 * Oculta el loader
 */
function hideLoader() {
    loader.style.display = 'none';
    btnLogin.disabled = false;
}

/**
 * Muestra un mensaje de error
 */
function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'flex';

    // Auto-ocultar después de 5 segundos
    setTimeout(() => {
        hideError();
    }, 5000);
}

/**
 * Oculta el mensaje de error
 */
function hideError() {
    errorMessage.style.display = 'none';
}

/**
 * Valida el nombre de usuario
 */
function validateUsername(username) {
    const trimmed = username.trim();

    if (trimmed.length < CONFIG.APP.MIN_USERNAME_LENGTH) {
        return {
            valid: false,
            error: CONFIG.MESSAGES.LOGIN.ERROR_USERNAME_SHORT
        };
    }

    if (trimmed.length > CONFIG.APP.MAX_USERNAME_LENGTH) {
        return {
            valid: false,
            error: `El nombre no puede tener más de ${CONFIG.APP.MAX_USERNAME_LENGTH} caracteres`
        };
    }

    // Validar caracteres permitidos (alfanuméricos y guiones bajos)
    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(trimmed)) {
        return {
            valid: false,
            error: 'Solo se permiten letras, números y guiones bajos'
        };
    }

    return {
        valid: true,
        username: trimmed
    };
}

/**
 * Guarda la sesión del usuario
 */
function saveSession(username) {
    localStorage.setItem(CONFIG.STORAGE_KEYS.USERNAME, username);
    localStorage.setItem(CONFIG.STORAGE_KEYS.SESSION, Date.now().toString());
}

/**
 * Redirige al chat
 */
function redirectToChat() {
    window.location.href = 'chat.html';
}

/**
 * Maneja el submit del formulario
 */
async function handleLogin(event) {
    event.preventDefault();
    hideError();

    const username = usernameInput.value;

    // Validar username
    const validation = validateUsername(username);
    if (!validation.valid) {
        showError(validation.error);
        usernameInput.focus();
        return;
    }

    // Mostrar loader
    showLoader();

    try {
        // Llamar a la API
        const response = await api.login(validation.username);

        if (response.success) {
            // Login exitoso
            console.log('Login exitoso:', response.data);

            // Guardar sesión
            saveSession(validation.username);

            // Pequeña pausa para mostrar animación
            setTimeout(() => {
                hideLoader();
                redirectToChat();
            }, 800);

        } else {
            // Error en el login
            hideLoader();

            // Determinar tipo de error
            const errorMsg = response.error || CONFIG.MESSAGES.LOGIN.ERROR_GENERIC;

            if (errorMsg.includes('ya conectado') || errorMsg.includes('already')) {
                showError(CONFIG.MESSAGES.LOGIN.ERROR_USERNAME_TAKEN);
            } else {
                showError(errorMsg);
            }
        }

    } catch (error) {
        console.error('Error inesperado:', error);
        hideLoader();
        showError(CONFIG.MESSAGES.LOGIN.ERROR_CONNECTION);
    }
}

/**
 * Verifica si ya hay sesión activa
 */
function checkExistingSession() {
    const savedUsername = localStorage.getItem(CONFIG.STORAGE_KEYS.USERNAME);
    const savedSession = localStorage.getItem(CONFIG.STORAGE_KEYS.SESSION);

    if (savedUsername && savedSession) {
        // Verificar que la sesión no sea muy antigua (opcional)
        const sessionTime = parseInt(savedSession);
        const currentTime = Date.now();
        const hoursSinceLogin = (currentTime - sessionTime) / (1000 * 60 * 60);

        // Si la sesión tiene menos de 24 horas, redirigir
        if (hoursSinceLogin < 24) {
            console.log('Sesión existente encontrada, redirigiendo...');
            redirectToChat();
        }
    }
}

/**
 * Agrega efectos visuales al input
 */
function setupInputEffects() {
    usernameInput.addEventListener('input', () => {
        hideError();
    });

    usernameInput.addEventListener('keypress', (e) => {
        // Enter también dispara el submit
        if (e.key === 'Enter') {
            loginForm.dispatchEvent(new Event('submit'));
        }
    });
}

/**
 * Inicialización
 */
function init() {
    // Verificar sesión existente
    checkExistingSession();

    // Agregar event listeners
    loginForm.addEventListener('submit', handleLogin);
    setupInputEffects();

    // Focus automático en el input
    usernameInput.focus();

    console.log('🎵 CumbiaChat Login inicializado');
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}