package com.example.chat.UDP;

import java.io.IOException;
import java.net.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * UDPAudioServer: recibe paquetes UDP de participantes y los reenvía
 * a todos los demás participantes registrados en la sala.
 *
 * Uso:
 *   UDPAudioServer server = new UDPAudioServer(); server.start();
 *   server.addParticipant(username, addressString, udpPort);
 *   server.shutdown();
 */
public class UDPAudioServer {
    private DatagramSocket socket;
    private final int port;
    private final Thread runner;
    // username -> (address, port)
    private final Map<String, InetSocketAddress> participants = new ConcurrentHashMap<>();
    private volatile boolean running = true;

    public UDPAudioServer() throws SocketException {
        // bind to ephemeral port:
        this.socket = new DatagramSocket(0);
        this.port = socket.getLocalPort();
        this.runner = new Thread(this::loop);
    }

    public int getPort() { return port; }

    public void start() {
        runner.setDaemon(true);
        runner.start();
    }

    public void shutdown() {
        running = false;
        if (socket != null && !socket.isClosed()) socket.close();
    }

    public void addParticipant(String username, String addr, int udpPort) {
        try {
            InetAddress inet = InetAddress.getByName(addr);
            participants.put(username, new InetSocketAddress(inet, udpPort));
            System.out.println("UDPAudioServer: participante agregado " + username + " @ " + addr + ":" + udpPort);
        } catch (UnknownHostException e) {
            e.printStackTrace();
        }
    }

    public void removeParticipant(String username) { participants.remove(username); }

    private void loop() {
        byte[] buf = new byte[4096];
        DatagramPacket pkt = new DatagramPacket(buf, buf.length);
        System.out.println("UDPAudioServer escuchando en puerto " + port);
        while (running) {
            try {
                socket.receive(pkt);
                // forward packet to all participants except sender
                InetSocketAddress sender = new InetSocketAddress(pkt.getAddress(), pkt.getPort());
                byte[] data = Arrays.copyOf(pkt.getData(), pkt.getLength());
                for (Map.Entry<String, InetSocketAddress> e : participants.entrySet()) {
                    InetSocketAddress dest = e.getValue();
                    // don't send back to sender (best-effort compare)
                    if (dest.getAddress().equals(sender.getAddress()) && dest.getPort() == sender.getPort()) continue;
                    DatagramPacket forward = new DatagramPacket(data, data.length, dest.getAddress(), dest.getPort());
                    socket.send(forward);
                }
            } catch (SocketException se) {
                // socket closed -> exit
                break;
            } catch (IOException ioe) {
                ioe.printStackTrace();
            }
        }
        System.out.println("UDPAudioServer detenido en puerto " + port);
    }
}
