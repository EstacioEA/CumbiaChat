package com.example.chat.TCP;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;
import java.util.Base64;
import java.util.Map;

import com.example.chat.data.Group;
import com.example.chat.data.HistorialManager;
import com.example.chat.data.User;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

/**
 * Handler que procesa mensajes en formato JSON (para el proxy REST)
 * Detecta automáticamente si el cliente usa JSON o el protocolo de consola
 */
public class JSONProtocolHandler implements Runnable {
    
    private final Socket clientSocket;
    private BufferedReader in;
    private PrintWriter out;
    
    private final Map<String, ClientHandler> connectedUsers;
    private final Map<String, Group> groups;
    private final HistorialManager historial;
    
    private final Gson gson = new Gson();
    private String username;

    public JSONProtocolHandler(Socket socket,
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
            
            String firstLine = in.readLine();
            if (firstLine == null) {
                closeSilently();
                return;
            }
            
            // Detectar si es JSON
            if (firstLine.trim().startsWith("{")) {
                handleJSONProtocol(firstLine);
            } else {
                // Es el protocolo de consola, delegar al ClientHandler original
                delegateToConsoleHandler(firstLine);
            }
            
        } catch (IOException ex) {
            System.err.println("[JSON] Error: " + ex.getMessage());
        } finally {
            cleanup();
        }
    }
    
    /**
     * Maneja el protocolo JSON del proxy
     */
    private void handleJSONProtocol(String firstMessage) throws IOException {
        System.out.println("[JSON] Cliente JSON detectado");
        
        // Procesar primer mensaje
        processJSONMessage(firstMessage);
        
        // Loop para mensajes adicionales
        String line;
        while ((line = in.readLine()) != null) {
            processJSONMessage(line);
        }
    }
    
    /**
     * Procesa un mensaje JSON individual
     */
    private void processJSONMessage(String jsonString) {
        try {
            JsonObject request = JsonParser.parseString(jsonString).getAsJsonObject();
            String action = request.get("action").getAsString();
            JsonObject data = request.has("data") ? request.getAsJsonObject("data") : new JsonObject();
            
            System.out.println("[JSON] Action: " + action);
            
            JsonObject response = new JsonObject();
            
            switch (action) {
                case "LOGIN" -> {
                    username = data.get("username").getAsString();
                    
                    synchronized (connectedUsers) {
                        // En modo web, permitir "re-login" (conexiones efímeras)
                        if (!connectedUsers.containsKey(username)) {
                            User user = new User(username, clientSocket);
                            ClientHandler dummyHandler = new ClientHandler(clientSocket, connectedUsers, groups, historial);
                            connectedUsers.put(username, dummyHandler);
                            System.out.println("[JSON] Usuario conectado: " + username);
                        }
                        
                        response.addProperty("status", "success");
                        response.addProperty("message", "Login exitoso");
                    }
                }
                
                case "LOGOUT" -> {
                    String user = data.get("username").getAsString();
                    synchronized (connectedUsers) {
                        connectedUsers.remove(user);
                        System.out.println("[JSON] Usuario desconectado: " + user);
                    }
                    response.addProperty("status", "success");
                    response.addProperty("message", "Logout exitoso");
                }
                
                case "GET_ACTIVE_USERS" -> {
                    System.out.println("[JSON] GET_ACTIVE_USERS");
                    response.addProperty("status", "success");
                    JsonObject dataObj = new JsonObject();
                    dataObj.add("users", gson.toJsonTree(Server.getActiveUsers()));
                    response.add("data", dataObj);
                }
                
                case "GET_AVAILABLE_GROUPS" -> {
                    System.out.println("[JSON] GET_AVAILABLE_GROUPS");
                    response.addProperty("status", "success");
                    JsonObject dataObj = new JsonObject();
                    dataObj.add("groups", gson.toJsonTree(Server.getAvailableGroups()));
                    response.add("data", dataObj);
                }
                
                case "CREATE_GROUP" -> {
                    String groupName = data.get("groupName").getAsString();
                    String creator = data.get("creatorUsername").getAsString();
                    
                    boolean created = Server.createGroup(groupName, new User(creator));
                    if (created) {
                        response.addProperty("status", "success");
                        response.addProperty("message", "Grupo creado");
                    } else {
                        response.addProperty("status", "error");
                        response.addProperty("message", "El grupo ya existe");
                    }
                }
                
                case "JOIN_GROUP" -> {
                    String groupName = data.get("groupName").getAsString();
                    String user = data.get("username").getAsString();
                    
                    boolean joined = Server.joinGroup(groupName, new User(user));
                    if (joined) {
                        response.addProperty("status", "success");
                        response.addProperty("message", "Te uniste al grupo");
                    } else {
                        response.addProperty("status", "error");
                        response.addProperty("message", "El grupo no existe");
                    }
                }
                
                case "SEND_MESSAGE_TO_GROUP" -> {
                    String groupName = data.get("groupName").getAsString();
                    String sender = data.get("sender").getAsString();
                    String message = data.get("message").getAsString();
                    
                    System.out.println("[JSON] Mensaje a grupo '" + groupName + "' de " + sender);
                    
                    // Guardar en historial
                    HistorialManager.registrarMensajeTexto(sender, groupName, message);
                    
                    // Broadcast (solo para logging, no envía en tiempo real)
                    Server.broadcastToGroup(groupName, message, sender);
                    
                    response.addProperty("status", "success");
                    response.addProperty("message", "Mensaje enviado");
                }
                
                case "SEND_PRIVATE_MESSAGE" -> {
                    String fromUser = data.get("fromUser").getAsString();
                    String toUser = data.get("toUser").getAsString();
                    String message = data.get("message").getAsString();
                    
                    System.out.println("[JSON] Mensaje privado: " + fromUser + " -> " + toUser);
                    
                    // Solo guardar en historial (no enviar en tiempo real por ahora)
                    String chatName = "Privado_" + fromUser + "_" + toUser;
                    HistorialManager.registrarMensajeTexto(fromUser, chatName, message);
                    
                    response.addProperty("status", "success");
                    response.addProperty("message", "Mensaje privado enviado");
                }
                
                case "SEND_AUDIO_TO_GROUP" -> {
                    String groupName = data.get("groupName").getAsString();
                    String sender = data.get("sender").getAsString();
                    String audioFileName = data.get("audioFileName").getAsString();
                    String audioDataBase64 = data.get("audioData").getAsString();
                    
                    // Decodificar Base64 y guardar
                    byte[] audioBytes = Base64.getDecoder().decode(audioDataBase64);
                    File audioFile = new File("audios/" + sender + "_" + audioFileName);
                    audioFile.getParentFile().mkdirs();
                    
                    try (FileOutputStream fos = new FileOutputStream(audioFile)) {
                        fos.write(audioBytes);
                    }
                    
                    HistorialManager.registrarAudio(sender, groupName, audioFile.getName());
                    Server.broadcastToGroup(groupName, "[AUDIO]" + audioFile.getName(), sender);
                    
                    response.addProperty("status", "success");
                    response.addProperty("message", "Audio enviado");
                }
                
                case "SEND_AUDIO_TO_PRIVATE" -> {
                    String fromUser = data.get("fromUser").getAsString();
                    String toUser = data.get("toUser").getAsString();
                    String audioFileName = data.get("audioFileName").getAsString();
                    String audioDataBase64 = data.get("audioData").getAsString();
                    
                    byte[] audioBytes = Base64.getDecoder().decode(audioDataBase64);
                    File audioFile = new File("audios/" + fromUser + "_" + audioFileName);
                    audioFile.getParentFile().mkdirs();
                    
                    try (FileOutputStream fos = new FileOutputStream(audioFile)) {
                        fos.write(audioBytes);
                    }
                    
                    String chatName = "Privado_" + fromUser + "_" + toUser;
                    HistorialManager.registrarAudio(fromUser, chatName, audioFile.getName());
                    
                    response.addProperty("status", "success");
                    response.addProperty("message", "Audio privado enviado");
                }
                
                case "GET_PRIVATE_HISTORY" -> {
                    String user1 = data.get("user1").getAsString();
                    String user2 = data.get("user2").getAsString();
                    
                    System.out.println("[JSON] GET_PRIVATE_HISTORY: " + user1 + " <-> " + user2);
                    
                    // Intentar ambas combinaciones de nombres
                    String chatName1 = "Privado_" + user1 + "_" + user2;
                    String chatName2 = "Privado_" + user2 + "_" + user1;
                    
                    String history1 = HistorialManager.leerHistorialCompleto(chatName1);
                    String history2 = HistorialManager.leerHistorialCompleto(chatName2);
                    
                    // Combinar ambos historiales
                    String combinedHistory = "";
                    if (!history1.contains("vacío")) combinedHistory += history1 + "\n";
                    if (!history2.contains("vacío")) combinedHistory += history2;
                    
                    if (combinedHistory.trim().isEmpty()) {
                        combinedHistory = "(Historial vacío)";
                    }
                    
                    response.addProperty("status", "success");
                    JsonObject dataObj = new JsonObject();
                    dataObj.addProperty("history", combinedHistory);
                    response.add("data", dataObj);
                }
                
                case "GET_GROUP_HISTORY" -> {
                    String groupName = data.get("groupName").getAsString();
                    
                    System.out.println("[JSON] GET_GROUP_HISTORY: " + groupName);
                    
                    String history = HistorialManager.leerHistorialCompleto(groupName);
                    
                    response.addProperty("status", "success");
                    JsonObject dataObj = new JsonObject();
                    dataObj.addProperty("history", history);
                    response.add("data", dataObj);
                }
                
                default -> {
                    response.addProperty("status", "error");
                    response.addProperty("message", "Acción no reconocida: " + action);
                }
            }
            
            // Enviar respuesta
            out.println(gson.toJson(response));
            out.flush();
            
        } catch (Exception e) {
            System.err.println("[JSON] Error procesando mensaje: " + e.getMessage());
            e.printStackTrace();
            
            JsonObject errorResponse = new JsonObject();
            errorResponse.addProperty("status", "error");
            errorResponse.addProperty("message", "Error interno: " + e.getMessage());
            out.println(gson.toJson(errorResponse));
        }
    }
    
    /**
     * Delega al ClientHandler original para protocolo de consola
     */
    private void delegateToConsoleHandler(String firstLine) {
        System.out.println("[JSON] Cliente de consola detectado, delegando...");
        // Aquí podrías re-enviar el firstLine al ClientHandler original
        // Por simplicidad, cerramos la conexión
        closeSilently();
    }
    
    private void cleanup() {
        // En modo web (JSON), NO desregistrar al usuario automáticamente
        // Solo limpiar el socket
        try {
            if (clientSocket != null && !clientSocket.isClosed()) {
                clientSocket.close();
            }
        } catch (IOException ignored) {}
    }
    
    private void closeSilently() {
        try {
            clientSocket.close();
        } catch (IOException ignored) {}
    }
}