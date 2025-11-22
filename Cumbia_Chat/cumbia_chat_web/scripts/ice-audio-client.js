/**
 * Cliente Ice.js para audio en tiempo real
 * Conecta con servidor Ice usando WebSocket
 */

// Importar módulos de Ice (se cargan desde el CDN)
const Ice = window.Ice;

class IceAudioClient {
    constructor() {
        this.communicator = null;
        this.audioProxy = null;
        this.callbackAdapter = null;
        this.mediaStream = null;
        this.audioContext = null;
        this.scriptProcessor = null;
        this.isConnected = false;
        this.isInCall = false;
        this.username = null;
        this.roomName = null;
        
        this.setupUI();
    }
    
    setupUI() {
        document.getElementById('btnConnect').addEventListener('click', () => this.connect());
        document.getElementById('btnStartCall').addEventListener('click', () => this.startCall());
        document.getElementById('btnEndCall').addEventListener('click', () => this.endCall());
    }
    
    log(message) {
        const logContainer = document.getElementById('logContainer');
        const timestamp = new Date().toLocaleTimeString();
        const p = document.createElement('p');
        p.textContent = `[${timestamp}] ${message}`;
        logContainer.appendChild(p);
        logContainer.scrollTop = logContainer.scrollHeight;
        console.log(message);
    }
    
    updateStatus(iceStatus, audioStatus, room) {
        if (iceStatus !== undefined) {
            document.getElementById('iceStatus').textContent = iceStatus;
        }
        if (audioStatus !== undefined) {
            document.getElementById('audioStatus').textContent = audioStatus;
        }
        if (room !== undefined) {
            document.getElementById('currentRoom').textContent = room;
        }
    }
    
    async connect() {
        try {
            this.log('🔌 Conectando a Ice Server...');
            
            // Inicializar Ice communicator
            const initData = new Ice.InitializationData();
            initData.properties = Ice.createProperties();
            
            // Configurar para usar WebSocket
            initData.properties.setProperty('Ice.Default.Protocol', 'ws');
            
            this.communicator = Ice.initialize(initData);
            
            // Crear proxy al servidor
            const proxyString = 'AudioServer:ws -h localhost -p 10000';
            this.log(`📡 Conectando a: ${proxyString}`);
            
            const base = this.communicator.stringToProxy(proxyString);
            
            // Verificar conexión con ping
            await base.ice_ping();
            
            this.audioProxy = base;
            this.isConnected = true;
            
            this.log('✅ Conectado a Ice Server');
            this.updateStatus('Conectado', 'Listo', 'Ninguna');
            
            document.getElementById('btnConnect').disabled = true;
            document.getElementById('btnStartCall').disabled = false;
            
        } catch (error) {
            this.log('❌ Error conectando: ' + error.message);
            this.updateStatus('Error', 'N/A', 'N/A');
            console.error('Error detallado:', error);
        }
    }
    
