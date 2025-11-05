// services/cumbiaChatDelegateService.js
const net = require('net');

// Constantes
const SERVER_HOST = 'localhost';
const SERVER_PORT = 12345; // El puerto donde escucha tu Server.java

// Función genérica para enviar un mensaje TCP y esperar una respuesta
const sendTcpMessage = (messageObject, username) => {
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();

        socket.connect(SERVER_PORT, SERVER_HOST, () => {
            if (messageObject.action === 'LOGIN') {
                socket.write(JSON.stringify(messageObject));
                socket.write('\n');
            } else {
                const loginMessage = {
                    action: 'LOGIN',
                    data: {
                        username: username
                    }
                };
                socket.write(JSON.stringify(loginMessage));
                socket.write('\n');

                socket.once('data', (data) => {
                    const loginResponse = data.toString().trim();
                    try {
                        const parsedLoginResponse = JSON.parse(loginResponse);
                        if (parsedLoginResponse.status !== 'success') {
                            socket.destroy(new Error(`Error en login: ${parsedLoginResponse.message}`));
                            return;
                        }
                        socket.write(JSON.stringify(messageObject));
                        socket.write('\n');
                    } catch (e) {
                        socket.destroy(new Error(`Error parseando respuesta de login: ${e.message}`));
                        return;
                    }
                });
            }
        });

        socket.once('data', (data) => {
            const response = data.toString().trim();
            try {
                const parsedResponse = JSON.parse(response);
                resolve(parsedResponse);
            } catch (e) {
                reject(new Error(`Error parseando respuesta del servidor: ${response}`));
            }
            socket.end();
        });

        socket.on('error', (err) => {
            reject(err);
            socket.destroy();
        });

        socket.setTimeout(10000, () => {
            socket.destroy(new Error('Timeout al esperar respuesta del servidor TCP'));
        });
    });
};

// --- Funciones de delegación ---

// Función para login (especial, no necesita username en el mensaje, lo recibe como parámetro)
const login = (username) => {
    const request = {
        action: 'LOGIN',
        data: {
            username: username
        }
    };
    // Para login, no necesitamos un username previo, así que pasamos null o '' al helper
    // Mejor lo hacemos directamente aquí:
    return new Promise((resolve, reject) => {
        const socket = new net.Socket();

        socket.connect(SERVER_PORT, SERVER_HOST, () => {
            socket.write(JSON.stringify(request));
            socket.write('\n');
        });

        socket.once('data', (data) => {
            const response = data.toString().trim();
            try {
                const parsedResponse = JSON.parse(response);
                resolve(parsedResponse);
            } catch (e) {
                reject(new Error(`Error parseando respuesta del servidor: ${response}`));
            }
            socket.end();
        });

        socket.on('error', (err) => {
            reject(err);
            socket.destroy();
        });

        socket.setTimeout(10000, () => {
            socket.destroy(new Error('Timeout al esperar respuesta del servidor TCP'));
        });
    });
};

const getActiveUsers = (username) => {
    const request = {
        action: 'GET_ACTIVE_USERS',
        data: {}
    };
    return sendTcpMessage(request, username);
};

const getAvailableGroups = (username) => {
    const request = {
        action: 'GET_AVAILABLE_GROUPS',
        data: {}
    };
    return sendTcpMessage(request, username);
};

const createGroup = (groupName, creatorUsername) => {
    const request = {
        action: 'CREATE_GROUP',
        data: {
            groupName: groupName,
            creatorUsername: creatorUsername
        }
    };
    return sendTcpMessage(request, creatorUsername);
};

const joinGroup = (groupName, username) => {
    const request = {
        action: 'JOIN_GROUP',
        data: {
            groupName: groupName,
            username: username
        }
    };
    return sendTcpMessage(request, username);
};

const sendMessageToGroup = (groupName, sender, message) => {
    const request = {
        action: 'SEND_MESSAGE_TO_GROUP',
        data: {
            groupName: groupName,
            sender: sender,
            message: message
        }
    };
    return sendTcpMessage(request, sender);
};

const sendPrivateMessage = (fromUser, toUser, message) => {
    const request = {
        action: 'SEND_PRIVATE_MESSAGE',
        data: {
            fromUser: fromUser,
            toUser: toUser,
            message: message
        }
    };
    return sendTcpMessage(request, fromUser);
};

// --- Nuevas funciones para audio ---

const sendAudioToGroup = (groupName, sender, audioFileName, audioDataBuffer) => {
    // Convertir el buffer de audio a Base64 para incluirlo en el JSON
    const audioDataBase64 = audioDataBuffer.toString('base64');
    const request = {
        action: 'SEND_AUDIO_TO_GROUP',
        data: {
            groupName: groupName,
            sender: sender,
            audioFileName: audioFileName,
            audioData: audioDataBase64 // Enviar como Base64
        }
    };
    return sendTcpMessage(request, sender);
};

const sendAudioToPrivate = (fromUser, toUser, audioFileName, audioDataBuffer) => {
    // Convertir el buffer de audio a Base64 para incluirlo en el JSON
    const audioDataBase64 = audioDataBuffer.toString('base64');
    const request = {
        action: 'SEND_AUDIO_TO_PRIVATE',
        data: {
            fromUser: fromUser,
            toUser: toUser,
            audioFileName: audioFileName,
            audioData: audioDataBase64 // Enviar como Base64
        }
    };
    return sendTcpMessage(request, fromUser);
};

// Exportar las funciones
module.exports = {
    login,
    getActiveUsers,
    getAvailableGroups,
    createGroup,
    joinGroup,
    sendMessageToGroup,
    sendPrivateMessage,
    sendAudioToGroup,
    sendAudioToPrivate,
};