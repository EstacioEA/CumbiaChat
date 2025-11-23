/**
 * Módulo de integración de Ice para llamadas de voz en el chat
 * Se conecta con el servidor Ice para audio P2P
 */

class VoiceCallManager {
    constructor() {
        this.communicator = null;
        this.audioProxy = null;
        this.callbackAdapter = null;
        this.mediaStream = null;
        this.audioContext = null;
        this.scriptProcessor = null;
        this.isConnected = false;
        this.isInCall = false;
        this.isMuted = false;
        this.currentUsername = null;
        this.remoteUsername = null;
        this.roomName = null;
        this.callStartTime = null;
        this.timerInterval = null;
        
        // Configuración
        this.ICE_SERVER = 'localhost';
        this.ICE_PORT = 10000;
        
        console.log('🎤 VoiceCallManager inicializado');
    }
    
    /**
     * Conecta al servidor Ice
     */
    async connect(username) {
        if (this.isConnected) {
            console.log('Ya conectado a Ice');
            return true;
        }
        
        try {
            this.log('🔌 Conectando a Ice Server...');
            this.currentUsername = username;
            
            // Verificar que Ice esté disponible
            if (typeof Ice === 'undefined') {
                throw new Error('Ice.js no está cargado. Verifica el CDN.');
            }
            
            // Inicializar communicator
            const initData = new Ice.InitializationData();
            initData.properties = Ice.createProperties();
            initData.properties.setProperty('Ice.Default.Protocol', 'ws');
            
            this.communicator = Ice.initialize(initData);
            
            // Crear proxy
            const proxyString = `AudioServer:ws -h ${this.ICE_SERVER} -p ${this.ICE_PORT}`;
            const base = this.communicator.stringToProxy(proxyString);
            
            // Ping para verificar
            await base.ice_ping();
            
            this.audioProxy = base;
            this.isConnected = true;
            
            this.log('✅ Conectado a Ice Server');
            return true;
            
        } catch (error) {
            this.log('❌ Error conectando: ' + error.message);
            console.error('Error Ice:', error);
            return false;
        }
    }
    
    /**
     * Inicia una llamada con otro usuario
     */
    async startCall(remoteUser) {
        if (!this.isConnected) {
            showToast('Conectando a servidor de voz...', 'info');
            const connected = await this.connect(getCurrentUser());
            if (!connected) {
                showToast('No se pudo conectar al servidor de voz', 'error');
                return false;
            }
        }
        
        try {
            this.remoteUsername = remoteUser;
            this.roomName = this.generateRoomName(this.currentUsername, remoteUser);
            
            this.log(`📞 Iniciando llamada con ${remoteUser}...`);
            this.log(`🏠 Sala: ${this.roomName}`);
            
            // Mostrar modal de llamada
            this.showCallModal();
            this.updateCallStatus('Conectando...');
            
            // Unirse a sala en Ice
            const joined = await this.audioProxy.joinRoom(this.roomName, this.currentUsername);
            if (!joined) {
                throw new Error('No se pudo unir a la sala');
            }
            
            this.log('✅ Unido a sala de voz');
            
            // Solicitar micrófono
            this.updateCallStatus('Activando micrófono...');
            await this.setupMicrophone();
            
            // Configurar recepción de audio
            this.updateCallStatus('Configurando audio...');
            await this.setupAudioReceiver();
            
            // Marcar como en llamada
            this.isInCall = true;
            this.callStartTime = Date.now();
            this.startTimer();
            
            this.updateCallStatus('En llamada');
            this.log('📞 Llamada iniciada');
            
            showToast(`Llamada iniciada con ${remoteUser}`, 'success');
            return true;
            
        } catch (error) {
            this.log('❌ Error: ' + error.message);
            console.error('Error llamada:', error);
            showToast('Error iniciando llamada', 'error');
            this.endCall();
            return false;
        }
    }
    
