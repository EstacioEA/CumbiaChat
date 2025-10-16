package com.example.chat.TCP;

import com.example.chat.data.Group;
import com.example.chat.data.HistorialManager;
import com.example.chat.data.User;

import java.io.*;
import java.net.Socket;
import java.util.Map;

/**
 * ClientHandler: maneja comandos TCP y coordina audio/llamadas via Server (UDP).
 */
public class ClientHandler implements Runnable {

    private final Socket clientSocket;
    private BufferedReader in;
    private PrintWriter out;
    private DataInputStream dataIn;

    private final Map<String, ClientHandler> connectedUsers;
    private final Map<String, Group> groups;
    private final HistorialManager historial;

    private String username;
    private User user;

    public ClientHandler(Socket socket,
                         Map<String, ClientHandler> connectedUsers,
                         Map<String, Group> groups,
                         HistorialManager historial) {
        this.clientSocket = socket;
        this.connectedUsers = connectedUsers;
        this.groups = groups;
        this.historial = historial;
    }

    @Override
    public void run() {
        try {
            in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
            out = new PrintWriter(clientSocket.getOutputStream(), true);
            dataIn = new DataInputStream(clientSocket.getInputStream());

            // Login
            out.println("=== Bienvenido a CumbiaChat ===");
            out.println("Ingresa tu nombre de usuario: ");
            out.flush();
            username = in.readLine();
            if (username == null || username.trim().isEmpty()) { closeSilently(); return; }
            username = username.trim();

            synchronized (connectedUsers) {
                if (connectedUsers.containsKey(username)) {
                    out.println("Usuario ya conectado. Conexion cerrada.");
                    closeSilently();
                    return;
                }
                user = new User(username, clientSocket);
                connectedUsers.put(username, this);
            }

            out.println("Conectado como " + username);
            broadcastSystem(username + " se ha unido.");

            // Main menu driven by server prompts
            while (true) {
                showMainMenu();
                String cmd = in.readLine();
                if (cmd == null) break;
                cmd = cmd.trim();

                switch (cmd) {
                    case "1" -> groupFlow();
                    case "2" -> privateFlow();
                    case "3" -> showChats();
                    case "4" -> { out.println("exit"); closeSilently(); return; }
                    default -> out.println("Opcion invalida.");
                }
            }

        } catch (IOException ex) {
            // client disconnected or error
        } finally {
            cleanup();
        }
    }

    private void showMainMenu() {
        out.println();
        out.println("=== MENU PRINCIPAL ===");
        out.println("1) Entrar a chat grupal");
        out.println("2) Conectarme con un usuario especifico");
        out.println("3) Ver chats disponibles");
        out.println("4) Salir");
        out.println("Elige: ");
        out.flush();
    }

    // ---------- group flow ----------
    private void groupFlow() throws IOException {
        out.println();
        out.println("=== CHAT GRUPAL ===");
        if (groups.isEmpty()) out.println("(No hay grupos creados aun)");
        else out.println("Grupos existentes: " + groups.keySet());

        out.println("Deseas (1) Crear grupo o (2) Unirte a uno existente?");
        out.println("Elige: ");
        out.flush();
        String choice = in.readLine();
        if (choice == null) return;

        String groupName;
        if ("1".equals(choice)) {
            out.println("Nombre del nuevo grupo: ");
            out.flush();
            groupName = in.readLine();
            if (groupName == null || groupName.trim().isEmpty()) { out.println("Nombre invalido."); return; }
            if (Server.createGroup(groupName, new User(username))) out.println("Grupo creado: " + groupName);
            else { out.println("Ya existe un grupo con ese nombre."); return; }
        } else if ("2".equals(choice)) {
            out.println("Nombre del grupo a unirte: ");
            out.flush();
            groupName = in.readLine();
            if (!Server.joinGroup(groupName, new User(username))) { out.println("Grupo no existe."); return; }
            out.println("Te uniste al grupo: " + groupName);
        } else { out.println("Opcion invalida."); return; }

        // Now inside group context: show group menu
        groupMenu(groupName);
    }

