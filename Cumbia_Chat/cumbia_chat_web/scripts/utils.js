// ===== GESTIÓN DE SESIÓN =====

/**
 * Obtiene el usuario actual de la sesión
 */
function getCurrentUser() {
    return localStorage.getItem(CONFIG.STORAGE_KEYS.USERNAME);
}

/**
 * Verifica si hay sesión activa
 */
function checkSession() {
    const username = getCurrentUser();
    if (!username) {
        window.location.href = 'index.html';
        return null;
    }
    return username;
}

/**
 * Cierra la sesión
 */
function logout() {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USERNAME);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.SESSION);
    window.location.href = 'index.html';
}

// ===== NOTIFICACIONES =====

/**
 * Muestra un toast de notificación
 */
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    const toastIcon = document.getElementById('toastIcon');
    const toastMessage = document.getElementById('toastMessage');

    // Iconos según el tipo
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toastIcon.textContent = icons[type] || icons.info;
    toastMessage.textContent = message;

    toast.style.display = 'flex';

    setTimeout(() => {
        toast.style.display = 'none';
    }, duration);
}

// ===== LOADER =====

let loaderCount = 0;

/**
 * Muestra el loader global
 */
function showLoader() {
    loaderCount++;
    document.getElementById('loader').style.display = 'flex';
}

/**
 * Oculta el loader global
 */
function hideLoader() {
    loaderCount = Math.max(0, loaderCount - 1);
    if (loaderCount === 0) {
        document.getElementById('loader').style.display = 'none';
    }
}

// ===== FORMATEO =====

/**
 * Formatea una fecha/hora
 */
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
        return date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } else {
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

/**
 * Obtiene las iniciales de un nombre
 */
function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Genera un emoji aleatorio para avatar
 */
function getRandomEmoji(name) {
    const emojis = ['🎵', '🎶', '🎸', '🎹', '🎺', '🎷', '🥁', '🎤', '🎧', '🎼'];
    const index = name.charCodeAt(0) % emojis.length;
    return emojis[index];
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Trunca texto largo
 */
function truncate(text, maxLength = 50) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ===== VALIDACIONES =====

/**
 * Valida que un string no esté vacío
 */
function isNotEmpty(str) {
    return str && str.trim().length > 0;
}

/**
 * Valida longitud de mensaje
 */
function isValidMessageLength(message) {
    const trimmed = message.trim();
    return trimmed.length > 0 && trimmed.length <= CONFIG.APP.MESSAGE_MAX_LENGTH;
}

// ===== DEBOUNCE =====

/**
 * Debounce para búsquedas
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== ANIMACIONES =====

/**
 * Scroll suave a un elemento
 */
function smoothScrollTo(element) {
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'end'
        });
    }
}

/**
 * Anima la aparición de un elemento
 */
function animateIn(element, animationClass = 'fade-in') {
    element.classList.add(animationClass);
    setTimeout(() => {
        element.classList.remove(animationClass);
    }, 600);
}

// ===== AUDIO =====

/**
 * Reproduce un sonido de notificación
 */
function playNotificationSound() {
    // Por implementar si quieren agregar sonidos
    // const audio = new Audio('sounds/notification.mp3');
    // audio.play().catch(e => console.log('Audio bloqueado'));
}

// ===== STORAGE HELPERS =====

/**
 * Guarda datos en localStorage
 */
function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        console.error('Error guardando en storage:', e);
        return false;
    }
}

/**
 * Lee datos de localStorage
 */
function getFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
        console.error('Error leyendo storage:', e);
        return defaultValue;
    }
}

// ===== DOM HELPERS =====

/**
 * Crea un elemento HTML con atributos
 */
function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);

    Object.keys(attributes).forEach(key => {
        if (key === 'className') {
            element.className = attributes[key];
        } else if (key === 'textContent') {
            element.textContent = attributes[key];
        } else {
            element.setAttribute(key, attributes[key]);
        }
    });

    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else {
            element.appendChild(child);
        }
    });

    return element;
}

/**
 * Limpia el contenido de un elemento
 */
function clearElement(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

// ===== DETECTORES =====

/**
 * Detecta si es un dispositivo móvil
 */
function isMobile() {
    return window.innerWidth <= 768;
}

/**
 * Detecta si el navegador soporta notificaciones
 */
function supportsNotifications() {
    return 'Notification' in window;
}

// ===== CLIPBOARD =====

/**
 * Copia texto al portapapeles
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copiado al portapapeles', 'success');
        return true;
    } catch (err) {
        console.error('Error copiando:', err);
        showToast('No se pudo copiar', 'error');
        return false;
    }
}