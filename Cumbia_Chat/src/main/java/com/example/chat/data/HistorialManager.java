package com.example.chat.data;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Historial por chat (grupo o privado).
 * Los historiales se guardan en archivos: historial_<nombre_chat>.txt
 */
public class HistorialManager {
    private static final Path ROOT = Paths.get(".");
    private static final SimpleDateFormat SDF = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
    private static final Object LOCK = new Object();

    private static Path pathForChat(String chatName) {
        String safe = chatName.replaceAll("\\s+", "_");
        return ROOT.resolve("historial_" + safe + ".txt");
    }

    private static void ensureExists(Path p) throws IOException {
        if (!Files.exists(p)) Files.createFile(p);
    }

    private static void appendLine(Path p, String line) {
        synchronized (LOCK) {
            try (BufferedWriter bw = Files.newBufferedWriter(p, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND)) {
                bw.write(line);
                bw.newLine();
            } catch (IOException e) {
                System.err.println("Error escribiendo historial: " + e.getMessage());
            }
        }
    }

    private static String formatLine(String tipo, String remitente, String destino, String contenido) {
        return String.format("[%s] [%s] %s -> %s : %s", SDF.format(new Date()), tipo, remitente, destino, contenido);
    }

    // Registrar texto
    public static void registrarMensajeTexto(String remitente, String chatName, String mensaje) {
        Path p = pathForChat(chatName);
        String line = formatLine("TEXT", remitente, chatName, mensaje);
        appendLine(p, line);
    }

    // Registrar audio (nombre archivo)
    public static void registrarAudio(String remitente, String chatName, String audioFileName) {
        Path p = pathForChat(chatName);
        String line = formatLine("AUDIO", remitente, chatName, audioFileName);
        appendLine(p, line);
    }

    // Leer todo
    public static String leerHistorialCompleto(String chatName) {
        Path p = pathForChat(chatName);
        synchronized (LOCK) {
            try {
                if (!Files.exists(p)) return "(Historial vacío)";
                List<String> all = Files.readAllLines(p, StandardCharsets.UTF_8);
                if (all.isEmpty()) return "(Historial vacío)";
                return String.join(System.lineSeparator(), all);
            } catch (IOException e) {
                return "Error leyendo historial: " + e.getMessage();
            }
        }
    }

    // Leer últimas N
    public static String leerHistorial(String chatName, int n) {
        if (n <= 0) return "(Solicitud inválida)";
        Path p = pathForChat(chatName);
        synchronized (LOCK) {
            try {
                if (!Files.exists(p)) return "(Historial vacío)";
                List<String> all = Files.readAllLines(p, StandardCharsets.UTF_8);
                int size = all.size();
                if (size == 0) return "(Historial vacío)";
                int from = Math.max(0, size - n);
                return String.join(System.lineSeparator(), all.subList(from, size));
            } catch (IOException e) {
                return "Error leyendo historial: " + e.getMessage();
            }
        }
    }

    // Buscar
    public static String buscarEnHistorial(String chatName, String termino) {
        if (termino == null || termino.trim().isEmpty()) return "(Término vacío)";
        Path p = pathForChat(chatName);
        String term = termino.toLowerCase(Locale.ROOT);
        synchronized (LOCK) {
            try {
                if (!Files.exists(p)) return "(Historial vacío)";
                List<String> all = Files.readAllLines(p, StandardCharsets.UTF_8);
                List<String> found = all.stream()
                        .filter(l -> l.toLowerCase(Locale.ROOT).contains(term))
                        .collect(Collectors.toList());
                if (found.isEmpty()) return "(No se encontraron coincidencias para: " + termino + ")";
                return String.join(System.lineSeparator(), found);
            } catch (IOException e) {
                return "Error buscando: " + e.getMessage();
            }
        }
    }
}
