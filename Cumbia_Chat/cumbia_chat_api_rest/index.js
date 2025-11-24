const express = require("express")
const cors = require("cors")
const multer = require("multer")
const path = require("path")
const http = require("http")
const { Server } = require("socket.io")
const Ice = require("ice").Ice
const fs = require("fs")

const CumbiaChat = require("./CumbiaChat").CumbiaChat

const app = express()
const PORT = 5000

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: "*" } })

app.use(express.json())
app.use(cors())
app.use(express.static("../cumbia_chat_web"))

// --- MULTER ---
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "temp_uploads/"
    if (!fs.existsSync(dir)) fs.mkdirSync(dir)
    cb(null, dir)
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname))
  },
})
const upload = multer({ storage: audioStorage })

// --- ICE GLOBALS ---
let communicator
let chatServicePrx
let adapter

class ChatCallbackI extends CumbiaChat.ChatCallback {
  receiveMessage(msg, groupName, current) {
    console.log(`[JAVA -> NODE] Mensaje: ${msg.type} en ${groupName} de ${msg.sender}`)
    io.to(groupName).emit("receive_message", {
      sender: msg.sender,
      content: msg.content,
      type: msg.type,
      date: msg.date,
      groupName: groupName,
    })
  }
}

async function initIce() {
  try {
    const initData = new Ice.InitializationData()
    initData.properties = Ice.createProperties()
    // Propiedades vitales para mantener la conexión viva
    initData.properties.setProperty("Ice.ACM.Client", "0")
    initData.properties.setProperty("Ice.RetryIntervals", "-1")

    communicator = Ice.initialize(process.argv, initData)

    const baseProxy = communicator.stringToProxy("ChatService:default -p 10000")
    chatServicePrx = await CumbiaChat.ChatServicePrx.checkedCast(baseProxy)
    if (!chatServicePrx) throw Error("Invalid Proxy")

    console.log(">>> CONECTADO AL BACKEND JAVA (ICE RPC)")

    // Adaptador Anónimo
    adapter = await communicator.createObjectAdapter("")
    adapter.activate()
    console.log(">>> Adaptador de callbacks activado")
  } catch (e) {
    console.error("CRITICAL ICE ERROR:", e)
    process.exit(1)
  }
}

io.on("connection", (socket) => {
  console.log("Cliente Web:", socket.id)
  let myIdentity = null

  socket.on("login", async (data) => {
    console.log(`[WS] Login intento: ${data.username}`)
    try {
      // 1. Ping para asegurar conexión TCP
      console.log("   1. Enviando Ping a Java...")
      await chatServicePrx.ice_ping()
      console.log("   ✓ Ping OK")

      // 2. Obtener conexión
      const connection = await chatServicePrx.ice_getConnection()
      if (!connection) throw new Error("Conexión TCP nula")
      console.log("   ✓ Conexión TCP obtenida")

      // 3. Vincular adaptador (Permite tráfico de vuelta)
      connection.setAdapter(adapter)
      console.log("   ✓ Adaptador vinculado")

      // 4. Crear Identidad y Servant
      myIdentity = new Ice.Identity(data.username, "user")
      const servant = new ChatCallbackI()
      adapter.add(servant, myIdentity)
      console.log("   ✓ Servant registrado localmente")

      // createDirectProxy crea un proxy que ICE puede serializar
      // connection.setAdapter() ya habilita la comunicación bidireccional
      const directProxy = adapter.createDirectProxy(myIdentity)
      const cbProxy = CumbiaChat.ChatCallbackPrx.uncheckedCast(directProxy)
      console.log("   ✓ Callback proxy creado (bidireccional via setAdapter)")

      // 5. Login en Java
      console.log("   -> Llamando a Java login()...")
      const success = await chatServicePrx.login(data.username, "", cbProxy)
      console.log(`   <- Respuesta Java: ${success}`)

      socket.emit("login_response", { success, username: data.username })
      if (success) {
        socket.username = data.username
        socket.join("general")
      }
    } catch (e) {
      console.error("❌ ERROR LOGIN DETALLADO:", e)
      if (myIdentity)
        try {
          adapter.remove(myIdentity)
        } catch (x) {}
      socket.emit("login_response", { success: false, message: e.message || "Error Ice" })
    }
  })

  socket.on("join_group", async (d) => {
    try {
      await chatServicePrx.joinGroup(d.groupName, d.username)
      socket.join(d.groupName)
    } catch (e) {}
  })
  socket.on("send_message", async (d) => {
    try {
      await chatServicePrx.sendMessage(d.content, d.sender, d.groupName, d.type || "TEXT")
    } catch (e) {}
  })
  socket.on("get_groups", async () => {
    try {
      socket.emit("groups_list", await chatServicePrx.getGroups())
    } catch (e) {}
  })
  socket.on("disconnect", async () => {
    if (myIdentity)
      try {
        adapter.remove(myIdentity)
      } catch (e) {}
  })
})

app.post("/api/messages/group/audio", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file" })
  try {
    const buf = fs.readFileSync(req.file.path)
    const iceData = new Int8Array(buf)
    await chatServicePrx.sendAudio(iceData, req.body.sender, req.body.groupName, ".webm")
    fs.unlinkSync(req.file.path)
    res.json({ message: "OK" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post("/api/auth/login", async (req, res) => {
  // Login REST fallback (sin notificaciones)
  try {
    await chatServicePrx.login(req.body.username, "", null)
    res.json({ status: "success", user: req.body.username })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.get("/api/groups", async (req, res) => {
  try {
    res.json({ status: "success", data: { groups: await chatServicePrx.getGroups() } })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

initIce().then(() => {
  server.listen(PORT, () => console.log(`>>> Servidor Node corriendo en ${PORT}`))
})