    private void groupMenu(String groupName) throws IOException {
        while (true) {
            out.println();
            out.println("=== Grupo: " + groupName + " ===");
            out.println("1) Enviar mensaje de texto");
            out.println("2) Enviar nota de voz (archivo)");
            out.println("3) Escuchar ultimo audio del grupo (si hay)");
            out.println("4) Realizar/Unirse a llamada (voz en tiempo real)");
            out.println("5) Salir al menu principal");
            out.println("Elige: ");
            out.flush();

            String opt = in.readLine();
            if (opt == null) return;

            switch (opt) {
                case "1" -> {
                    out.println("Escribe mensaje: ");
                    out.flush();
                    String msg = in.readLine();
                    if (msg != null) {
                        Server.broadcastToGroup(groupName, msg, username);
                        HistorialManager.registrarMensajeTexto(username, groupName, msg);
                    }
                }
                case "2" -> {
                    sendAudioToGroup(groupName);
                }
                case "3" -> {
                    String hist = HistorialManager.leerHistorialCompleto(groupName);
                    out.println(hist);
                    out.println("END_OF_HISTORY");
                }
                case "4" -> {
                    int port = Server.getVoiceRoomPort(groupName);
                    if (port == -1) {
                        int p = Server.startVoiceRoom(groupName);
                        if (p > 0) out.println("VOICE_PORT:" + p);
                        else out.println("VOICE_ERR");
                    } else {
                        out.println("VOICE_PORT:" + port);
                    }
                    out.println("Si deseas unirte a la sala, envia VOICE_JOIN:<groupName>:<tuUdpPort> ahora: ");
                    out.flush();
                    String line = in.readLine();
                    if (line != null && line.startsWith("VOICE_JOIN:")) {
                        String[] parts = line.split(":");
                        if (parts.length >= 3) {
                            int clientUdpPort = Integer.parseInt(parts[2]);
                            Server.registerVoiceParticipant(groupName, username, clientSocket.getInetAddress().getHostAddress(), clientUdpPort);
                            out.println("Registrado en sala de voz. Esperando audio UDP...");
                        } else out.println("Formato VOICE_JOIN invalido.");
                    }
                }
                case "5" -> { return; }
                default -> out.println("Opcion invalida.");
            }
        }
    }

