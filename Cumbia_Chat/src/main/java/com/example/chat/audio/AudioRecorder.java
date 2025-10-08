package com.example.chat.audio;

import javax.sound.sampled.*;
import java.io.*;

public class AudioRecorder {

    private static final AudioFormat FORMAT = new AudioFormat(
            AudioFormat.Encoding.PCM_SIGNED,
            8000.0F, 16, 1, 2, 8000.0F, false
    );

    private TargetDataLine microphone;
    private ByteArrayOutputStream audioBuffer;
    private Thread recordingThread;
    private volatile boolean isRecording = false;

    public void startRecording() {
        if (isRecording) return;

        try {
            DataLine.Info info = new DataLine.Info(TargetDataLine.class, FORMAT);
            microphone = (TargetDataLine) AudioSystem.getLine(info);
            microphone.open(FORMAT);
            microphone.start();

            audioBuffer = new ByteArrayOutputStream();
            isRecording = true;

            recordingThread = new Thread(() -> {
                byte[] buffer = new byte[4096];
                while (isRecording) {
                    int bytesRead = microphone.read(buffer, 0, buffer.length);
                    if (bytesRead > 0) {
                        audioBuffer.write(buffer, 0, bytesRead);
                    }
                }
                microphone.close();
            });

            recordingThread.start();
            System.out.println("Grabación iniciada...");

        } catch (LineUnavailableException e) {
            System.err.println("Error al acceder al micrófono: " + e.getMessage());
        }
    }

    public void stopRecording(String filePath) {
        if (!isRecording) return;

        isRecording = false;
        try {
            recordingThread.join(); // Esperar a que termine el hilo
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }

        // Guardar como archivo WAV
        saveAudioToFile(filePath);
        System.out.println("Grabación guardada en: " + filePath);
    }

    private void saveAudioToFile(String filePath) {
        try (FileOutputStream fos = new FileOutputStream(filePath);
             BufferedOutputStream bos = new BufferedOutputStream(fos)) {

            // Escribir encabezado WAV y datos
            AudioInputStream audioStream = new AudioInputStream(
                    new ByteArrayInputStream(audioBuffer.toByteArray()),
                    FORMAT,
                    audioBuffer.size() / FORMAT.getFrameSize()
            );

            AudioSystem.write(audioStream, AudioFileFormat.Type.WAVE, bos);
            audioStream.close();

        } catch (IOException e) {
            System.err.println("Error al guardar el archivo de audio: " + e.getMessage());
        }
    }
}