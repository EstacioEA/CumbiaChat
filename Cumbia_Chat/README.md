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

## 🚀 Ejecución del proyecto

