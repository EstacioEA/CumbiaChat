/**
 * Lógica principal del chat de CumbiaChat
 * VERSIÓN FINAL (Socket.io + Audio + Ice)
 */

// Inicializar Socket.io
const socket = io();

// ===== ESTADO DE LA APLICACIÓN =====
const appState = {
    currentUser: null,
    activeChat: null,
    users: [],
    groups: [],
    messages: {},
    // Audio state
    isRecording: false,
    mediaRecorder: null,
    audioChunks: []
}

// ===== ELEMENTOS DEL DOM =====
const elements = {
    currentUsername: document.getElementById("currentUsername"),
    btnLogout: document.getElementById("btnLogout"),
    tabButtons: document.querySelectorAll(".tab-btn"),
    usersTab: document.getElementById("usersTab"),
    groupsTab: document.getElementById("groupsTab"),
    usersList: document.getElementById("usersList"),
    groupsList: document.getElementById("groupsList"),
    searchUsers: document.getElementById("searchUsers"),
    searchGroups: document.getElementById("searchGroups"),
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
    // Botón de audio (antes btnAttach, ahora btnRecord)
    btnRecord: document.getElementById("btnRecord") || document.getElementById("btnAttach"), 
}

// ===== LISTENERS DE SOCKET.IO (TIEMPO REAL) =====

socket.on("connect", () => {
    console.log("Conectado a Socket.io");
    if (appState.currentUser) {
        // Si se reconecta, volvemos a hacer login silencioso para reconectar Ice
        socket.emit("login", { username: appState.currentUser });
    }
});

// Recibir mensajes (Texto o Audio)
socket.on("receive_message", (data) => {
    console.log("Mensaje recibido:", data);
    
    // Si el mensaje es para el grupo que tengo abierto
    if (appState.activeChat && appState.activeChat.name === data.groupName) {
        const isOwn = data.sender === appState.currentUser;
        const time = new Date(data.date).getTime();

        if (data.type === "AUDIO") {
            addAudioMessageToUI(data.sender, data.content, time, isOwn, true);
        } else {
            addMessageToUI(data.sender, data.content, time, isOwn, true);
        }
        scrollToBottom();
    } else {
        // Notificación si llega mensaje a otro grupo
        // showToast(`Nuevo mensaje en ${data.groupName}`, "info");
    }
});

socket.on("groups_list", (groups) => {
    appState.groups = groups;
    renderGroupsList();
});


// ===== FUNCIONES UI (Tus funciones originales + Audio) =====

