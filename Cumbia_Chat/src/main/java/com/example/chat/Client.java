package com.example.chat;

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

            while (true) {
                System.out.println("Enter message:");
                String message = userInput.readLine();
                if (message.equals("exit")) {
                    socket.close();
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        finally{
            System.out.println("Client terminated");
        }
    }
}
