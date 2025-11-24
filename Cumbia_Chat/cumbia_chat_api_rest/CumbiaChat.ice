// Archivo: CumbiaChat-main/CumbiaChat.ice

[["java:package:com.example.chat.generated"]] // <--- CORREGIDO: Dobles corchetes obligatorios
module CumbiaChat {

    // --- TIPOS DE DATOS ---

    // Definimos una secuencia de bytes para transmitir el audio (blobs)
    sequence<byte> AudioData;

    // Listas auxiliares
    sequence<string> StringList;

    // Estructura del Mensaje
    struct Message {
        string sender;
        string content;     // Texto del mensaje o nombre del archivo
        string type;        // "TEXT", "AUDIO", "CALL"
        string date;        // Fecha
    };

    sequence<Message> MessageList;

    // --- INTERFAZ CALLBACK (Para Tiempo Real) ---
    // Node.js implementará esto. Java llamará aquí cuando haya novedades.
    interface ChatCallback {
        void receiveMessage(Message msg, string groupName);
    }

    // --- INTERFAZ DEL SERVIDOR ---
    // Java implementará esto. Node.js llamará aquí para ejecutar acciones.
    interface ChatService {
        // Gestión de Sesión: Recibe el "proxy" del cliente (cb) para poder responderle
        // El * indica que se pasa un proxy, no el objeto completo
        bool login(string username, string password, ChatCallback* cb);
        
        // Gestión de Grupos
        void createGroup(string groupName, string creator);
        StringList getGroups();
        bool joinGroup(string groupName, string username);

        // Mensajería
        void sendMessage(string content, string sender, string groupName, string type);
        
        // Audio: Recibe los bytes crudos, quién lo manda, a qué grupo y la extensión (.wav/.webm)
        void sendAudio(AudioData data, string sender, string groupName, string fileExtension);

        // Historial
        MessageList getHistory(string groupName);
    }
}