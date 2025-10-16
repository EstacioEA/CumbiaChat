package com.example.chat.TCP;

import com.example.chat.audio.AudioPlayer;
import com.example.chat.audio.AudioRecorder;
import com.example.chat.UDP.UDPAudioClient;

import java.io.*;
import java.net.ServerSocket;
import java.net.Socket;

/**
 * Cliente TCP interactivo. Lee linea por linea del servidor de forma sinconica.
 */
public class Client {
    private static final String SERVER = "localhost";
    private static final int PORT = 12345;
    private static final String AUDIO_DIR = "audios";
    private static final String TEMP_FILE = AUDIO_DIR + "/temp_voice.wav";
    
    private UDPAudioClient currentUdpClient = null;

    public static void main(String[] args) {
        new Client().start();
    }

    public void start() {
        try (Socket socket = new Socket(SERVER, PORT)) {
            System.out.println("Conectado al servidor " + SERVER + ":" + PORT);

            BufferedReader serverIn = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            PrintWriter serverOut = new PrintWriter(socket.getOutputStream(), true);
            DataOutputStream dataOut = new DataOutputStream(socket.getOutputStream());
            DataInputStream dataIn = new DataInputStream(socket.getInputStream());
            BufferedReader stdin = new BufferedReader(new InputStreamReader(System.in));

            new File(AUDIO_DIR).mkdirs();

            String line;
            while ((line = serverIn.readLine()) != null) {
                System.out.print(line);

                if (line.startsWith("AUDIO_FILE:")) {
                    handleReceiveAudio(line, dataIn);
                    continue;
                }

                if (line.startsWith("VOICE_PORT:")) {
                    handleVoiceCallAuto(line, serverOut, stdin);
                    continue;
                }

                if (line.contains("Grabando...")) {
                    handleServerRecording(stdin, serverOut, dataOut);
                    continue;
                }

                if (line.endsWith(": ") || line.endsWith("? ") || line.contains("Elige:")) {
                    String input = stdin.readLine();
                    if (input == null) break;
                    input = input.trim();

                    if (input.equalsIgnoreCase("/voicefile")) {
                        handleVoiceFile(stdin, serverOut, dataOut);
                        continue;
                    }

                    if (input.startsWith("/joinvoice ")) {
                        handleJoinVoice(input, serverIn, serverOut, socket);
                        continue;
                    }

                    serverOut.println(input);
                } else {
                    System.out.println();
                }
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void handleVoiceCallAuto(String header, PrintWriter serverOut, BufferedReader stdin) {
        try {
            String[] parts = header.split(":");
            if (parts.length < 3) {
                System.out.println("Header de voz invalido.");
                return;
            }

            int voicePort = Integer.parseInt(parts[1]);
            String roomName = parts[2];

            System.out.println("\nUniendo a sala de voz...");

            int localUdpPort = findAvailablePort();
            
            currentUdpClient = new UDPAudioClient(localUdpPort, SERVER, voicePort);
            currentUdpClient.start();

            serverOut.println("VOICE_JOIN:" + roomName + ":" + localUdpPort);
            System.out.println("Conectado a llamada. Puerto local: " + localUdpPort);
            System.out.println();
            System.out.println("En llamada de voz");
            System.out.println("1) Colgar");
            System.out.print("Elige: ");
            System.out.flush();
            
            String choice = stdin.readLine();
            if (choice != null && choice.trim().equals("1")) {
                serverOut.println("VOICE_HANGUP:" + roomName);
                if (currentUdpClient != null) {
                    currentUdpClient.stop();
                    currentUdpClient = null;
                }
                System.out.println("Llamada finalizada.");
            }

        } catch (Exception e) {
            System.out.println("Error uniendo a llamada de voz: " + e.getMessage());
        }
    }

    private int findAvailablePort() {
        try (ServerSocket socket = new ServerSocket(0)) {
            return socket.getLocalPort();
        } catch (IOException e) {
            return 5000;
        }
    }

    private void handleReceiveAudio(String header, DataInputStream dataIn) throws IOException {
        try {
            String[] parts = header.split(":");
            if (parts.length < 3) {
                System.out.println("Header de audio invalido.");
                return;
            }

            String filename = parts[1];
            long filesize = Long.parseLong(parts[2]);

            File receivedFile = new File(AUDIO_DIR + "/received_" + filename);
            receivedFile.getParentFile().mkdirs();

            try (FileOutputStream fos = new FileOutputStream(receivedFile)) {
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

            System.out.println();
            AudioPlayer.playAudio(receivedFile.getAbsolutePath());

        } catch (Exception e) {
            System.out.println("Error recibiendo audio: " + e.getMessage());
        }
    }

    private void handleServerRecording(BufferedReader stdin, PrintWriter serverOut, DataOutputStream dataOut) throws IOException {
        System.out.println("\n1) Parar grabacion y enviar");
        
        AudioRecorder rec = new AudioRecorder();
        rec.startRecording();
        
        stdin.readLine();
        rec.stopRecording(TEMP_FILE);
        
        File f = new File(TEMP_FILE);
        if (!f.exists()) {
            System.out.println("No se genero audio.");
            return;
        }
        
        long size = f.length();
        String header = "AUDIO:temp_voice.wav:" + size;
        serverOut.println(header);
        serverOut.flush();
        
        try (FileInputStream fis = new FileInputStream(f)) {
            byte[] buf = new byte[4096];
            int r;
            while ((r = fis.read(buf)) != -1) dataOut.write(buf, 0, r);
            dataOut.flush();
        }
        System.out.println("Audio enviado");
    }

    private void handleVoiceFile(BufferedReader stdin, PrintWriter serverOut, DataOutputStream dataOut) throws IOException {
        System.out.println("Grabando nota de voz... presiona ENTER para detener.");
        AudioRecorder rec = new AudioRecorder();
        rec.startRecording();
        stdin.readLine();
        rec.stopRecording(TEMP_FILE);

        File f = new File(TEMP_FILE);
        if (!f.exists()) {
            System.out.println("No se genero audio.");
            return;
        }

        long size = f.length();
        String header = "AUDIO:" + f.getName() + ":" + size + ":ALL:";
        serverOut.println(header);
        serverOut.flush();

        try (FileInputStream fis = new FileInputStream(f)) {
            byte[] buf = new byte[4096];
            int r;
            while ((r = fis.read(buf)) != -1) dataOut.write(buf, 0, r);
            dataOut.flush();
        }
        System.out.println("Nota de voz enviada: " + f.getName());
    }

    private void handleJoinVoice(String input, BufferedReader serverIn, PrintWriter serverOut, Socket socket) throws IOException {
        String[] p = input.split("\\s+");
        if (p.length < 3) {
            System.out.println("Uso: /joinvoice <groupName> <localUdpPort>");
            return;
        }
        String group = p[1];
        int localPort = Integer.parseInt(p[2]);

        serverOut.println("VOICE_REQUEST:" + group);
        serverOut.flush();

        String resp;
        while ((resp = serverIn.readLine()) != null) {
            System.out.println(resp);
            if (resp.startsWith("VOICE_PORT:")) {
                int port = Integer.parseInt(resp.split(":")[1]);
                System.out.println("Sala de voz en puerto " + port + ". Uniendome y arrancando UDPAudioClient...");

                UDPAudioClient udpClient = new UDPAudioClient(localPort, SERVER, port);
                udpClient.start();

                serverOut.println("VOICE_JOIN:" + group + ":" + localPort);
                serverOut.flush();
                break;
            } else if (resp.equals("VOICE_ERR")) {
                System.out.println("No se pudo crear sala de voz.");
                break;
            } else if (resp.equals("NO_VOICE")) {
                System.out.println("No hay sala de voz para ese grupo.");
                break;
            }
        }
    }
}