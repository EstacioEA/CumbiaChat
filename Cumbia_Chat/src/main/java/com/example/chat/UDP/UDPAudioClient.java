package com.example.chat.UDP;

import java.io.*;
import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;

public class UDPAudioClient {

    private static final String SERVER_IP = "localhost";
    private static final int SERVER_PORT = 5001;

    public static void main(String[] args) {
        try {
            DatagramSocket socket = new DatagramSocket();
            InetAddress serverAddress = InetAddress.getByName(SERVER_IP);

            // Simular envío de un archivo WAV
            File audioFile = new File("audio.wav"); // Debes tener este archivo en la raíz del proyecto
            if (!audioFile.exists()) {
                System.out.println("No se encontró el archivo audio.wav");
                return;
            }

            byte[] buffer = new byte[4096]; // Tamaño del paquete UDP
            FileInputStream fis = new FileInputStream(audioFile);
            int bytesRead;

            System.out.println("Enviando audio por UDP...");

            while ((bytesRead = fis.read(buffer)) != -1) {
                DatagramPacket packet = new DatagramPacket(buffer, bytesRead, serverAddress, SERVER_PORT);
                socket.send(packet);
                System.out.print("."); // Mostrar progreso
            }

            System.out.println("\n Audio enviado!");

            fis.close();
            socket.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}