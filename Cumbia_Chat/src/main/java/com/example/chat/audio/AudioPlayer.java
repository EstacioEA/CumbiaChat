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
            Clip clip = AudioSystem.getClip();
            clip.open(ais);
            clip.start();
            System.out.println("Reproduciendo... (esperando a que termine)");
            while (clip.isRunning()) Thread.sleep(100);
            clip.close();
        } catch (Exception e) {
            System.err.println("Error reproduciendo audio: " + e.getMessage());
        }

    }

}
