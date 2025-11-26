# 🎶 CumbiaChat

**CumbiaChat** es una aplicación cliente-servidor desarrollada en Java que permite comunicación en tiempo real entre usuarios mediante texto, notas de voz y llamadas.  
El proyecto combina los protocolos **TCP** y **UDP** para optimizar el rendimiento y la confiabilidad según el tipo de comunicación.

---

## 👥 Equipo de desarrollo

- **Jose Valdez**
- **Juan Diego Balanta**
- **Edwar Andres Estacio**

---

## 💡 Descripción general

CumbiaChat implementa un sistema de mensajería que integra múltiples tipos de comunicación en una arquitectura cliente-servidor basada en **sockets**.  
El sistema está diseñado para ser flexible, eficiente y modular.

---

## ⚙️ Funcionalidades principales

| Requerimiento | Descripción | Protocolo |
|----------------|-------------|------------|
| **1. Creación de grupos de chat** | Los usuarios pueden crear y unirse a grupos. Cada grupo mantiene su propia lista de participantes y su historial. | **TCP** |
| **2. Mensajes de texto** | Envío y recepción de mensajes individuales o grupales en tiempo real. | **TCP** |
| **3. Notas de voz** | Envío de grabaciones de audio en formato PCM mediante datagramas. | **UDP** |
| **4. Llamadas de voz** | Comunicación bidireccional en tiempo real entre usuarios o grupos, con transmisión directa de audio. | **UDP** |
| **5. Historial de mensajes** | Registro persistente de mensajes y notas de voz enviados por usuario o grupo. | **TCP** |

---

## 🧱 Arquitectura del sistema

CumbiaChat utiliza una arquitectura **cliente-servidor multihilo** con los siguientes módulos:

### 🖥️ Servidor (`Server`)
- Gestiona las conexiones TCP de todos los clientes.
- Mantiene una lista de usuarios conectados, grupos activos y el historial de mensajes.
- Crea instancias de **UDPAudioServer** para manejar llamadas y notas de voz.

### 💬 Cliente (`Client`)
- Interactúa con el usuario mediante interfaz gráfica o consola.
- Envía comandos al servidor por TCP y gestiona las sesiones UDP para audio.
- Utiliza **UDPAudioClient** para grabar, enviar y reproducir audio en tiempo real.

### 🔊 Módulos UDP (`com.example.chat.UDP`)
- **UDPAudioClient**: captura audio del micrófono, lo envía por UDP y reproduce el audio recibido.
- **UDPAudioServer**: recibe y redistribuye los paquetes de audio a todos los participantes conectados.

---

## 🧩 Tecnologías utilizadas

- **Lenguaje:** Java 17
- **Framework de compilación:** Gradle
- **Comunicación:** TCP y UDP (Sockets de Java)
- **Audio:** `javax.sound.sampled`

---


# 🕺 Cumbia Chat - Guía de Ejecución

## 📋 Descripción general
**Cumbia Chat** es una aplicación de mensajería simple desarrollada en **Java** que permite la comunicación entre clientes y un servidor utilizando los protocolos **TCP** y **UDP**.  
El proyecto está configurado con **Gradle** y se puede ejecutar directamente desde la línea de comandos sin necesidad de un IDE.

---

## ⚙️ Requisitos previos

Antes de ejecutar el proyecto, asegúrate de tener instalados los siguientes componentes:

| Requisito | Versión mínima | Verificar instalación |
|------------|----------------|------------------------|
| **Java JDK** | 17 o superior | `java -version` |
| **Gradle** | (Opcional, el wrapper está incluido) | `gradle -v` |
| **Terminal / Consola** | Cualquiera (CMD, PowerShell, bash, etc.) | — |

> 💡 El proyecto incluye el **Gradle Wrapper**, así que no necesitas tener Gradle instalado globalmente.

---

## 🚀 Compilar el proyecto

Primero, asegúrate de estar en la carpeta raíz del proyecto (donde está el archivo `build.gradle`).

Luego, ejecuta el siguiente comando:

```bash
.\gradlew clean build
```
Esto limpiará compilaciones anteriores y generará los archivos `.class` en la carpeta `build/classes/java/main`

## Ejecución del proyecto

### Servidor TCP

Para iniciar el **servidor TCP**, ejecuta:

```bash
java -cp build/classes/java/main com.example.chat.TCP.Server
```

Por defecto, el servidor se ejecuta en el puerto 5000 y espera conexiones de los clientes TCP.

### Cliente TCP

Para conectar un **cliente TCP** al servidor, abre **otra terminal** y ejecuta (puedes abrir **varias terminales** para conectar **diferentes clientes**):

```bash
java -cp build/classes/java/main com.example.chat.TCP.Client
```

El cliente intentará conectarse automáticamente al servidor TCP (localhost:5000).

Una vez conectado, podrás:

- Enviar mensajes al servidor.
- Ver los mensajes que otros clientes envían.

## Menú principal del cliente

Cuando ejecutas un **cliente**, se te mostrará un menú con opciones como:



Selecciona la opción deseada escribiendo el número correspondiente y presionando **Enter**.

## Solución de problemas comunes

| Problema                 | Causa probable                                 | Solución                                                             |
| ------------------------ | ---------------------------------------------- | -------------------------------------------------------------------- |
| `ClassNotFoundException` | Estás ejecutando el comando desde otra carpeta | Verifica que estés en la raíz del proyecto (`build.gradle` visible). |
| `Address already in use` | El puerto (5000 o 6000) ya está ocupado        | Cambia el puerto en el código o cierra procesos anteriores.          |
| `java.net.BindException` | Falta de permisos o error al asignar puerto    | Ejecuta la consola como administrador o usa otro puerto.             |

