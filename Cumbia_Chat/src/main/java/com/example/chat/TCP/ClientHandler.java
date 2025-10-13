package com.example.chat.TCP;

import com.example.chat.data.*;
import java.io.*;
import java.net.Socket;
import java.util.Map;

/**
 * ClientHandler mejorado:
 * - Maneja mensajes de texto
 * - Recibe y reenvía archivos de audio (header + bytes)
 * - Guarda historial usando HistorialManager
 * - Permite comandos: historial, historial:N, buscar:palabra
 */
public class ClientHandler implements Runnable {

    private final Socket socket;
    private final Map<String, ClientHandler> clients;
    private final HistorialManager historial;
    private BufferedReader in;
    private PrintWriter out;
    private DataInputStream dataIn;
    private DataOutputStream dataOut;
    private String username;

    public ClientHandler(Socket socket, Map<String, ClientHandler> clients, HistorialManager historial) {
        this.socket = socket;
        this.clients = clients;
        this.historial = historial;
    }

    public ClientHandler(Map<String, ClientHandler> clients, DataInputStream dataIn, DataOutputStream dataOut, HistorialManager historial, BufferedReader in, PrintWriter out, Socket socket, String username) {
        this.clients = clients;
        this.dataIn = dataIn;
        this.dataOut = dataOut;
        this.historial = historial;
        this.in = in;
        this.out = out;
        this.socket = socket;
        this.username = username;
    }

    public ClientHandler(Map<String, ClientHandler> clients, HistorialManager historial, Socket socket) {
        this.clients = clients;
        this.historial = historial;
        this.socket = socket;
    }

    @Override
    public void run() {
        try {
            in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            out = new PrintWriter(socket.getOutputStream(), true);
            dataIn = new DataInputStream(socket.getInputStream());
            dataOut = new DataOutputStream(socket.getOutputStream());

            out.println("=== Bienvenido al CumbiaChat ===");
            out.println("Ingresa tu nombre de usuario:");
            username = in.readLine();

            if (username == null || username.trim().isEmpty()) {
                out.println("❌ Nombre inválido. Conexión cerrada.");
                socket.close();
                return;
            }

            synchronized (clients) {
                if (clients.containsKey(username)) {
                    out.println("⚠️ Ya hay un usuario con ese nombre.");
                    socket.close();
                    return;
                }
                clients.put(username, this);
            }

            System.out.println("🟢 Usuario conectado: " + username);
            broadcast("📢 " + username + " se ha unido al chat.");

            // Bucle principal de escucha
            String inputLine;
            while ((inputLine = in.readLine()) != null) {
                if (inputLine.equalsIgnoreCase("exit")) {
                    break;
                }

                if (inputLine.startsWith("AUDIO:")) {
                    recibirYReenviarAudio(inputLine);
                } else if (inputLine.startsWith("historial")) {
                    manejarHistorial(inputLine);
                } else if (inputLine.startsWith("buscar:")) {
                    manejarBusqueda(inputLine);
                } else {
                    broadcast("💬 " + username + ": " + inputLine);
                    historial.registrarMensajeTexto(username, "general", inputLine);
                }
            }

        } catch (Exception e) {
            System.err.println("❌ Error con cliente " + username + ": " + e.getMessage());
        } finally {
            cleanup();
        }
    }

    /**
     * Recibe un archivo de audio del cliente y lo reenvía a todos los demás.
     */
    private void recibirYReenviarAudio(String header) {
        try {
            String[] parts = header.split(":");
            if (parts.length != 3) return;

            String fileName = parts[1];
            long fileSize = Long.parseLong(parts[2]);

            File received = new File("audios/received_from_" + username + "_" + fileName);
            received.getParentFile().mkdirs();

            try (FileOutputStream fos = new FileOutputStream(received)) {
                byte[] buffer = new byte[4096];
                long totalRead = 0;
                while (totalRead < fileSize) {
                    int toRead = (int) Math.min(buffer.length, fileSize - totalRead);
                    int bytesRead = dataIn.read(buffer, 0, toRead);
                    if (bytesRead == -1) break;
                    fos.write(buffer, 0, bytesRead);
                    totalRead += bytesRead;
                }
            }

            System.out.println("🎵 Audio recibido de " + username + ": " + received.getName());
            historial.registrarMensajeAudio(username, "general", received.getName());

            // Reenviar a todos los demás clientes
            broadcastAudio(received);

        } catch (Exception e) {
            System.err.println("⚠ Error recibiendo audio de " + username + ": " + e.getMessage());
        }
    }

    /**
     * Reenvía un archivo de audio a todos los clientes conectados.
     */
    private void broadcastAudio(File audioFile) {
        synchronized (clients) {
            for (ClientHandler client : clients.values()) {
                if (client == this) continue; // No reenviar al mismo
                try {
                    client.enviarAudio(audioFile);
                } catch (Exception e) {
                    System.err.println("⚠ No se pudo enviar audio a " + client.username + ": " + e.getMessage());
                }
            }
        }
    }

    /**
     * Envía un archivo de audio a este cliente.
     */
    private void enviarAudio(File audioFile) throws IOException {
        if (audioFile == null || !audioFile.exists()) return;
        out.println("AUDIO:" + audioFile.getName() + ":" + audioFile.length());
        out.flush();

        try (FileInputStream fis = new FileInputStream(audioFile)) {
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                dataOut.write(buffer, 0, bytesRead);
            }
            dataOut.flush();
        }
    }

    /**
     * Maneja los comandos de historial: completo o últimos N.
     */
    private void manejarHistorial(String command) {
        try {
            if (command.equals("historial")) {
                out.println(historial.leerHistorialCompleto());
            } else if (command.startsWith("historial:")) {
                String nStr = command.split(":")[1];
                int n = Integer.parseInt(nStr);
                out.println(historial.leerHistorial(n));
            }
            out.println("END_OF_HISTORY");
        } catch (Exception e) {
            out.println("⚠ Error leyendo historial: " + e.getMessage());
            out.println("END_OF_HISTORY");
        }
    }

    /**
     * Maneja el comando "buscar:palabra"
     */
    private void manejarBusqueda(String command) {
        try {
            String term = command.split(":", 2)[1];
            out.println(historial.buscarEnHistorial(term));
            out.println("END_OF_HISTORY");
        } catch (Exception e) {
            out.println("⚠ Error en búsqueda: " + e.getMessage());
            out.println("END_OF_HISTORY");
        }
    }

    /**
     * Envía un mensaje a todos los clientes conectados.
     */
    private void broadcast(String msg) {
        synchronized (clients) {
            for (ClientHandler client : clients.values()) {
                client.sendMessage(msg);
            }
        }
    }

    /**
     * Envía un mensaje a este cliente.
     */
    public void sendMessage(String msg) {
        out.println(msg);
    }

    /**
     * Limpia recursos y elimina al usuario del mapa global.
     */
    private void cleanup() {
        try {
            if (username != null) {
                clients.remove(username);
                System.out.println("🔴 Usuario desconectado: " + username);
                broadcast("📢 " + username + " salió del chat.");
            }
            if (socket != null && !socket.isClosed()) {
                socket.close();
            }
        } catch (IOException e) {
            System.err.println("Error al cerrar conexión de " + username + ": " + e.getMessage());
        }
    }
}