    /**
     * Configura captura del micrófono
     */
    async setupMicrophone() {
        try {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000
                }
            });
            
            this.log('🎤 Micrófono activado');
            
            // AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 16000
            });
            
            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
            
            // Procesar y enviar audio
            this.scriptProcessor.onaudioprocess = async (event) => {
                if (!this.isInCall || this.isMuted) return;
                
                const inputData = event.inputBuffer.getChannelData(0);
                const pcmData = this.floatTo16BitPCM(inputData);
                
                try {
                    await this.audioProxy.sendAudioPacket(Array.from(pcmData));
                } catch (error) {
                    // Silencioso para evitar spam
                }
            };
            
            source.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);
            
        } catch (error) {
            throw new Error('No se pudo acceder al micrófono: ' + error.message);
        }
    }
    
    /**
     * Configura recepción de audio
     */
    async setupAudioReceiver() {
        try {
            // Crear adapter para callback
            this.callbackAdapter = await this.communicator.createObjectAdapter('');
            
            // Implementar callback
            const self = this;
            const AudioCallbackImpl = class {
                receiveAudioPacket(data, current) {
                    self.playAudioData(data);
                }
            };
            
            const callbackServant = new AudioCallbackImpl();
            const callbackProxy = await this.callbackAdapter.addWithUUID(callbackServant);
            await this.callbackAdapter.activate();
            
            // Registrar en servidor
            await this.audioProxy.registerCallback(callbackProxy);
            
            this.log('👂 Recepción de audio activa');
            
        } catch (error) {
            console.error('Error setup receiver:', error);
        }
    }
    
    /**
     * Reproduce audio recibido
     */
    playAudioData(pcmDataArray) {
        if (!this.audioContext || !this.isInCall) return;
        
        try {
            const pcmData = new Uint8Array(pcmDataArray);
            const float32Data = new Float32Array(pcmData.length / 2);
            const dataView = new DataView(pcmData.buffer);
            
            for (let i = 0; i < float32Data.length; i++) {
                const int16 = dataView.getInt16(i * 2, true);
                float32Data[i] = int16 / (int16 < 0 ? 0x8000 : 0x7FFF);
            }
            
            const audioBuffer = this.audioContext.createBuffer(1, float32Data.length, 16000);
            audioBuffer.copyToChannel(float32Data, 0);
            
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start();
            
        } catch (error) {
            console.error('Error play audio:', error);
        }
    }
    
    /**
     * Silenciar/Activar micrófono
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        const btnMute = document.getElementById('btnMuteMic');
        
        if (this.isMuted) {
            btnMute.classList.add('muted');
            btnMute.innerHTML = '🔇';
            this.log('🔇 Micrófono silenciado');
        } else {
            btnMute.classList.remove('muted');
            btnMute.innerHTML = '🎤';
            this.log('🎤 Micrófono activo');
        }
    }
    
    /**
     * Finaliza la llamada
     */
    async endCall() {
        try {
            this.log('📴 Finalizando llamada...');
            
            this.isInCall = false;
            this.stopTimer();
            
            // Notificar servidor
            if (this.audioProxy) {
                await this.audioProxy.leaveCall();
            }
            
            // Limpiar recursos
            this.cleanup();
            
            // Ocultar modal
            this.hideCallModal();
            
            this.log('✅ Llamada finalizada');
            showToast('Llamada finalizada', 'info');
            
        } catch (error) {
            console.error('Error end call:', error);
        }
    }
    
    /**
     * Limpia recursos de audio
     */
    cleanup() {
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }
        
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        if (this.callbackAdapter) {
            this.callbackAdapter.destroy();
            this.callbackAdapter = null;
        }
    }
    
    /**
     * Genera nombre de sala único para dos usuarios
     */
    generateRoomName(user1, user2) {
        const users = [user1, user2].sort();
        return `call_${users[0]}_${users[1]}`;
    }
    
    /**
     * Convierte Float32 a PCM 16-bit
     */
    floatTo16BitPCM(float32Array) {
        const buffer = new ArrayBuffer(float32Array.length * 2);
        const view = new DataView(buffer);
        let offset = 0;
        
        for (let i = 0; i < float32Array.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, float32Array[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        
        return new Uint8Array(buffer);
    }
    
    // === UI Helpers ===
    
    showCallModal() {
        const modal = document.getElementById('modalVoiceCall');
        const username = document.getElementById('voiceCallUsername');
        
        username.textContent = this.remoteUsername;
        modal.style.display = 'flex';
        
        // Marcar botón de llamada como activo
        const btnCall = document.getElementById('btnStartVoiceCall');
        if (btnCall) {
            btnCall.classList.add('in-call');
            btnCall.innerHTML = '📞';
        }
    }
    
    hideCallModal() {
        document.getElementById('modalVoiceCall').style.display = 'none';
        
        // Desmarcar botón
        const btnCall = document.getElementById('btnStartVoiceCall');
        if (btnCall) {
            btnCall.classList.remove('in-call');
            btnCall.innerHTML = '📞';
        }
    }
    
    updateCallStatus(status) {
        document.getElementById('voiceCallStatus').textContent = status;
    }
    
    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.callStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            document.getElementById('voiceTimer').textContent = `${minutes}:${seconds}`;
        }, 1000);
    }
    
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }
    
    log(message) {
        const logContainer = document.getElementById('voiceLog');
        if (logContainer) {
            const p = document.createElement('p');
            p.textContent = message;
            logContainer.appendChild(p);
            logContainer.scrollTop = logContainer.scrollHeight;
        }
        console.log('[Voice]', message);
    }
}

// Instancia global
const voiceCallManager = new VoiceCallManager();

// Configurar event listeners cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const btnMute = document.getElementById('btnMuteMic');
    const btnEnd = document.getElementById('btnEndVoiceCall');
    
    if (btnMute) {
        btnMute.addEventListener('click', () => voiceCallManager.toggleMute());
    }
    
    if (btnEnd) {
        btnEnd.addEventListener('click', () => voiceCallManager.endCall());
    }
});