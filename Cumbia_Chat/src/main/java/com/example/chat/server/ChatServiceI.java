package com.example.chat.server;

import com.zeroc.Ice.Current;
import com.example.chat.generated.CumbiaChat.*;
import com.example.chat.data.HistorialManager;
import com.example.chat.data.User;
import com.example.chat.data.Group;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class ChatServiceI implements ChatService {

    // Simula la memoria del servidor
    private static final Map<String, ChatCallbackPrx> connectedClients = new ConcurrentHashMap<>();
    private static final Map<String, Group> groups = new ConcurrentHashMap<>();

    // --- GESTIÓN DE SESIÓN ---

    @Override
    public boolean login(String username, String password, ChatCallbackPrx cb, Current current) {
        System.out.println("Login solicitado: " + username);
        if (cb != null) {
            connectedClients.put(username, cb);
            System.out.println("Usuario registrado en Ice: " + username);
            return true;
        }
        return false;
    }

    // --- GESTIÓN DE GRUPOS ---

    @Override
    public void createGroup(String groupName, String creator, Current current) {
        System.out.println("Creando grupo: " + groupName);
        if (!groups.containsKey(groupName)) {
            // Usamos tus constructores originales
            User creatorUser = new User(creator); 
            Group newGroup = new Group(groupName, creatorUser); 
            groups.put(groupName, newGroup);
        }
    }

    @Override
    public String[] getGroups(Current current) {
        return groups.keySet().toArray(new String[0]);
    }

    @Override
    public boolean joinGroup(String groupName, String username, Current current) {
        Group g = groups.get(groupName);
        if (g != null) {
            // Usamos tu método addMember
            User u = new User(username);
            g.addMember(u);
            System.out.println(username + " añadido al grupo " + groupName);
            return true;
        }
        return false;
    }

    // --- MENSAJERÍA ---

    @Override
    public void sendMessage(String content, String sender, String groupName, String type, Current current) {
        System.out.println("[" + groupName + "] " + sender + ": " + content);

        // 1. GUARDAR EN HISTORIAL
        try {
            // Usamos el método estático registrarMensajeTexto tal cual está en tu HistorialManager
            HistorialManager.registrarMensajeTexto(sender, groupName, content);
        } catch (Exception e) {
            System.err.println("Error guardando historial: " + e.getMessage());
        }

        // 2. PREPARAR MENSAJE ICE
        Message msg = new Message();
        msg.sender = sender;
        msg.content = content;
        msg.type = type; 
        msg.date = new java.util.Date().toString();

        // 3. BROADCAST (Notificar a los miembros conectados)
        Group g = groups.get(groupName);
        if (g != null) {
            // Usamos tu método getMembers
            for (User member : g.getMembers()) {
                ChatCallbackPrx clientPrx = connectedClients.get(member.getUsername());
                
                if (clientPrx != null) {
                    try {
                        clientPrx.receiveMessage(msg, groupName);
                    } catch (Exception e) {
                        connectedClients.remove(member.getUsername());
                    }
                }
            }
        }
    }

    // --- AUDIO ---

    @Override
    public void sendAudio(byte[] data, String sender, String groupName, String fileExtension, Current current) {
        System.out.println("Recibiendo audio de " + sender + " para " + groupName);
        
        // 1. CREAR ARCHIVO FÍSICO
        String fileName = sender + "_" + System.currentTimeMillis() + fileExtension;
        File audioDir = new File("audios");
        if (!audioDir.exists()) audioDir.mkdirs();
        
        File outFile = new File(audioDir, fileName);
        
        try (FileOutputStream fos = new FileOutputStream(outFile)) {
            fos.write(data);
            
            // 2. REGISTRAR AUDIO EN HISTORIAL
            // Usamos el método estático registrarAudio tal cual está en tu HistorialManager
            HistorialManager.registrarAudio(sender, groupName, fileName);
            
            // 3. NOTIFICAR AL GRUPO
            sendMessage(fileName, sender, groupName, "AUDIO", current);
            
        } catch (IOException e) {
            System.err.println("Error guardando audio: " + e.getMessage());
        }
    }

    // --- HISTORIAL ---

    @Override
    public Message[] getHistory(String groupName, Current current) {
        return new Message[]{};
    }
}