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

    private static final Map<String, ChatCallbackPrx> connectedClients = new ConcurrentHashMap<>();
    private static final Map<String, Group> groups = new ConcurrentHashMap<>();

    @Override
    public boolean login(String username, String password, ChatCallbackPrx cb, Current current) {
        System.out.println("\n[LOGIN] ========================================");
        System.out.println("  Usuario: " + username);
        System.out.println("  Password: " + (password.isEmpty() ? "(vacío)" : "***"));
        System.out.println("  Callback: " + (cb != null ? "✓ Recibido" : "✗ NULL"));
        
        try {
            if (connectedClients.containsKey(username)) {
                System.out.println("  ❌ Usuario ya conectado");
                return false;
            }

            if (cb != null) {
                // El proxy llega solo con identidad, sin endpoints.
                // ice_fixed() lo vincula a la conexion TCP entrante.
                ChatCallbackPrx fixedCallback = cb.ice_fixed(current.con);
                System.out.println("  ✓ Callback fijado a conexion bidireccional");
                
                // <CHANGE> Eliminado ice_ping() que causa bloqueo en conexiones bidireccionales con JS
                // El ping síncrono no funciona correctamente con Ice.js en WebSockets
                // fixedCallback.ice_ping();  // REMOVIDO
                System.out.println("  ✓ Callback registrado (sin ping de verificación)");
                
                connectedClients.put(username, fixedCallback);
                System.out.println("  ✓ Usuario registrado");
                System.out.println("  ✓ Total conectados: " + connectedClients.size());
                System.out.println("  ✅ LOGIN EXITOSO");
                System.out.println("================================================\n");
                return true;
            } else {
                System.out.println("  ❌ Callback es NULL");
                return false;
            }
            
        } catch (Exception e) {
            System.err.println("  ❌ ERROR en login: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    @Override
    public void createGroup(String groupName, String creator, Current current) {
        System.out.println("[CREATE_GROUP] " + groupName + " por " + creator);
        
        try {
            if (!groups.containsKey(groupName)) {
                User creatorUser = new User(creator);
                Group newGroup = new Group(groupName, creatorUser);
                groups.put(groupName, newGroup);
                System.out.println("  ✓ Grupo creado. Total grupos: " + groups.size());
            } else {
                System.out.println("  ⚠ Grupo ya existe");
            }
        } catch (Exception e) {
            System.err.println("  ❌ Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public String[] getGroups(Current current) {
        System.out.println("[GET_GROUPS] Solicitando lista de grupos");
        String[] result = groups.keySet().toArray(new String[0]);
        System.out.println("  → Retornando " + result.length + " grupo(s)");
        return result;
    }

    @Override
    public boolean joinGroup(String groupName, String username, Current current) {
        System.out.println("[JOIN_GROUP] " + username + " → " + groupName);
        
        try {
            Group g = groups.get(groupName);
            if (g != null) {
                User u = new User(username);
                g.addMember(u);
                System.out.println("  ✓ Usuario añadido. Miembros: " + g.getMembers().size());
                return true;
            } else {
                System.out.println("  ❌ Grupo no existe");
                return false;
            }
        } catch (Exception e) {
            System.err.println("  ❌ Error: " + e.getMessage());
            return false;
        }
    }

    @Override
    public void sendMessage(String content, String sender, String groupName, String type, Current current) {
        String preview = content.length() > 30 ? content.substring(0, 30) + "..." : content;
        System.out.println("[SEND_MESSAGE] " + sender + " → " + groupName + ": " + preview);
        
        try {
            HistorialManager.registrarMensajeTexto(sender, groupName, content);
            System.out.println("  ✓ Guardado en historial");

            Message msg = new Message();
            msg.sender = sender;
            msg.content = content;
            msg.type = type;
            msg.date = new java.util.Date().toString();

            Group g = groups.get(groupName);
            if (g != null) {
                int sent = 0;
                int failed = 0;
                
                for (User member : g.getMembers()) {
                    ChatCallbackPrx clientPrx = connectedClients.get(member.getUsername());
                    
                    if (clientPrx != null) {
                        try {
                            clientPrx.receiveMessage(msg, groupName);
                            sent++;
                        } catch (Exception e) {
                            System.err.println("    ⚠ Falló envío a " + member.getUsername() + ": " + e.getMessage());
                            connectedClients.remove(member.getUsername());
                            failed++;
                        }
                    }
                }
                System.out.println("  ✓ Enviado: " + sent + " | Fallidos: " + failed);
            } else {
                System.out.println("  ⚠ Grupo no encontrado");
            }
            
        } catch (Exception e) {
            System.err.println("  ❌ Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public void sendAudio(byte[] data, String sender, String groupName, String fileExtension, Current current) {
        System.out.println("[SEND_AUDIO] " + sender + " → " + groupName + " (" + data.length + " bytes)");
        
        try {
            String fileName = sender + "_" + System.currentTimeMillis() + fileExtension;
            File audioDir = new File("audios");
            if (!audioDir.exists()) audioDir.mkdirs();
            
            File outFile = new File(audioDir, fileName);
            
            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(data);
            }
            
            HistorialManager.registrarAudio(sender, groupName, fileName);
            System.out.println("  ✓ Audio guardado: " + fileName);
            
            sendMessage(fileName, sender, groupName, "AUDIO", current);
            
        } catch (IOException e) {
            System.err.println("  ❌ Error guardando audio: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public Message[] getHistory(String groupName, Current current) {
        System.out.println("[GET_HISTORY] " + groupName);
        return new Message[]{};
    }
}