package com.example.chat.server;

import com.zeroc.Ice.Current;
import com.example.chat.generated.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

public class ChatServiceI extends _ChatServiceDisp {

    // Usuarios conectados: username -> callback proxy
    private final Map<String, ChatCallbackPrx> connectedUsers = new ConcurrentHashMap<>();
    
    // Grupos: groupName -> Set de usernames
    private final Map<String, Set<String>> groups = new ConcurrentHashMap<>();
    
    // Historial: roomName -> List de mensajes
    private final Map<String, List<Message>> history = new ConcurrentHashMap<>();
    
    private final DateTimeFormatter dateFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Override
    public boolean login(String username, String password, ChatCallbackPrx callback, Current current) {
        System.out.println("\n[LOGIN] ========================================");
        System.out.println("  Usuario: " + username);
        System.out.println("  Password: " + (password.isEmpty() ? "(vacio)" : "***"));
        System.out.println("  Callback: " + (callback == null ? "NULL" : "OK"));
        System.out.println("  Connection: " + (current.con == null ? "NULL" : "OK"));
        
        if (callback == null) {
            System.out.println("  ERROR: Callback es NULL");
            return false;
        }
        
        if (connectedUsers.containsKey(username)) {
            System.out.println("  ERROR: Usuario ya conectado");
            return false;
        }
        
        try {
            ChatCallbackPrx fixedCallback = callback.ice_fixed(current.con);
            System.out.println("  Fixed callback creado: " + fixedCallback);
            
            // Ping para verificar conectividad
            fixedCallback.ice_ping();
            System.out.println("  Ping al callback: OK");
            
            // Guardar el proxy fijado
            connectedUsers.put(username, fixedCallback);
            System.out.println("  Usuario registrado exitosamente");
            System.out.println("[LOGIN] ========================================\n");
            return true;
            
        } catch (Exception e) {
            System.out.println("  ERROR en ping/registro: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    @Override
    public void createGroup(String groupName, String creator, Current current) {
        System.out.println("[GROUP] Creando grupo: " + groupName + " por " + creator);
        if (!groups.containsKey(groupName)) {
            Set<String> members = ConcurrentHashMap.newKeySet();
            members.add(creator);
            groups.put(groupName, members);
            history.put(groupName, Collections.synchronizedList(new ArrayList<>()));
            System.out.println("  Grupo creado exitosamente");
        } else {
            System.out.println("  El grupo ya existe");
        }
    }

    @Override
    public String[] getGroups(Current current) {
        System.out.println("[GROUPS] Obteniendo lista de grupos");
        return groups.keySet().toArray(new String[0]);
    }

    @Override
    public boolean joinGroup(String groupName, String username, Current current) {
        System.out.println("[JOIN] " + username + " intenta unirse a " + groupName);
        Set<String> members = groups.get(groupName);
        if (members != null) {
            members.add(username);
            System.out.println("  Unido exitosamente");
            return true;
        }
        System.out.println("  Grupo no existe");
        return false;
    }

    @Override
    public void sendMessage(String content, String sender, String groupName, String type, Current current) {
        System.out.println("[MSG] De: " + sender + " | Room: " + groupName + " | Type: " + type);
        System.out.println("  Contenido: " + content.substring(0, Math.min(50, content.length())) + "...");
        
        String timestamp = LocalDateTime.now().format(dateFormatter);
        Message msg = new Message(sender, content, type, timestamp);
        
        // Guardar en historial
        history.computeIfAbsent(groupName, k -> Collections.synchronizedList(new ArrayList<>())).add(msg);
        
        // Broadcast a usuarios conectados
        Set<String> recipients = getRecipients(groupName);
        
        for (String recipient : recipients) {
            ChatCallbackPrx cb = connectedUsers.get(recipient);
            if (cb != null) {
                try {
                    cb.ice_oneway().receiveMessage(msg, groupName);
                    System.out.println("  Enviado a: " + recipient);
                } catch (Exception e) {
                    System.out.println("  Error enviando a " + recipient + ": " + e.getMessage());
                    connectedUsers.remove(recipient);
                }
            }
        }
    }

    @Override
    public void sendAudio(byte[] data, String sender, String groupName, String fileExtension, Current current) {
        System.out.println("[AUDIO] De: " + sender + " | Room: " + groupName + " | Size: " + data.length);
        
        String timestamp = LocalDateTime.now().format(dateFormatter);
        String base64Audio = Base64.getEncoder().encodeToString(data);
        Message msg = new Message(sender, base64Audio, "audio", timestamp);
        
        history.computeIfAbsent(groupName, k -> Collections.synchronizedList(new ArrayList<>())).add(msg);
        
        Set<String> recipients = getRecipients(groupName);
        for (String recipient : recipients) {
            ChatCallbackPrx cb = connectedUsers.get(recipient);
            if (cb != null) {
                try {
                    cb.ice_oneway().receiveMessage(msg, groupName);
                    System.out.println("  Audio enviado a: " + recipient);
                } catch (Exception e) {
                    System.out.println("  Error enviando audio a " + recipient);
                    connectedUsers.remove(recipient);
                }
            }
        }
    }

    @Override
    public Message[] getHistory(String groupName, Current current) {
        System.out.println("[HISTORY] Solicitando historial de: " + groupName);
        List<Message> messages = history.getOrDefault(groupName, new ArrayList<>());
        System.out.println("  Mensajes encontrados: " + messages.size());
        return messages.toArray(new Message[0]);
    }
    
    // Helper: obtener destinatarios segun el room
    private Set<String> getRecipients(String room) {
        if ("general".equals(room)) {
            return connectedUsers.keySet();
        }
        Set<String> groupMembers = groups.get(room);
        if (groupMembers != null) {
            return groupMembers;
        }
        // Chat privado: el room es el username destino
        Set<String> single = new HashSet<>();
        single.add(room);
        return single;
    }
}
