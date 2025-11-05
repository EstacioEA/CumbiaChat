const express = require('express');
const cors = require('cors');
const multer = require('multer'); // <-- Importar multer
const path = require('path'); // <-- Importar path para manejar extensiones
const {
    login,
    getActiveUsers,
    getAvailableGroups,
    createGroup,
    joinGroup,
    sendMessageToGroup,
    sendPrivateMessage,
    sendAudioToGroup, // <-- Importar la nueva función
    sendAudioToPrivate, // <-- Importar la nueva función
    // ... importar más funciones según necesites
} = require("./services/cumbiaChatDelegateService");

const app = express();
const PORT = 5000;

app.use(express.json());
app.use(cors());

// Configuración de Multer para manejar archivos de audio (limitar tamaño si es necesario)
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Opcional: crear carpeta temporal si no existe
        cb(null, 'temp_uploads/'); // Asegúrate de crear esta carpeta o usar memoria
    },
    filename: (req, file, cb) => {
        // Generar un nombre único para evitar colisiones
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        // Mantener la extensión original del archivo
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtro para permitir solo archivos de audio (opcional)
const audioFileFilter = (req, file, cb) => {
    // Aceptar solo archivos con tipo MIME de audio
    if (file.mimetype.startsWith('audio/')) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos de audio.'), false);
    }
};

