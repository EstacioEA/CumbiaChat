package com.example.chat.TCP;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;

public class Client {
    private static final int PORT = 12345;
    private static final int THREAD_POOL_SIZE = 10;

    public static void main(String[] args) {
        try {
            Socket socket = new Socket("localhost",PORT);
            System.out.println("Connected to server on port:"+PORT);

            BufferedReader userInput = new BufferedReader(new InputStreamReader(System.in));
            BufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()));
            PrintWriter out = new PrintWriter(socket.getOutputStream(),true);

            // Hilo para escuchar mensajes del servidor y mostrarlos en la terminal del cliente (esto puede ser opcional xdd)h
            new Thread(() -> {
                try {
                    String serverMsg;
                    while ((serverMsg = in.readLine()) != null) {
                        System.out.println(">> " + serverMsg);
                    }
                } catch (Exception e) {
                    System.out.println("Disconnected from server.");
                }
            }).start();


            while (true) {
                System.out.println("Enter message:");
                String message = userInput.readLine();
                if (message.equalsIgnoreCase("exit")) {
                    socket.close();
                    break;
                }
                out.println(message);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        finally{
            System.out.println("Client terminated");
        }
    }
}
