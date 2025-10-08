package com.example.chat.TCP;

import com.example.chat.audio.AudioPlayer;
import com.example.chat.audio.AudioRecorder;

import java.io.*;
import java.net.Socket;
import java.util.Scanner;

public class Client {
    private static final String SERVER_IP = "localhost";
    private static final int PORT = 12345;
    private static final String AUDIO_FOLDER = "audios";
    private static final String AUDIO_FILE = AUDIO_FOLDER + "/temp_voice.wav";

    private static Socket socket;
    private static BufferedReader userInput;
    private static BufferedReader in;
    private static PrintWriter out;
    private static DataInputStream dataIn;
    private static DataOutputStream dataOut;

    public static void main(String[] args) {
        try {
            System.out.println("Archivos se guardarán en: " + new File("").getAbsolutePath());
            socket = new Socket(SERVER_IP, PORT);
            System.out.println("Connected to server on port: " + PORT);

            in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            out = new PrintWriter(socket.getOutputStream(), true);
            dataIn = new DataInputStream(socket.getInputStream());
            dataOut = new DataOutputStream(socket.getOutputStream());

            userInput = new BufferedReader(new InputStreamReader(System.in));

            // Hilo para escuchar mensajes (texto o comandos de audio)
            new Thread(Client::listenForMessages).start();

            // Menú principal
            while (true) {
                System.out.println("\nOpciones:");
                System.out.println("1. Enviar mensaje de texto");
                System.out.println("2. Enviar mensaje de voz");
                System.out.println("3. Salir");
                System.out.print("Elige una opción: ");

                String option = userInput.readLine();
                switch (option.trim()) {
                    case "1":
                        System.out.print("Escribe tu mensaje: ");
                        String msg = userInput.readLine();
                        if (msg != null && !msg.equalsIgnoreCase("exit")) {
                            out.println(msg);
                        }
                        break;
                    case "2":
                        sendVoiceMessage();
                        break;
                    case "3":
                        out.println("exit");
                        socket.close();
                        return;
                    default:
                        System.out.println("Opción inválida.");
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            System.out.println("Client terminated");
        }
    }

    private static void sendVoiceMessage() {
        try {
            // Crear carpeta si no existe
            new File(AUDIO_FOLDER).mkdirs();

            System.out.println("Grabando... Presiona ENTER para detener.");
            AudioRecorder recorder = new AudioRecorder();
            recorder.startRecording();

            new BufferedReader(new InputStreamReader(System.in)).readLine(); // Esperar ENTER

            recorder.stopRecording(AUDIO_FILE);

            File file = new File(AUDIO_FILE);
            out.println("AUDIO:" + file.getName() + ":" + file.length());

            try (FileInputStream fis = new FileInputStream(file)) {
                byte[] buffer = new byte[4096];
                int bytesRead;
                while ((bytesRead = fis.read(buffer)) != -1) {
                    dataOut.write(buffer, 0, bytesRead);
                }
                dataOut.flush();
            }

            System.out.println("Mensaje de voz enviado. Archivo: " + AUDIO_FILE);

        } catch (Exception e) {
            System.err.println("Error al enviar el audio: " + e.getMessage());
        }
    }

    private static void listenForMessages() {
        try {
            String line;
            while ((line = in.readLine()) != null) {
                if (line.startsWith("AUDIO:")) {
                    handleIncomingAudio(line);
                } else if (line.equalsIgnoreCase("exit")) {
                    break;
                } else {
                    System.out.println(">> " + line);
                }
            }
        } catch (Exception e) {
            System.out.println("Disconnected from server.");
        }
    }

    private static void handleIncomingAudio(String header) {
        try {
            String[] parts = header.split(":");
            if (parts.length != 3) return;

            String fileName = parts[1];
            long fileSize = Long.parseLong(parts[2]);

            new File(AUDIO_FOLDER).mkdirs();
            String outputPath = AUDIO_FOLDER + "/received_" + fileName;
            try (FileOutputStream fos = new FileOutputStream(outputPath)) {
                byte[] buffer = new byte[4096];
                long totalRead = 0;
                int bytesRead;
                while (totalRead < fileSize && (bytesRead = dataIn.read(buffer)) != -1) {
                    fos.write(buffer, 0, bytesRead);
                    totalRead += bytesRead;
                }
            }

            System.out.println(" Audio recibido: " + outputPath);
            System.out.print("¿Reproducir ahora? (s/n): ");
            String resp = new BufferedReader(new InputStreamReader(System.in)).readLine();
            if ("s".equalsIgnoreCase(resp.trim())) {
                AudioPlayer.playAudio(outputPath);
            }

        } catch (Exception e) {
            System.err.println("Error al recibir audio: " + e.getMessage());
        }
    }
}