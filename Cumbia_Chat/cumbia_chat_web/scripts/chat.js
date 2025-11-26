/**
 * Logica principal del chat de CumbiaChat
 * VERSION: Socket.io + Audio (ZeroC Ice) + WebRTC Calls
 */

const io = window.io // Declare the io variable
const socket = io()

// ===== ESTADO =====
const appState = {
  currentUser: null,
  activeChat: null,
  users: [],
  groups: [],
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  isLoggedIn: false,
  chatMessages: {},
  callState: {
    active: false,
    remoteUser: null,
    peerConnection: null,
    localStream: null,
    isCaller: false,
  },
}

// ===== ELEMENTOS DOM =====
const elements = {
  currentUsername: document.getElementById("currentUsername"),
  btnLogout: document.getElementById("btnLogout"),
  tabButtons: document.querySelectorAll(".tab-btn"),
  usersTab: document.getElementById("usersTab"),
  groupsTab: document.getElementById("groupsTab"),
  usersList: document.getElementById("usersList"),
  groupsList: document.getElementById("groupsList"),
  btnRefreshUsers: document.getElementById("btnRefreshUsers"),
  btnCreateGroup: document.getElementById("btnCreateGroup"),
  emptyChat: document.getElementById("emptyChat"),
  chatContainer: document.getElementById("chatContainer"),
  chatName: document.getElementById("chatName"),
  chatStatus: document.getElementById("chatStatus"),
  chatAvatar: document.getElementById("chatAvatar"),
  messagesWrapper: document.getElementById("messagesWrapper"),
  messageInput: document.getElementById("messageInput"),
  messageForm: document.getElementById("messageForm"),
  btnCloseChat: document.getElementById("btnCloseChat"),
  modalCreateGroup: document.getElementById("modalCreateGroup"),
  createGroupForm: document.getElementById("createGroupForm"),
  groupNameInput: document.getElementById("groupName"),
  btnCloseModal: document.getElementById("btnCloseModal"),
  btnCancelGroup: document.getElementById("btnCancelGroup"),
  btnRecord: document.getElementById("btnRecord") || document.getElementById("btnAttach"),
}

// ===== UTILS =====
function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

function formatTime(timestamp) {
  try {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) {
      return new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    }
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  } catch (e) {
    return new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
  }
}

function getRandomEmoji(name) {
  const emojis = ["🎸", "🎺", "🥁", "🎷", "🎻", "🎹", "🪘", "🎤", "🎵", "🎶"]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return emojis[Math.abs(hash) % emojis.length]
}

function clearElement(el) {
  if (el) el.innerHTML = ""
}

function getChatKey(chatName, chatType) {
  return `${chatType}:${chatName}`
}

// ===== SOCKET LISTENERS =====

socket.on("connect", () => {
  console.log("Conectado a Socket.io")
  if (appState.currentUser && !appState.isLoggedIn) {
    doLogin()
  }
})

socket.on("login_response", (data) => {
  console.log("Login response:", data)
  if (data.success) {
    appState.isLoggedIn = true
  }
})

socket.on("receive_message", (data) => {
  console.log("Mensaje recibido:", data)

  let chatKey
  let chatName

  if (data.sender === appState.currentUser) {
    console.log("Ignorando mensaje propio recibido por callback")
    return
  }

  chatKey = `private:${data.sender}`
  chatName = data.sender

  if (appState.groups.includes(data.groupName)) {
    chatKey = `group:${data.groupName}`
    chatName = data.groupName
  }

  if (!appState.chatMessages[chatKey]) {
    appState.chatMessages[chatKey] = []
  }

  const msgData = {
    sender: data.sender,
    content: data.content,
    type: data.type,
    timestamp: Date.now(),
    isOwn: false,
  }

  appState.chatMessages[chatKey].push(msgData)

  const activeChatKey = appState.activeChat ? getChatKey(appState.activeChat.name, appState.activeChat.type) : null

  if (activeChatKey === chatKey) {
    if (data.type === "AUDIO") {
      addAudioMessageToUI(data.sender, data.content, msgData.timestamp, false, true)
    } else {
      addMessageToUI(data.sender, data.content, msgData.timestamp, false, true)
    }
    scrollToBottom()
  } else {
    console.log("Mensaje recibido de otro chat:", chatName)
  }
})