    private void sendAudioToGroup(String groupName) {
        try {
            File audioDir = new File("audios");
            audioDir.mkdirs();

            out.println("Grabando... presiona ENTER en el cliente para parar");
            out.flush();

            String header = in.readLine();
            if (header == null || !header.startsWith("AUDIO:")) {
                out.println("Error: no se recibio header de audio valido");
                return;
            }

            String[] parts = header.split(":");
            if (parts.length < 3) {
                out.println("Header invalido");
                return;
            }

            String filename = parts[1];
            long filesize = Long.parseLong(parts[2]);

            File outFile = new File("audios/" + username + "_" + filename);
            outFile.getParentFile().mkdirs();

            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                byte[] buffer = new byte[4096];
                long total = 0;
                while (total < filesize) {
                    int toRead = (int) Math.min(buffer.length, filesize - total);
                    int read = dataIn.read(buffer, 0, toRead);
                    if (read == -1) break;
                    fos.write(buffer, 0, read);
                    total += read;
                }
            }

            HistorialManager.registrarAudio(username, groupName, outFile.getName());
            Server.broadcastToGroup(groupName, "[AUDIO] " + outFile.getName(), username);
            out.println("Audio recibido y registrado: " + outFile.getName());

        } catch (Exception e) {
            out.println("Error procesando audio: " + e.getMessage());
        }
    }

    // ---------- private chat ----------
    private void privateFlow() throws IOException {
        out.println();
        out.println("=== CHAT PRIVADO ===");
        out.println("Usuarios conectados: " + Server.getActiveUsers());
        out.println("Usuario destino: ");
        out.flush();
        String target = in.readLine();
        if (target == null || target.trim().isEmpty()) { out.println("Nombre invalido."); return; }
        if (!Server.getActiveUsers().contains(target)) { out.println("Usuario no conectado."); return; }

        out.println("Opciones:");
        out.println("1) Enviar mensaje de texto");
        out.println("2) Enviar nota de voz (archivo)");
        out.println("3) Escuchar ultimo audio privado");
        out.println("4) Iniciar llamada privada (voz)");
        out.println("5) Volver");
        out.println("Elige: ");
        out.flush();

        String opt = in.readLine();
        if (opt == null) return;
        switch (opt) {
            case "1" -> {
                out.println("Mensaje: ");
                out.flush();
                String msg = in.readLine();
                if (msg != null) {
                    Server.sendPrivateMessage(username, target, msg);
                    HistorialManager.registrarMensajeTexto(username, "Privado_" + username + "_" + target, msg);
                }
            }
            case "2" -> {
                sendAudioPrivate(target);
            }
            case "3" -> {
                String chatName = "Privado_" + target + "_" + username;
                out.println(HistorialManager.leerHistorialCompleto(chatName));
                out.println("END_OF_HISTORY");
            }
            case "4" -> {
                String room = "PRIV_" + username + "_" + target;
                int port = Server.getVoiceRoomPort(room);
                if (port == -1) {
                    int p = Server.startVoiceRoom(room);
                    if (p > 0) out.println("VOICE_PORT:" + p);
                    else out.println("VOICE_ERR");
                } else out.println("VOICE_PORT:" + port);

                out.println("Si deseas unirte a la sala, envia VOICE_JOIN:" + room + ":<tuUdpPort> ahora: ");
                out.flush();
                String line = in.readLine();
                if (line != null && line.startsWith("VOICE_JOIN:")) {
                    String[] parts = line.split(":");
                    if (parts.length >= 3) {
                        int clientUdpPort = Integer.parseInt(parts[2]);
                        Server.registerVoiceParticipant(room, username, clientSocket.getInetAddress().getHostAddress(), clientUdpPort);
                        out.println("Registrado en sala de voz privada.");
                    } else out.println("Formato VOICE_JOIN invalido.");
                }
            }
            default -> out.println("Opcion invalida.");
        }
    }

    private void sendAudioPrivate(String target) {
        try {
            File audioDir = new File("audios");
            audioDir.mkdirs();

            out.println("Grabando... presiona ENTER en el cliente para parar");
            out.flush();

            String header = in.readLine();
            if (header == null || !header.startsWith("AUDIO:")) {
                out.println("Error: no se recibio header de audio valido");
                return;
            }

            String[] parts = header.split(":");
            if (parts.length < 3) {
                out.println("Header invalido");
                return;
            }

            String filename = parts[1];
            long filesize = Long.parseLong(parts[2]);

            File outFile = new File("audios/" + username + "_" + filename);
            outFile.getParentFile().mkdirs();

            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                byte[] buffer = new byte[4096];
                long total = 0;
                while (total < filesize) {
                    int toRead = (int) Math.min(buffer.length, filesize - total);
                    int read = dataIn.read(buffer, 0, toRead);
                    if (read == -1) break;
                    fos.write(buffer, 0, read);
                    total += read;
                }
            }

            String chatName = "Privado_" + username + "_" + target;
            HistorialManager.registrarAudio(username, chatName, outFile.getName());
            Server.sendPrivateMessage(username, target, "[AUDIO] " + outFile.getName());
            out.println("Audio enviado a " + target + ": " + outFile.getName());

        } catch (Exception e) {
            out.println("Error procesando audio: " + e.getMessage());
        }
    }

    private void showChats() {
        out.println("Grupos: " + Server.getAvailableGroups());
        out.println("Usuarios: " + Server.getActiveUsers());
    }

    private void broadcastSystem(String msg) {
        synchronized (connectedUsers) {
            for (ClientHandler ch : connectedUsers.values()) ch.sendMessage("[SYSTEM] " + msg);
        }
    }

    public void sendMessage(String msg) {
        out.println(msg);
    }

    private void cleanup() {
        try {
            if (username != null) {
                connectedUsers.remove(username);
                broadcastSystem(username + " se ha desconectado.");
            }
            if (clientSocket != null && !clientSocket.isClosed()) clientSocket.close();
        } catch (IOException ignored) {}
    }

    private void closeSilently() {
        try { clientSocket.close(); } catch (IOException ignored) {}
    }
}