package com.example.chat.TCP;

import com.example.chat.data.Group;
import com.example.chat.data.HistorialManager;
import com.example.chat.data.User;

import java.io.*;
import java.net.Socket;
import java.util.Map;
import java.util.Set; // Importar Set

// Importar Gson
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;

/**
 * ClientHandler: maneja comandos TCP y coordina audio/llamadas via Server (UDP).
 * Modificado para aceptar mensajes JSON como comandos.
 */
public class ClientHandler implements Runnable {

    private final Socket clientSocket;
    private BufferedReader in;
    private PrintWriter out;
    private DataInputStream dataIn;
    private DataOutputStream dataOut;

    private final Map<String, ClientHandler> connectedUsers;
    private final Map<String, Group> groups;
    private final HistorialManager historial;

    private String username;
    private User user;

    private final Gson gson = new Gson(); // Instancia de Gson

    public ClientHandler(Socket socket,
                         Map<String, ClientHandler> connectedUsers,
                         Map<String, Group> groups,
                         HistorialManager historial) {
        this.clientSocket = socket;
        this.connectedUsers = connectedUsers;
        this.groups = groups;
        this.historial = historial;
    }

    @Override
    public void run() {
        try {
            in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
            out = new PrintWriter(clientSocket.getOutputStream(), true);
            dataIn = new DataInputStream(clientSocket.getInputStream());
            dataOut = new DataOutputStream(clientSocket.getOutputStream());

            // --- Nuevo: Login basado en JSON ---
            out.println("{\"status\":\"need_login\", \"message\":\"Envía un mensaje JSON con {\\\"action\\\":\\\"LOGIN\\\", \\\"data\\\":{\\\"username\\\":\\\"tu_nombre\\\"}}\"}");
            out.flush();

            String loginLine = in.readLine();
            if (loginLine == null) {
                closeSilently();
                return;
            }

            JsonObject loginRequest;
            try {
                loginRequest = JsonParser.parseString(loginLine).getAsJsonObject();
            } catch (JsonSyntaxException e) {
                out.println("{\"status\":\"error\", \"message\":\"Formato de login inválido, se esperaba JSON.\"}");
                closeSilently();
                return;
            }

            if (!"LOGIN".equals(loginRequest.get("action").getAsString())) {
                out.println("{\"status\":\"error\", \"message\":\"Acción inicial inválida, se esperaba LOGIN.\"}");
                closeSilently();
                return;
            }

            JsonObject loginData = loginRequest.getAsJsonObject("data");
            if (loginData == null || !loginData.has("username")) {
                out.println("{\"status\":\"error\", \"message\":\"Datos de login incompletos, falta 'username'.\"}");
                closeSilently();
                return;
            }
            username = loginData.get("username").getAsString();

            if (username == null || username.trim().isEmpty()) {
                out.println("{\"status\":\"error\", \"message\":\"Nombre de usuario vacío.\"}");
                closeSilently();
                return;
            }
            username = username.trim();

            synchronized (connectedUsers) {
                if (connectedUsers.containsKey(username)) {
                    out.println("{\"status\":\"error\", \"message\":\"Usuario ya conectado.\"}");
                    closeSilently();
                    return;
                }
                user = new User(username, clientSocket);
                connectedUsers.put(username, this);
            }

            out.println("{\"status\":\"success\", \"message\":\"Conectado como " + username + "\"}");
            broadcastSystem(username + " se ha unido.");


            // --- Bucle principal para mensajes JSON ---


            String line;
            while ((line = in.readLine()) != null) {
                try {
                    JsonObject json = JsonParser.parseString(line).getAsJsonObject();
                    String action = json.get("action").getAsString();

                    switch (action) {
                        case "GET_ACTIVE_USERS":
                            handleGetActiveUsers();
                            break;
                        case "GET_AVAILABLE_GROUPS":
                            handleGetAvailableGroups();
                            break;
                        case "CREATE_GROUP":
                            handleCreateGroup(json);
                            break;
                        case "JOIN_GROUP":
                            handleJoinGroup(json);
                            break;
                        case "SEND_MESSAGE_TO_GROUP":
                            handleSendMessageToGroup(json);
                            break;
                        case "SEND_PRIVATE_MESSAGE":
                            handleSendPrivateMessage(json);
                            break;
                        // --- Añadir estos casos ---
                        case "SEND_AUDIO_TO_GROUP":
                            handleSendAudioToGroup(json);
                            break;
                        case "SEND_AUDIO_TO_PRIVATE":
                            handleSendAudioToPrivate(json);
                            break;

                        default:
                            out.println("{\"status\":\"error\", \"message\":\"Acción desconocida: " + action + "\"}");
                    }
                } catch (JsonSyntaxException e) {
                    out.println("{\"status\":\"error\", \"message\":\"Mensaje no es un JSON válido: " + line + "\"}");
                } catch (Exception e) {
                    out.println("{\"status\":\"error\", \"message\":\"Error procesando acción: " + e.getMessage() + "\"}");
                    e.printStackTrace();
                }
            }

        } catch (IOException ex) {
            System.out.println("Cliente " + username + " desconectado inesperadamente.");
        } finally {
            cleanup();
        }
    }

