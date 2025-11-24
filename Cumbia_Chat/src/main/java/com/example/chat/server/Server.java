package com.example.chat.server;

import com.zeroc.Ice.Communicator;
import com.zeroc.Ice.ObjectAdapter;
import com.zeroc.Ice.Util;

public class Server {
    public static void main(String[] args) {
        System.out.println("===========================================");
        System.out.println(">>> Iniciando Servidor CumbiaChat (Ice RPC)...");
        System.out.println("===========================================\n");

        try (Communicator communicator = Util.initialize(args)) {
            
            // Crear adaptador en puerto 10000 (TCP)
            System.out.println("→ Creando adaptador en puerto 10000...");
            ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints(
                "ChatAdapter", 
                "default -p 10000"
            );

            // Crear e instanciar el servicio
            System.out.println("→ Creando servicio ChatService...");
            ChatServiceI service = new ChatServiceI();

            // Registrar el servicio
            System.out.println("→ Registrando servicio con identidad 'ChatService'...");
            adapter.add(service, Util.stringToIdentity("ChatService"));

            // Activar el adaptador
            System.out.println("→ Activando adaptador...\n");
            adapter.activate();

            System.out.println("╔═══════════════════════════════════════════╗");
            System.out.println("║   ✅ SERVIDOR LISTO Y ESCUCHANDO          ║");
            System.out.println("║                                           ║");
            System.out.println("║   Puerto: 10000                           ║");
            System.out.println("║   Protocolo: TCP (default)                ║");
            System.out.println("║   Servicio: ChatService                   ║");
            System.out.println("║                                           ║");
            System.out.println("║   Esperando conexiones de Node.js...      ║");
            System.out.println("╚═══════════════════════════════════════════╝\n");
            
            // Esperar señal de apagado (Ctrl+C)
            communicator.waitForShutdown();
            
            System.out.println("\n>>> Servidor detenido correctamente");
            
        } catch (Exception e) {
            System.err.println("❌ ERROR CRÍTICO en servidor:");
            e.printStackTrace();
            System.exit(1);
        }
    }
}