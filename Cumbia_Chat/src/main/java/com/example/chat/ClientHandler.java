package com.example.chat;

import java.io.BufferedReader;
import java.io.PrintWriter;
import java.net.Socket;

public class ClientHandler implements Runnable{

    private Socket clientSocket;

    public ClientHandler(Socket clientSocket){
        this.clientSocket = clientSocket;
    }
    
    @Override
    public void run() {
       
        try {
            BufferedReader
        } catch (Exception e) {
            // TODO: handle exception
        }
    }
    
}
