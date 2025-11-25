module CumbiaChat {
    
    // Definición de secuencias
    sequence<byte> ByteSeq;
    sequence<string> StringSeq;  
    
    // Interfaz del Observer (cliente)
    interface ChatObserver {
        void incomingCall(string fromUser);
        void callAccepted(string fromUser);
        void callRejected(string fromUser);
        void callEnded(string fromUser);
        void receiveAudioStream(string fromUser, ByteSeq data);
        void receiveAudioMessage(string fromUser, string audioId, ByteSeq data);
    }
    
    // Interfaz del Servicio (servidor)
    interface ChatService {
        // Registro de clientes
        void registerClient(string userId, ChatObserver* obs);
        void unregisterClient(string userId);
        StringSeq getConnectedUsers();  
        
        // Llamadas
        void startCall(string fromUser, string toUser);
        void acceptCall(string fromUser, string toUser);
        void rejectCall(string fromUser, string toUser);
        void endCall(string fromUser, string toUser);
        
        // Consulta de llamadas pendientes
        StringSeq getPendingCalls(string userId); 
        void clearPendingCall(string userId, string fromUser);
        
        // Streaming de audio
        void streamAudio(string fromUser, string toUser, ByteSeq data);
        
        // Mensajes de audio
        string sendAudioMessage(string fromUser, string toUser, ByteSeq data);
        string sendAudioMessageToGroup(string fromUser, string groupName, ByteSeq data);
    }
}
