package com.example.chat.data;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

/**
 * HistorialManager
 * - Archivo "historial.txt" en la carpeta de ejecución.
 * - Thread-safe mediante sincronización en LOCK.
 * - Formatos legibles para texto y audios.
 */
public class HistorialManager {

    private static final Path HISTORIAL_FILE = Paths.get("historial.txt");
    private static final String AUDIO_FOLDER = "audios";
    private static final Object LOCK = new Object();
    private static final SimpleDateFormat SDF = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    static {
        try {
            if (!Files.exists(HISTORIAL_FILE)) {
                Files.createFile(HISTORIAL_FILE);
            }
            Path aud = Paths.get(AUDIO_FOLDER);
            if (!Files.exists(aud)) Files.createDirectories(aud);
        } catch (IOException e) {
            throw new RuntimeException("No se pudo inicializar HistorialManager", e);
        }
    }

    private static String formatoLinea(String tipo, String remitente, String destino, String contenido) {
        return String.format("[%s] [%s] %s -> %s : %s",
                SDF.format(new Date()), tipo, remitente, destino, contenido);
    }

    public static void registrarMensajeTexto(String remitente, String destino, String mensaje) {
        String linea = formatoLinea("TEXT", remitente, destino, mensaje);
        appendLinea(linea);
    }

    public static void registrarAudio(String remitente, String destino, String nombreArchivo) {
        String linea = formatoLinea("AUDIO", remitente, destino, nombreArchivo);
        appendLinea(linea);
    }

    private static void appendLinea(String linea) {
        synchronized (LOCK) {
            try (BufferedWriter bw = Files.newBufferedWriter(HISTORIAL_FILE, StandardCharsets.UTF_8, StandardOpenOption.APPEND)) {
                bw.write(linea);
                bw.newLine();
                bw.flush();
            } catch (IOException e) {
                System.err.println("Error escribiendo historial: " + e.getMessage());
            }
        }
    }

    public static String leerHistorialCompleto() {
        synchronized (LOCK) {
            try {
                List<String> all = Files.readAllLines(HISTORIAL_FILE, StandardCharsets.UTF_8);
                if (all.isEmpty()) return "(Historial vacío)";
                return String.join(System.lineSeparator(), all);
            } catch (IOException e) {
                return "Error leyendo historial: " + e.getMessage();
            }
        }
    }

    public static String leerHistorial(int n) {
        if (n <= 0) return "(Solicitud inválida)";
        synchronized (LOCK) {
            try {
                List<String> all = Files.readAllLines(HISTORIAL_FILE, StandardCharsets.UTF_8);
                int size = all.size();
                if (size == 0) return "(Historial vacío)";
                int from = Math.max(0, size - n);
                List<String> sub = all.subList(from, size);
                return String.join(System.lineSeparator(), sub);
            } catch (IOException e) {
                return "Error leyendo historial: " + e.getMessage();
            }
        }
    }

    public static String buscarEnHistorial(String termino) {
        if (termino == null || termino.trim().isEmpty()) return "(Término vacío)";
        String t = termino.toLowerCase(Locale.ROOT);
        synchronized (LOCK) {
            try {
                List<String> all = Files.readAllLines(HISTORIAL_FILE, StandardCharsets.UTF_8);
                List<String> found = all.stream()
                        .filter(line -> line.toLowerCase(Locale.ROOT).contains(t))
                        .collect(Collectors.toList());
                if (found.isEmpty()) return "(No se encontraron coincidencias para: " + termino + ")";
                return String.join(System.lineSeparator(), found);
            } catch (IOException e) {
                return "Error buscando en historial: " + e.getMessage();
            }
        }
    }
}
