// scripts/iceClient.js

class IceClient {
    constructor() {
        this.currentUser = null;
        this.isCallActive = false;
        this.currentCallWith = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.audioPlayer = null;
    }

    // ========== GESTIÓN DE LLAMADAS VIA PROXY ==========

    async startCall(targetUser) {
        if (this.isCallActive) {
            console.log("[ICE Client] Ya hay una llamada activa");
            return false;
        }

        try {
            const response = await fetch('http://localhost:5000/api/calls/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromUser: this.currentUser,
                    toUser: targetUser
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                this.isCallActive = true;
                this.currentCallWith = targetUser;
                console.log("[ICE Client] Llamada iniciada a:", targetUser);
                return true;
            }
            return false;
        } catch (error) {
            console.error("[ICE Client] Error iniciando llamada:", error);
            return false;
        }
    }

    async acceptCall(fromUser) {
        try {
            const response = await fetch('http://localhost:5000/api/calls/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromUser: fromUser,
                    toUser: this.currentUser
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                this.isCallActive = true;
                this.currentCallWith = fromUser;
                console.log("[ICE Client] Llamada aceptada de:", fromUser);
                await this.startAudioStreaming();
                return true;
            }
            return false;
        } catch (error) {
            console.error("[ICE Client] Error aceptando llamada:", error);
            return false;
        }
    }

    async rejectCall(fromUser) {
        try {
            const response = await fetch('http://localhost:5000/api/calls/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromUser: fromUser,
                    toUser: this.currentUser
                })
            });

            console.log("[ICE Client] Llamada rechazada");
            return true;
        } catch (error) {
            console.error("[ICE Client] Error rechazando llamada:", error);
            return false;
        }
    }

    async endCall() {
        if (!this.isCallActive || !this.currentCallWith) {
            console.log("[ICE Client] No hay llamada activa");
            return false;
        }

        try {
            const response = await fetch('http://localhost:5000/api/calls/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromUser: this.currentUser,
                    toUser: this.currentCallWith
                })
            });

            this.stopAudioStreaming();
            this.isCallActive = false;
            const target = this.currentCallWith;
            this.currentCallWith = null;

            console.log("[ICE Client] Llamada finalizada con:", target);
            return true;
        } catch (error) {
            console.error("[ICE Client] Error finalizando llamada:", error);
            return false;
        }
    }

    // ========== CAPTURA Y GRABACIÓN DE AUDIO ==========

    async startAudioRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.audioChunks = [];

                // Aquí puedes enviar el audio grabado
                console.log("[ICE Client] Audio grabado, tamaño:", audioBlob.size);
                return audioBlob;
            };

            this.mediaRecorder.start();
            console.log("[ICE Client] Grabación de audio iniciada");
            return true;

        } catch (error) {
            console.error("[ICE Client] Error accediendo al micrófono:", error);
            alert("No se pudo acceder al micrófono. Verifica los permisos.");
            return false;
        }
    }

    stopAudioRecording() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();

            // Detener el stream de audio
            this.mediaRecorder.stream.getTracks().forEach(track => track.stop());

            console.log("[ICE Client] Grabación de audio detenida");
            return true;
        }
        return false;
    }

    async sendAudioMessage(targetUser, audioBlob) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio-message.wav');
            formData.append('fromUser', this.currentUser);
            formData.append('toUser', targetUser);

            const response = await fetch('http://localhost:5000/api/messages/private/audio', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            console.log("[ICE Client] Audio enviado:", data);
            return data;

        } catch (error) {
            console.error("[ICE Client] Error enviando audio:", error);
            return null;
        }
    }

    async sendAudioMessageToGroup(groupName, audioBlob) {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'audio-message.wav');
            formData.append('sender', this.currentUser);
            formData.append('groupName', groupName);

            const response = await fetch('http://localhost:5000/api/messages/group/audio', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            console.log("[ICE Client] Audio enviado al grupo:", data);
            return data;

        } catch (error) {
            console.error("[ICE Client] Error enviando audio al grupo:", error);
            return null;
        }
    }

    // ========== STREAMING DE AUDIO (PARA LLAMADAS) ==========

    async startAudioStreaming() {
        // TODO: Implementar streaming en tiempo real
        // Por ahora solo iniciamos la grabación
        console.log("[ICE Client] Iniciando streaming de audio");
        await this.startAudioRecording();
    }

    stopAudioStreaming() {
        console.log("[ICE Client] Deteniendo streaming de audio");
        this.stopAudioRecording();
    }

    // ========== UTILIDADES ==========

    setCurrentUser(username) {
        this.currentUser = username;
        console.log("[ICE Client] Usuario configurado:", username);
    }

    getCallStatus() {
        return {
            isActive: this.isCallActive,
            callWith: this.currentCallWith
        };
    }
}

// Exportar instancia singleton
const iceClient = new IceClient();

// Exportar instancia singleton al window
window.iceClient = iceClient;

// Log de confirmación
console.log('IceClient cargado y disponible globalmente');
console.log('IceClient disponible en:', window.iceClient);