socket.on("groups_list", (groups) => {
  console.log("Lista de grupos recibida:", groups)
  appState.groups = groups || []
  renderGroupsList()
})

socket.on("users_list", (users) => {
  console.log("Lista de usuarios recibida:", users)
  appState.users = (users || []).filter((u) => u !== appState.currentUser)
  renderUsersList()
})

socket.on("incoming_call", async (data) => {
  console.log("[CALL] Llamada entrante de:", data.from)
  showIncomingCallModal(data.from, data.offer)
})

socket.on("call_accepted", async (data) => {
  console.log("[CALL] Llamada aceptada por:", data.from)
  try {
    await appState.callState.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer))
    updateCallUI("connected")
  } catch (e) {
    console.error("[CALL] Error setRemoteDescription:", e)
    endCall()
  }
})

socket.on("call_rejected", (data) => {
  console.log("[CALL] Llamada rechazada por:", data.from)
  alert(`${data.from} rechazo la llamada`)
  endCall()
})

socket.on("ice_candidate", async (data) => {
  if (appState.callState.peerConnection && data.candidate) {
    try {
      await appState.callState.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate))
    } catch (e) {
      console.error("[CALL] Error agregando ICE candidate:", e)
    }
  }
})

socket.on("call_ended", (data) => {
  console.log("[CALL] Llamada terminada por:", data.from)
  endCall()
})

socket.on("call_failed", (data) => {
  alert("Llamada fallida: " + data.reason)
  endCall()
})

// ===== FUNCIONES UI =====

function addMessageToUI(sender, text, timestamp, isOwn, animate = true) {
  const empty = elements.messagesWrapper.querySelector(".empty-state")
  if (empty) empty.remove()

  const messageDiv = document.createElement("div")
  messageDiv.className = `message ${isOwn ? "own" : ""}`
  if (animate) messageDiv.style.animation = "slide-in 0.3s ease"

  const avatar = getRandomEmoji(sender)

  messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${!isOwn ? `<div class="message-sender">${escapeHtml(sender)}</div>` : ""}
            <div class="message-bubble">${escapeHtml(text)}</div>
            <div class="message-time">${formatTime(timestamp)}</div>
        </div>
    `
  elements.messagesWrapper.appendChild(messageDiv)
}

function addAudioMessageToUI(sender, audioUrl, timestamp, isOwn, animate = true) {
  const empty = elements.messagesWrapper.querySelector(".empty-state")
  if (empty) empty.remove()

  const messageDiv = document.createElement("div")
  messageDiv.className = `message ${isOwn ? "own" : ""}`
  if (animate) messageDiv.style.animation = "slide-in 0.3s ease"

  const avatar = getRandomEmoji(sender)

  messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${!isOwn ? `<div class="message-sender">${escapeHtml(sender)}</div>` : ""}
            <div class="message-bubble audio-bubble" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 12px; border-radius: 12px;">
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                    <span style="font-size: 1.5em;">🎤</span>
                    <span style="color: white; font-weight: bold;">Nota de Voz</span>
                </div>
                <audio controls style="width: 100%; max-width: 250px;">
                    <source src="${escapeHtml(audioUrl)}" type="audio/webm">
                    Tu navegador no soporta audio.
                </audio>
            </div>
            <div class="message-time">${formatTime(timestamp)}</div>
        </div>
    `
  elements.messagesWrapper.appendChild(messageDiv)
}

