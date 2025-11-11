# 🎵 CumbiaChat v2.0 - Cliente Web con Proxy HTTP

**CumbiaChat** es una aplicación de mensajería en tiempo real que permite la comunicación entre usuarios mediante texto y notas de voz. En esta segunda entrega, el proyecto evoluciona de una aplicación de consola Java a una **aplicación web moderna** que utiliza **HTML, CSS y JavaScript** como frontend, comunicándose con el backend Java original a través de un **proxy HTTP basado en Express**.

---

## 👥 Equipo de Desarrollo

- **Jose Valdez**
- **Juan Diego Balanta**
- **Edwar Andres Estacio**

---

## 📋 Descripción General

Esta es la **segunda entrega** del proyecto CumbiaChat, enfocada en la transición del cliente de consola Java a un cliente web moderno. El sistema mantiene la arquitectura cliente-servidor original, pero introduce una capa intermedia (proxy HTTP) que permite la comunicación entre el navegador web y el servidor TCP Java.

### Arquitectura del Sistema
```
┌─────────────────┐         HTTP          ┌──────────────────┐         TCP          ┌──────────────────┐
│   Cliente Web   │ ◄──────────────────► │   Proxy Express  │ ◄──────────────────► │  Servidor Java   │
│ (HTML/CSS/JS)   │    REST API Calls    │   (Node.js)      │   Socket Messages   │   (TCP Server)   │
└─────────────────┘                       └──────────────────┘                       └──────────────────┘
```

**Flujo de Comunicación:**

1. **Cliente Web → Proxy HTTP**: El navegador realiza peticiones HTTP/AJAX al proxy Express (puerto 5000)
2. **Proxy → Backend Java**: El proxy traduce las peticiones HTTP a mensajes JSON que el servidor TCP Java entiende (puerto 12345)
3. **Backend Java → Proxy**: El servidor procesa la petición y responde con JSON
4. **Proxy → Cliente Web**: El proxy reenvía la respuesta al navegador en formato JSON

---

## ⚙️ Funcionalidades Implementadas

| Requerimiento | Descripción | Estado |
|---------------|-------------|--------|
| **1. Crear grupos** | Los usuarios pueden crear nuevos grupos de chat | ✅ Implementado |
| **2. Mensajes de texto** | Envío de mensajes a usuarios individuales o grupos | ✅ Implementado |
| **3. Historial de mensajes** | Consultar mensajes previos de chats privados y grupales | ✅ Implementado |
| **4. Gestión de usuarios** | Ver usuarios conectados y unirse a grupos | ✅ Implementado |

> **Nota**: Las funcionalidades de llamadas en tiempo real (UDP) no se han implementado en esta versión web, ya que se implementarán mediante WebSockets en la entrega final.

---

## 🚀 Instrucciones de Ejecución

### Requisitos Previos

| Requisito | Versión mínima | Verificar instalación |
|-----------|----------------|------------------------|
| **Java JDK** | 17 o superior | `java -version` |
| **Node.js** | 16 o superior | `node -v` |
| **npm** | 8 o superior | `npm -v` |

---

### Paso 1: Iniciar el Servidor Java (Backend)

1. Navega a la carpeta del servidor:
```
   CumbiaChat\Cumbia_Chat\src\main\java\com\example\chat\TCP\
```

2. Ejecuta el archivo `Server.java` desde tu IDE (IntelliJ IDEA, Eclipse, VS Code con extensión Java) o mediante línea de comandos:
```bash
   # Compilar (si usas Gradle)
   cd CumbiaChat/Cumbia_Chat
   ./gradlew build
   
   # Ejecutar el servidor
   java -cp build/classes/java/main com.example.chat.TCP.Server
```

3. Deberías ver el mensaje:
```
   Servidor TCP corriendo en puerto 12345
```

> **¿Qué hace el servidor?** Gestiona todas las conexiones de clientes, mantiene el registro de usuarios conectados, grupos activos y el historial de mensajes. Opera en el puerto TCP **12345**.

---

### Paso 2: Configurar e Iniciar el Proxy HTTP (Node.js/Express)

1. Navega a la carpeta del proxy:
```bash
   cd CumbiaChat\Cumbia_Chat\cumbia_chat_api_rest
```

2. **Instala las dependencias** de Node.js:
```bash
   npm install
```
   
   > **¿Para qué sirve?** Este comando descarga e instala todas las librerías necesarias definidas en `package.json`, como **Express** (servidor HTTP), **CORS** (para permitir peticiones desde el navegador) y **Multer** (para manejar archivos de audio).

3. **Inicia el servidor proxy**:
```bash
   node index.js
```

4. Deberías ver el mensaje:
```
   Servidor API REST CumbiaChat iniciado en http://localhost:5000
```

> **¿Qué hace el proxy?** Actúa como intermediario entre el cliente web y el servidor Java. Recibe peticiones HTTP del navegador (por ejemplo, "crear grupo"), las traduce a mensajes JSON que el servidor TCP entiende, y devuelve las respuestas al navegador. Opera en el puerto HTTP **5000**.

---

### Paso 3: Iniciar el Cliente Web

1. Navega a la carpeta del cliente web:
```bash
   cd CumbiaChat\Cumbia_Chat\cumbia_chat_web
```

2. **Inicia un servidor HTTP estático**:
```bash
   npx http-server -p 3000
```

   > **¿Para qué sirve?** Este comando levanta un servidor web simple que sirve los archivos HTML, CSS y JavaScript de tu aplicación. El puerto **3000** es donde podrás acceder a la aplicación desde el navegador.

