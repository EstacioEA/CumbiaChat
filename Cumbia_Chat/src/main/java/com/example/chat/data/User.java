package com.example.chat.data;

import java.io.Serializable;
import java.net.Socket;

public class User implements Serializable {
    private String username;
    private transient Socket socket; // no serializar socket

    public User(String username) {
        this.username = username;
    }

    public User(String username, Socket socket) {
        this.username = username;
        this.socket = socket;
    }

    public String getUsername() { return username; }
    public Socket getSocket() { return socket; }
    public void setSocket(Socket socket) { this.socket = socket; }

    @Override
    public String toString() {
        return username;
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof User)) return false;
        return username.equalsIgnoreCase(((User)o).username);
    }

    @Override
    public int hashCode() {
        return username.toLowerCase().hashCode();
    }
}
