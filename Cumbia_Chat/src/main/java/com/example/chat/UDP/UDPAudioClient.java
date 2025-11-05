package com.example.chat.UDP;

import javax.sound.sampled.*;
import java.io.*;
import java.net.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * UDPAudioClient: envía audio del micrófono por UDP al serverVoiceHost:serverVoicePort
 * y al mismo tiempo escucha en localPort los paquetes UDP entrantes y los reproduce.
 */
public class UDPAudioClient {
    private final int localPort;
    private final String serverHost;
    private final int serverPort;
    private DatagramSocket socket;
    private final AtomicBoolean running = new AtomicBoolean(false);

    private Thread senderThread;
    private Thread receiverThread;

    private final AudioFormat format = new AudioFormat(16000f, 16, 1, true, false);

    public UDPAudioClient(int localPort, String serverHost, int serverPort) {
        this.localPort = localPort;
        this.serverHost = serverHost;
        this.serverPort = serverPort;
    }

    public void start() {
        try {
            socket = new DatagramSocket(localPort);
            running.set(true);
            startReceiver();
            startSender();
            System.out.println("UDPAudioClient iniciado en puerto local " + localPort + " -> enviar a " + serverHost + ":" + serverPort);
        } catch (SocketException e) {
            e.printStackTrace();
        }
    }

    public void stop() {
        running.set(false);
        try {
            Thread.sleep(500);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        if (socket != null && !socket.isClosed()) socket.close();
    }

    private void startReceiver() {
        receiverThread = new Thread(() -> {
            SourceDataLine speakers = null;
            try {
                byte[] buf = new byte[4096];
                DatagramPacket pkt = new DatagramPacket(buf, buf.length);
                
                DataLine.Info infoOut = new DataLine.Info(SourceDataLine.class, format);
                if (!AudioSystem.isLineSupported(infoOut)) {
                    System.err.println("SourceDataLine no soportado para el formato");
                    return;
                }
                
                speakers = (SourceDataLine) AudioSystem.getLine(infoOut);
                speakers.open(format);
                speakers.start();
                System.out.println("SourceDataLine abierto y iniciado para reproduccion");

                long packetsReceived = 0;
                while (running.get()) {
                    try {
                        socket.receive(pkt);
                        packetsReceived++;
                        if (packetsReceived % 100 == 0) {
                            System.out.println("Paquetes recibidos: " + packetsReceived);
                        }
                        speakers.write(pkt.getData(), 0, pkt.getLength());
                    } catch (SocketException se) {
                        if (running.get()) {
                            System.err.println("SocketException en receiver: " + se.getMessage());
                        }
                        break;
                    }
                }
                
                System.out.println("Receiver thread terminando. Paquetes recibidos totales: " + packetsReceived);
                if (speakers != null) {
                    speakers.drain();
                    speakers.stop();
                    speakers.close();
                }
            } catch (LineUnavailableException e) {
                System.err.println("LineUnavailableException: " + e.getMessage());
                e.printStackTrace();
            } catch (IOException e) {
                System.err.println("IOException en receiver: " + e.getMessage());
                e.printStackTrace();
            } finally {
                if (speakers != null) {
                    try {
                        speakers.close();
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        }, "udp-audio-receiver");
        receiverThread.setDaemon(true);
        receiverThread.start();
    }

    private void startSender() {
        senderThread = new Thread(() -> {
            TargetDataLine mic = null;
            try {
                DataLine.Info info = new DataLine.Info(TargetDataLine.class, format);
                mic = (TargetDataLine) AudioSystem.getLine(info);
                mic.open(format);
                mic.start();
                System.out.println("Microfono abierto y activo");

                byte[] buffer = new byte[2048];
                InetAddress serverAddr = InetAddress.getByName(serverHost);
                long packetsSent = 0;
                
                while (running.get()) {
                    int read = mic.read(buffer, 0, buffer.length);
                    if (read > 0) {
                        DatagramPacket pkt = new DatagramPacket(buffer, read, serverAddr, serverPort);
                        socket.send(pkt);
                        packetsSent++;
                        if (packetsSent % 100 == 0) {
                            System.out.println("Paquetes enviados: " + packetsSent);
                        }
                    }
                }
                System.out.println("Sender thread terminando. Paquetes enviados totales: " + packetsSent);
            } catch (LineUnavailableException e) {
                System.err.println("LineUnavailableException (mic): " + e.getMessage());
                e.printStackTrace();
            } catch (IOException e) {
                System.err.println("IOException en sender: " + e.getMessage());
                e.printStackTrace();
            } finally {
                if (mic != null) {
                    mic.stop();
                    mic.close();
                }
            }
        }, "udp-audio-sender");
        senderThread.setDaemon(true);
        senderThread.start();
    }
}