3. **Abre tu navegador** y accede a:
```
   http://localhost:3000
```
   o si abriste otros clientes accede:
```
   http://localhost:300x
```

4. **¿Necesitas varios clientes?** Puedes abrir múltiples ventanas del navegador (o usar diferentes puertos):
```bash
   # Cliente 1
   npx http-server -p 3000
   
   # Cliente 2 (en otra terminal)
   npx http-server -p 3001
   
   # Cliente 3
   npx http-server -p 3002
```

---

## 🎨 Uso de la Aplicación

### 1️⃣ **Login**
- Ingresa un nombre de usuario único
- Haz clic en "¡Entrar a bailar!"

### 2️⃣ **Crear un Grupo**
- Ve a la pestaña "Grupos"
- Haz clic en el botón **➕**
- Ingresa el nombre del grupo

### 3️⃣ **Enviar Mensajes**
- Selecciona un usuario o grupo de la lista
- Escribe tu mensaje en el campo de texto
- Presiona "Enviar" o la tecla Enter


### 4️⃣ **Ver Historial**
- El historial de mensajes se carga automáticamente al abrir un chat
- Incluye mensajes de texto y notificaciones de audios

---

## 🧩 Tecnologías Utilizadas

### **Backend (Java)**
- **Lenguaje:** Java 17
- **Framework de compilación:** Gradle
- **Comunicación:** TCP Sockets + JSON (Gson)
- **Audio:** `javax.sound.sampled`

### **Proxy (Node.js)**
- **Lenguaje:** JavaScript (Node.js)
- **Framework:** Express.js
- **Librerías:** CORS, Multer, net (sockets TCP)

### **Frontend (Web)**
- **Lenguaje:** HTML5, CSS3, JavaScript (ES6+)
- **API:** Fetch API para llamadas HTTP
- **Almacenamiento:** LocalStorage para sesiones

---

## 📂 Estructura del Proyecto
```
CumbiaChat/
├── src/main/java/com/example/chat/
│   ├── TCP/
│   │   ├── Server.java                 # Servidor TCP principal
│   │   ├── ClientHandler.java          # Manejo de clientes (JSON)
│   │   └── JSONProtocolHandler.java    # Handler para protocolo JSON
│   ├── data/
│   │   ├── User.java                   # Modelo de usuario
│   │   ├── Group.java                  # Modelo de grupo
│   │   └── HistorialManager.java       # Gestión de historiales
│   └── audio/
│       ├── AudioPlayer.java            # Reproductor de audio
│       └── AudioRecorder.java          # Grabador de audio
│
├── cumbia_chat_api_rest/
│   ├── index.js                        # Servidor Express (proxy HTTP)
│   ├── services/
│   │   └── cumbiaChatDelegateService.js # Lógica de comunicación TCP
│   └── package.json                    # Dependencias de Node.js
│
└── cumbia_chat_web/
    ├── index.html                      # Página de login
    ├── chat.html                       # Interfaz principal del chat
    ├── scripts/
    │   ├── config.js                   # Configuración (endpoints, URLs)
    │   ├── api.js                      # Cliente HTTP (fetch)
    │   ├── utils.js                    # Utilidades y helpers
    │   ├── login.js                    # Lógica de autenticación
    │   └── chat.js                     # Lógica principal del chat
    └── styles/
        ├── login.css                   # Estilos de la página de login
        └── chat.css                    # Estilos de la interfaz de chat
```

---

## 🔧 Solución de Problemas Comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| **El servidor Java no inicia** | Puerto 12345 ocupado | Cambia el puerto en `Server.java` o cierra procesos que lo usen: `netstat -ano \| findstr :12345` |
| **El proxy no se conecta al backend** | Servidor Java no está corriendo | Verifica que el servidor Java esté activo en el puerto 12345 |
| **Error CORS en el navegador** | Proxy no configurado correctamente | Verifica que el proxy Express tenga `app.use(cors())` habilitado |
| **No se cargan usuarios/grupos** | Problema de comunicación | Revisa la consola del navegador (F12) y los logs del proxy |
| **"Cannot find module"** | Dependencias no instaladas | Ejecuta `npm install` en `cumbia_chat_api_rest` |

---


### Interfaz de Chat
- **Sidebar izquierdo:** Lista de usuarios y grupos
- **Área central:** Mensajes del chat activo
- **Campo de entrada:** Para escribir y enviar mensajes

---

## 🎯 Diferencias con la Tarea 1

| Aspecto | Tarea 1 | Tarea 2 |
|---------|---------|---------|
| **Cliente** | Consola Java | Navegador Web (HTML/CSS/JS) |
| **Protocolo** | TCP directo | HTTP → TCP (via proxy) |
| **Llamadas de voz** | ✅ UDP en tiempo real | ❌ Deshabilitado (futuro: WebSockets) |
| **Interfaz** | Menús de texto | Interfaz gráfica moderna |
| **Mensajería** | Sincrónica | Asincrónica (AJAX) |

---

## 📝 Notas Importantes

- **Historiales persistentes:** Los mensajes se guardan en archivos `.txt` en la carpeta raíz del servidor Java
- **Sesiones:** El cliente web mantiene la sesión mediante `localStorage`
- **Sin WebSockets:** Esta versión **NO** implementa comunicación en tiempo real (se agregará en el proyecto final)

---

## 🎵 ¡Gracias por usar CumbiaChat!

**Proyecto desarrollado para la asignatura de Computacion en Internet I**  
Universidad Icesi- 2025

---

**Versión:** 2.0 (Cliente Web)  
**Fecha:** Noviembre 2025 
