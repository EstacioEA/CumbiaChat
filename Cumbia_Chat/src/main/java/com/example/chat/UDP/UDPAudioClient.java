package com.example.chat.UDP;

import javax.sound.sampled.*;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;

public class UDPAudioClient {

    private static final String SERVER_IP = "localhost";
    private static final int SERVER_PORT = 5001;
    private static final int BUFFER_SIZE = 4096;

    // Variable para controlar la grabación
    private static volatile boolean isRecording = false;

    public static void main(String[] args) {
        try {
            // Configuración de audio
            AudioFormat format = new AudioFormat(
                    AudioFormat.Encoding.PCM_SIGNED,
                    8000.0F, 16, 1, 2, 8000.0F, false
            );
            DataLine.Info info = new DataLine.Info(TargetDataLine.class, format);
            TargetDataLine microphone = (TargetDataLine) AudioSystem.getLine(info);
            microphone.open(format);
            microphone.start();

            System.out.println(" Grabación de voz iniciada...");
            System.out.println(" Escribe 'stop' y presiona ENTER para detener.\n");

            isRecording = true;

            // Hilo para enviar audio
            Thread audioThread = new Thread(() -> {
                try {
                    DatagramSocket socket = new DatagramSocket();
                    InetAddress serverAddress = InetAddress.getByName(SERVER_IP);
                    byte[] buffer = new byte[BUFFER_SIZE];

                    while (isRecording) {
                        int bytesRead = microphone.read(buffer, 0, buffer.length);
                        if (bytesRead > 0) {
                            DatagramPacket packet = new DatagramPacket(buffer, bytesRead, serverAddress, SERVER_PORT);
                            socket.send(packet);
                        }
                    }

                    socket.close();
                    microphone.close();
                    System.out.println("\n  Grabación detenida. Audio enviado por UDP.");

                } catch (Exception e) {
                    e.printStackTrace();
                }
            });

            audioThread.start();

            // Leer comando del usuario para detener
            BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
            String input;
            while ((input = reader.readLine()) != null) {
                if ("stop".equalsIgnoreCase(input.trim())) {
                    isRecording = false;
                    break;
                }
            }

            // Esperar a que el hilo termine
            audioThread.join();

        } catch (Exception e) {
            System.err.println(" Error al acceder al micrófono:");
            e.printStackTrace();
        }
    }
}