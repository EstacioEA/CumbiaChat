package com.example.chat.TCP;

import java.io.IOException;
import java.lang.Exception;
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

import com.example.chat.ice.ChatServiceImpl;
import com.example.chat.data.Group;
import com.example.chat.data.HistorialManager;
import com.example.chat.data.User;
import com.zeroc.Ice.*;

public class Server {
    private static final int TCP_PORT = 12345;
    private static final int ICE_PORT = 9099;
    private static final int THREAD_POOL_SIZE = 50;

    private static final Map<String, ClientHandler> connectedUsers = Collections.synchronizedMap(new HashMap<>());
    private static final Map<String, Group> groups = Collections.synchronizedMap(new HashMap<>());
    private static final HistorialManager historial = new HistorialManager();

    public static void main(String[] args) {
        // Iniciar servidor Ice en un thread separado
        Thread iceThread = new Thread(() -> startIceServer(args));
        iceThread.setDaemon(false);
        iceThread.start();

        // Iniciar servidor TCP
        startTcpServer();
    }

    private static void startIceServer(String[] args) {
        try (Communicator communicator = Util.initialize(args)) {
            ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints(
                    "CumbiaChatAdapter",
                    "ws -h localhost -p " + ICE_PORT
            );

            ChatServiceImpl iceService = new ChatServiceImpl();
            adapter.add(iceService, Util.stringToIdentity("CumbiaChatService"));
            adapter.activate();

            System.out.println("[ICE] Servidor Ice WebSocket listo en ws://localhost:" + ICE_PORT);
            communicator.waitForShutdown();

        } catch (Exception e) {
            System.err.println("[ICE] Error en servidor Ice: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private static void startTcpServer() {
        ExecutorService pool = Executors.newFixedThreadPool(THREAD_POOL_SIZE);
        try (ServerSocket server = new ServerSocket(TCP_PORT, 50, InetAddress.getByName("localhost"))) {
            System.out.println("[TCP] Servidor TCP corriendo en puerto " + TCP_PORT);
            while (true) {
                Socket clientSocket = server.accept();
                JSONProtocolHandler handler = new JSONProtocolHandler(clientSocket, connectedUsers, groups, historial);
                pool.submit(handler);
            }
        } catch (IOException e) {
            System.err.println("[TCP] Error en servidor: " + e.getMessage());
        } finally {
            pool.shutdown();
        }
    }

    // Métodos existentes sin cambios
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
        System.out.println("[GRUPO " + groupName + "] " + sender + ": " + message);
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

    public static HistorialManager getHistorial() { return historial; }
}
