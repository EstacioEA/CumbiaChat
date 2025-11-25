// services/iceDelegate.js
const Ice = require("ice").Ice;

class IceDelegate {
    constructor() {
        this.communicator = null;
        this.chatService = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) {
            console.log("[ICE Delegate] Ya está inicializado");
            return true;
        }

        try {
            // Inicializar comunicador Ice
            this.communicator = Ice.initialize();

            // Conectar al servicio Ice
            const proxy = this.communicator.stringToProxy(
                "CumbiaChatService:ws -h localhost -p 9099"
            );

            // Cargar módulo generado por slice2js
            const CumbiaChat = require("../generated/CumbiaChat").CumbiaChat;

            // Cast al tipo correcto
            this.chatService = await CumbiaChat.ChatServicePrx.checkedCast(proxy);

            if (!this.chatService) {
                throw new Error("No se pudo hacer cast a ChatServicePrx");
            }

            this.isInitialized = true;
            console.log("[ICE Delegate] Conectado exitosamente al servidor Ice");
            return true;

        } catch (error) {
            console.error("[ICE Delegate] Error inicializando:", error);
            this.isInitialized = false;
            return false;
        }
    }

    async getConnectedUsers() {
        if (!this.isInitialized) {
            await this.initialize();
        }
        try {
            return await this.chatService.getConnectedUsers();
        } catch (error) {
            console.error("[ICE Delegate] Error obteniendo usuarios:", error);
            return [];
        }
    }

    async startCall(fromUser, toUser) {
        if (!this.isInitialized) await this.initialize();
        try {
            await this.chatService.startCall(fromUser, toUser);
            return { status: 'success', message: 'Llamada iniciada' };
        } catch (error) {
            console.error("[ICE Delegate] Error iniciando llamada:", error);
            return { status: 'error', message: error.message };
        }
    }

    async acceptCall(fromUser, toUser) {
        if (!this.isInitialized) await this.initialize();
        try {
            await this.chatService.acceptCall(fromUser, toUser);
            return { status: 'success', message: 'Llamada aceptada' };
        } catch (error) {
            console.error("[ICE Delegate] Error aceptando llamada:", error);
            return { status: 'error', message: error.message };
        }
    }

    async rejectCall(fromUser, toUser) {
        if (!this.isInitialized) await this.initialize();
        try {
            await this.chatService.rejectCall(fromUser, toUser);
            return { status: 'success', message: 'Llamada rechazada' };
        } catch (error) {
            console.error("[ICE Delegate] Error rechazando llamada:", error);
            return { status: 'error', message: error.message };
        }
    }

    async endCall(fromUser, toUser) {
        if (!this.isInitialized) await this.initialize();
        try {
            await this.chatService.endCall(fromUser, toUser);
            return { status: 'success', message: 'Llamada finalizada' };
        } catch (error) {
            console.error("[ICE Delegate] Error finalizando llamada:", error);
            return { status: 'error', message: error.message };
        }
    }

    async getPendingCalls(userId) {
        if (!this.isInitialized) await this.initialize();
        try {
            const calls = await this.chatService.getPendingCalls(userId);
            console.log(`[ICE Delegate] Llamadas pendientes para ${userId}:`, calls);
            return calls || [];
        } catch (error) {
            console.error('[ICE Delegate] Error obteniendo llamadas pendientes:', error);
            return [];
        }
    }

    async clearPendingCall(userId, fromUser) {
        if (!this.isInitialized) await this.initialize();
        try {
            await this.chatService.clearPendingCall(userId, fromUser);
            console.log(`[ICE Delegate] Llamada pendiente limpiada: ${fromUser} -> ${userId}`);
        } catch (error) {
            console.error('[ICE Delegate] Error limpiando llamada pendiente:', error);
        }
    }

    async sendAudioMessage(fromUser, toUser, audioBuffer) {
        if (!this.isInitialized) await this.initialize();
        try {
            // Convertir Buffer de Node.js a Uint8Array para Ice
            const audioData = new Uint8Array(audioBuffer);
            const audioId = await this.chatService.sendAudioMessage(fromUser, toUser, audioData);
            return { status: 'success', message: 'Audio enviado', audioId: audioId };
        } catch (error) {
            console.error("[ICE Delegate] Error enviando audio:", error);
            return { status: 'error', message: error.message };
        }
    }

    async sendAudioMessageToGroup(fromUser, groupName, audioBuffer) {
        if (!this.isInitialized) await this.initialize();
        try {
            const audioData = new Uint8Array(audioBuffer);
            const audioId = await this.chatService.sendAudioMessageToGroup(fromUser, groupName, audioData);
            return { status: 'success', message: 'Audio enviado al grupo', audioId: audioId };
        } catch (error) {
            console.error("[ICE Delegate] Error enviando audio al grupo:", error);
            return { status: 'error', message: error.message };
        }
    }

    async shutdown() {
        if (this.communicator) {
            await this.communicator.destroy();
            this.isInitialized = false;
            console.log("[ICE Delegate] Conexión Ice cerrada");
        }
    }
}

// Singleton
const iceDelegate = new IceDelegate();

// Inicializar al cargar el módulo
iceDelegate.initialize().catch(err => {
    console.error("[ICE Delegate] Error en inicialización automática:", err);
});

module.exports = iceDelegate;