function addMessageToUI(sender, text, timestamp, isOwn, animate = true) {
    const emptyState = elements.messagesWrapper.querySelector(".empty-state")
    if (emptyState) emptyState.remove();

    const messageDiv = document.createElement("div")
    messageDiv.className = `message ${isOwn ? "own" : ""}`
    if (animate) messageDiv.style.animation = "slide-in 0.3s ease"

    const avatar = getRandomEmoji(sender) // Asumo que está en utils.js

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

// Nueva función para pintar audios
function addAudioMessageToUI(sender, fileName, timestamp, isOwn, animate = true) {
    const emptyState = elements.messagesWrapper.querySelector(".empty-state")
    if (emptyState) emptyState.remove();

    const messageDiv = document.createElement("div")
    messageDiv.className = `message ${isOwn ? "own" : ""}`
    if (animate) messageDiv.style.animation = "slide-in 0.3s ease"

    const avatar = getRandomEmoji(sender);

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${!isOwn ? `<div class="message-sender">${escapeHtml(sender)}</div>` : ""}
            <div class="message-bubble audio-bubble" style="background-color: #e1ffc7; color: #333; display:flex; align-items:center; gap:10px; padding: 10px;">
                <span style="font-size: 1.5em;">▶️</span>
                <div>
                    <p style="margin:0; font-weight:bold; font-size:0.9em;">Nota de Voz</p>
                    <small style="font-size:0.7em;">${escapeHtml(fileName)}</small>
                </div>
            </div>
            <div class="message-time">${formatTime(timestamp)}</div>
        </div>
    `
    elements.messagesWrapper.appendChild(messageDiv)
}

function scrollToBottom() {
    const container = document.getElementById("messagesContainer")
    if (container) container.scrollTop = container.scrollHeight
}

function showEmptyHistory(name) {
    clearElement(elements.messagesWrapper)
    const emptyMsg = document.createElement("div")
    emptyMsg.className = "empty-state"
    emptyMsg.innerHTML = `
        <span class="empty-icon">💬</span>
        <p>Chat con ${escapeHtml(name)}</p>
        <small>Envía tu primer mensaje</small>
    `
    elements.messagesWrapper.appendChild(emptyMsg)
}

function parseAndDisplayHistory(historyData) {
    clearElement(elements.messagesWrapper)
    // Aquí deberías adaptar según cómo Java te mande el historial.
    // Por ahora limpiamos para que no dé error.
    showEmptyHistory(appState.activeChat.name);
}

async function loadChatHistory(name, type) {
    // Simulado: Pedir historial real en el futuro
    showEmptyHistory(name);
}

// ===== INICIALIZACIÓN =====
function init() {
    // Usamos localStorage con la clave que pusimos en login.js
    appState.currentUser = localStorage.getItem("cumbiachat_username");
    if (!appState.currentUser) {
        window.location.href = "index.html";
        return;
    }

    elements.currentUsername.textContent = appState.currentUser;
    setupEventListeners();
    
    // Login inicial en Socket
    socket.emit("login", { username: appState.currentUser });
    socket.emit("get_groups"); // Pedir grupos a Node

    console.log("🎵 CumbiaChat iniciado -", appState.currentUser)
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    elements.btnLogout.addEventListener("click", handleLogout)
    elements.tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab))
    })
    
    // Refresh ahora pide a Node
    elements.btnRefreshUsers.addEventListener("click", () => { /* socket.emit('get_users') */ })
    
    elements.btnCreateGroup.addEventListener("click", openCreateGroupModal)
    elements.createGroupForm.addEventListener("submit", handleCreateGroup)
    elements.btnCloseModal.addEventListener("click", closeCreateGroupModal)
    elements.btnCancelGroup.addEventListener("click", closeCreateGroupModal)
    elements.searchUsers.addEventListener("input", debounce(filterUsers, 300))
    elements.searchGroups.addEventListener("input", debounce(filterGroups, 300))
    elements.messageForm.addEventListener("submit", handleSendMessage)
    elements.btnCloseChat.addEventListener("click", closeChat)
    elements.messageInput.addEventListener("input", autoResizeTextarea)
    
    // LISTENER DE AUDIO (NUEVO)
    if (elements.btnRecord) {
        elements.btnRecord.addEventListener("click", toggleRecording);
    }

    elements.modalCreateGroup.addEventListener("click", (e) => {
        if (e.target === elements.modalCreateGroup) closeCreateGroupModal()
    })
}

// ===== AUDIO LOGIC =====
async function toggleRecording() {
    if (!appState.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            appState.mediaRecorder = new MediaRecorder(stream);
            appState.audioChunks = [];

            appState.mediaRecorder.ondataavailable = (e) => {
                appState.audioChunks.push(e.data);
            };

            appState.mediaRecorder.onstop = async () => {
                const blob = new Blob(appState.audioChunks, { type: 'audio/webm' });
                uploadAudio(blob);
            };

            appState.mediaRecorder.start();
            appState.isRecording = true;
            
            // Feedback Visual
            elements.btnRecord.innerText = "⏹️"; // Icono stop
            elements.btnRecord.classList.add("recording-active"); // Clase CSS para rojo
            
        } catch (err) {
            console.error("Error micrófono:", err);
            alert("No se pudo acceder al micrófono.");
        }
    } else {
        appState.mediaRecorder.stop();
        appState.isRecording = false;
        elements.btnRecord.innerText = "🎤";
        elements.btnRecord.classList.remove("recording-active");
    }
}

async function uploadAudio(blob) {
    if (!appState.activeChat) return;

    const formData = new FormData();
    const fileName = `${appState.currentUser}_${Date.now()}.webm`;
    
    formData.append("audio", blob, fileName);
    formData.append("groupName", appState.activeChat.name);
    formData.append("sender", appState.currentUser);

    // Usamos fetch para subir el archivo (Híbrido: REST para binarios)
    try {
        const res = await fetch("/api/messages/group/audio", {
            method: "POST",
            body: formData
        });
        
        if (res.ok) {
            // Optimista: Mostrar mi propio audio
            addAudioMessageToUI(appState.currentUser, fileName, Date.now(), true, true);
            scrollToBottom();
        } else {
            console.error("Error subiendo audio");
        }
    } catch (e) {
        console.error("Error de red audio:", e);
    }
}

// ===== RENDERIZADO (Listas) =====
function renderUsersList() {
    clearElement(elements.usersList)
    // Placeholder (usuarios vendrían de socket.on('users_list'))
    elements.usersList.innerHTML = `<div class="empty-state"><span class="empty-icon">👥</span><p>Lista de usuarios</p></div>`;
}

function renderGroupsList() {
    clearElement(elements.groupsList)
    if (!appState.groups || appState.groups.length === 0) {
        elements.groupsList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🎭</span>
                <p>No hay grupos aún</p>
            </div>
        `
        return
    }
    appState.groups.forEach((groupName) => {
        const item = createListItem(groupName, "group")
        elements.groupsList.appendChild(item)
    })
}

