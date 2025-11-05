package com.example.chat.ui;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;

public class MenuManager {
    private final BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));

    public String readLine() throws IOException { return reader.readLine(); }

    public void printMain() {
        System.out.println("=== CUMBIA CHAT ===");
        System.out.println("1) Entrar a chat grupal");
        System.out.println("2) Conectarme con un usuario específico");
        System.out.println("3) Ver mis chats disponibles");
        System.out.println("4) Salir");
        System.out.print("Elige: ");
    }
}
