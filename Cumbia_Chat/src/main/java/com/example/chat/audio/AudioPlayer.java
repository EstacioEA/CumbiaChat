package com.example.chat.audio;

import javax.sound.sampled.*;
import java.io.File;

public class AudioPlayer {
    public static void playAudio(String path) {
        try {
            File file = new File(path);
            System.out.println("DEBUG: Reproduciendo: " + path);
            
            if (!file.exists()) {
                System.err.println("Archivo no encontrado: " + path);
                return;
            }
            
            AudioInputStream ais = AudioSystem.getAudioInputStream(file);
            AudioFormat format = ais.getFormat();
            
            DataLine.Info info = new DataLine.Info(SourceDataLine.class, format);
            SourceDataLine line = (SourceDataLine) AudioSystem.getLine(info);
            
            line.open(format);
            line.start();
            
            System.out.println("DEBUG: SourceDataLine abierto y iniciado");
            
            byte[] buffer = new byte[4096];
            int bytesRead;
            long totalBytes = 0;
            
            while ((bytesRead = ais.read(buffer)) != -1) {
                line.write(buffer, 0, bytesRead);
                totalBytes += bytesRead;
            }
            
            System.out.println("DEBUG: Se escribieron " + totalBytes + " bytes");
            
            line.drain();
            line.close();
            ais.close();
            
            System.out.println("DEBUG: Reproduccion completada");
            
        } catch (Exception e) {
            System.err.println("Error reproduciendo audio: " + e.getMessage());
            e.printStackTrace();
        }
    }
}