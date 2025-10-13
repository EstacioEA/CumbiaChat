package com.example.chat.UDP;

import com.example.chat.audio.AudioPlayer;

import javax.sound.sampled.*;
import java.io.*;
import java.net.*;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * UDPAudioClient: envía audio del micrófono por UDP al serverVoiceHost:serverVoicePort
 * y al mismo tiempo escucha en localPort los paquetes UDP entrantes y los reproduce.
 *
 * NOTA: si tu entorno no permite acceso al micrófono o las dependencias de audio,
 * puede no funcionar en algunos entornos remotos. En Windows con JDK correcto funciona.
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
        if (socket != null && !socket.isClosed()) socket.close();
    }

    private void startReceiver() {
        receiverThread = new Thread(() -> {
            try {
                byte[] buf = new byte[4096];
                DatagramPacket pkt = new DatagramPacket(buf, buf.length);
                // prepare audio playback line
                DataLine.Info infoOut = new DataLine.Info(SourceDataLine.class, format);
                SourceDataLine speakers = (SourceDataLine) AudioSystem.getLine(infoOut);
                speakers.open(format);
                speakers.start();

                while (running.get()) {
                    try {
                        socket.receive(pkt);
                        speakers.write(pkt.getData(), 0, pkt.getLength());
                    } catch (SocketException se) {
                        break;
                    }
                }
                speakers.drain();
                speakers.close();
            } catch (LineUnavailableException | IOException e) {
                e.printStackTrace();
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

                byte[] buffer = new byte[2048];
                InetAddress serverAddr = InetAddress.getByName(serverHost);
                while (running.get()) {
                    int read = mic.read(buffer, 0, buffer.length);
                    if (read > 0) {
                        DatagramPacket pkt = new DatagramPacket(buffer, read, serverAddr, serverPort);
                        socket.send(pkt);
                    }
                }
            } catch (LineUnavailableException | IOException e) {
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
