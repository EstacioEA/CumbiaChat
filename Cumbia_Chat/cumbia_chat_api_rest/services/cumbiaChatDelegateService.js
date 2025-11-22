// services/cumbiaChatDelegateService.js
const net = require("net")

// Constantes
const SERVER_HOST = "localhost"
const SERVER_PORT = 12345

// Función genérica para enviar un mensaje TCP y esperar una respuesta
const sendTcpMessage = (messageObject) => {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket()

        socket.connect(SERVER_PORT, SERVER_HOST, () => {
            // Enviar el mensaje directamente (sin login previo)
            socket.write(JSON.stringify(messageObject))
            socket.write("\n")
        })

        socket.once("data", (data) => {
            const response = data.toString().trim()
            try {
                const parsedResponse = JSON.parse(response)
                resolve(parsedResponse)
            } catch (e) {
                reject(new Error(`Error parseando respuesta del servidor: ${response}`))
            }
            socket.end()
        })

        socket.on("error", (err) => {
            reject(err)
            socket.destroy()
        })

        socket.setTimeout(10000, () => {
            socket.destroy(new Error("Timeout al esperar respuesta del servidor TCP"))
        })
    })
}

// --- Funciones de delegación ---

// Función para login
const login = (username) => {
    const request = {
        action: "LOGIN",
        data: {
            username: username,
        },
    }
    return sendTcpMessage(request)
}

// Función para logout
const logout = (username) => {
    const request = {
        action: "LOGOUT",
        data: {
            username: username,
        },
    }
    return sendTcpMessage(request)
}

const getActiveUsers = (username) => {
    const request = {
        action: "GET_ACTIVE_USERS",
        data: {
            username: username, // Para tracking, pero no hace login
        },
    }
    return sendTcpMessage(request)
}

const getAvailableGroups = (username) => {
    const request = {
        action: "GET_AVAILABLE_GROUPS",
        data: {
            username: username,
        },
    }
    return sendTcpMessage(request)
}

const createGroup = (groupName, creatorUsername) => {
    const request = {
        action: "CREATE_GROUP",
        data: {
            groupName: groupName,
            creatorUsername: creatorUsername,
        },
    }
    return sendTcpMessage(request)
}

const joinGroup = (groupName, username) => {
    const request = {
        action: "JOIN_GROUP",
        data: {
            groupName: groupName,
            username: username,
        },
    }
    return sendTcpMessage(request)
}

const sendMessageToGroup = (groupName, sender, message) => {
    const request = {
        action: "SEND_MESSAGE_TO_GROUP",
        data: {
            groupName: groupName,
            sender: sender,
            message: message,
        },
    }
    return sendTcpMessage(request)
}

const sendPrivateMessage = (fromUser, toUser, message) => {
    const request = {
        action: "SEND_PRIVATE_MESSAGE",
        data: {
            fromUser: fromUser,
            toUser: toUser,
            message: message,
        },
    }
    return sendTcpMessage(request)
}

const sendAudioToGroup = (groupName, sender, audioFileName, audioDataBuffer) => {
    const audioDataBase64 = audioDataBuffer.toString("base64")
    const request = {
        action: "SEND_AUDIO_TO_GROUP",
        data: {
            groupName: groupName,
            sender: sender,
            audioFileName: audioFileName,
            audioData: audioDataBase64,
        },
    }
    return sendTcpMessage(request)
}

const sendAudioToPrivate = (fromUser, toUser, audioFileName, audioDataBuffer) => {
    const audioDataBase64 = audioDataBuffer.toString("base64")
    const request = {
        action: "SEND_AUDIO_TO_PRIVATE",
        data: {
            fromUser: fromUser,
            toUser: toUser,
            audioFileName: audioFileName,
            audioData: audioDataBase64,
        },
    }
    return sendTcpMessage(request)
}

// Funciones para obtener historial
const getPrivateHistory = (user1, user2, requestingUser) => {
    const request = {
        action: "GET_PRIVATE_HISTORY",
        data: {
            user1: user1,
            user2: user2,
            requestingUser: requestingUser,
        },
    }
    return sendTcpMessage(request)
}

const getGroupHistory = (groupName, requestingUser) => {
    const request = {
        action: "GET_GROUP_HISTORY",
        data: {
            groupName: groupName,
            requestingUser: requestingUser,
        },
    }
    return sendTcpMessage(request)
}

// Exportar las funciones
module.exports = {
    login,
    logout,
    getActiveUsers,
    getAvailableGroups,
    createGroup,
    joinGroup,
    sendMessageToGroup,
    sendPrivateMessage,
    sendAudioToGroup,
    sendAudioToPrivate,
    getPrivateHistory,
    getGroupHistory,
}
