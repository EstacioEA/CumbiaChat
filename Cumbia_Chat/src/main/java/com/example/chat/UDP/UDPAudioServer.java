package com.example.chat.UDP;

import java.io.IOException;
import java.net.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * UDPAudioServer: recibe paquetes UDP de participantes y los reenvía
 * a todos los demás participantes registrados en la sala.
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
            System.out.println("UDPAudioServer: total de participantes = " + participants.size());
        } catch (UnknownHostException e) {
            e.printStackTrace();
        }
    }

    public void removeParticipant(String username) {
        participants.remove(username);
        System.out.println("UDPAudioServer: participante removido " + username);
    }

    private void loop() {
        byte[] buf = new byte[4096];
        DatagramPacket pkt = new DatagramPacket(buf, buf.length);
        System.out.println("UDPAudioServer escuchando en puerto " + port);
        
        long packetsProcessed = 0;
        long packetsForwarded = 0;
        
        while (running) {
            try {
                socket.receive(pkt);
                packetsProcessed++;
                
                if (packetsProcessed % 100 == 0) {
                    System.out.println("UDPAudioServer: paquetes procesados = " + packetsProcessed + ", reenviados = " + packetsForwarded);
                }
                
                if (participants.isEmpty()) {
                    if (packetsProcessed % 500 == 0) {
                        System.out.println("ADVERTENCIA: No hay participantes registrados");
                    }
                    continue;
                }
                
                InetSocketAddress sender = new InetSocketAddress(pkt.getAddress(), pkt.getPort());
                byte[] data = Arrays.copyOf(pkt.getData(), pkt.getLength());
                
                int destCount = 0;
                int skippedCount = 0;
                
                for (Map.Entry<String, InetSocketAddress> e : participants.entrySet()) {
                    String username = e.getKey();
                    InetSocketAddress dest = e.getValue();
                    
                    // Comparar direccion y puerto
                    boolean isSender = dest.getAddress().equals(sender.getAddress()) && 
                                      dest.getPort() == sender.getPort();
                    
                    if (isSender) {
                        skippedCount++;
                        continue;
                    }
                    
                    try {
                        DatagramPacket forward = new DatagramPacket(data, data.length, dest.getAddress(), dest.getPort());
                        socket.send(forward);
                        destCount++;
                        packetsForwarded++;
                    } catch (IOException e2) {
                        System.err.println("Error reenviando a " + username + ": " + e2.getMessage());
                    }
                }
                
                if (packetsProcessed % 500 == 0) {
                    System.out.println("Paquete " + packetsProcessed + ": " + participants.size() + " participantes, " + 
                                     destCount + " destinos, " + skippedCount + " omitidos (sender)");
                }
                
            } catch (SocketException se) {
                if (running) {
                    System.err.println("SocketException: " + se.getMessage());
                }
                break;
            } catch (IOException ioe) {
                System.err.println("IOException: " + ioe.getMessage());
                ioe.printStackTrace();
            }
        }
        
        System.out.println("UDPAudioServer detenido. Total paquetes procesados: " + packetsProcessed + 
                          ", reenviados: " + packetsForwarded);
    }
}