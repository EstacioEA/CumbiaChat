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

const audiosDir = path.join(__dirname, "audios")
if (!fs.existsSync(audiosDir)) fs.mkdirSync(audiosDir)
app.use("/audios", express.static(audiosDir))

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

// Mapa global de username -> socket
const userSockets = new Map()

class ChatCallbackI extends CumbiaChat.ChatCallback {
  constructor(username) {
    super()
    this.username = username
  }

  receiveMessage(msg, groupName, current) {
    console.log(`[JAVA -> NODE] Mensaje para ${this.username}: ${msg.type} en ${groupName} de ${msg.sender}`)

    const socket = userSockets.get(this.username)

    if (socket && socket.connected) {
      socket.emit("receive_message", {
        sender: msg.sender,
        content: msg.content,
        type: msg.type,
        date: msg.date,
        groupName: groupName,
      })
      console.log(`[JAVA -> NODE] Emitido OK a ${this.username}`)
    } else {
      console.log(`[JAVA -> NODE] Socket de ${this.username} no disponible`)
    }
  }
}

async function broadcastUsersList() {
  try {
    const users = await chatServicePrx.getConnectedUsers()
    io.emit("users_list", users)
    console.log("[BROADCAST] Lista de usuarios:", users)
  } catch (e) {
    console.error("Error obteniendo usuarios:", e.message)
  }
}

async function initIce() {
  try {
    const initData = new Ice.InitializationData()
    initData.properties = Ice.createProperties()
    initData.properties.setProperty("Ice.ACM.Client", "0")
    initData.properties.setProperty("Ice.RetryIntervals", "-1")

    communicator = Ice.initialize(process.argv, initData)

    const baseProxy = communicator.stringToProxy("ChatService:default -p 10000")
    chatServicePrx = await CumbiaChat.ChatServicePrx.checkedCast(baseProxy)
    if (!chatServicePrx) throw Error("Invalid Proxy")

    console.log(">>> CONECTADO AL BACKEND JAVA (ICE RPC)")

    try {
      await chatServicePrx.createGroup("general", "system")
      console.log(">>> Grupo 'general' creado automaticamente")
    } catch (e) {
      console.log(">>> Grupo 'general' ya existe")
    }

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
  let myUsername = null

  socket.on("login", async (data) => {
    if (myUsername === data.username) {
      console.log(`[WS] Login duplicado ignorado para: ${data.username}`)
      socket.emit("login_response", { success: true, username: data.username })
      return
    }

    console.log(`[WS] Login intento: ${data.username}`)
    let servantAdded = false

    try {
      await chatServicePrx.ice_ping()
      console.log("   Ping OK")

      const connection = await chatServicePrx.ice_getConnection()
      if (!connection) throw new Error("Conexion TCP nula")
      console.log("   Conexion TCP obtenida")

      connection.setAdapter(adapter)
      console.log("   Adaptador vinculado")

      myIdentity = new Ice.Identity(data.username, "user")

      try {
        adapter.remove(myIdentity)
        console.log("   Servant anterior removido")
      } catch (e) {}

      const servant = new ChatCallbackI(data.username)
      adapter.add(servant, myIdentity)
      servantAdded = true
      console.log("   Servant registrado localmente")

      const directProxy = adapter.createDirectProxy(myIdentity)
      const cbProxy = CumbiaChat.ChatCallbackPrx.uncheckedCast(directProxy)
      console.log("   Callback proxy creado")

      console.log("   -> Llamando a Java login()...")
      const success = await chatServicePrx.login(data.username, "", cbProxy)
      console.log(`   <- Respuesta Java: ${success}`)

      socket.emit("login_response", { success, username: data.username })

      if (success) {
        myUsername = data.username
        socket.username = data.username

        userSockets.set(data.username, socket)
        console.log(`   Socket registrado para ${data.username}`)

        try {
          await chatServicePrx.joinGroup("general", data.username)
          console.log(`   ${data.username} unido al grupo 'general' en Java`)
        } catch (e) {
          console.log("   Error uniendo a general:", e.message)
        }

        socket.join("general")
        await broadcastUsersList()
      } else {
        if (servantAdded && myIdentity) {
          try {
            adapter.remove(myIdentity)
          } catch (x) {}
        }
        myIdentity = null
      }
    } catch (e) {
      console.error("ERROR LOGIN DETALLADO:", e)
      if (servantAdded && myIdentity) {
        try {
          adapter.remove(myIdentity)
        } catch (x) {}
      }
      myIdentity = null
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
    } catch (e) {
      console.error("Error enviando mensaje:", e.message)
    }
  })

  socket.on("get_groups", async () => {
    try {
      socket.emit("groups_list", await chatServicePrx.getGroups())
    } catch (e) {}
  })

  socket.on("get_users", async () => {
    try {
      const users = await chatServicePrx.getConnectedUsers()
      socket.emit("users_list", users)
    } catch (e) {
      console.error("Error obteniendo usuarios:", e.message)
    }
  })

  socket.on("disconnect", async () => {
    console.log(`[WS] Desconexion: ${myUsername || socket.id}`)

    if (myUsername) {
      if (userSockets.get(myUsername) === socket) {
        userSockets.delete(myUsername)
        console.log(`   Socket removido del mapa para ${myUsername}`)
      }

      try {
        await chatServicePrx.logout(myUsername)
        console.log(`   Logout en Java para ${myUsername}`)
      } catch (e) {
        console.error("   Error en logout Java:", e.message)
      }
    }

    if (myIdentity) {
      try {
        adapter.remove(myIdentity)
        console.log(`   Servant removido para ${myIdentity.name}`)
      } catch (e) {}
    }

    await broadcastUsersList()
  })

  socket.on("call_request", (data) => {
    console.log(`[CALL] ${data.from} quiere llamar a ${data.to}`)
    const targetSocket = userSockets.get(data.to)
    if (targetSocket && targetSocket.connected) {
      targetSocket.emit("incoming_call", { from: data.from, offer: data.offer })
      console.log(`[CALL] Offer enviada a ${data.to}`)
    } else {
      socket.emit("call_failed", { reason: "Usuario no disponible" })
    }
  })

  socket.on("call_accept", (data) => {
    console.log(`[CALL] ${data.from} acepto la llamada de ${data.to}`)
    const targetSocket = userSockets.get(data.to)
    if (targetSocket && targetSocket.connected) {
      targetSocket.emit("call_accepted", { from: data.from, answer: data.answer })
    }
  })

  socket.on("call_reject", (data) => {
    console.log(`[CALL] ${data.from} rechazo la llamada de ${data.to}`)
    const targetSocket = userSockets.get(data.to)
    if (targetSocket && targetSocket.connected) {
      targetSocket.emit("call_rejected", { from: data.from })
    }
  })

  socket.on("ice_candidate", (data) => {
    const targetSocket = userSockets.get(data.to)
    if (targetSocket && targetSocket.connected) {
      targetSocket.emit("ice_candidate", { from: data.from, candidate: data.candidate })
    }
  })

  socket.on("call_end", (data) => {
    console.log(`[CALL] ${data.from} termino la llamada con ${data.to}`)
    const targetSocket = userSockets.get(data.to)
    if (targetSocket && targetSocket.connected) {
      targetSocket.emit("call_ended", { from: data.from })
    }
  })
})

