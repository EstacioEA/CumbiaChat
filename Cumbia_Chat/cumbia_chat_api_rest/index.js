const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cumbiaChatDelegate = require('./services/cumbiaChatDelegateService');
const iceDelegate = require('./services/iceDelegate');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuracion de multer para subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'temp_uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// ========== ENDPOINTS DE AUTENTICACION ==========

app.post('/api/auth/register', async (req, res) => {
    const { username } = req.body;
    console.log('Registrando usuario:', username);

    try {
        const response = await cumbiaChatDelegate.login(username);
        res.status(200).json(response);
    } catch (error) {
        console.error('Error en POST /api/auth/register:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/logout', async (req, res) => {
    const { username } = req.body;
    console.log('Cerrando sesion:', username);

    try {
        const response = await cumbiaChatDelegate.logout(username);
        res.status(200).json(response);
    } catch (error) {
        console.error('Error en POST /api/auth/logout:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ENDPOINTS DE USUARIOS Y GRUPOS ==========

app.get('/api/users/active', async (req, res) => {
    const { username } = req.query;
    console.log('Obteniendo usuarios activos para:', username);

    try {
        const response = await cumbiaChatDelegate.getActiveUsers(username);
        res.status(200).json(response);
    } catch (error) {
        console.error('Error en GET /api/users/active:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/groups/available', async (req, res) => {
    const { username } = req.query;
    console.log('Obteniendo grupos disponibles para:', username);

    try {
        const response = await cumbiaChatDelegate.getAvailableGroups(username);
        res.status(200).json(response);
    } catch (error) {
        console.error('Error en GET /api/groups/available:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/groups/create', async (req, res) => {
    const { groupName, creator } = req.body;
    console.log('Creando grupo:', groupName, 'creador:', creator);

    try {
        const response = await cumbiaChatDelegate.createGroup(groupName, creator);
        res.status(200).json(response);
    } catch (error) {
        console.error('Error en POST /api/groups/create:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/groups/join', async (req, res) => {
    const { groupName, username } = req.body;
    console.log('Usuario', username, 'uniendose al grupo:', groupName);

    try {
        const response = await cumbiaChatDelegate.joinGroup(groupName, username);
        res.status(200).json(response);
    } catch (error) {
        console.error('Error en POST /api/groups/join:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ENDPOINTS DE MENSAJES ==========

app.post('/api/messages/private', async (req, res) => {
    const { fromUser, toUser, message } = req.body;
    console.log('Mensaje privado:', fromUser, '->', toUser);

    try {
        const response = await cumbiaChatDelegate.sendPrivateMessage(fromUser, toUser, message);
        res.status(200).json(response);
    } catch (error) {
        console.error('Error en POST /api/messages/private:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/messages/group', async (req, res) => {
    const { groupName, sender, message } = req.body;
    console.log('Mensaje a grupo:', sender, '->', groupName);

    try {
        const response = await cumbiaChatDelegate.sendMessageToGroup(groupName, sender, message);
        res.status(200).json(response);
    } catch (error) {
        console.error('Error en POST /api/messages/group:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ENDPOINTS DE HISTORIAL ==========

app.get('/api/history/private', async (req, res) => {
    const { user1, user2, requester } = req.query;
    console.log('Obteniendo historial privado:', user1, '<->', user2);

    try {
        const response = await cumbiaChatDelegate.getPrivateHistory(user1, user2, requester);
        res.status(200).json(response);
    } catch (error) {
        console.error('Error en GET /api/history/private:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/history/group', async (req, res) => {
    const { groupName, requester } = req.query;
    console.log('Obteniendo historial de grupo:', groupName);

    try {
        const response = await cumbiaChatDelegate.getGroupHistory(groupName, requester);
        res.status(200).json(response);
    } catch (error) {
        console.error('Error en GET /api/history/group:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========== ENDPOINTS ICE PARA LLAMADAS ==========

app.post('/api/calls/start', async (req, res) => {
    const { fromUser, toUser } = req.body;
    console.log('[Ice] Iniciando llamada:', fromUser, '->', toUser);

    if (!fromUser || !toUser) {
        return res.status(400).json({ 
            status: 'error',
            error: 'fromUser y toUser son requeridos' 
        });
    }

    try {
        const response = await iceDelegate.startCall(fromUser, toUser);
        res.status(200).json(response);
    } catch (error) {
        console.error('[Ice] Error en POST /api/calls/start:', error);
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

app.post('/api/calls/accept', async (req, res) => {
    const { fromUser, toUser } = req.body;
    console.log('[Ice] Aceptando llamada:', fromUser, '<-', toUser);

    try {
        const response = await iceDelegate.acceptCall(fromUser, toUser);
        res.status(200).json(response);
    } catch (error) {
        console.error('[Ice] Error en POST /api/calls/accept:', error);
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

app.post('/api/calls/reject', async (req, res) => {
    const { fromUser, toUser } = req.body;
    console.log('[Ice] Rechazando llamada:', fromUser, '<-', toUser);

    try {
        const response = await iceDelegate.rejectCall(fromUser, toUser);
        res.status(200).json(response);
    } catch (error) {
        console.error('[Ice] Error en POST /api/calls/reject:', error);
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

app.post('/api/calls/end', async (req, res) => {
    const { fromUser, toUser } = req.body;
    console.log('[Ice] Finalizando llamada:', fromUser, '<->', toUser);

    try {
        const response = await iceDelegate.endCall(fromUser, toUser);
        res.status(200).json(response);
    } catch (error) {
        console.error('[Ice] Error en POST /api/calls/end:', error);
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

// ========== ENDPOINTS PARA MENSAJES DE AUDIO ==========

app.post('/api/messages/private/audio', upload.single('audio'), async (req, res) => {
    const { fromUser, toUser } = req.body;
    console.log('[Audio] Enviando audio privado:', fromUser, '->', toUser);

    if (!req.file) {
        return res.status(400).json({ 
            status: 'error',
            error: 'No se recibio archivo de audio' 
        });
    }

    try {
        const audioBuffer = fs.readFileSync(req.file.path);
        const response = await iceDelegate.sendAudioMessage(fromUser, toUser, audioBuffer);
        
        // Limpiar archivo temporal
        fs.unlinkSync(req.file.path);
        
        res.status(200).json(response);
    } catch (error) {
        console.error('[Audio] Error en POST /api/messages/private/audio:', error);
        
        // Limpiar archivo temporal en caso de error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

// Nuevo endpoint para consultar llamadas pendientes
app.get('/api/calls/pending', async (req, res) => {
    const { username } = req.query;
    console.log('[Ice] Consultando llamadas pendientes para:', username);

    if (!username) {
        return res.status(400).json({ 
            error: 'username es requerido' 
        });
    }

    try {
        const calls = await iceDelegate.getPendingCalls(username);
        res.status(200).json({ 
            pendingCalls: calls || []
        });
    } catch (error) {
        console.error('[Ice] Error en GET /api/calls/pending:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/calls/clear-pending', async (req, res) => {
    const { username, fromUser } = req.body;
    console.log('[Ice] Limpiando llamada pendiente:', fromUser, '->', username);

    try {
        await iceDelegate.clearPendingCall(username, fromUser);
        res.status(200).json({ status: 'success' });
    } catch (error) {
        console.error('[Ice] Error en POST /api/calls/clear-pending:', error);
        res.status(500).json({ error: error.message });
    }
});


app.post('/api/messages/group/audio', upload.single('audio'), async (req, res) => {
    const { sender, groupName } = req.body;
    console.log('[Audio] Enviando audio a grupo:', sender, '->', groupName);

    if (!req.file) {
        return res.status(400).json({ 
            status: 'error',
            error: 'No se recibio archivo de audio' 
        });
    }

    try {
        const audioBuffer = fs.readFileSync(req.file.path);
        const response = await iceDelegate.sendAudioMessageToGroup(sender, groupName, audioBuffer);
        
        // Limpiar archivo temporal
        fs.unlinkSync(req.file.path);
        
        res.status(200).json(response);
    } catch (error) {
        console.error('[Audio] Error en POST /api/messages/group/audio:', error);
        
        // Limpiar archivo temporal en caso de error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

// Manejar cierre limpio
process.on('SIGINT', async () => {
    console.log('\n[Server] Cerrando proxy...');
    if (iceDelegate.shutdown) {
        await iceDelegate.shutdown();
    }
    process.exit(0);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`[Server] Servidor API REST CumbiaChat iniciado en http://localhost:${PORT}`);
});
