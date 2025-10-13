package com.example.chat.TCP;

import com.example.chat.data.*;

import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Servidor principal que gestiona los clientes, grupos y mensajes.
 * Soporta:
 *  - Chats grupales
 *  - Chats individuales
 *  - Historial persistente
 */
public class Server {

    private static final int PORT = 12345;
    private static final int THREAD_POOL_SIZE = 20;

    // Usuarios conectados
    private static final Map<String, ClientHandler> connectedUsers = Collections.synchronizedMap(new HashMap<>());

    // Grupos creados en el servidor
    private static final Map<String, Group> groups = Collections.synchronizedMap(new HashMap<>());

    // Historial global de mensajes
    private static final HistorialManager historial = new HistorialManager();

    public static void main(String[] args) {
        ExecutorService pool = Executors.newFixedThreadPool(THREAD_POOL_SIZE);

        try (ServerSocket server = new ServerSocket(PORT, 50, InetAddress.getByName("localhost"))) {
            System.out.println("🚀 Servidor TCP corriendo en el puerto " + PORT);

            while (true) {
                Socket clientSocket = server.accept();

                // Cuando un cliente se conecta, primero debe identificarse
                ClientHandler handler = new ClientHandler(clientSocket, connectedUsers, groups, historial);
                pool.submit(handler);
            }
        } catch (IOException e) {
            System.err.println("❌ Error en el servidor: " + e.getMessage());
        } finally {
            pool.shutdown();
        }
    }

    /**
     * Envía un mensaje a todos los miembros de un grupo.
     */
    public static void broadcastToGroup(String groupName, String message, String sender) {
        Group group = groups.get(groupName);
        if (group != null) {
            for (User member : group.getMembers()) {
                ClientHandler handler = connectedUsers.get(member.getUsername());
                if (handler != null) {
                    handler.sendMessage("[GRUPO " + groupName + "] " + sender + ": " + message);
                }
            }
        }
    }

    /**
     * Envía un mensaje directo entre dos usuarios.
     */
    public static void sendPrivateMessage(String fromUser, String toUser, String message) {
        ClientHandler receiver = connectedUsers.get(toUser);
        if (receiver != null) {
            receiver.sendMessage("[Privado de " + fromUser + "]: " + message);
        } else {
            ClientHandler sender = connectedUsers.get(fromUser);
            if (sender != null) {
                sender.sendMessage("⚠️ El usuario '" + toUser + "' no está conectado.");
            }
        }
    }

    /**
     * Crea un grupo nuevo en el servidor.
     */
    public static boolean createGroup(String groupName, User creator) {
        if (groups.containsKey(groupName)) {
            return false;
        }
        Group group = new Group(groupName, creator);
        groups.put(groupName, group);
        return true;
    }

    /**
     * Agrega un usuario a un grupo existente.
     */
    public static boolean joinGroup(String groupName, User user) {
        Group group = groups.get(groupName);
        if (group == null) {
            return false;
        }
        group.addMember(user);
        return true;
    }

    public static Set<String> getActiveUsers() {
        return connectedUsers.keySet();
    }

    public static Set<String> getAvailableGroups() {
        return groups.keySet();
    }
}
