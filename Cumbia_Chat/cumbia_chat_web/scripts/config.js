/**
 * Configuración global de CumbiaChat
 */

const CONFIG = {
    // URL base del proxy/API REST
    API_BASE_URL: 'http://localhost:5000',
    
    // Endpoints específicos
    ENDPOINTS: {
        LOGIN: '/api/auth/login',
        LOGOUT: '/api/auth/logout',
        USERS: '/api/users',
        GROUPS: '/api/groups',
        JOIN_GROUP: '/api/groups/join',
        MESSAGE_GROUP: '/api/messages/group',
        MESSAGE_PRIVATE: '/api/messages/private',
        AUDIO_GROUP: '/api/messages/group/audio',
        AUDIO_PRIVATE: '/api/messages/private/audio',
        HISTORY_PRIVATE: '/api/history/private',
        HISTORY_GROUP: '/api/history/group'
    },
    
    // Configuración de la aplicación
    APP: {
        NAME: 'CumbiaChat',
        VERSION: '2.0',
        MIN_USERNAME_LENGTH: 3,
        MAX_USERNAME_LENGTH: 20,
        MESSAGE_MAX_LENGTH: 500,
        POLL_INTERVAL: 3000 // Intervalo para polling de mensajes (ms)
    },
    
    // Mensajes de la aplicación
    MESSAGES: {
        LOGIN: {
            SUCCESS: '¡Bienvenido al ritmo! 🎵',
            ERROR_GENERIC: 'No pudimos conectarte. Intenta de nuevo.',
            ERROR_USERNAME_SHORT: 'El nombre debe tener al menos 3 caracteres',
            ERROR_USERNAME_TAKEN: 'Ese nombre ya está en uso. ¡Elige otro!',
            ERROR_CONNECTION: 'No hay conexión con el servidor'
        },
        CHAT: {
            SEND_SUCCESS: 'Mensaje enviado',
            SEND_ERROR: 'No se pudo enviar el mensaje',
            GROUP_CREATED: 'Grupo creado exitosamente',
            GROUP_JOINED: 'Te uniste al grupo',
            NO_USERS: 'No hay usuarios conectados',
            NO_GROUPS: 'No hay grupos disponibles'
        }
    },
    
    // Almacenamiento local
    STORAGE_KEYS: {
        USERNAME: 'cumbiachat_username',
        SESSION: 'cumbiachat_session'
    }
};

// Función auxiliar para construir URLs
const buildUrl = (endpoint) => {
    return `${CONFIG.API_BASE_URL}${endpoint}`;
};

// Exportar para uso en otros scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}