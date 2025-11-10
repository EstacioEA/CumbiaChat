/**
 * Cliente API para CumbiaChat
 * Maneja todas las llamadas HTTP al proxy/backend
 */

class CumbiaChatAPI {
    constructor() {
        this.baseUrl = CONFIG.API_BASE_URL;
    }

    /**
     * Realiza una petición HTTP genérica
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const config = { ...defaultOptions, ...options };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || data.message || 'Error en la petición');
            }

            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error(`Error en ${endpoint}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Login de usuario
     */
    async login(username) {
        return await this.request(CONFIG.ENDPOINTS.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ username })
        });
    }

    /**
     * Logout de usuario
     */
    async logout(username) {
        return await this.request(CONFIG.ENDPOINTS.LOGOUT, {
            method: 'POST',
            body: JSON.stringify({ username })
        });
    }

    /**
     * Obtener usuarios activos
     */
    async getActiveUsers(username) {
        return await this.request(`${CONFIG.ENDPOINTS.USERS}?user=${username}`, {
            method: 'GET'
        });
    }

    /**
     * Obtener grupos disponibles
     */
    async getAvailableGroups(username) {
        return await this.request(`${CONFIG.ENDPOINTS.GROUPS}?user=${username}`, {
            method: 'GET'
        });
    }

    /**
     * Crear un grupo nuevo
     */
    async createGroup(groupName, creatorUsername) {
        return await this.request(CONFIG.ENDPOINTS.GROUPS, {
            method: 'POST',
            body: JSON.stringify({ groupName, creatorUsername })
        });
    }

    /**
     * Unirse a un grupo existente
     */
    async joinGroup(groupName, username) {
        return await this.request(CONFIG.ENDPOINTS.JOIN_GROUP, {
            method: 'POST',
            body: JSON.stringify({ groupName, username })
        });
    }

    /**
     * Enviar mensaje a grupo
     */
    async sendMessageToGroup(groupName, sender, message) {
        return await this.request(CONFIG.ENDPOINTS.MESSAGE_GROUP, {
            method: 'POST',
            body: JSON.stringify({ groupName, sender, message })
        });
    }

    /**
     * Enviar mensaje privado
     */
    async sendPrivateMessage(fromUser, toUser, message) {
        return await this.request(CONFIG.ENDPOINTS.MESSAGE_PRIVATE, {
            method: 'POST',
            body: JSON.stringify({ fromUser, toUser, message })
        });
    }

    /**
     * Enviar audio a grupo
     */
    async sendAudioToGroup(groupName, sender, audioFile) {
        const formData = new FormData();
        formData.append('groupName', groupName);
        formData.append('sender', sender);
        formData.append('audio', audioFile);

        const url = `${this.baseUrl}${CONFIG.ENDPOINTS.AUDIO_GROUP}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
                // No incluir Content-Type, el navegador lo hará automáticamente con multipart
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error enviando audio');
            }

            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error('Error enviando audio a grupo:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Enviar audio privado
     */
    async sendAudioToPrivate(fromUser, toUser, audioFile) {
        const formData = new FormData();
        formData.append('fromUser', fromUser);
        formData.append('toUser', toUser);
        formData.append('audio', audioFile);

        const url = `${this.baseUrl}${CONFIG.ENDPOINTS.AUDIO_PRIVATE}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error enviando audio');
            }

            return {
                success: true,
                data: data
            };

        } catch (error) {
            console.error('Error enviando audio privado:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// Instancia global del API
const api = new CumbiaChatAPI();