    async startCall() {
        try {
            // Solicitar datos de usuario
            this.username = prompt('Ingresa tu nombre de usuario:', 
                                  'Usuario' + Math.floor(Math.random() * 1000));
            this.roomName = prompt('Ingresa el nombre de la sala:', 'SalaGeneral');
            
            if (!this.username || !this.roomName) {
                this.log('⚠️ Llamada cancelada');
                return;
            }
            
            this.log('🎤 Iniciando llamada...');
            this.log(`👤 Usuario: ${this.username}`);
            this.log(`🏠 Sala: ${this.roomName}`);
            
            // Unirse a la sala en el servidor
            const joined = await this.audioProxy.joinRoom(this.roomName, this.username);
            
            if (!joined) {
                throw new Error('No se pudo unir a la sala');
            }
            
            this.log('✅ Unido a la sala');
            
            // Solicitar acceso al micrófono
            this.log('🎤 Solicitando acceso al micrófono...');
            
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 16000
                } 
            });
            
            this.log('✅ Micrófono activado');
            
            // Configurar captura y envío de audio
            await this.setupAudioCapture();
            
            // Registrar callback para recibir audio
            await this.setupAudioReceiver();
            
            this.isInCall = true;
            this.updateStatus('En llamada', 'Transmitiendo', this.roomName);
            this.log('📞 Llamada iniciada exitosamente');
            
            document.getElementById('btnStartCall').disabled = true;
            document.getElementById('btnEndCall').disabled = false;
            
        } catch (error) {
            this.log('❌ Error iniciando llamada: ' + error.message);
            console.error('Error detallado:', error);
            this.cleanup();
        }
    }
    
    async setupAudioCapture() {
        // Inicializar AudioContext
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: 16000
        });
        
        const source = this.audioContext.createMediaStreamSource(this.mediaStream);
        this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        this.scriptProcessor.onaudioprocess = async (event) => {
            if (!this.isInCall) return;
            
            const inputBuffer = event.inputBuffer;
            const inputData = inputBuffer.getChannelData(0);
            
            // Convertir Float32Array a Int16Array (PCM)
            const pcmData = this.floatTo16BitPCM(inputData);
            
            // Enviar al servidor Ice
            try {
                // Convertir Uint8Array a Array para Ice
                const audioArray = Array.from(pcmData);
                await this.audioProxy.sendAudioPacket(audioArray);
            } catch (error) {
                if (this.isInCall) { // Solo log si aún estamos en llamada
                    console.error('Error enviando audio:', error);
                }
            }
        };
        
        source.connect(this.scriptProcessor);
        this.scriptProcessor.connect(this.audioContext.destination);
        
        this.log('🔊 Captura de audio configurada');
    }
    
    async setupAudioReceiver() {
        try {
            this.log('👂 Configurando recepción de audio...');
            
            // Crear adapter para callbacks
            this.callbackAdapter = await this.communicator.createObjectAdapter('');
            
            // Implementar callback
            const AudioCallbackImpl = class {
                receiveAudioPacket(data, current) {
                    // Recibir audio del servidor
                    iceClient.playAudioData(data);
                }
            };
            
            // Registrar callback
            const callbackServant = new AudioCallbackImpl();
            const callbackProxy = await this.callbackAdapter.addWithUUID(callbackServant);
            
            await this.callbackAdapter.activate();
            
            // Registrar callback en el servidor
            await this.audioProxy.registerCallback(callbackProxy);
            
            this.log('✅ Recepción de audio activada');
            
        } catch (error) {
            this.log('⚠️ Error configurando recepción: ' + error.message);
            console.error('Error detallado:', error);
        }
    }
    
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
    
    playAudioData(pcmDataArray) {
        if (!this.audioContext || !this.isInCall) return;
        
        try {
            // Convertir Array a Uint8Array
            const pcmData = new Uint8Array(pcmDataArray);
            
            // Convertir PCM (Int16) a Float32
            const float32Data = new Float32Array(pcmData.length / 2);
            const dataView = new DataView(pcmData.buffer);
            
            for (let i = 0; i < float32Data.length; i++) {
                const int16 = dataView.getInt16(i * 2, true);
                float32Data[i] = int16 / (int16 < 0 ? 0x8000 : 0x7FFF);
            }
            
            // Crear buffer de audio
            const audioBuffer = this.audioContext.createBuffer(
                1, 
                float32Data.length, 
                this.audioContext.sampleRate
            );
            
            audioBuffer.copyToChannel(float32Data, 0);
            
            // Reproducir
            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            source.start();
            
        } catch (error) {
            console.error('Error reproduciendo audio:', error);
        }
    }
    
    async endCall() {
        try {
            this.log('📴 Finalizando llamada...');
            
            this.isInCall = false;
            
            // Notificar al servidor
            if (this.audioProxy) {
                await this.audioProxy.leaveCall();
            }
            
            this.cleanup();
            
            this.updateStatus('Conectado', 'Inactivo', 'Ninguna');
            this.log('✅ Llamada finalizada');
            
            document.getElementById('btnStartCall').disabled = false;
            document.getElementById('btnEndCall').disabled = true;
            
        } catch (error) {
            this.log('❌ Error finalizando: ' + error.message);
            console.error(error);
        }
    }
    
    cleanup() {
        // Detener stream de audio
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
        
        // Desconectar procesador
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }
        
        // Cerrar AudioContext
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        // Cerrar callback adapter
        if (this.callbackAdapter) {
            this.callbackAdapter.destroy();
            this.callbackAdapter = null;
        }
    }
    
    async disconnect() {
        await this.endCall();
        
        if (this.communicator) {
            await this.communicator.destroy();
            this.communicator = null;
        }
        
        this.isConnected = false;
        this.updateStatus('Desconectado', 'N/A', 'N/A');
        this.log('🔌 Desconectado de Ice');
        
        document.getElementById('btnConnect').disabled = false;
        document.getElementById('btnStartCall').disabled = true;
    }
}

// Inicializar cliente
let iceClient;

document.addEventListener('DOMContentLoaded', () => {
    iceClient = new IceAudioClient();
    console.log('🎵 Ice Audio Client inicializado');
});

// Cleanup al cerrar
window.addEventListener('beforeunload', async () => {
    if (iceClient && iceClient.isInCall) {
        await iceClient.disconnect();
    }
});