app.post("/api/messages/group/audio", upload.single("audio"), async (req, res) => {
  console.log("[AUDIO] Peticion recibida")
  console.log("[AUDIO] File:", req.file ? req.file.filename : "null")
  console.log("[AUDIO] Body:", req.body)

  if (!req.file) {
    console.log("[AUDIO] ERROR: No file")
    return res.status(400).json({ error: "No file" })
  }

  try {
    const buf = fs.readFileSync(req.file.path)
    console.log("[AUDIO] Buffer size:", buf.length)

    const fileName = `${req.body.sender}_${Date.now()}.webm`
    const audioPath = path.join(audiosDir, fileName)
    fs.writeFileSync(audioPath, buf)
    console.log("[AUDIO] Archivo guardado en:", audioPath)

    // Eliminar archivo temporal
    fs.unlinkSync(req.file.path)

    const audioUrl = `/audios/${fileName}`
    await chatServicePrx.sendMessage(audioUrl, req.body.sender, req.body.groupName, "AUDIO")
    console.log("[AUDIO] Mensaje AUDIO enviado a Java con URL:", audioUrl)

    res.json({ message: "OK", audioUrl })
  } catch (e) {
    console.error("[AUDIO] ERROR:", e)
    res.status(500).json({ error: e.message })
  }
})

app.post("/api/auth/login", async (req, res) => {
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

app.post("/api/groups", async (req, res) => {
  try {
    await chatServicePrx.createGroup(req.body.groupName, req.body.creatorUsername)
    res.json({ status: "success" })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

initIce().then(() => {
  server.listen(PORT, () => console.log(`>>> Servidor Node corriendo en ${PORT}`))
})