    // --- Métodos para manejar acciones JSON ---

    private void handleGetActiveUsers() {
        try {
            Set<String> users = Server.getActiveUsers();
            String jsonResponse = gson.toJson(Map.of("status", "success", "data", users));
            out.println(jsonResponse);
        } catch (Exception e) {
            String errorResponse = gson.toJson(Map.of("status", "error", "message", e.getMessage()));
            out.println(errorResponse);
        }
    }

    private void handleGetAvailableGroups() {
        try {
            Set<String> groups = Server.getAvailableGroups();
            String jsonResponse = gson.toJson(Map.of("status", "success", "data", groups));
            out.println(jsonResponse);
        } catch (Exception e) {
            String errorResponse = gson.toJson(Map.of("status", "error", "message", e.getMessage()));
            out.println(errorResponse);
        }
    }

    private void handleCreateGroup(JsonObject request) {
        try {
            JsonObject data = request.getAsJsonObject("data");
            if (data == null || !data.has("groupName") || !data.has("creatorUsername")) {
                out.println("{\"status\":\"error\", \"message\":\"Datos incompletos para CREATE_GROUP.\"}");
                return;
            }
            String groupName = data.get("groupName").getAsString();
            String creatorUsername = data.get("creatorUsername").getAsString();

            if (!this.username.equals(creatorUsername)) {
                out.println("{\"status\":\"error\", \"message\":\"No autorizado. El creatorUsername no coincide con el usuario logueado.\"}");
                return;
            }

            boolean success = Server.createGroup(groupName, new User(creatorUsername));
            if (success) {
                String jsonResponse = gson.toJson(Map.of("status", "success", "message", "Grupo creado exitosamente."));
                out.println(jsonResponse);
            } else {
                String jsonResponse = gson.toJson(Map.of("status", "error", "message", "No se pudo crear el grupo (ya existe?)."));
                out.println(jsonResponse);
            }
        } catch (Exception e) {
            String errorResponse = gson.toJson(Map.of("status", "error", "message", e.getMessage()));
            out.println(errorResponse);
        }
    }

    private void handleJoinGroup(JsonObject request) {
        try {
            JsonObject data = request.getAsJsonObject("data");
            if (data == null || !data.has("groupName") || !data.has("username")) {
                out.println("{\"status\":\"error\", \"message\":\"Datos incompletos para JOIN_GROUP.\"}");
                return;
            }
            String groupName = data.get("groupName").getAsString();
            String usernameToJoin = data.get("username").getAsString();

            if (!this.username.equals(usernameToJoin)) {
                out.println("{\"status\":\"error\", \"message\":\"No autorizado. El username no coincide con el usuario logueado.\"}");
                return;
            }

            boolean success = Server.joinGroup(groupName, new User(usernameToJoin));
            if (success) {
                String jsonResponse = gson.toJson(Map.of("status", "success", "message", "Usuario se unió al grupo."));
                out.println(jsonResponse);
            } else {
                String jsonResponse = gson.toJson(Map.of("status", "error", "message", "No se pudo unir al grupo (no existe?)."));
                out.println(jsonResponse);
            }
        } catch (Exception e) {
            String errorResponse = gson.toJson(Map.of("status", "error", "message", e.getMessage()));
            out.println(errorResponse);
        }
    }

