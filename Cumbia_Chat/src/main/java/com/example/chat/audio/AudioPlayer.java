package com.example.chat.audio;

import javax.sound.sampled.*;
import java.io.File;

public class AudioPlayer {
    public static void playAudio(String path) {
        try {
            File file = new File(path);
            
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
            
            byte[] buffer = new byte[4096];
            int bytesRead;
            
            while ((bytesRead = ais.read(buffer)) != -1) {
                line.write(buffer, 0, bytesRead);
            }
            
            line.drain();
            line.close();
            ais.close();
            
        } catch (Exception e) {
            System.err.println("Error reproduciendo audio: " + e.getMessage());
        }
    }
}