package com.example.chat.audio;

import javax.sound.sampled.*;
import java.io.File;
import java.io.IOException;

public class AudioPlayer {

    public static void playAudio(String filePath) {
        try {
            File audioFile = new File(filePath);
            AudioInputStream audioStream = AudioSystem.getAudioInputStream(audioFile);
            Clip clip = AudioSystem.getClip();
            clip.open(audioStream);
            clip.start();

            // Opcional: esperar a que termine la reproducción
            // while (!clip.isRunning()) Thread.sleep(10);
            // while (clip.isRunning()) Thread.sleep(10);
            // clip.close();

        } catch (UnsupportedAudioFileException | IOException | LineUnavailableException e) {
            System.err.println("Error al reproducir el audio: " + e.getMessage());
        }
    }
}