// audio.ice - Definición de interfaz Ice para CumbiaChat
// IMPORTANTE: Las definiciones deben estar ANTES de ser usadas

module CumbiaChat {
    
    // ===== TIPOS DE DATOS (definir primero) =====
    
    // Secuencia de bytes para datos de audio PCM
    sequence<byte> AudioData;
    
    // Secuencia de strings (DEBE estar antes de usarse)
    sequence<string> StringSeq;
    
    // ===== INTERFACES =====
    
    // Callback para recibir audio del servidor
    interface AudioCallback {
        /**
         * Recibe un paquete de audio del servidor
         * @param data Datos de audio en formato PCM
         */
        void receiveAudioPacket(AudioData data);
    };
    
    // Interfaz principal del servidor de audio
    interface AudioServer {
        
        /**
         * Unirse a una sala de voz
         * @param roomName Nombre del grupo/sala
         * @param username Nombre del usuario
         * @return true si se unió exitosamente
         */
        bool joinRoom(string roomName, string username);
        
        /**
         * Salir de la sala de voz actual
         */
        void leaveCall();
        
        /**
         * Enviar paquete de audio al servidor
         * @param data Datos de audio en formato PCM
         */
        void sendAudioPacket(AudioData data);
        
        /**
         * Registrar callback para recibir audio
         * @param callback Proxy del callback del cliente
         */
        void registerCallback(AudioCallback* callback);
        
        /**
         * Obtener lista de usuarios en la sala
         * @param roomName Nombre de la sala
         * @return Lista de nombres de usuario
         */
        idempotent StringSeq getUsersInRoom(string roomName);
        
        /**
         * Ping para verificar conexión
         */
        idempotent void ping();
    };
};