/**
 * Configuracion global de CumbiaChat
 */

const CONFIG = {
    // URL base del proxy/API REST
    API_BASE_URL: 'http://localhost:5000',
    
    // Endpoints especificos
    ENDPOINTS: {
        LOGIN: '/api/auth/register',
        LOGOUT: '/api/auth/logout',
        USERS: '/api/users/active',
        GROUPS: '/api/groups/available',
        CREATE_GROUP: '/api/groups/create',
        JOIN_GROUP: '/api/groups/join',
        MESSAGE_GROUP: '/api/messages/group',
        MESSAGE_PRIVATE: '/api/messages/private',
        AUDIO_GROUP: '/api/messages/group/audio',
        AUDIO_PRIVATE: '/api/messages/private/audio',
        HISTORY_PRIVATE: '/api/history/private',
        HISTORY_GROUP: '/api/history/group'
    },
    
    // Configuracion de la aplicacion
    APP: {
        NAME: 'CumbiaChat',
        VERSION: '2.0',
        MIN_USERNAME_LENGTH: 3,
        MAX_USERNAME_LENGTH: 20,
        MESSAGE_MAX_LENGTH: 500,
        POLL_INTERVAL: 3000
    },
    
    // Mensajes de la aplicacion
    MESSAGES: {
        LOGIN: {
            SUCCESS: 'Bienvenido',
            ERROR_GENERIC: 'No pudimos conectarte. Intenta de nuevo.',
            ERROR_USERNAME_SHORT: 'El nombre debe tener al menos 3 caracteres',
            ERROR_USERNAME_TAKEN: 'Ese nombre ya esta en uso',
            ERROR_CONNECTION: 'No hay conexion con el servidor'
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

// Funcion auxiliar para construir URLs
const buildUrl = (endpoint) => {
    return `${CONFIG.API_BASE_URL}${endpoint}`;
};

// Exportar para uso en otros scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
