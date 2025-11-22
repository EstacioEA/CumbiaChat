package com.example.chat.ice;

import com.zeroc.Ice.Communicator;
import com.zeroc.Ice.ObjectAdapter;
import com.zeroc.Ice.Properties;
import com.zeroc.Ice.Util;

/**
 * Servidor Ice para audio en tiempo real
 * Configurado para aceptar WebSocket (navegadores) y UDP (clientes nativos)
 */
public class IceAudioServerMain {
    
    private static final int WS_PORT = 10000;  // Puerto WebSocket
    private static final int UDP_PORT = 10001; // Puerto UDP
    
    public static void main(String[] args) {
        System.out.println("🎵 ========================================");
        System.out.println("🎵 Iniciando CumbiaChat Ice Audio Server");
        System.out.println("🎵 ========================================\n");
        
        try (Communicator communicator = Util.initialize(args)) {
            
            // Configurar propiedades
            configureProperties(communicator);
            
            // Crear servant (implementación)
            IceAudioServerImpl audioServer = new IceAudioServerImpl();
            
            // Crear adaptadores (WebSocket + UDP)
            ObjectAdapter wsAdapter = createWebSocketAdapter(communicator, audioServer);
            ObjectAdapter udpAdapter = createUdpAdapter(communicator, audioServer);
            
            // Activar adaptadores
            wsAdapter.activate();
            udpAdapter.activate();
            
            System.out.println("✅ Servidor Ice iniciado correctamente\n");
            System.out.println("📡 Endpoints disponibles:");
            System.out.println("   - WebSocket (Web): ws://localhost:" + WS_PORT);
            System.out.println("   - UDP (Native):    udp://localhost:" + UDP_PORT);
            System.out.println("\n⚠️  Presiona Ctrl+C para detener el servidor\n");
            
            // Thread para estadísticas
            startStatsThread(audioServer);
            
            // Thread para limpieza de conexiones inactivas
            startCleanupThread(audioServer);
            
            // Esperar shutdown
            communicator.waitForShutdown();
            
        } catch (Exception e) {
            System.err.println("❌ Error fatal en servidor Ice:");
            e.printStackTrace();
            System.exit(1);
        }
        
        System.out.println("\n👋 Ice Audio Server detenido");
    }
    
    /**
     * Configura propiedades generales de Ice
     */
    private static void configureProperties(Communicator communicator) {
        Properties props = communicator.getProperties();
        
        // Configuración de threads para mejor rendimiento
        props.setProperty("Ice.ThreadPool.Server.Size", "10");
        props.setProperty("Ice.ThreadPool.Server.SizeMax", "100");
        
        // ACM (Active Connection Management) para detectar desconexiones
        props.setProperty("Ice.ACM.Server.Timeout", "60");
        props.setProperty("Ice.ACM.Server.Close", "4"); // CloseOnIdleForceful
        props.setProperty("Ice.ACM.Server.Heartbeat", "3"); // HeartbeatOnIdle
        
        // Timeouts
        props.setProperty("Ice.Default.InvocationTimeout", "10000");
        
        // Logging
        props.setProperty("Ice.Warn.Connections", "1");
        props.setProperty("Ice.Trace.Network", "0"); // 0=off, 1=basic, 2=detailed
        
        System.out.println("⚙️  Propiedades de Ice configuradas");
    }
    
    /**
     * Crea adapter para WebSocket (clientes web)
     */
    private static ObjectAdapter createWebSocketAdapter(
            Communicator communicator, 
            IceAudioServerImpl servant) throws Exception {
        
        System.out.println("🌐 Creando adapter WebSocket...");
        
        // Endpoint WebSocket
        String wsEndpoint = "ws -h 0.0.0.0 -p " + WS_PORT;
        
        ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints(
            "AudioServerWS",
            wsEndpoint
        );
        
        // Registrar servant
        adapter.add(servant, Util.stringToIdentity("AudioServer"));
        
        System.out.println("✅ WebSocket adapter creado en puerto " + WS_PORT);
        
        return adapter;
    }
    
    /**
     * Crea adapter para UDP (clientes nativos Java)
     */
    private static ObjectAdapter createUdpAdapter(
            Communicator communicator,
            IceAudioServerImpl servant) throws Exception {
        
        System.out.println("📡 Creando adapter UDP...");
        
        // Endpoint UDP
        String udpEndpoint = "udp -h 0.0.0.0 -p " + UDP_PORT;
        
        ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints(
            "AudioServerUDP",
            udpEndpoint
        );
        
        // Registrar el mismo servant
        adapter.add(servant, Util.stringToIdentity("AudioServer"));
        
        System.out.println("✅ UDP adapter creado en puerto " + UDP_PORT);
        
        return adapter;
    }
    
    /**
     * Thread para mostrar estadísticas periódicas
     */
    private static void startStatsThread(IceAudioServerImpl server) {
        Thread statsThread = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(30000); // Cada 30 segundos
                    server.printStats();
                } catch (InterruptedException e) {
                    break;
                }
            }
        });
        
        statsThread.setDaemon(true);
        statsThread.setName("Ice-StatsThread");
        statsThread.start();
        
        System.out.println("📊 Thread de estadísticas iniciado");
    }
    
    /**
     * Thread para limpiar conexiones inactivas
     */
    private static void startCleanupThread(IceAudioServerImpl server) {
        Thread cleanupThread = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(60000); // Cada minuto
                    // Aquí podrías implementar limpieza de conexiones viejas
                    // server.cleanupInactiveConnections();
                } catch (InterruptedException e) {
                    break;
                }
            }
        });
        
        cleanupThread.setDaemon(true);
        cleanupThread.setName("Ice-CleanupThread");
        cleanupThread.start();
        
        System.out.println("🧹 Thread de limpieza iniciado");
    }
    
    /**
     * Hook para shutdown graceful
     */
    static {
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("\n🛑 Iniciando shutdown graceful...");
            System.out.println("   Cerrando conexiones activas...");
            System.out.println("   Liberando recursos...");
        }));
    }
}