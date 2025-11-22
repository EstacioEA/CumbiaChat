package com.example.chat.ice;

import com.zeroc.Ice.Current;
import CumbiaChat.*;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Implementación del servidor Ice para audio en tiempo real
 * Soporta WebSocket para clientes web y UDP para clientes nativos
 */
public class IceAudioServerImpl implements AudioServer {
    
    // Mapa de salas: roomName -> RoomInfo
    private final Map<String, RoomInfo> rooms;
    
    // Mapa de conexiones a usuarios
    private final Map<String, UserConnection> connections;
    
    // Estadísticas
    private final AtomicLong totalPacketsReceived = new AtomicLong(0);
    private final AtomicLong totalPacketsForwarded = new AtomicLong(0);
    
    public IceAudioServerImpl() {
        this.rooms = new ConcurrentHashMap<>();
        this.connections = new ConcurrentHashMap<>();
        System.out.println("🎵 [Ice] AudioServer inicializado");
    }
    
    @Override
    public boolean joinRoom(String roomName, String username, Current current) {
        try {
            System.out.println("📞 [Ice] " + username + " intentando unirse a '" + roomName + "'");
            
            // Obtener identificador único de la conexión
            String connectionId = getConnectionId(current);
            
            // Crear sala si no existe
            RoomInfo room = rooms.computeIfAbsent(roomName, k -> new RoomInfo(roomName));
            
            // Registrar usuario
            UserConnection userConn = new UserConnection(username, roomName, connectionId, current);
            connections.put(connectionId, userConn);
            
            // Agregar a la sala
            room.addUser(connectionId, username);
            
            System.out.println("✅ [Ice] " + username + " se unió a '" + roomName + "' " +
                             "(Total en sala: " + room.getUserCount() + ")");
            
            return true;
            
        } catch (Exception e) {
            System.err.println("❌ [Ice] Error en joinRoom: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
    
    @Override
    public void leaveCall(Current current) {
        try {
            String connectionId = getConnectionId(current);
            UserConnection userConn = connections.remove(connectionId);
            
            if (userConn != null) {
                RoomInfo room = rooms.get(userConn.roomName);
                if (room != null) {
                    room.removeUser(connectionId);
                    
                    System.out.println("👋 [Ice] " + userConn.username + 
                                     " salió de '" + userConn.roomName + "' " +
                                     "(Quedan: " + room.getUserCount() + ")");
                    
                    // Eliminar sala si está vacía
                    if (room.isEmpty()) {
                        rooms.remove(userConn.roomName);
                        System.out.println("🗑️  [Ice] Sala '" + userConn.roomName + "' eliminada (vacía)");
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("❌ [Ice] Error en leaveCall: " + e.getMessage());
        }
    }
    
    @Override
    public void sendAudioPacket(byte[] data, Current current) {
        try {
            totalPacketsReceived.incrementAndGet();
            
            String senderId = getConnectionId(current);
            UserConnection sender = connections.get(senderId);
            
            if (sender == null || sender.roomName == null) {
                return;
            }
            
            RoomInfo room = rooms.get(sender.roomName);
            if (room == null) {
                return;
            }
            
            // Obtener callbacks registrados
            Map<String, AudioCallbackPrx> callbacks = room.getCallbacks();
            
            if (callbacks.isEmpty()) {
                // Log cada 100 paquetes sin destinatarios
                if (totalPacketsReceived.get() % 100 == 0) {
                    System.out.println("⚠️  [Ice] Paquete sin destinatarios en '" + sender.roomName + "'");
                }
                return;
            }
            
            // Reenviar a todos menos al remitente
            int sent = 0;
            int errors = 0;
            
            for (Map.Entry<String, AudioCallbackPrx> entry : callbacks.entrySet()) {
                String recipientId = entry.getKey();
                AudioCallbackPrx callback = entry.getValue();
                
                // No enviar al remitente
                if (recipientId.equals(senderId)) {
                    continue;
                }
                
                try {
                    // Enviar asíncronamente para no bloquear
                    callback.receiveAudioPacketAsync(data);
                    sent++;
                    totalPacketsForwarded.incrementAndGet();
                    
                } catch (Exception e) {
                    errors++;
                    System.err.println("⚠️  [Ice] Error enviando audio: " + e.getMessage());
                    
                    // Remover callback fallido
                    room.removeCallback(recipientId);
                }
            }
            
            // Log estadísticas cada 500 paquetes
            long total = totalPacketsReceived.get();
            if (total % 500 == 0) {
                System.out.println(String.format(
                    "📊 [Ice] Stats - Recibidos: %d, Reenviados: %d, " +
                    "Sala: '%s' (%d usuarios, %d destinos, %d errores)",
                    total, totalPacketsForwarded.get(),
                    sender.roomName, room.getUserCount(), sent, errors
                ));
            }
            
        } catch (Exception e) {
            System.err.println("❌ [Ice] Error en sendAudioPacket: " + e.getMessage());
        }
    }
    
    @Override
    public void registerCallback(AudioCallbackPrx callback, Current current) {
        try {
            String connectionId = getConnectionId(current);
            UserConnection userConn = connections.get(connectionId);
            
            if (userConn == null || userConn.roomName == null) {
                System.err.println("⚠️  [Ice] registerCallback: Usuario no está en sala");
                return;
            }
            
            RoomInfo room = rooms.get(userConn.roomName);
            if (room != null) {
                room.addCallback(connectionId, callback);
                System.out.println("✅ [Ice] Callback registrado para " + userConn.username + 
                                 " en '" + userConn.roomName + "' " +
                                 "(Total callbacks: " + room.getCallbackCount() + ")");
            }
            
        } catch (Exception e) {
            System.err.println("❌ [Ice] Error en registerCallback: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    @Override
    public String[] getUsersInRoom(String roomName, Current current) {
        RoomInfo room = rooms.get(roomName);
        
        if (room == null || room.isEmpty()) {
            return new String[0];
        }
        
        return room.getUsernames();
    }
    
    @Override
    public void ping(Current current) {
        // Método de verificación de conexión (idempotent)
        String connId = getConnectionId(current);
        UserConnection user = connections.get(connId);
        
        if (user != null) {
            user.lastPing = System.currentTimeMillis();
        }
    }
    
    /**
     * Obtiene un identificador único de la conexión
     */
    private String getConnectionId(Current current) {
        try {
            // Usar información de la conexión Ice
            return current.con.toString();
        } catch (Exception e) {
            return "unknown-" + System.currentTimeMillis();
        }
    }
    
    /**
     * Imprime estadísticas del servidor
     */
    public void printStats() {
        System.out.println("\n==============================");
        System.out.println("📊 Ice Audio Server Stats");
        System.out.println("==============================");
        System.out.println("Salas activas: " + rooms.size());
        System.out.println("Conexiones activas: " + connections.size());
        System.out.println("Paquetes recibidos: " + totalPacketsReceived.get());
        System.out.println("Paquetes reenviados: " + totalPacketsForwarded.get());
        System.out.println();
        
        for (RoomInfo room : rooms.values()) {
            System.out.println("  📍 " + room.name + ":");
            System.out.println("     Usuarios: " + room.getUserCount());
            System.out.println("     Callbacks: " + room.getCallbackCount());
            System.out.println("     Miembros: " + String.join(", ", room.getUsernames()));
        }
        
        System.out.println("==============================\n");
    }
    
    // ===== CLASES INTERNAS =====
    
    /**
     * Información de un usuario conectado
     */
    private static class UserConnection {
        final String username;
        final String roomName;
        final String connectionId;
        final Current current;
        long lastPing;
        
        UserConnection(String username, String roomName, String connectionId, Current current) {
            this.username = username;
            this.roomName = roomName;
            this.connectionId = connectionId;
            this.current = current;
            this.lastPing = System.currentTimeMillis();
        }
    }
    
    /**
     * Información de una sala de audio
     */
    private static class RoomInfo {
        final String name;
        private final Map<String, String> users; // connectionId -> username
        private final Map<String, AudioCallbackPrx> callbacks; // connectionId -> callback
        
        RoomInfo(String name) {
            this.name = name;
            this.users = new ConcurrentHashMap<>();
            this.callbacks = new ConcurrentHashMap<>();
        }
        
        void addUser(String connectionId, String username) {
            users.put(connectionId, username);
        }
        
        void removeUser(String connectionId) {
            users.remove(connectionId);
            callbacks.remove(connectionId);
        }
        
        void addCallback(String connectionId, AudioCallbackPrx callback) {
            callbacks.put(connectionId, callback);
        }
        
        void removeCallback(String connectionId) {
            callbacks.remove(connectionId);
        }
        
        Map<String, AudioCallbackPrx> getCallbacks() {
            return callbacks;
        }
        
        int getUserCount() {
            return users.size();
        }
        
        int getCallbackCount() {
            return callbacks.size();
        }
        
        boolean isEmpty() {
            return users.isEmpty();
        }
        
        String[] getUsernames() {
            return users.values().toArray(new String[0]);
        }
    }
}