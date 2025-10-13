package com.example.chat.TCP;

import com.example.chat.audio.*;


import java.io.*;
import java.net.Socket;

/**
 * Cliente TCP con soporte para:
 * - Mensajes de texto
 * - Mensajes de voz (envío/recepción de archivos WAV)
 * - Solicitud de historial y búsqueda
 *
 * Comunicación:
 * - Mensajes normales: línea de texto
 * - Audio: header "AUDIO:filename:filesize" seguido de bytes
 */
public class Client {
    private static final String SERVER_IP = "localhost";
    private static final int PORT = 12345;
    private static final String AUDIO_FOLDER = "audios";
    private static final String TEMP_AUDIO_FILE = AUDIO_FOLDER + "/temp_voice.wav";

    private Socket socket;
    private BufferedReader in;
    private PrintWriter out;
    private DataInputStream dataIn;
    private DataOutputStream dataOut;

    public static void main(String[] args) {
        new Client().start();
    }

    public void start() {
        try {
            new File(AUDIO_FOLDER).mkdirs();
            socket = new Socket(SERVER_IP, PORT);
            System.out.println("✅ Conectado al servidor en puerto " + PORT);

            in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            out = new PrintWriter(socket.getOutputStream(), true);
            dataIn = new DataInputStream(socket.getInputStream());
            dataOut = new DataOutputStream(socket.getOutputStream());

            Thread listener = new Thread(this::listenForMessages);
            listener.start();

            BufferedReader userInput = new BufferedReader(new InputStreamReader(System.in));
            while (true) {
                System.out.println("\n==== MENÚ ====");
                System.out.println("1) Enviar mensaje de texto");
                System.out.println("2) Enviar mensaje de voz");
                System.out.println("3) Ver historial completo");
                System.out.println("4) Ver últimos N mensajes");
                System.out.println("5) Buscar en historial");
                System.out.println("6) Salir");
                System.out.print("Elige opción: ");

                String option = userInput.readLine();
                if (option == null) continue;

                switch (option.trim()) {
                    case "1":
                        System.out.print("Escribe tu mensaje: ");
                        String msg = userInput.readLine();
                        if (msg != null && !msg.trim().isEmpty()) {
                            out.println(msg);
                        }
                        break;
                    case "2":
                        sendVoiceMessage(userInput);
                        break;
                    case "3":
                        out.println("historial");
                        leerMultilinea();
                        break;
                    case "4":
                        System.out.print("¿Cuántos mensajes recientes ver? ");
                        String n = userInput.readLine();
                        out.println("historial:" + n);
                        leerMultilinea();
                        break;
                    case "5":
                        System.out.print("Término a buscar: ");
                        String term = userInput.readLine();
                        out.println("buscar:" + term);
                        leerMultilinea();
                        break;
                    case "6":
                        out.println("exit");
                        socket.close();
                        System.out.println("👋 Desconectado del servidor.");
                        return;
                    default:
                        System.out.println("❌ Opción inválida");
                }
            }
        } catch (IOException e) {
            System.err.println("⚠ Error en el cliente: " + e.getMessage());
        }
    }

    /**
     * Envía un mensaje de voz grabando en tiempo real y transmitiendo el archivo.
     */
    private void sendVoiceMessage(BufferedReader userInput) {
        try {
            AudioRecorder recorder = new AudioRecorder();
            System.out.println("🎙️ Grabando... presiona ENTER para detener.");
            recorder.startRecording();

            userInput.readLine(); // esperar ENTER
            recorder.stopRecording(TEMP_AUDIO_FILE);

            File file = new File(TEMP_AUDIO_FILE);
            if (!file.exists()) {
                System.err.println("❌ No se generó el archivo de audio.");
                return;
            }

            long fileSize = file.length();
            out.println("AUDIO:" + file.getName() + ":" + fileSize);
            out.flush();

            try (FileInputStream fis = new FileInputStream(file)) {
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = fis.read(buffer)) != -1) {
                    dataOut.write(buffer, 0, bytesRead);
                }
                dataOut.flush();
            }

            System.out.println("✅ Audio enviado: " + file.getName() + " (" + fileSize + " bytes)");
        } catch (Exception e) {
            System.err.println("⚠ Error al enviar audio: " + e.getMessage());
        }
    }

    /**
     * Lee una respuesta de múltiples líneas del servidor (hasta END_OF_HISTORY)
     */
    private void leerMultilinea() {
        try {
            String line;
            while ((line = in.readLine()) != null) {
                if ("END_OF_HISTORY".equals(line)) break;
                System.out.println(line);
            }
        } catch (IOException e) {
            System.err.println("⚠ Error leyendo historial: " + e.getMessage());
        }
    }

    /**
     * Escucha mensajes y archivos enviados desde el servidor.
     */
    private void listenForMessages() {
        try {
            String line;
            while ((line = in.readLine()) != null) {
                if (line.startsWith("AUDIO:")) {
                    recibirAudio(line);
                } else if (line.equalsIgnoreCase("exit")) {
                    System.out.println("👋 Servidor cerró la conexión.");
                    break;
                } else {
                    System.out.println("💬 " + line);
                }
            }
        } catch (Exception e) {
            System.out.println("🔌 Conexión cerrada.");
        }
    }

    /**
     * Maneja la recepción de un archivo de audio desde el servidor.
     */
    private void recibirAudio(String header) {
        try {
            String[] parts = header.split(":");
            if (parts.length != 3) return;

            String fileName = parts[1];
            long fileSize = Long.parseLong(parts[2]);

            File receivedFile = new File(AUDIO_FOLDER, "received_" + fileName);
            try (FileOutputStream fos = new FileOutputStream(receivedFile)) {
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

            System.out.println("🎧 Audio recibido: " + receivedFile.getAbsolutePath());
            System.out.print("¿Reproducir ahora? (s/n): ");
            String resp = new BufferedReader(new InputStreamReader(System.in)).readLine();
            if ("s".equalsIgnoreCase(resp.trim())) {
                AudioPlayer.playAudio(receivedFile.getAbsolutePath());
            }

        } catch (Exception e) {
            System.err.println("⚠ Error recibiendo audio: " + e.getMessage());
        }
    }
}
