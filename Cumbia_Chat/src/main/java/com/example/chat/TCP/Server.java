package com.example.chat.TCP;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import com.example.chat.UDP.UDPAudioServer;
import com.example.chat.data.Group;
import com.example.chat.data.HistorialManager;
import com.example.chat.data.User;

/**
 * Servidor TCP principal. Mantiene usuarios conectados, grupos, historial
 * y coordina las salas de voz UDP (una UDPAudioServer por sala activa).
 */
public class Server {
    private static final int PORT = 12345;
    private static final int THREAD_POOL_SIZE = 50;

    // username -> handler
    private static final Map<String, ClientHandler> connectedUsers = Collections.synchronizedMap(new HashMap<>());
    // groupName -> Group
    private static final Map<String, Group> groups = Collections.synchronizedMap(new HashMap<>());

    // active voice rooms: groupName -> UDPAudioServer instance
    private static final Map<String, UDPAudioServer> voiceRooms = Collections.synchronizedMap(new HashMap<>());

    private static final HistorialManager historial = new HistorialManager();

    public static void main(String[] args) {
        ExecutorService pool = Executors.newFixedThreadPool(THREAD_POOL_SIZE);
        try (ServerSocket server = new ServerSocket(PORT, 50, InetAddress.getByName("localhost"))) {
            System.out.println("Servidor TCP corriendo en puerto " + PORT);
            while (true) {
                Socket clientSocket = server.accept();
                JSONProtocolHandler handler = new JSONProtocolHandler(clientSocket, connectedUsers, groups, historial);
                pool.submit(handler);
            }
        } catch (IOException e) {
            System.err.println("Error en servidor: " + e.getMessage());
        } finally {
            pool.shutdown();
        }
    }

    // ---------- user & group helpers ----------
    public static boolean userExists(String username) { return connectedUsers.containsKey(username); }

    public static void registerUser(String username, ClientHandler handler) { connectedUsers.put(username, handler); }

    public static void unregisterUser(String username) { connectedUsers.remove(username); }

    public static Set<String> getActiveUsers() { return new HashSet<>(connectedUsers.keySet()); }

    public static Set<String> getAvailableGroups() { return new HashSet<>(groups.keySet()); }

    public static boolean createGroup(String groupName, User creator) {
        synchronized (groups) {
            if (groups.containsKey(groupName)) return false;
            Group g = new Group(groupName, creator);
            groups.put(groupName, g);
            return true;
        }
    }

    public static boolean joinGroup(String groupName, User user) {
        synchronized (groups) {
            Group g = groups.get(groupName);
            if (g == null) return false;
            g.addMember(user);
            return true;
        }
    }

    public static void broadcastToGroup(String groupName, String message, String sender) {
        Group g = groups.get(groupName);
        if (g == null) return;
        for (User member : g.getMembers()) {
            ClientHandler h = connectedUsers.get(member.getUsername());
            if (h != null) h.sendMessage("[GRUPO " + groupName + "] " + sender + ": " + message);
        }
    }

    public static void sendPrivateMessage(String fromUser, String toUser, String message) {
        ClientHandler h = connectedUsers.get(toUser);
        if (h != null) {
            h.sendMessage("[PRIVADO de " + fromUser + "]: " + message);
        } else {
            ClientHandler sender = connectedUsers.get(fromUser);
            if (sender != null) sender.sendMessage("⚠️ Usuario " + toUser + " no conectado.");
        }
    }

    // ---------- voice room management ----------
    /**
     * Starts a UDP voice room for given group. Returns chosen port, or -1 on error.
     * If a room already exists, returns its port.
     */
    public static int startVoiceRoom(String groupName) {
        synchronized (voiceRooms) {
            if (voiceRooms.containsKey(groupName)) {
                return voiceRooms.get(groupName).getPort();
            }
            try {
                UDPAudioServer room = new UDPAudioServer();
                room.start(); // starts on a random free port
                voiceRooms.put(groupName, room);
                System.out.println("Sala de voz creada para grupo '" + groupName + "' en puerto " + room.getPort());
                return room.getPort();
            } catch (IOException e) {
                e.printStackTrace();
                return -1;
            }
        }
    }

    /**
     * Stops the voice room for group (if exists)
     */
    public static void stopVoiceRoom(String groupName) {
        synchronized (voiceRooms) {
            UDPAudioServer room = voiceRooms.remove(groupName);
            if (room != null) room.shutdown();
        }
    }

    /**
     * Register a participant's address+port into the voice room so server forwards packets.
     * clientAddress is the InetAddress as string (the server can infer from socket),
     * udpPort is the client's local UDP listening port.
     */
    public static boolean registerVoiceParticipant(String groupName, String username, String clientAddress, int udpPort) {
        UDPAudioServer room = voiceRooms.get(groupName);
        if (room == null) return false;
        room.addParticipant(username, clientAddress, udpPort);
        return true;
    }

    public static int getVoiceRoomPort(String groupName) {
        UDPAudioServer room = voiceRooms.get(groupName);
        if (room == null) return -1;
        return room.getPort();
    }

    public static HistorialManager getHistorial() { return historial; }
}
