package com.example.chat.UDP;

import javax.sound.sampled.*;
import java.net.DatagramPacket;
import java.net.DatagramSocket;

public class UDPAudioServer {

    private static final int PORT = 5001;

    public static void main(String[] args) {
        try {
            // Configuración de audio (debe coincidir con el cliente)
            AudioFormat format = new AudioFormat(
                    AudioFormat.Encoding.PCM_SIGNED,
                    8000.0F, 16, 1, 2, 8000.0F, false
            );

            DataLine.Info info = new DataLine.Info(SourceDataLine.class, format);
            SourceDataLine speaker = (SourceDataLine) AudioSystem.getLine(info);
            speaker.open(format);
            speaker.start();

            System.out.println(" Servidor de audio UDP escuchando en puerto " + PORT);
            System.out.println(" Reproduciendo audio en tiempo real...");

            DatagramSocket socket = new DatagramSocket(PORT);
            byte[] buffer = new byte[4096];

            while (true) {
                DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
                socket.receive(packet);

                // Enviar los datos directamente al altavoz
                speaker.write(packet.getData(), 0, packet.getLength());
            }

        } catch (Exception e) {
            System.err.println("Error en el servidor de audio:");
            e.printStackTrace();
        }
    }
}