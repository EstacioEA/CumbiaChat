const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const Ice = require("ice").Ice;
const fs = require('fs');

const CumbiaChat = require("./CumbiaChat").CumbiaChat;

const app = express();
const PORT = 5000;

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(cors());
app.use(express.static("../cumbia_chat_web")); 

// --- MULTER ---
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'temp_uploads/';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: audioStorage });

// --- ICE ---
let communicator;
let chatServicePrx;
let adapter;

class ChatCallbackI extends CumbiaChat.ChatCallback {
    receiveMessage(msg, groupName, current) {
        console.log(`[JAVA -> NODE] Recibido: ${msg.type} de ${msg.sender}`);
        io.to(groupName).emit("receive_message", {
            sender: msg.sender, content: msg.content,
            type: msg.type, date: msg.date, groupName: groupName
        });
    }
}

async function initIce() {
    try {
        communicator = Ice.initialize();
        const baseProxy = communicator.stringToProxy("ChatService:default -p 10000");
        chatServicePrx = await CumbiaChat.ChatServicePrx.checkedCast(baseProxy);
        if (!chatServicePrx) throw Error("Invalid Proxy");
        console.log(">>> CONECTADO AL BACKEND JAVA (ICE RPC)");

        // Adaptador sin puertos (Router nulo)
        adapter = await communicator.createObjectAdapterWithRouter("", null);
        adapter.activate();
    } catch (e) {
        console.error("CRITICAL ICE ERROR:", e);
        process.exit(1);
    }
}

// --- SOCKET.IO ---
io.on("connection", (socket) => {
    console.log("Web conectada:", socket.id);
    let myIdentity = null;

    socket.on("login", async (data) => {
        console.log(`[WS] Login: ${data.username}`);
        try {
            // 1. Asegurar conexión con Java
            await chatServicePrx.ice_ping();
            const connection = chatServicePrx.ice_getConnection();
            if (!connection) throw new Error("Sin conexión a Java");

            // 2. IMPORTANTE: Asociar adaptador a la conexión
            // Esto permite que Java nos llame de vuelta por el mismo cable
            connection.setAdapter(adapter);

            // 3. Crear Identidad y Proxy
            myIdentity = new Ice.Identity(data.username, "user");
            const servant = new ChatCallbackI();
            await adapter.add(servant, myIdentity);

            // 4. Crear el Proxy "Fixed" (atado a la conexión)
            // Usamos la sintaxis más compatible: createProxy -> ice_fixed
            const basePrx = adapter.createProxy(myIdentity);
            const fixedPrx = basePrx.ice_fixed(connection);
            const cbPrx = await CumbiaChat.ChatCallbackPrx.uncheckedCast(fixedPrx);

            // 5. Login
            const success = await chatServicePrx.login(data.username, "", cbPrx);
            
            socket.emit("login_response", { success, username: data.username });
            if(success) {
                socket.username = data.username;
                socket.join("general");
            }
        } catch (e) {
            console.error("Login Error:", e);
            socket.emit("login_response", { success: false, message: e.message || "Error interno Ice" });
        }
    });

    socket.on("join_group", async (d) => {
        try { await chatServicePrx.joinGroup(d.groupName, d.username); socket.join(d.groupName); } 
        catch(e) { console.error(e); }
    });

    socket.on("send_message", async (d) => {
        try { await chatServicePrx.sendMessage(d.content, d.sender, d.groupName, d.type||"TEXT"); } 
        catch(e) { console.error(e); }
    });

    socket.on("get_groups", async () => {
        try { socket.emit("groups_list", await chatServicePrx.getGroups()); } catch(e){}
    });

    socket.on("disconnect", async () => {
        if (myIdentity) try { await adapter.remove(myIdentity); } catch(e){}
    });
});

// --- AUDIO ---
app.post("/api/messages/group/audio", upload.single('audio'), async (req, res) => {
    if(!req.file) return res.status(400).json({error:'No file'});
    try {
        const buf = fs.readFileSync(req.file.path);
        const iceData = new Int8Array(buf);
        await chatServicePrx.sendAudio(iceData, req.body.sender, req.body.groupName, ".webm");
        fs.unlinkSync(req.file.path);
        res.json({message:"Audio enviado"});
    } catch(e) { res.status(500).json({error:e.message}); }
});

// Init
initIce().then(() => {
    server.listen(PORT, () => console.log(`>>> Node corriendo en ${PORT}`));
});