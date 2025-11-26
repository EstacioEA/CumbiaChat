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
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public class ChatServiceI implements ChatService {

    private static final Map<String, ChatCallbackPrx> connectedClients = new ConcurrentHashMap<>();
    private static final Map<String, Group> groups = new ConcurrentHashMap<>();
    private static final Map<String, Set<String>> groupMemberNames = new ConcurrentHashMap<>();

    @Override
    public boolean login(String username, String password, ChatCallbackPrx cb, Current current) {
        System.out.println("\n[LOGIN] ========================================");
        System.out.println("  Usuario: " + username);
        System.out.println("  Callback: " + (cb != null ? "Recibido" : "NULL"));
        
        try {
            if (connectedClients.containsKey(username)) {
                System.out.println("  Usuario ya conectado - removiendo anterior");
                connectedClients.remove(username);
            }

            if (cb != null) {
                ChatCallbackPrx fixedCallback = cb.ice_fixed(current.con);
                // Convertir a oneway para que no bloquee
                ChatCallbackPrx onewayCallback = fixedCallback.ice_oneway();
                System.out.println("  Callback fijado y convertido a oneway");
                System.out.println("  Callback proxy: " + onewayCallback.toString());
                
                connectedClients.put(username, onewayCallback);
                System.out.println("  Usuario registrado");
                System.out.println("  Total conectados: " + connectedClients.size());
                System.out.println("  Clientes: " + connectedClients.keySet());
                System.out.println("  LOGIN EXITOSO");
                System.out.println("================================================\n");
                return true;
            } else {
                System.out.println("  Callback es NULL");
                return false;
            }
            
        } catch (Exception e) {
            System.err.println("  ERROR en login: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    @Override
    public void logout(String username, Current current) {
        System.out.println("[LOGOUT] " + username);
        connectedClients.remove(username);
        for (Set<String> members : groupMemberNames.values()) {
            members.remove(username);
        }
        System.out.println("  Usuario removido. Total conectados: " + connectedClients.size());
    }

    @Override
    public String[] getConnectedUsers(Current current) {
        System.out.println("[GET_CONNECTED_USERS] Solicitando lista de usuarios");
        String[] result = connectedClients.keySet().toArray(new String[0]);
        System.out.println("  Retornando " + result.length + " usuario(s): " + String.join(", ", result));
        return result;
    }

    @Override
    public void createGroup(String groupName, String creator, Current current) {
        System.out.println("[CREATE_GROUP] " + groupName + " por " + creator);
        
        try {
            if (!groups.containsKey(groupName)) {
                Group newGroup = new Group(groupName, null);
                groups.put(groupName, newGroup);
                groupMemberNames.put(groupName, ConcurrentHashMap.newKeySet());
                System.out.println("  Grupo creado. Total grupos: " + groups.size());
            } else {
                System.out.println("  Grupo ya existe");
            }
        } catch (Exception e) {
            System.err.println("  Error: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public String[] getGroups(Current current) {
        System.out.println("[GET_GROUPS] Solicitando lista de grupos");
        String[] result = groups.keySet().toArray(new String[0]);
        System.out.println("  Retornando " + result.length + " grupo(s)");
        return result;
    }

    @Override
    public boolean joinGroup(String groupName, String username, Current current) {
        System.out.println("[JOIN_GROUP] " + username + " -> " + groupName);
        
        try {
            if (groups.containsKey(groupName)) {
                Set<String> members = groupMemberNames.get(groupName);
                if (members == null) {
                    members = ConcurrentHashMap.newKeySet();
                    groupMemberNames.put(groupName, members);
                }
                members.add(username);
                System.out.println("  Usuario agregado. Miembros actuales: " + members);
                return true;
            } else {
                System.out.println("  Grupo no existe");
                return false;
            }
        } catch (Exception e) {
            System.err.println("  Error: " + e.getMessage());
            return false;
        }
    }

    @Override
    public void sendMessage(String content, String sender, String target, String type, Current current) {
        String preview = content.length() > 30 ? content.substring(0, 30) + "..." : content;
        System.out.println("[SEND_MESSAGE] " + sender + " -> " + target + ": " + preview);
        
        try {
            HistorialManager.registrarMensajeTexto(sender, target, content);
            System.out.println("  Guardado en historial");

            Message msg = new Message();
            msg.sender = sender;
            msg.content = content;
            msg.type = type;
            msg.date = new java.util.Date().toString();

            Set<String> members = groupMemberNames.get(target);
            
            if (members != null && !members.isEmpty()) {
                System.out.println("  [GRUPO] Miembros: " + members);
                int sent = 0;
                int failed = 0;
                
                for (String memberName : members) {
                    if (memberName.equals(sender)) {
                        continue;
                    }
                    
                    ChatCallbackPrx clientPrx = connectedClients.get(memberName);
                    System.out.println("  Enviando a: " + memberName + " (proxy: " + (clientPrx != null ? "OK" : "NULL") + ")");
                    
                    if (clientPrx != null) {
                        try {
                            clientPrx.receiveMessage(msg, target);
                            sent++;
                            System.out.println("    ENVIADO OK -> " + memberName);
                        } catch (Exception e) {
                            System.err.println("    FALLO -> " + memberName + ": " + e.getClass().getName() + " - " + e.getMessage());
                            connectedClients.remove(memberName);
                            failed++;
                        }
                    }
                }
                System.out.println("  Resultado: Enviados=" + sent + " Fallidos=" + failed);
            } else {
                ChatCallbackPrx targetPrx = connectedClients.get(target);
                System.out.println("  [PRIVADO] Target: " + target);
                System.out.println("  [PRIVADO] Proxy encontrado: " + (targetPrx != null ? "SI" : "NO"));
                
                if (targetPrx != null) {
                    try {
                        targetPrx.receiveMessage(msg, sender);
                        System.out.println("  [PRIVADO] ENVIADO OK -> " + target);
                    } catch (Exception e) {
                        System.err.println("  [PRIVADO] ERROR: " + e.getClass().getName() + " - " + e.getMessage());
                        connectedClients.remove(target);
                    }
                } else {
                    System.out.println("  [PRIVADO] Usuario " + target + " no conectado");
                }
            }
            
            System.out.println("[SEND_MESSAGE] Fin");
            
        } catch (Exception e) {
            System.err.println("  Error general: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public void sendAudio(byte[] data, String sender, String groupName, String fileExtension, Current current) {
        System.out.println("[SEND_AUDIO] " + sender + " -> " + groupName + " (" + data.length + " bytes)");
        
        try {
            String fileName = sender + "_" + System.currentTimeMillis() + fileExtension;
            File audioDir = new File("audios");
            if (!audioDir.exists()) audioDir.mkdirs();
            
            File outFile = new File(audioDir, fileName);
            
            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                fos.write(data);
            }
            
            HistorialManager.registrarAudio(sender, groupName, fileName);
            System.out.println("  Audio guardado: " + fileName);
            
            sendMessage(fileName, sender, groupName, "AUDIO", current);
            
        } catch (IOException e) {
            System.err.println("  Error guardando audio: " + e.getMessage());
            e.printStackTrace();
        }
    }

    @Override
    public Message[] getHistory(String groupName, Current current) {
        System.out.println("[GET_HISTORY] " + groupName);
        return new Message[]{};
    }
}