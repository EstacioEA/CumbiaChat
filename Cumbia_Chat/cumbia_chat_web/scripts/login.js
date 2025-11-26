/**
 * Lógica de la página de Login
 * ADAPTADA PARA SOCKET.IO + ICE (Mantiene tu estilo y validaciones)
 */

// --- CONEXIÓN SOCKET.IO (Necesaria para Ice) ---
const socket = io();

// Elementos del DOM
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('username');
const btnLogin = document.getElementById('btnLogin');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const loader = document.getElementById('loader');

// --- FUNCIONES DE UI (Tus funciones originales) ---

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
    // Usamos valores default si CONFIG no cargó, para evitar errores
    const minLength = (typeof CONFIG !== 'undefined' && CONFIG.APP) ? CONFIG.APP.MIN_USERNAME_LENGTH : 3;
    const maxLength = (typeof CONFIG !== 'undefined' && CONFIG.APP) ? CONFIG.APP.MAX_USERNAME_LENGTH : 20;

    if (trimmed.length < minLength) return { valid: false, error: `Mínimo ${minLength} caracteres` };
    if (trimmed.length > maxLength) return { valid: false, error: `Máximo ${maxLength} caracteres` };

    const validPattern = /^[a-zA-Z0-9_]+$/;
    if (!validPattern.test(trimmed)) return { valid: false, error: 'Solo letras, números y guiones bajos' };

    return { valid: true, username: trimmed };
}

function saveSession(username) {
    // Usamos keys específicas para evitar conflictos
    localStorage.setItem("cumbiachat_username", username);
    localStorage.setItem("cumbiachat_session", Date.now().toString());
}

function redirectToChat() {
    window.location.href = 'chat.html';
}

// --- LÓGICA DE LOGIN (MODIFICADA PARA SOCKETS) ---

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

    // CAMBIO CLAVE: Login vía Socket.io
    console.log('Iniciando login via Socket.io para:', validation.username);
    socket.emit('login', { username: validation.username });
}

// Escuchar respuesta del servidor (Node + Ice)
socket.on('login_response', (data) => {
    // Pequeño delay para que se vea tu animación de vinilo
    setTimeout(() => {
        hideLoader();
        
        if (data.success) {
            console.log('Login exitoso:', data);
            saveSession(data.username);
            redirectToChat();
        } else {
            console.error('Error login:', data.message);
            const errorMsg = data.message || "Error desconocido";
            
            if (errorMsg.includes('ya conectado') || errorMsg.includes('already')) {
                showError("El usuario ya está conectado");
            } else {
                showError(errorMsg); // Muestra el error técnico si lo hay
            }
        }
    }, 800); // 800ms de "efecto carga"
});

socket.on('connect_error', () => {
    hideLoader();
    showError("No se puede conectar al servidor (Node.js)");
});

// --- INICIALIZACIÓN (Tu lógica original) ---

function checkExistingSession() {
    const savedUsername = localStorage.getItem("cumbiachat_username");
    const savedSession = localStorage.getItem("cumbiachat_session");

    if (savedUsername && savedSession) {
        const sessionTime = parseInt(savedSession);
        const currentTime = Date.now();
        // Sesión válida por 24 horas
        if ((currentTime - sessionTime) < (24 * 60 * 60 * 1000)) {
            console.log('Sesión activa, redirigiendo...');
            redirectToChat();
        }
    }
}

function setupInputEffects() {
    usernameInput.addEventListener('input', () => hideError());
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') loginForm.dispatchEvent(new Event('submit'));
    });
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