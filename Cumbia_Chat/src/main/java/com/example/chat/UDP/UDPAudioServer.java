package com.example.chat.UDP;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;

public class UDPAudioServer {

    private static final int PORT = 5001;
    private static List<InetAddress> clients = new ArrayList<>();
    private static List<Integer> ports = new ArrayList<>();

    public static void main(String[] args) throws Exception {
        DatagramSocket socket = new DatagramSocket(PORT);
        System.out.println(" Servidor de audio UDP escuchando en puerto " + PORT);

        byte[] buffer = new byte[4096];

        while (true) {
            DatagramPacket packet = new DatagramPacket(buffer, buffer.length);
            socket.receive(packet);

            InetAddress clientAddress = packet.getAddress();
            int clientPort = packet.getPort();

            // Registrar cliente (simplificado)
            if (!clients.contains(clientAddress)) {
                clients.add(clientAddress);
                ports.add(clientPort);
                System.out.println(" Cliente conectado: " + clientAddress + ":" + clientPort);
            }

            // Retransmitir a todos los demás clientes
            for (int i = 0; i < clients.size(); i++) {
                if (clients.get(i).equals(clientAddress) && ports.get(i) == clientPort) {
                    continue; // No enviar de vuelta al emisor
                }
                DatagramPacket out = new DatagramPacket(
                        packet.getData(),
                        packet.getLength(),
                        clients.get(i),
                        ports.get(i)
                );
                socket.send(out);
            }

            System.out.print(".");
        }
    }
}