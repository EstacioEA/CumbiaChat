package com.example.chat.server;

import com.zeroc.Ice.Communicator;
import com.zeroc.Ice.ObjectAdapter;
import com.zeroc.Ice.Util;

public class Server {
    public static void main(String[] args) {
        System.out.println(">>> Iniciando Servidor CumbiaChat (Ice RPC)...");

        // Inicializar Ice
        try (Communicator communicator = Util.initialize(args)) {
            
            // Crear adaptador en el puerto 10000 (TCP estandar)
            // Esto permite que Node.js se conecte a "ChatAdapter"
            ObjectAdapter adapter = communicator.createObjectAdapterWithEndpoints("ChatAdapter", "default -p 10000");

            // Crear nuestra implementación
            ChatServiceI service = new ChatServiceI();

            // Registrar la implementación bajo el nombre "ChatService"
            adapter.add(service, Util.stringToIdentity("ChatService"));

            // Activar
            adapter.activate();

            System.out.println(">>> Servidor LISTO y escuchando en puerto 10000");
            
            // Esperar señal de apagado
            communicator.waitForShutdown();
        }
    }
}