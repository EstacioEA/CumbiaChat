// ========== ICE CLIENT PARA LLAMADAS Y AUDIO ==========

class IceClient {
    constructor() {
        this.currentUser = null;
        this.isCallActive = false;
        this.currentCallWith = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.localStream = null;
        this.audioContext = null;
        this.analyser = null;
    }

    setCurrentUser(username) {
        this.currentUser = username;
        console.log('[IceClient] Usuario configurado:', username);
    }

    // ========== LLAMADAS ==========

    async startCall(targetUser) {
        console.log('[IceClient] Iniciando llamada a:', targetUser);

        if (!this.currentUser) {
            console.error('[IceClient] currentUser no configurado');
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

                // ACTIVAR MICRÓFONO AL INICIAR LLAMADA
                await this.startMicrophone();

                console.log('[IceClient] Llamada iniciada exitosamente');
                return true;
            } else {
                console.error('[IceClient] Error en respuesta:', data);
                return false;
            }
        } catch (error) {
            console.error('[IceClient] Error startCall:', error);
            return false;
        }
    }

    async acceptCall(fromUser) {
        console.log('[IceClient] Aceptando llamada de:', fromUser);

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

                // ACTIVAR MICRÓFONO AL ACEPTAR LLAMADA
                await this.startMicrophone();

                console.log('[IceClient] Llamada aceptada exitosamente');
                return true;
            }
            return false;
        } catch (error) {
            console.error('[IceClient] Error acceptCall:', error);
            return false;
        }
    }

    async rejectCall(fromUser) {
        console.log('[IceClient] Rechazando llamada de:', fromUser);

        try {
            const response = await fetch('http://localhost:5000/api/calls/reject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromUser: fromUser,
                    toUser: this.currentUser
                })
            });

            return response.json();
        } catch (error) {
            console.error('[IceClient] Error rejectCall:', error);
            return { status: 'error' };
        }
    }

    async endCall() {
        console.log('[IceClient] Finalizando llamada con:', this.currentCallWith);

        if (!this.currentCallWith) {
            console.warn('[IceClient] No hay llamada activa para finalizar');
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

            const data = await response.json();

            if (data.status === 'success') {
                // DETENER MICRÓFONO
                this.stopMicrophone();

                this.isCallActive = false;
                const previousCall = this.currentCallWith;
                this.currentCallWith = null;

                console.log('[IceClient] Llamada finalizada con:', previousCall);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[IceClient] Error endCall:', error);
            return false;
        }
    }

    // ========== MICRÓFONO Y STREAMING ==========

    async startMicrophone() {
        console.log('[IceClient] Activando micrófono...');

        try {
            // Solicitar permiso para el micrófono
            this.localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            console.log('[IceClient] Micrófono activado exitosamente');

            // Configurar análisis de audio (opcional, para visualización)
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamSource(this.localStream);
            this.analyser = this.audioContext.createAnalyser();
            source.connect(this.analyser);

            // INICIAR STREAMING DE AUDIO
            this.startAudioStreaming();

            return true;
        } catch (error) {
            console.error('[IceClient] Error activando micrófono:', error);
            alert('No se pudo acceder al micrófono: ' + error.message);
            return false;
        }
    }

    stopMicrophone() {
        console.log('[IceClient] Deteniendo micrófono...');

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.stopAudioStreaming();

        console.log('[IceClient] Micrófono detenido');
    }

    startAudioStreaming() {
        if (!this.localStream || !this.currentCallWith) {
            console.warn('[IceClient] No se puede iniciar streaming: falta stream o destino');
            return;
        }

        console.log('[IceClient] Iniciando streaming de audio a:', this.currentCallWith);

        // Crear MediaRecorder para capturar chunks de audio
        const options = { mimeType: 'audio/webm' };
        this.mediaRecorder = new MediaRecorder(this.localStream, options);

        this.mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0 && this.isCallActive) {
                // Enviar chunk al servidor
                await this.sendAudioChunk(event.data);
            }
        };

        // Capturar chunks cada 100ms para baja latencia
        this.mediaRecorder.start(100);
        console.log('[IceClient] Streaming de audio iniciado');
    }

    stopAudioStreaming() {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
            console.log('[IceClient] Streaming de audio detenido');
        }
    }

    async sendAudioChunk(audioBlob) {
        if (!this.currentCallWith) return;

        try {
            // Convertir blob a buffer para enviar
            const arrayBuffer = await audioBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            // Enviar al servidor Ice vía proxy
            // NOTA: Este endpoint debe implementarse en el proxy
            await fetch('http://localhost:5000/api/calls/stream-audio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: uint8Array
            });
        } catch (error) {
            console.error('[IceClient] Error enviando chunk de audio:', error);
        }
    }

    // ========== GRABAR NOTAS DE VOZ ==========

    async startAudioRecording() {
        console.log('[IceClient] === Iniciando grabación de audio ===');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('[IceClient] Stream de audio obtenido');

            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(stream);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    console.log('[IceClient] Chunk de audio agregado:', event.data.size, 'bytes');
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('[IceClient] Grabación detenida. Total chunks:', this.audioChunks.length);
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            console.log('[IceClient] MediaRecorder iniciado');
            return true;
        } catch (error) {
            console.error('[IceClient] Error iniciando grabación:', error);
            throw error;
        }
    }

    stopAudioRecording() {
        console.log('[IceClient] === Deteniendo grabación ===');
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
    }

    async sendAudioMessage(toUser, audioBlob) {
        console.log('[IceClient] Enviando audio a:', toUser);

        const formData = new FormData();
        formData.append('fromUser', this.currentUser);
        formData.append('toUser', toUser);
        formData.append('audio', audioBlob, 'audio.wav');

        try {
            const response = await fetch('http://localhost:5000/api/messages/private/audio', {
                method: 'POST',
                body: formData
            });

            return await response.json();
        } catch (error) {
            console.error('[IceClient] Error enviando audio:', error);
            throw error;
        }
    }

    async sendAudioMessageToGroup(groupName, audioBlob) {
        console.log('[IceClient] Enviando audio a grupo:', groupName);

        const formData = new FormData();
        formData.append('sender', this.currentUser);
        formData.append('groupName', groupName);
        formData.append('audio', audioBlob, 'audio.wav');

        try {
            const response = await fetch('http://localhost:5000/api/messages/group/audio', {
                method: 'POST',
                body: formData
            });

            return await response.json();
        } catch (error) {
            console.error('[IceClient] Error enviando audio a grupo:', error);
            throw error;
        }
    }
}

// Instancia global
const iceClient = new IceClient();
window.iceClient = iceClient;

console.log('[IceClient] Cargado y disponible globalmente');
