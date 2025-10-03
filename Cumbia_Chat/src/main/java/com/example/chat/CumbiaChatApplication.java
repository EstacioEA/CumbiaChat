package com.example.chat;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class CumbiaChatApplication {
    public static void main(String[] args) {
        SpringApplication.run(CumbiaChatApplication.class, args);
        System.out.println("Cumbia Chat corriendo en http://localhost:8080");
    }
}