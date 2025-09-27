package com.example.chat;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.PrintWriter;
import java.net.Socket;
import java.util.Set;
import java.util.concurrent.Semaphore;

public class ClientHandler implements Runnable{

    private Socket clientSocket;
    private BufferedReader in;
    private PrintWriter out;

    private Set<PrintWriter> clients;
    private Semaphore Semaphore;


    public ClientHandler(Socket clientSocket, Set<PrintWriter> clients, Semaphore Semaphore) {
        this.clientSocket = clientSocket;
        this.clients = clients;
        this.Semaphore = Semaphore;
    }
    
    @Override
    public void run() {
       
        try {
            // Streams de entrada y salida del cliente
            in = new BufferedReader(new InputStreamReader(clientSocket.getInputStream()));
            out = new PrintWriter(clientSocket.getOutputStream(), true);

            // Agregar al conjunto de clientes
            clients.add(out);
            out.println(" Conectado al servidor de chat.");

            String message;
            // Mientras el cliente mande mensajes, se reenvían
            while ((message = in.readLine()) != null) {
                System.out.println(" Mensaje recibido: " + message);
                sendToAll(message);
            }
        } catch (Exception e) {
            System.out.println(" Cliente desconectado.");
        }finally {

            // Limpieza
            if (out != null) {
                clients.remove(out);
            }
            try {
                clientSocket.close();
            } catch (IOException e) {
                e.printStackTrace();
            }
        }
    }


    private void sendToAll(String message) {
        try {
            Semaphore.acquire(); // Un cliente escribe a la vez
            for (PrintWriter cliente : clients) {
                cliente.println(message);
            }
        } catch (InterruptedException e) {
            e.printStackTrace();
        } finally {
            Semaphore.release();
        }
    }
    
}