    private void handleSendMessageToGroup(JsonObject request) {
        try {
            JsonObject data = request.getAsJsonObject("data");
            if (data == null || !data.has("groupName") || !data.has("sender") || !data.has("message")) {
                out.println("{\"status\":\"error\", \"message\":\"Datos incompletos para SEND_MESSAGE_TO_GROUP.\"}");
                return;
            }
            String groupName = data.get("groupName").getAsString();
            String sender = data.get("sender").getAsString();
            String message = data.get("message").getAsString();

            if (!this.username.equals(sender)) {
                out.println("{\"status\":\"error\", \"message\":\"No autorizado. El sender no coincide con el usuario logueado.\"}");
                return;
            }

            Server.broadcastToGroup(groupName, message, sender);
            HistorialManager.registrarMensajeTexto(sender, groupName, message);

            String jsonResponse = gson.toJson(Map.of("status", "success", "message", "Mensaje enviado al grupo."));
            out.println(jsonResponse);
        } catch (Exception e) {
            String errorResponse = gson.toJson(Map.of("status", "error", "message", e.getMessage()));
            out.println(errorResponse);
        }
    }

    private void handleSendPrivateMessage(JsonObject request) {
        try {
            JsonObject data = request.getAsJsonObject("data");
            if (data == null || !data.has("fromUser") || !data.has("toUser") || !data.has("message")) {
                out.println("{\"status\":\"error\", \"message\":\"Datos incompletos para SEND_PRIVATE_MESSAGE.\"}");
                return;
            }
            String fromUser = data.get("fromUser").getAsString();
            String toUser = data.get("toUser").getAsString();
            String message = data.get("message").getAsString();

            if (!this.username.equals(fromUser)) {
                out.println("{\"status\":\"error\", \"message\":\"No autorizado. El fromUser no coincide con el usuario logueado.\"}");
                return;
            }

            Server.sendPrivateMessage(fromUser, toUser, message);
            String chatName = "Privado_" + fromUser + "_" + toUser;
            HistorialManager.registrarMensajeTexto(fromUser, chatName, message);

            String jsonResponse = gson.toJson(Map.of("status", "success", "message", "Mensaje privado enviado."));
            out.println(jsonResponse);
        } catch (Exception e) {
            String errorResponse = gson.toJson(Map.of("status", "error", "message", e.getMessage()));
            out.println(errorResponse);
        }
    }

    // --- Fin de métodos handle ---



    // --- Métodos para manejar envío de audio via JSON ---

