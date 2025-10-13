package com.example.chat.ui;

import java.util.Scanner;

/**
 * Controla la interacción por consola del cliente.
 * Muestra menús y devuelve las selecciones del usuario.
 */
public class MenuManager {

    private Scanner scanner;

    public MenuManager(Scanner scanner) {
        this.scanner = scanner;
    }

    /** Menú principal del sistema */
    public int mostrarMenuPrincipal() {
        System.out.println("=== 💬 Bienvenido a CumbiaChat ===");
        System.out.println("1) Crear grupo");
        System.out.println("2) Unirse a grupo existente");
        System.out.println("3) Chatear con usuario");
        System.out.println("4) Salir");
        System.out.print("Elige una opción: ");
        return leerOpcion();
    }

    /** Menú de chat grupal */
    public int mostrarMenuGrupo(String nombreGrupo) {
        System.out.println("\n=== 👥 Grupo: " + nombreGrupo + " ===");
        System.out.println("1) Enviar mensaje de texto");
        System.out.println("2) Enviar nota de voz");
        System.out.println("3) Llamar al grupo");
        System.out.println("4) Ver historial");
        System.out.println("5) Salir del grupo");
        System.out.print("Elige una opción: ");
        return leerOpcion();
    }

    /** Menú de chat directo con usuario */
    public int mostrarMenuUsuario(String nombreUsuario) {
        System.out.println("\n=== 💬 Chat con: " + nombreUsuario + " ===");
        System.out.println("1) Enviar mensaje de texto");
        System.out.println("2) Enviar nota de voz");
        System.out.println("3) Llamar al usuario");
        System.out.println("4) Ver historial");
        System.out.println("5) Salir del chat");
        System.out.print("Elige una opción: ");
        return leerOpcion();
    }

    /** Método auxiliar para leer opciones numéricas */
    private int leerOpcion() {
        try {
            return Integer.parseInt(scanner.nextLine());
        } catch (Exception e) {
            System.out.println("⚠️ Opción inválida. Intenta de nuevo.");
            return leerOpcion();
        }
    }
}