const upload = multer({
    storage: audioStorage,
    fileFilter: audioFileFilter,
    // Puedes limitar el tamaño aquí si es necesario, por ejemplo: limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});


// --- Definir Rutas de la API REST ---

// Ruta para login
app.post("/api/auth/login", async (req, res) => {
    const { username } = req.body;
    console.log("Intento de login:", { username });

    if (!username) {
        return res.status(400).json({ error: "Nombre de usuario es requerido." });
    }

    try {
        const response = await login(username);
        if(response.status === 'success') {
            res.status(200).json({ status: 'success', message: response.message, user: username });
        } else {
            res.status(401).json({ status: 'error', message: response.message || 'Error de autenticación' });
        }
    } catch (error) {
        console.error("Error en POST /api/auth/login:", error);
        res.status(500).json({ error: error.message });
    }
});

// Rutas que requieren un usuario logueado (simulado)
app.get("/api/users", async (req, res) => {
    const loggedInUser = req.query.user || req.body.user || 'TestUser';
    console.log("Obteniendo usuarios activos para:", loggedInUser);

    try {
        const response = await getActiveUsers(loggedInUser);
        if(response.status === 'success') {
            res.status(200).json(response.data);
        } else {
            res.status(500).json({ error: response.message || 'Error obteniendo usuarios' });
        }
    } catch (error) {
        console.error("Error en GET /api/users:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/groups", async (req, res) => {
    const loggedInUser = req.query.user || req.body.user || 'TestUser';
    console.log("Obteniendo grupos disponibles para:", loggedInUser);

    try {
        const response = await getAvailableGroups(loggedInUser);
        if(response.status === 'success') {
            res.status(200).json(response.data);
        } else {
            res.status(500).json({ error: response.message || 'Error obteniendo grupos' });
        }
    } catch (error) {
        console.error("Error en GET /api/groups:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/groups", async (req, res) => {
    const { groupName, creatorUsername } = req.body;
    console.log("Creando grupo:", { groupName, creatorUsername });

    try {
        const response = await createGroup(groupName, creatorUsername);
        if(response.status === 'success') {
            res.status(200).json({ message: response.message || "Grupo creado exitosamente." });
        } else {
            res.status(400).json({ error: response.message || 'Error creando grupo' });
        }
    } catch (error) {
        console.error("Error en POST /api/groups:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/groups/join", async (req, res) => {
    const { groupName, username } = req.body;
    console.log("Uniéndose a grupo:", { groupName, username });

    try {
        const response = await joinGroup(groupName, username);
        if(response.status === 'success') {
            res.status(200).json({ message: response.message || "Usuario se unió al grupo." });
        } else {
            res.status(400).json({ error: response.message || 'Error uniéndose al grupo' });
        }
    } catch (error) {
        console.error("Error en POST /api/groups/join:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/messages/group", async (req, res) => {
    const { groupName, sender, message } = req.body;
    console.log("Enviando mensaje a grupo:", { groupName, sender, message });

    try {
        const response = await sendMessageToGroup(groupName, sender, message);
        if(response.status === 'success') {
            res.status(200).json({ message: response.message || "Mensaje enviado." });
        } else {
            res.status(400).json({ error: response.message || 'Error enviando mensaje' });
        }
    } catch (error) {
        console.error("Error en POST /api/messages/group:", error);
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/messages/private", async (req, res) => {
    const { fromUser, toUser, message } = req.body;
    console.log("Enviando mensaje privado:", { fromUser, toUser, message });

    try {
        const response = await sendPrivateMessage(fromUser, toUser, message);
        if(response.status === 'success') {
            res.status(200).json({ message: response.message || "Mensaje privado enviado." });
        } else {
            res.status(400).json({ error: response.message || 'Error enviando mensaje privado' });
        }
    } catch (error) {
        console.error("Error en POST /api/messages/private:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- Nuevos endpoints para audio ---

// Endpoint para enviar audio a un grupo
// Se espera que el frontend envíe:
// - Campo 'groupName' (string) en el body
// - Campo 'sender' (string) en el body (debe coincidir con el usuario logueado)
// - Archivo de audio en el campo 'audio' (usando multipart/form-data)
app.post("/api/messages/group/audio", upload.single('audio'), async (req, res) => {
    // req.file contiene la información del archivo subido
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo de audio.' });
    }

    const { groupName, sender } = req.body; // Datos del formulario
    console.log("Enviando audio a grupo:", { groupName, sender, fileName: req.file.originalname, path: req.file.path });

    // Validar campos requeridos
    if (!groupName || !sender) {
        return res.status(400).json({ error: "Nombre del grupo y nombre del remitente son requeridos." });
    }

    // Validar que el emisor sea el usuario logueado (simulado aquí)
    // if(sender !== loggedInUserFromToken) { return res.status(403).json({...}) }

    try {
        // Leer el archivo subido como buffer
        const fs = require('fs');
        const audioBuffer = fs.readFileSync(req.file.path); // Lee el archivo desde la ubicación temporal
        const audioFileName = req.file.originalname; // Usa el nombre original o el generado por multer

        const response = await sendAudioToGroup(groupName, sender, audioFileName, audioBuffer);

        // Opcional: Eliminar el archivo temporal después de enviarlo
        fs.unlinkSync(req.file.path);

        if(response.status === 'success') {
            res.status(200).json({ message: response.message || "Audio enviado al grupo." });
        } else {
            res.status(400).json({ error: response.message || 'Error enviando audio al grupo' });
        }
    } catch (error) {
        console.error("Error en POST /api/messages/group/audio:", error);
        // Opcional: Eliminar el archivo temporal si ocurre un error
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (unlinkErr) { console.error("Error eliminando archivo temporal:", unlinkErr); }
        }
        res.status(500).json({ error: error.message });
    }
});


// Endpoint para enviar audio en mensaje privado
// Se espera que el frontend envíe:
// - Campo 'toUser' (string) en el body
// - Campo 'fromUser' (string) en el body (debe coincidir con el usuario logueado)
// - Archivo de audio en el campo 'audio' (usando multipart/form-data)
app.post("/api/messages/private/audio", upload.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo de audio.' });
    }

    const { toUser, fromUser } = req.body; // Datos del formulario
    console.log("Enviando audio privado:", { toUser, fromUser, fileName: req.file.originalname, path: req.file.path });

    if (!toUser || !fromUser) {
        return res.status(400).json({ error: "Nombre del destinatario y nombre del remitente son requeridos." });
    }

    // Validar que el emisor sea el usuario logueado (simulado aquí)
    // if(fromUser !== loggedInUserFromToken) { return res.status(403).json({...}) }

    try {
        const fs = require('fs');
        const audioBuffer = fs.readFileSync(req.file.path);
        const audioFileName = req.file.originalname;

        const response = await sendAudioToPrivate(fromUser, toUser, audioFileName, audioBuffer);

        fs.unlinkSync(req.file.path); // Eliminar temporal

        if(response.status === 'success') {
            res.status(200).json({ message: response.message || "Audio enviado en mensaje privado." });
        } else {
            res.status(400).json({ error: response.message || 'Error enviando audio privado' });
        }
    } catch (error) {
        console.error("Error en POST /api/messages/private/audio:", error);
        if (req.file && req.file.path) {
            try { fs.unlinkSync(req.file.path); } catch (unlinkErr) { console.error("Error eliminando archivo temporal:", unlinkErr); }
        }
        res.status(500).json({ error: error.message });
    }
});


// ... más rutas según necesites

app.listen(PORT, () => {
    console.log(`Servidor API REST CumbiaChat iniciado en http://localhost:${PORT}`);
});