function renderUsersList() {
  clearElement(elements.usersList)
  if (!appState.users || appState.users.length === 0) {
    elements.usersList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">😴</span>
                <p>No hay usuarios conectados</p>
            </div>
        `
    return
  }
  appState.users.forEach((username) => {
    const div = document.createElement("div")
    const isActive = appState.activeChat && appState.activeChat.name === username
    div.className = `list-item ${isActive ? "active" : ""}`
    div.style.cursor = "pointer"
    div.innerHTML = `
            <div class="list-item-avatar">${getRandomEmoji(username)}</div>
            <div class="list-item-info" style="flex: 1;">
                <div class="list-item-name">${escapeHtml(username)}</div>
                <div class="list-item-status online">En linea</div>
            </div>
            <button class="btn-call" title="Llamar a ${escapeHtml(username)}" style="background: #4CAF50; border: none; border-radius: 50%; width: 36px; height: 36px; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: 8px;">
                📞
            </button>
        `
    div.querySelector(".list-item-info").onclick = () => openChat(username, "private")
    div.querySelector(".list-item-avatar").onclick = () => openChat(username, "private")
    div.querySelector(".btn-call").onclick = (e) => {
      e.stopPropagation()
      startCall(username)
    }
    elements.usersList.appendChild(div)
  })
}

function renderGroupsList() {
  clearElement(elements.groupsList)
  if (!appState.groups || appState.groups.length === 0) {
    elements.groupsList.innerHTML = `<div class="empty-state"><p>No hay grupos</p></div>`
    return
  }
  appState.groups.forEach((g) => {
    const div = document.createElement("div")
    const isActive = appState.activeChat && appState.activeChat.name === g
    div.className = `list-item ${isActive ? "active" : ""}`
    div.style.cursor = "pointer"
    div.innerHTML = `<div class="list-item-avatar">🎪</div><div class="list-item-name">${escapeHtml(g)}</div>`
    div.onclick = () => openChat(g, "group")
    elements.groupsList.appendChild(div)
  })
}

function scrollToBottom() {
  const container = document.getElementById("messagesContainer")
  if (container) container.scrollTop = container.scrollHeight
}

function renderChatMessages(chatKey) {
  clearElement(elements.messagesWrapper)

  const messages = appState.chatMessages[chatKey] || []

  if (messages.length === 0) {
    const emptyMsg = document.createElement("div")
    emptyMsg.className = "empty-state"
    emptyMsg.innerHTML = `
            <span class="empty-icon">💬</span>
            <p>Chat con ${escapeHtml(appState.activeChat.name)}</p>
            <small>Envia tu primer mensaje</small>
        `
    elements.messagesWrapper.appendChild(emptyMsg)
    return
  }

  messages.forEach((msg) => {
    if (msg.type === "AUDIO") {
      addAudioMessageToUI(msg.sender, msg.content, msg.timestamp, msg.isOwn, false)
    } else {
      addMessageToUI(msg.sender, msg.content, msg.timestamp, msg.isOwn, false)
    }
  })

  scrollToBottom()
}

// ===== LOGIN =====
function doLogin() {
  if (appState.isLoggedIn) {
    console.log("Ya esta logueado, ignorando login duplicado")
    return
  }

  console.log("Ejecutando login para:", appState.currentUser)
  socket.emit("login", { username: appState.currentUser })
  socket.emit("get_groups")
  socket.emit("get_users")
}

// ===== INICIALIZACION =====
function init() {
  appState.currentUser = localStorage.getItem("cumbiachat_username")
  if (!appState.currentUser) {
    window.location.href = "index.html"
    return
  }

  elements.currentUsername.textContent = appState.currentUser
  setupEventListeners()

  doLogin()

  console.log("CumbiaChat iniciado (WS) -", appState.currentUser)
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  elements.btnLogout.addEventListener("click", handleLogout)

  elements.tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab))
  })

  elements.btnCreateGroup.addEventListener("click", openCreateGroupModal)
  elements.createGroupForm.addEventListener("submit", handleCreateGroup)
  elements.btnCloseModal.addEventListener("click", closeCreateGroupModal)
  elements.btnCancelGroup.addEventListener("click", closeCreateGroupModal)

  elements.messageForm.addEventListener("submit", handleSendMessage)
  elements.btnCloseChat.addEventListener("click", closeChat)
  elements.messageInput.addEventListener("input", autoResizeTextarea)

  if (elements.btnRecord) {
    elements.btnRecord.removeAttribute("disabled")
    elements.btnRecord.innerText = "🎤"
    elements.btnRecord.title = "Grabar nota de voz"
    elements.btnRecord.addEventListener("click", toggleRecording)
  }

  elements.modalCreateGroup.addEventListener("click", (e) => {
    if (e.target === elements.modalCreateGroup) closeCreateGroupModal()
  })

  elements.btnRefreshUsers.addEventListener("click", () => {
    socket.emit("get_groups")
    socket.emit("get_users")
  })
}

// ===== LOGICA AUDIO =====
async function toggleRecording() {
  console.log("[AUDIO] toggleRecording llamado, isRecording:", appState.isRecording)

  if (!appState.activeChat) {
    alert("Abre un chat primero para grabar audio")
    return
  }

  if (!appState.isRecording) {
    try {
      console.log("[AUDIO] Solicitando acceso al microfono...")
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log("[AUDIO] Microfono obtenido")

      appState.mediaRecorder = new MediaRecorder(stream)
      appState.audioChunks = []

      appState.mediaRecorder.ondataavailable = (e) => {
        console.log("[AUDIO] Chunk recibido, size:", e.data.size)
        appState.audioChunks.push(e.data)
      }

      appState.mediaRecorder.onstop = async () => {
        console.log("[AUDIO] Grabacion detenida, chunks:", appState.audioChunks.length)
        const blob = new Blob(appState.audioChunks, { type: "audio/webm" })
        console.log("[AUDIO] Blob creado, size:", blob.size)

        // Detener todas las pistas del stream
        stream.getTracks().forEach((track) => track.stop())

        await uploadAudio(blob)
      }

      appState.mediaRecorder.start()
      appState.isRecording = true
      console.log("[AUDIO] Grabando...")

      elements.btnRecord.innerText = "⏹️"
      elements.btnRecord.classList.add("recording-active")
      elements.btnRecord.style.backgroundColor = "#ff4444"
    } catch (err) {
      console.error("[AUDIO] Error microfono:", err)
      alert("No se pudo acceder al microfono. Revisa permisos.")
    }
  } else {
    console.log("[AUDIO] Deteniendo grabacion...")
    appState.mediaRecorder.stop()
    appState.isRecording = false

    elements.btnRecord.innerText = "🎤"
    elements.btnRecord.classList.remove("recording-active")
    elements.btnRecord.style.backgroundColor = ""
  }
}

async function uploadAudio(blob) {
  console.log("[AUDIO] uploadAudio llamado")
  console.log("[AUDIO] activeChat:", appState.activeChat)

  if (!appState.activeChat) {
    console.log("[AUDIO] ERROR: No hay chat activo")
    return
  }

  const formData = new FormData()
  const fileName = `${appState.currentUser}_${Date.now()}.webm`

  formData.append("audio", blob, fileName)
  formData.append("groupName", appState.activeChat.name)
  formData.append("sender", appState.currentUser)

  console.log("[AUDIO] Enviando a servidor...", fileName)

  try {
    const res = await fetch("/api/messages/group/audio", {
      method: "POST",
      body: formData,
    })

    console.log("[AUDIO] Response status:", res.status)
    const data = await res.json()
    console.log("[AUDIO] Response data:", data)

    if (res.ok) {
      const chatKey = getChatKey(appState.activeChat.name, appState.activeChat.type)
      if (!appState.chatMessages[chatKey]) {
        appState.chatMessages[chatKey] = []
      }
      const audioUrl = data.audioUrl
      appState.chatMessages[chatKey].push({
        sender: appState.currentUser,
        content: audioUrl,
        type: "AUDIO",
        timestamp: Date.now(),
        isOwn: true,
      })

      addAudioMessageToUI(appState.currentUser, audioUrl, Date.now(), true, true)
      scrollToBottom()
      console.log("[AUDIO] Audio enviado exitosamente")
    } else {
      console.error("[AUDIO] Error del servidor:", data)
      alert("Error enviando audio: " + (data.error || "Error desconocido"))
    }
  } catch (e) {
    console.error("[AUDIO] Error de red:", e)
    alert("Error enviando audio: " + e.message)
  }
}

// ===== CHAT ACTIONS =====
function openChat(name, type) {
  appState.activeChat = { name, type }
  elements.emptyChat.style.display = "none"
  elements.chatContainer.style.display = "flex"

  elements.chatName.textContent = name
  elements.chatStatus.textContent = type === "group" ? "Grupo" : "Chat Privado"

  const chatKey = getChatKey(name, type)
  renderChatMessages(chatKey)

  if (type === "group") {
    socket.emit("join_group", { groupName: name, username: appState.currentUser })
  }

  elements.messageInput.focus()
  renderGroupsList()
  renderUsersList()
}

function closeChat() {
  appState.activeChat = null
  elements.emptyChat.style.display = "flex"
  elements.chatContainer.style.display = "none"
  renderGroupsList()
  renderUsersList()
}

async function handleSendMessage(e) {
  e.preventDefault()
  const text = elements.messageInput.value.trim()
  if (!text || !appState.activeChat) return

  socket.emit("send_message", {
    content: text,
    sender: appState.currentUser,
    groupName: appState.activeChat.name,
    type: "TEXT",
  })

  const chatKey = getChatKey(appState.activeChat.name, appState.activeChat.type)
  if (!appState.chatMessages[chatKey]) {
    appState.chatMessages[chatKey] = []
  }
  appState.chatMessages[chatKey].push({
    sender: appState.currentUser,
    content: text,
    type: "TEXT",
    timestamp: Date.now(),
    isOwn: true,
  })

  addMessageToUI(appState.currentUser, text, Date.now(), true, true)
  elements.messageInput.value = ""
  autoResizeTextarea()
  scrollToBottom()
}

// ===== GRUPOS =====
function openCreateGroupModal() {
  elements.modalCreateGroup.style.display = "flex"
  elements.groupNameInput.value = ""
  elements.groupNameInput.focus()
}

function closeCreateGroupModal() {
  elements.modalCreateGroup.style.display = "none"
}

async function handleCreateGroup(e) {
  e.preventDefault()
  const name = elements.groupNameInput.value.trim()
  if (name) {
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupName: name, creatorUsername: appState.currentUser }),
      })
      if (res.ok) {
        closeCreateGroupModal()
        socket.emit("get_groups")
      } else {
        alert("Error creando grupo")
      }
    } catch (err) {
      console.error(err)
    }
  }
}

// ===== UTILS =====
function autoResizeTextarea() {
  const textarea = elements.messageInput
  textarea.style.height = "auto"
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px"
}

function handleLogout() {
  if (confirm("Salir?")) {
    appState.isLoggedIn = false
    localStorage.removeItem("cumbiachat_username")
    window.location.href = "index.html"
  }
}

function switchTab(tabName) {
  if (tabName === "groups") {
    elements.groupsTab.classList.add("active")
    elements.usersTab.classList.remove("active")
    document.getElementById("groupsPanel").style.display = "block"
    document.getElementById("usersPanel").style.display = "none"
    socket.emit("get_groups")
  } else {
    elements.usersTab.classList.add("active")
    elements.groupsTab.classList.remove("active")
    document.getElementById("usersPanel").style.display = "block"
    document.getElementById("groupsPanel").style.display = "none"
    socket.emit("get_users")
  }
}

function filterGroups() {}
function filterUsers() {}

// ===== LOGICA WEBRTC =====
const rtcConfig = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
}

async function startCall(targetUser) {
  if (appState.callState.active) {
    alert("Ya hay una llamada en curso")
    return
  }

  console.log("[CALL] Iniciando llamada a:", targetUser)

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    appState.callState.localStream = stream

    const pc = new RTCPeerConnection(rtcConfig)
    appState.callState.peerConnection = pc
    appState.callState.remoteUser = targetUser
    appState.callState.isCaller = true
    appState.callState.active = true

    stream.getTracks().forEach((track) => pc.addTrack(track, stream))

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice_candidate", {
          to: targetUser,
          from: appState.currentUser,
          candidate: e.candidate,
        })
      }
    }

    pc.ontrack = (e) => {
      console.log("[CALL] Audio remoto recibido")
      const audio = document.getElementById("remoteAudio") || createRemoteAudio()
      audio.srcObject = e.streams[0]
      audio.play().catch(console.error)
    }

    pc.onconnectionstatechange = () => {
      console.log("[CALL] Estado conexion:", pc.connectionState)
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        endCall()
      }
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    socket.emit("call_request", {
      to: targetUser,
      from: appState.currentUser,
      offer: offer,
    })

    showCallUI(targetUser, "calling")
  } catch (e) {
    console.error("[CALL] Error iniciando llamada:", e)
    alert("Error al iniciar llamada: " + e.message)
    endCall()
  }
}

async function acceptCall(callerUser, offer) {
  console.log("[CALL] Aceptando llamada de:", callerUser)
  hideIncomingCallModal()

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    appState.callState.localStream = stream

    const pc = new RTCPeerConnection(rtcConfig)
    appState.callState.peerConnection = pc
    appState.callState.remoteUser = callerUser
    appState.callState.isCaller = false
    appState.callState.active = true

    stream.getTracks().forEach((track) => pc.addTrack(track, stream))

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice_candidate", {
          to: callerUser,
          from: appState.currentUser,
          candidate: e.candidate,
        })
      }
    }

    pc.ontrack = (e) => {
      console.log("[CALL] Audio remoto recibido")
      const audio = document.getElementById("remoteAudio") || createRemoteAudio()
      audio.srcObject = e.streams[0]
      audio.play().catch(console.error)
    }

    pc.onconnectionstatechange = () => {
      console.log("[CALL] Estado conexion:", pc.connectionState)
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        endCall()
      }
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    socket.emit("call_accept", {
      to: callerUser,
      from: appState.currentUser,
      answer: answer,
    })

    showCallUI(callerUser, "connected")
  } catch (e) {
    console.error("[CALL] Error aceptando llamada:", e)
    alert("Error al aceptar llamada: " + e.message)
    endCall()
  }
}

function rejectCall(callerUser) {
  console.log("[CALL] Rechazando llamada de:", callerUser)
  socket.emit("call_reject", {
    to: callerUser,
    from: appState.currentUser,
  })
  hideIncomingCallModal()
}

function endCall() {
  console.log("[CALL] Terminando llamada")

  if (appState.callState.remoteUser && appState.callState.active) {
    socket.emit("call_end", {
      to: appState.callState.remoteUser,
      from: appState.currentUser,
    })
  }

  if (appState.callState.localStream) {
    appState.callState.localStream.getTracks().forEach((track) => track.stop())
  }

  if (appState.callState.peerConnection) {
    appState.callState.peerConnection.close()
  }

  appState.callState = {
    active: false,
    remoteUser: null,
    peerConnection: null,
    localStream: null,
    isCaller: false,
  }

  hideCallUI()
  hideIncomingCallModal()
}

function createRemoteAudio() {
  let audio = document.getElementById("remoteAudio")
  if (!audio) {
    audio = document.createElement("audio")
    audio.id = "remoteAudio"
    audio.autoplay = true
    document.body.appendChild(audio)
  }
  return audio
}

function showCallUI(user, status) {
  let modal = document.getElementById("callModal")
  if (!modal) {
    modal = document.createElement("div")
    modal.id = "callModal"
    modal.innerHTML = `
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; padding: 30px; text-align: center; min-width: 300px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
        <div style="font-size: 60px; margin-bottom: 15px;">📞</div>
        <div id="callUser" style="font-size: 24px; font-weight: bold; color: white; margin-bottom: 10px;"></div>
        <div id="callStatus" style="color: #ffd700; margin-bottom: 25px;"></div>
        <div id="callTimer" style="font-size: 32px; color: white; margin-bottom: 25px; font-family: monospace;">00:00</div>
        <button id="btnEndCall" style="background: #ff4444; color: white; border: none; padding: 15px 40px; border-radius: 30px; font-size: 18px; cursor: pointer; display: flex; align-items: center; gap: 10px; margin: 0 auto;">
          <span style="font-size: 24px;">📵</span> Colgar
        </button>
      </div>
    `
    modal.style.cssText =
      "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;"
    document.body.appendChild(modal)
    document.getElementById("btnEndCall").onclick = endCall
  }

  document.getElementById("callUser").textContent = user
  document.getElementById("callStatus").textContent = status === "calling" ? "Llamando..." : "En llamada"
  document.getElementById("callTimer").textContent = "00:00"
  modal.style.display = "flex"

  if (status === "connected") {
    startCallTimer()
  }
}

function hideCallUI() {
  const modal = document.getElementById("callModal")
  if (modal) modal.style.display = "none"
  stopCallTimer()
}

function updateCallUI(status) {
  const statusEl = document.getElementById("callStatus")
  if (statusEl) {
    statusEl.textContent = status === "connected" ? "En llamada" : "Llamando..."
  }
  if (status === "connected") {
    startCallTimer()
  }
}

let callTimerInterval = null
let callSeconds = 0

function startCallTimer() {
  callSeconds = 0
  callTimerInterval = setInterval(() => {
    callSeconds++
    const mins = String(Math.floor(callSeconds / 60)).padStart(2, "0")
    const secs = String(callSeconds % 60).padStart(2, "0")
    const timerEl = document.getElementById("callTimer")
    if (timerEl) timerEl.textContent = `${mins}:${secs}`
  }, 1000)
}

function stopCallTimer() {
  if (callTimerInterval) {
    clearInterval(callTimerInterval)
    callTimerInterval = null
  }
  callSeconds = 0
}

function showIncomingCallModal(caller, offer) {
  let modal = document.getElementById("incomingCallModal")
  if (!modal) {
    modal = document.createElement("div")
    modal.id = "incomingCallModal"
    modal.innerHTML = `
      <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 20px; padding: 30px; text-align: center; min-width: 300px; box-shadow: 0 20px 60px rgba(0,0,0,0.5); animation: pulse 1s infinite;">
        <div style="font-size: 60px; margin-bottom: 15px;">📱</div>
        <div style="color: #ffd700; margin-bottom: 10px;">Llamada entrante</div>
        <div id="incomingCaller" style="font-size: 28px; font-weight: bold; color: white; margin-bottom: 25px;"></div>
        <div style="display: flex; gap: 20px; justify-content: center;">
          <button id="btnAcceptCall" style="background: #4CAF50; color: white; border: none; padding: 15px 30px; border-radius: 30px; font-size: 18px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">✅</span> Aceptar
          </button>
          <button id="btnRejectCall" style="background: #ff4444; color: white; border: none; padding: 15px 30px; border-radius: 30px; font-size: 18px; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">❌</span> Rechazar
          </button>
        </div>
      </div>
      <style>
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
      </style>
    `
    modal.style.cssText =
      "position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 10000;"
    document.body.appendChild(modal)
  }

  document.getElementById("incomingCaller").textContent = caller
  document.getElementById("btnAcceptCall").onclick = () => acceptCall(caller, offer)
  document.getElementById("btnRejectCall").onclick = () => rejectCall(caller)
  modal.style.display = "flex"

  // Sonido de llamada entrante
  try {
    const ringtone = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==")
    ringtone.loop = true
    ringtone.play().catch(() => {})
    modal.ringtone = ringtone
  } catch (e) {}
}

function hideIncomingCallModal() {
  const modal = document.getElementById("incomingCallModal")
  if (modal) {
    modal.style.display = "none"
    if (modal.ringtone) {
      modal.ringtone.pause()
      modal.ringtone = null
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
