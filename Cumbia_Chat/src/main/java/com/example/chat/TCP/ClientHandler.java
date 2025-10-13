package com.example.chat.TCP;

import com.example.chat.HistorialManager;

import java.io.*;
import java.net.Socket;
import java.util.Set;
import java.util.concurrent.Semaphore;

/**
 * ClientHandler: maneja un cliente TCP (texto + envío/recepción de archivos de audio).
 * Protocolo asumido:
 * - Mensajes de texto: línea simple enviada con println()
 * - Audio: primero el cliente envia "AUDIO:<filename>:<length>" con println(),
 *          luego escribe exactamente <length> bytes en el stream binario.
 *
 * Para respuestas multilinea (historial), se envía línea por línea terminando con "END_OF_HISTORY".
 */
public class ClientHandler implements Runnable {

    private final Socket clientSocket;
    private BufferedReader in;
    private PrintWriter out;
    private DataInputStream dataIn;
    private DataOutputStream dataOut;

    private final Set<ClientHandler> clients;
    private final Semaphore semaphore;

    public ClientHandler(Socket clientSocket, Set<ClientHandler> clients, Semaphore semaphore) {
        this.clientSocket = clientSocket;
        this.clients = clients;
        this.semaphore = semaphore;
    }

    @Override
    public void run() {
        try {
            in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
            out = new PrintWriter(clientSocket.getOutputStream(), true);
            dataIn = new DataInputStream(clientSocket.getInputStream());
            dataOut = new DataOutputStream(clientSocket.getOutputStream());

            clients.add(this);
            out.println("Conectado al servidor de chat.");

            String message;
            while ((message = in.readLine()) != null) {
                if (message.startsWith("AUDIO:")) {
                    // header = AUDIO:filename:filesize
                    forwardAudioFile(message);
                } else if (message.equalsIgnoreCase("historial")) {
                    sendMultilineResponse(HistorialManager.leerHistorialCompleto());
                } else if (message.startsWith("historial:")) {
                    String[] parts = message.split(":");
                    int lineas = 10;
                    try { lineas = Integer.parseInt(parts[1]); } catch (Exception ignored) {}
                    sendMultilineResponse(HistorialManager.leerHistorial(lineas));
                } else if (message.startsWith("buscar:")) {
                    String termino = message.substring("buscar:".length());
                    sendMultilineResponse(HistorialManager.buscarEnHistorial(termino));
                } else if (message.equalsIgnoreCase("exit")) {
                    break;
                } else {
                    System.out.println("Mensaje recibido: " + message);
                    sendTextToAll(message);
                }
            }
        } catch (Exception e) {
            System.out.println("Cliente desconectado o error: " + e.getMessage());
        } finally {
            cleanup();
        }
    }

    private void sendMultilineResponse(String payload) {
        // Enviar línea por línea y finalizar con END_OF_HISTORY
        try {
            if (payload == null || payload.isEmpty()) {
                out.println("(vacío)");
                out.println("END_OF_HISTORY");
                return;
            }
            BufferedReader br = new BufferedReader(new StringReader(payload));
            String l;
            while ((l = br.readLine()) != null) {
                out.println(l);
            }
            out.println("END_OF_HISTORY");
        } catch (Exception e) {
            out.println("Error preparando historial: " + e.getMessage());
            out.println("END_OF_HISTORY");
        }
    }

    private void forwardAudioFile(String header) throws IOException {
        // header = "AUDIO:filename:filesize"
        String[] parts = header.split(":");
        if (parts.length != 3) return;

        String fileName = parts[1];
        long fileSize = Long.parseLong(parts[2]);

        // Notificar a clientes destino con el encabezado
        for (ClientHandler other : clients) {
            if (other != this) {
                other.out.println(header);
                other.out.flush();
            }
        }

        // Leer los bytes del cliente emisor y reenviarlos inmediatamente a los demas
        byte[] buffer = new byte[4096];
        long totalRead = 0;
        while (totalRead < fileSize) {
            int toRead = (int) Math.min(buffer.length, fileSize - totalRead);
            int bytesRead = dataIn.read(buffer, 0, toRead);
            if (bytesRead == -1) break;

            for (ClientHandler other : clients) {
                if (other != this) {
                    synchronized (other) { // sincronizar acceso al dataOut del otro
                        other.dataOut.write(buffer, 0, bytesRead);
                    }
                }
            }
            totalRead += bytesRead;
        }

        // Ensures flush on receivers
        for (ClientHandler other : clients) {
            if (other != this) {
                try { other.dataOut.flush(); } catch (Exception ignored) {}
            }
        }

        // Registrar en historial (remitente por IP y nombre de archivo)
        String remitente = "Cliente-" + clientSocket.getInetAddress().getHostAddress();
        HistorialManager.registrarAudio(remitente, "Grupo", fileName);
    }

    private void sendTextToAll(String message) {
        try {
            semaphore.acquire();
            for (ClientHandler client : clients) {
                if (client != this) {
                    client.out.println(message);
                }
            }
            String remitente = "Cliente-" + clientSocket.getInetAddress().getHostAddress();
            HistorialManager.registrarMensajeTexto(remitente, "Grupo", message);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            semaphore.release();
        }
    }

    private void cleanup() {
        clients.remove(this);
        try {
            if (clientSocket != null && !clientSocket.isClosed())
                clientSocket.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    // Exponer streams si son necesarios (opcional)
    public DataOutputStream getDataOut() { return dataOut; }
}
