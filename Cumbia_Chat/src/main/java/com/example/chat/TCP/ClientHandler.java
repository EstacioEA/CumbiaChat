package com.example.chat.TCP;

import java.io.*;
import java.net.Socket;
import java.util.Set;
import java.util.concurrent.Semaphore;

public class ClientHandler implements Runnable {

    private Socket clientSocket;
    private BufferedReader in;
    private PrintWriter out;
    private DataInputStream dataIn;
    private DataOutputStream dataOut;

    private Set<ClientHandler> clients; // Cambiamos a ClientHandler para acceder a sus streams
    private Semaphore semaphore;

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
                    forwardAudioFile(message);
                } else if (message.equalsIgnoreCase("exit")) {
                    break;
                } else {
                    System.out.println("Mensaje recibido: " + message);
                    sendTextToAll(message);
                }
            }
        } catch (Exception e) {
            System.out.println("Cliente desconectado.");
        } finally {
            cleanup();
        }
    }

    private void forwardAudioFile(String header) throws IOException {
        String[] parts = header.split(":");
        if (parts.length != 3) return;

        long fileSize = Long.parseLong(parts[2]);

        // Reenviar el encabezado a todos los demás clientes
        for (ClientHandler other : clients) {
            if (other != this) {
                other.out.println(header);
                other.out.flush();
            }
        }

        // Leer el archivo del cliente emisor y reenviarlo
        byte[] buffer = new byte[4096];
        long totalRead = 0;
        while (totalRead < fileSize) {
            int toRead = (int) Math.min(buffer.length, fileSize - totalRead);
            int bytesRead = dataIn.read(buffer, 0, toRead);
            if (bytesRead == -1) break;

            // Enviar a todos los demás
            for (ClientHandler other : clients) {
                if (other != this) {
                    other.dataOut.write(buffer, 0, bytesRead);
                }
            }
            totalRead += bytesRead;
        }

        // Asegurar que se envíe todo
        for (ClientHandler other : clients) {
            if (other != this) {
                other.dataOut.flush();
            }
        }
    }

    private void sendTextToAll(String message) {
        try {
            semaphore.acquire();
            for (ClientHandler client : clients) {
                if (client != this) {
                    client.out.println(message);
                }
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            semaphore.release();
        }
    }

    private void cleanup() {
        clients.remove(this);
        try {
            if (clientSocket != null && !clientSocket.isClosed()) {
                clientSocket.close();
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    // Getters para streams (solo si necesitas acceso externo, opcional)
    public DataOutputStream getDataOut() { return dataOut; }
}