    private void handleSendAudioToGroup(JsonObject request) {
        try {
            JsonObject data = request.getAsJsonObject("data");
            if (data == null || !data.has("groupName") || !data.has("sender") || !data.has("audioFileName") || !data.has("audioData")) {
                JsonObject errorResponse = new JsonObject();
                errorResponse.addProperty("status", "error");
                errorResponse.addProperty("message", "Datos incompletos para SEND_AUDIO_TO_GROUP. Se requiere groupName, sender, audioFileName, y audioData.");
                out.println(gson.toJson(errorResponse));
                return;
            }
            String groupName = data.get("groupName").getAsString();
            String sender = data.get("sender").getAsString();
            String audioFileName = data.get("audioFileName").getAsString();
            String audioDataBase64 = data.get("audioData").getAsString(); // Asumimos que el audio viene como Base64

            // Validar que el emisor sea el usuario logueado
            if (!this.username.equals(sender)) {
                JsonObject errorResponse = new JsonObject();
                errorResponse.addProperty("status", "error");
                errorResponse.addProperty("message", "No autorizado. El sender no coincide con el usuario logueado.");
                out.println(gson.toJson(errorResponse));
                return;
            }

            // Decodificar Base64 a bytes
            byte[] audioBytes;
            try {
                audioBytes = java.util.Base64.getDecoder().decode(audioDataBase64);
            } catch (IllegalArgumentException e) {
                JsonObject errorResponse = new JsonObject();
                errorResponse.addProperty("status", "error");
                errorResponse.addProperty("message", "Error decodificando audio (Base64 inválido).");
                out.println(gson.toJson(errorResponse));
                return;
            }

            // Crear el archivo en la ubicación donde lo espera el código original
            File audioDir = new File("audios");
            audioDir.mkdirs();
            File outFile = new File(audioDir, sender + "_" + audioFileName);
            outFile.getParentFile().mkdirs();

            // Escribir los bytes decodificados al archivo
            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(audioBytes);
            }

            // Registrar en historial (reutilizando la lógica original)
            HistorialManager.registrarAudio(sender, groupName, outFile.getName());

            // Enviar mensaje de notificación al grupo (reutilizando la lógica original)
            Server.broadcastToGroup(groupName, "[AUDIO] " + outFile.getName(), sender);

            // Opcional: Enviar el archivo binario a cada cliente del grupo (esto es complejo con TCP y ClientHandler actuales,
            // ya que ClientHandler no tiene acceso directo a los sockets de otros clientes).
            // La lógica original lo hace *después* de recibir el header AUDIO:, lo cual no aplica aquí.
            // Para que el cliente lo reciba, el *cliente receptor* debe solicitarlo explícitamente (como en `playAudioMenuAndSend`).
            // O se podría implementar un mecanismo de notificación de nuevo archivo disponible (WebSocket, polling, etc.).

            JsonObject response = new JsonObject();
            response.addProperty("status", "success");
            response.addProperty("message", "Audio enviado al grupo y registrado.");
            out.println(gson.toJson(response));

        } catch (Exception e) {
            JsonObject errorResponse = new JsonObject();
            errorResponse.addProperty("status", "error");
            errorResponse.addProperty("message", e.getMessage());
            out.println(gson.toJson(errorResponse));
        }
    }

    private void handleSendAudioToPrivate(JsonObject request) {
        try {
            JsonObject data = request.getAsJsonObject("data");
            if (data == null || !data.has("toUser") || !data.has("fromUser") || !data.has("audioFileName") || !data.has("audioData")) {
                JsonObject errorResponse = new JsonObject();
                errorResponse.addProperty("status", "error");
                errorResponse.addProperty("message", "Datos incompletos para SEND_AUDIO_TO_PRIVATE. Se requiere toUser, fromUser, audioFileName, y audioData.");
                out.println(gson.toJson(errorResponse));
                return;
            }
            String toUser = data.get("toUser").getAsString();
            String fromUser = data.get("fromUser").getAsString(); // Debe ser el usuario logueado
            String audioFileName = data.get("audioFileName").getAsString();
            String audioDataBase64 = data.get("audioData").getAsString(); // Asumimos que el audio viene como Base64

            // Validar que el emisor sea el usuario logueado
            if (!this.username.equals(fromUser)) {
                JsonObject errorResponse = new JsonObject();
                errorResponse.addProperty("status", "error");
                errorResponse.addProperty("message", "No autorizado. El fromUser no coincide con el usuario logueado.");
                out.println(gson.toJson(errorResponse));
                return;
            }

            // Decodificar Base64 a bytes
            byte[] audioBytes;
            try {
                audioBytes = java.util.Base64.getDecoder().decode(audioDataBase64);
            } catch (IllegalArgumentException e) {
                JsonObject errorResponse = new JsonObject();
                errorResponse.addProperty("status", "error");
                errorResponse.addProperty("message", "Error decodificando audio (Base64 inválido).");
                out.println(gson.toJson(errorResponse));
                return;
            }

            // Crear el archivo en la ubicación donde lo espera el código original
            File audioDir = new File("audios");
            audioDir.mkdirs();
            File outFile = new File(audioDir, fromUser + "_" + audioFileName);
            outFile.getParentFile().mkdirs();

            // Escribir los bytes decodificados al archivo
            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(audioBytes);
            }

            // Registrar en historial (reutilizando la lógica original)
            String chatName = "Privado_" + fromUser + "_" + toUser;
            HistorialManager.registrarAudio(fromUser, chatName, outFile.getName());

            // Enviar mensaje de notificación al usuario receptor (reutilizando la lógica original)
            Server.sendPrivateMessage(fromUser, toUser, "[AUDIO] " + outFile.getName());

            // Opcional: Enviar el archivo binario al cliente receptor (ver comentario en handleSendAudioToGroup)
            // Para que el cliente receptor lo reciba, debe solicitarlo explícitamente.

            JsonObject response = new JsonObject();
            response.addProperty("status", "success");
            response.addProperty("message", "Audio enviado en mensaje privado y registrado.");
            out.println(gson.toJson(response));

        } catch (Exception e) {
            JsonObject errorResponse = new JsonObject();
            errorResponse.addProperty("status", "error");
            errorResponse.addProperty("message", e.getMessage());
            out.println(gson.toJson(errorResponse));
        }
    }

    // --- Fin de métodos para audio ---



    private void broadcastSystem(String msg) {
        synchronized (connectedUsers) {
            for (ClientHandler ch : connectedUsers.values()) ch.sendMessage("[SYSTEM] " + msg);
        }
    }

    public void sendMessage(String msg) {
        out.println(msg);
    }

    private void cleanup() {
        try {
            if (username != null) {
                connectedUsers.remove(username);
                broadcastSystem(username + " se ha desconectado.");
            }
            if (clientSocket != null && !clientSocket.isClosed()) clientSocket.close();
        } catch (IOException ignored) {}
    }

    private void closeSilently() {
        try { clientSocket.close(); } catch (IOException ignored) {}
    }
}