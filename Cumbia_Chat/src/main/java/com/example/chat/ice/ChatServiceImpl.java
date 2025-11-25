package com.example.chat.ice;

import com.zeroc.Ice.Current;
import CumbiaChat.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class ChatServiceImpl implements ChatService {

    // Observadores registrados: userId -> ObserverPrx
    private final Map<String, ChatObserverPrx> observers = new ConcurrentHashMap<>();

    // Llamadas activas: userId -> userId (quién está llamando a quién)
    private final Map<String, String> activeCalls = new ConcurrentHashMap<>();

    // Llamadas pendientes: userId -> List<fromUser> (llamadas que no se han aceptado/rechazado)
    private final Map<String, List<String>> pendingCalls = new ConcurrentHashMap<>();

    // Directorio para guardar audios
    private static final String AUDIO_DIR = "audios/";

    public ChatServiceImpl() {
        // Crear directorio de audios si no existe
        try {
            Files.createDirectories(Paths.get(AUDIO_DIR));
            System.out.println("[ICE] Directorio de audios creado/verificado: " + AUDIO_DIR);
        } catch (IOException e) {
            System.err.println("[ICE] Error creando directorio de audios: " + e.getMessage());
        }
    }

    @Override
    public void registerClient(String userId, ChatObserverPrx obs, Current current) {
        observers.put(userId, obs);
        System.out.println("[ICE] Cliente registrado: " + userId + " (Total: " + observers.size() + ")");
    }

    @Override
    public void unregisterClient(String userId, Current current) {
        observers.remove(userId);
        activeCalls.remove(userId);
        pendingCalls.remove(userId);
        System.out.println("[ICE] Cliente desregistrado: " + userId);
    }

    @Override
    public String[] getConnectedUsers(Current current) {
        return observers.keySet().toArray(new String[0]);
    }

    // ============ LLAMADAS ============

    @Override
    public void startCall(String fromUser, String toUser, Current current) {
        System.out.println("[ICE] " + fromUser + " iniciando llamada a " + toUser);

        // Guardar llamada pendiente (para polling)
        pendingCalls.computeIfAbsent(toUser, k -> new ArrayList<>()).add(fromUser);
        System.out.println("[ICE] Llamada agregada a pendientes para " + toUser);

        ChatObserverPrx targetObserver = observers.get(toUser);
        
        if (targetObserver == null) {
            System.out.println("[ICE] Usuario " + toUser + " no está conectado (llamada guardada como pendiente)");
            return;
        }

        // Notificar al destinatario (si está conectado vía observer)
        try {
            targetObserver.incomingCallAsync(fromUser);
            activeCalls.put(fromUser, toUser);
            System.out.println("[ICE] Notificación de llamada enviada a " + toUser);
        } catch (Exception e) {
            System.err.println("[ICE] Error notificando llamada entrante: " + e.getMessage());
        }
    }

    @Override
    public void acceptCall(String fromUser, String toUser, Current current) {
        System.out.println("[ICE] " + toUser + " aceptó llamada de " + fromUser);

        ChatObserverPrx callerObserver = observers.get(fromUser);
        if (callerObserver != null) {
            try {
                callerObserver.callAcceptedAsync(toUser);
                activeCalls.put(toUser, fromUser);
            } catch (Exception e) {
                System.err.println("[ICE] Error notificando aceptación: " + e.getMessage());
            }
        }
    }

    @Override
    public void rejectCall(String fromUser, String toUser, Current current) {
        System.out.println("[ICE] " + toUser + " rechazó llamada de " + fromUser);

        ChatObserverPrx callerObserver = observers.get(fromUser);
        if (callerObserver != null) {
            try {
                callerObserver.callRejectedAsync(toUser);
                activeCalls.remove(fromUser);
            } catch (Exception e) {
                System.err.println("[ICE] Error notificando rechazo: " + e.getMessage());
            }
        }
    }

    @Override
    public void endCall(String fromUser, String toUser, Current current) {
        System.out.println("[ICE] Finalizando llamada entre " + fromUser + " y " + toUser);

        ChatObserverPrx targetObserver = observers.get(toUser);
        if (targetObserver != null) {
            try {
                targetObserver.callEndedAsync(fromUser);
            } catch (Exception e) {
                System.err.println("[ICE] Error notificando fin de llamada: " + e.getMessage());
            }
        }

        activeCalls.remove(fromUser);
        activeCalls.remove(toUser);
    }

    // ============ CONSULTA DE LLAMADAS PENDIENTES ============

    @Override
    public String[] getPendingCalls(String userId, Current current) {
        List<String> calls = pendingCalls.getOrDefault(userId, new ArrayList<>());
        System.out.println("[ICE] Consulta de llamadas pendientes para " + userId + ": " + calls.size() + " llamadas");
        return calls.toArray(new String[0]);
    }

    @Override
    public void clearPendingCall(String userId, String fromUser, Current current) {
        List<String> calls = pendingCalls.get(userId);
        if (calls != null) {
            calls.remove(fromUser);
            System.out.println("[ICE] Llamada pendiente eliminada: " + fromUser + " -> " + userId);
            
            // Si no quedan llamadas pendientes, eliminar la entrada
            if (calls.isEmpty()) {
                pendingCalls.remove(userId);
            }
        }
    }

    // ============ STREAMING DE AUDIO (LLAMADAS) ============

    @Override
    public void streamAudio(String fromUser, String toUser, byte[] data, Current current) {
        // Verificar si hay llamada activa
        String activeTarget = activeCalls.get(fromUser);
        if (activeTarget == null || !activeTarget.equals(toUser)) {
            return; // No hay llamada activa
        }

        ChatObserverPrx targetObserver = observers.get(toUser);
        if (targetObserver != null) {
            try {
                targetObserver.receiveAudioStreamAsync(fromUser, data);
            } catch (Exception e) {
                System.err.println("[ICE] Error enviando stream de audio: " + e.getMessage());
            }
        }
    }

    // ============ MENSAJES DE AUDIO (GUARDADOS) ============

    @Override
    public String sendAudioMessage(String fromUser, String toUser, byte[] data, Current current) {
        String audioId = generateAudioId(fromUser, toUser);

        // Guardar archivo
        String filePath = AUDIO_DIR + audioId + ".wav";
        try {
            Files.write(Paths.get(filePath), data);
            System.out.println("[ICE] Audio guardado: " + filePath + " (" + data.length + " bytes)");
        } catch (IOException e) {
            System.err.println("[ICE] Error guardando audio: " + e.getMessage());
            return null;
        }

        // Notificar al destinatario
        ChatObserverPrx targetObserver = observers.get(toUser);
        if (targetObserver != null) {
            try {
                targetObserver.receiveAudioMessageAsync(fromUser, audioId, data);
            } catch (Exception e) {
                System.err.println("[ICE] Error notificando mensaje de audio: " + e.getMessage());
            }
        }

        return audioId;
    }

    @Override
    public String sendAudioMessageToGroup(String fromUser, String groupName, byte[] data, Current current) {
        String audioId = generateAudioId(fromUser, groupName);

        // Guardar archivo
        String filePath = AUDIO_DIR + audioId + ".wav";
        try {
            Files.write(Paths.get(filePath), data);
            System.out.println("[ICE] Audio de grupo guardado: " + filePath);
        } catch (IOException e) {
            System.err.println("[ICE] Error guardando audio de grupo: " + e.getMessage());
            return null;
        }

        // TODO: Obtener miembros del grupo desde Server.java y notificar a todos
        // Por ahora, retornamos el ID para verificar que funciona

        return audioId;
    }

    private String generateAudioId(String from, String to) {
        return String.format("audio_%s_%s_%d", from, to, System.currentTimeMillis());
    }
}
