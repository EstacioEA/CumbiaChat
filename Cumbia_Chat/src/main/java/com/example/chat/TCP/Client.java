package com.example.chat.TCP;

import com.example.chat.audio.AudioPlayer;
import com.example.chat.audio.AudioRecorder;
import com.example.chat.UDP.UDPAudioClient;

import java.io.*;
import java.net.Socket;

/**
 * Cliente TCP interactivo. El servidor maneja prompts y el cliente responde.
 * - Para enviar nota de voz (archivo) en grupo: cliente envía header AUDIO:... e inmediatamente el fichero bytes.
 * - Para llamada: el cliente arranca UDPAudioClient(localPort, serverHost, serverVoicePort) y se une a sala.
 *
 * Usa el prompt del servidor; comandos especiales del cliente:
 *  - /voice-local  -> graba y envía como nota de voz (archivo) al chat actual si el servidor lo solicita
 *  - /start-voice  -> (cliente) request VOICE_REQUEST, then VOICE_JOIN...
 */
public class Client {
    private static final String SERVER = "localhost";
    private static final int PORT = 12345;
    private static final String AUDIO_DIR = "audios";
    private static final String TEMP_FILE = AUDIO_DIR + "/temp_voice.wav";

    public static void main(String[] args) {
        new Client().start();
    }

    public void start() {
        try (Socket socket = new Socket(SERVER, PORT)) {
            System.out.println("Conectado al servidor " + SERVER + ":" + PORT);

            BufferedReader serverIn = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            PrintWriter serverOut = new PrintWriter(socket.getOutputStream(), true);
            DataOutputStream dataOut = new DataOutputStream(socket.getOutputStream());
            BufferedReader stdin = new BufferedReader(new InputStreamReader(System.in));

            // Reader thread: imprime todo lo que llega del servidor
            Thread reader = new Thread(() -> {
                try {
                    String line;
                    while ((line = serverIn.readLine()) != null) {
                        System.out.println(line);
                    }
                } catch (IOException e) {
                    System.out.println("Conexión cerrada por servidor.");
                }
            });
            reader.setDaemon(true);
            reader.start();

            new File(AUDIO_DIR).mkdirs();

            // Main input loop: lo que el usuario escriba se envía al servidor.
            String input;
            while ((input = stdin.readLine()) != null) {
                input = input.trim();
                // Client-side shortcuts:
                if (input.equalsIgnoreCase("/voicefile")) {
                    // Record and then send as TCP audio file using header AUDIO:filename:filesize:ALL:
                    System.out.println("Grabando nota de voz... presiona ENTER para detener.");
                    AudioRecorder rec = new AudioRecorder();
                    rec.startRecording();
                    stdin.readLine(); // wait
                    rec.stopRecording(TEMP_FILE);
                    File f = new File(TEMP_FILE);
                    if (!f.exists()) {
                        System.out.println("No se generó audio.");
                        continue;
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
                    continue;
                }

                // Voice (UDP) flow - client requests server voice port and joins
                if (input.startsWith("/joinvoice ")) {
                    // usage: /joinvoice <groupName> <localUdpPort>
                    String[] p = input.split("\\s+");
                    if (p.length < 3) {
                        System.out.println("Uso: /joinvoice <groupName> <localUdpPort>");
                        continue;
                    }
                    String group = p[1];
                    int localPort = Integer.parseInt(p[2]);

                    // ask server for voice port
                    serverOut.println("VOICE_REQUEST:" + group);
                    serverOut.flush();

                    // read server responses (synchronously here)
                    String resp;
                    while ((resp = serverIn.readLine()) != null) {
                        if (resp.startsWith("VOICE_PORT:")) {
                            int port = Integer.parseInt(resp.split(":")[1]);
                            System.out.println("Sala de voz en puerto " + port + ". Uniéndome y arrancando UDPAudioClient...");
                            // Start UDP client: send to server's UDP room port; also announce local UDP port to server
                            UDPAudioClient udpClient = new UDPAudioClient(localPort, SERVER, port);
                            udpClient.start(); // starts sender+receiver
                            // tell server to register this participant (so server forwards to others)
                            serverOut.println("VOICE_JOIN:" + group + ":" + localPort);
                            serverOut.flush();
                            break;
                        } else if (resp.equals("VOICE_ERR")) {
                            System.out.println("No se pudo crear sala de voz.");
                            break;
                        } else if (resp.equals("NO_VOICE")) {
                            System.out.println("No hay sala de voz para ese grupo.");
                            break;
                        } else {
                            // print other server lines until the VOICE_PORT or NO_VOICE arrives
                            System.out.println(resp);
                        }
                    }
                    continue;
                }

                // default: send line to server
                serverOut.println(input);
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}