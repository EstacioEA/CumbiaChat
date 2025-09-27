package com.example.chat;

import java.io.IOException;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Semaphore;

public class Server {
    private static final int PORT = 12345;
    private static final int THREAD_POOL_SIZE = 10;

    private static Set<PrintWriter> clients = Collections.synchronizedSet(new HashSet<>());
    private static Semaphore semaphore = new Semaphore(1);

    public static void main(String[] args) throws IOException {
        ExecutorService pool = Executors.newFixedThreadPool(THREAD_POOL_SIZE);
        try (ServerSocket server = new ServerSocket(PORT,50,InetAddress.getByName("localhost"))){
            System.out.println("Server is running");


            while (true) {
                Socket clientSocket = server.accept();
                pool.submit(new ClientHandler(clientSocket,clients, semaphore));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        finally{

        }
    }
}
