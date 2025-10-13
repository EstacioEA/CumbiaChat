package com.example.chat.data;

import java.net.Socket;
import java.io.Serializable;

/**
 * Representa un usuario dentro del sistema de chat.
 * Contiene su nombre, dirección IP, puerto y socket asociado.
 */
public class User implements Serializable {
    private String username;
    private String address;
    private int port;
    private transient Socket socket;

    public User(String username, String address, int port) {
        this.username = username;
        this.address = address;
        this.port = port;
    }

    public String getUsername() {
        return username;
    }

    public String getAddress() {
        return address;
    }

    public int getPort() {
        return port;
    }

    public Socket getSocket() {
        return socket;
    }

    public void setSocket(Socket socket) {
        this.socket = socket;
    }

    @Override
    public String toString() {
        return username + " (" + address + ":" + port + ")";
    }

    @Override
    public boolean equals(Object obj) {
        if (!(obj instanceof User)) return false;
        User other = (User) obj;
        return this.username.equalsIgnoreCase(other.username);
    }

    @Override
    public int hashCode() {
        return username.toLowerCase().hashCode();
    }
}