function createListItem(name, type) {
    const isActive = appState.activeChat && appState.activeChat.name === name
    const item = document.createElement("div")
    item.className = `list-item ${isActive ? "active" : ""}`
    item.onclick = () => openChat(name, type)

    const avatar = "🎪"
    const status = "Grupo"

    item.innerHTML = `
        <div class="list-item-avatar">${avatar}</div>
        <div class="list-item-info">
            <div class="list-item-name">${escapeHtml(name)}</div>
            <div class="list-item-status">${status}</div>
        </div>
    `
    return item
}

// ===== CHAT ACTIONS =====
async function openChat(name, type) {
    appState.activeChat = { name, type }

    elements.emptyChat.style.display = "none"
    elements.chatContainer.style.display = "flex"
    elements.chatName.textContent = name
    elements.chatStatus.textContent = "En línea"

    clearElement(elements.messagesWrapper)
    
    // Unirse a la sala del grupo en Socket.io
    if (type === "group") {
        socket.emit("join_group", { groupName: name, username: appState.currentUser });
    }

    elements.messageInput.focus()
    renderGroupsList() // Refrescar UI
}

function closeChat() {
    appState.activeChat = null
    elements.emptyChat.style.display = "flex"
    elements.chatContainer.style.display = "none"
    renderGroupsList()
}

// ===== ENVIAR MENSAJE (TEXTO) =====
async function handleSendMessage(e) {
    e.preventDefault()
    const text = elements.messageInput.value.trim()

    if (!text || !appState.activeChat) return

    // Enviar por Socket
    socket.emit("send_message", {
        content: text,
        sender: appState.currentUser,
        groupName: appState.activeChat.name,
        type: "TEXT"
    });

    // Mostrar mensaje propio inmediatamente
    addMessageToUI(appState.currentUser, text, Date.now(), true, true)
    
    elements.messageInput.value = ""
    autoResizeTextarea()
    scrollToBottom()
}

// ===== CREAR GRUPO =====
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
    if (!name) return

    // Usamos REST porque ya está implementado
    try {
        const res = await fetch("/api/groups", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({ groupName: name, creatorUsername: appState.currentUser })
        });
        if (res.ok) {
            closeCreateGroupModal();
            socket.emit("get_groups"); // Pedir actualización
        } else {
            alert("Error al crear grupo")
        }
    } catch (err) { console.error(err); }
}

// ===== UTILS =====
function autoResizeTextarea() {
    const textarea = elements.messageInput
    textarea.style.height = "auto"
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px"
}

function handleLogout() {
    if (confirm("¿Seguro que quieres salir?")) {
        localStorage.removeItem("cumbiachat_username");
        window.location.href = "index.html";
    }
}

function switchTab(tabName) {
    if (tabName === "groups") {
        elements.groupsTab.classList.add("active");
        elements.usersTab.classList.remove("active");
        socket.emit("get_groups");
    } else {
        elements.usersTab.classList.add("active");
        elements.groupsTab.classList.remove("active");
    }
}

function filterGroups() { /* Implementar filtro local si se desea */ }
function filterUsers() { /* Implementar filtro local si se desea */ }

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Iniciar
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
} else {
    init()
}