/**
 * Lógica de la página de Login (Adaptada para Ice + Socket.io)
 */

// --- CONEXIÓN SOCKET.IO ---
const socket = io(); 

// Elementos del DOM
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const btnLogin = document.getElementById('btnLogin');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const loader = document.getElementById('loader');

function showLoader() {
    loader.style.display = 'flex';
    btnLogin.disabled = true;
}

function hideLoader() {
    loader.style.display = 'none';
    btnLogin.disabled = false;
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.style.display = 'flex';
    setTimeout(() => { hideError(); }, 5000);
}

function hideError() {
    errorMessage.style.display = 'none';
}

function validateUsername(username) {
    const trimmed = username.trim();
    const minLength = (typeof CONFIG !== 'undefined' && CONFIG.APP) ? CONFIG.APP.MIN_USERNAME_LENGTH : 3;
    const maxLength = (typeof CONFIG !== 'undefined' && CONFIG.APP) ? CONFIG.APP.MAX_USERNAME_LENGTH : 20;

    if (trimmed.length < minLength) return { valid: false, error: `Mínimo ${minLength} caracteres` };
    if (trimmed.length > maxLength) return { valid: false, error: `Máximo ${maxLength} caracteres` };

    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(trimmed)) return { valid: false, error: 'Solo letras, números y guiones bajos' };

    return { valid: true, username: trimmed };
}

function saveSession(username) {
    localStorage.setItem("cumbiachat_username", username);
    localStorage.setItem("cumbiachat_session", Date.now().toString());
}

function redirectToChat() {
    window.location.href = 'chat.html';
}

/**
 * Maneja el submit (USA SOCKET.IO EN LUGAR DE REST)
 */
async function handleLogin(event) {
    event.preventDefault();
    hideError();

    const username = usernameInput.value;
    const validation = validateUsername(username);
    if (!validation.valid) {
        showError(validation.error);
        usernameInput.focus();
        return;
    }

    showLoader();

    // Emitimos evento de login por Socket para conectar con Ice
    console.log('Login Socket.io:', validation.username);
    socket.emit('login', { username: validation.username });
}

// ESCUCHAR RESPUESTA DEL SERVIDOR
socket.on('login_response', (data) => {
    hideLoader();
    if (data.success) {
        console.log('Login exitoso:', data);
        saveSession(data.username);
        setTimeout(() => { redirectToChat(); }, 500);
    } else {
        console.error('Error login:', data.message);
        const errorMsg = data.message || "Error desconocido";
        if (errorMsg.includes('ya conectado') || errorMsg.includes('already')) {
            showError("El usuario ya está conectado");
        } else {
            showError(errorMsg);
        }
    }
});

socket.on('connect_error', () => {
    hideLoader();
    showError("No se puede conectar al servidor");
});

function checkExistingSession() {
    const savedUsername = localStorage.getItem("cumbiachat_username");
    const savedSession = localStorage.getItem("cumbiachat_session");

    if (savedUsername && savedSession) {
        const sessionTime = parseInt(savedSession);
        const currentTime = Date.now();
        const hoursSinceLogin = (currentTime - sessionTime) / (1000 * 60 * 60);

        if (hoursSinceLogin < 24) {
            console.log('Sesión activa, redirigiendo...');
            redirectToChat();
        }
    }
}

function setupInputEffects() {
    usernameInput.addEventListener('input', () => hideError());
}

function init() {
    checkExistingSession();
    loginForm.addEventListener('submit', handleLogin);
    setupInputEffects();
    usernameInput.focus();
    console.log('🎵 CumbiaChat Login (Socket) inicializado');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}