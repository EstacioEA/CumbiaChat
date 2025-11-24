/**
 * Lógica principal del chat de CumbiaChat
 * VERSIÓN: Socket.io + Audio (ZeroC Ice)
 */

// Inicializar Socket.io
const socket = io();

// ===== ESTADO =====
const appState = {
    currentUser: null,
    activeChat: null,
    users: [],
    groups: [],
    isRecording: false,
    mediaRecorder: null,
    audioChunks: []
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
    // Botón de audio: Si no cambiaste el HTML, busca 'btnRecord' o 'btnAttach'
    btnRecord: document.getElementById("btnRecord") || document.getElementById("btnAttach"),
}

// ===== SOCKET LISTENERS (LO NUEVO) =====

socket.on("connect", () => {
    console.log("Conectado a Socket.io");
    // Si se reconecta (F5), hacemos login silencioso para recuperar Ice
    if (appState.currentUser) {
        socket.emit("login", { username: appState.currentUser });
        socket.emit("get_groups");
    }
});

// Recibir mensaje (Texto o Audio)
socket.on("receive_message", (data) => {
    console.log("Mensaje recibido:", data);
    
    // Solo pintar si es del chat activo
    if (appState.activeChat && appState.activeChat.name === data.groupName) {
        const isOwn = data.sender === appState.currentUser;
        const timestamp = new Date(data.date).getTime(); // Convertir fecha string a ms

        if (data.type === "AUDIO") {
            addAudioMessageToUI(data.sender, data.content, timestamp, isOwn, true);
        } else {
            addMessageToUI(data.sender, data.content, timestamp, isOwn, true);
        }
        scrollToBottom();
    }
});

socket.on("groups_list", (groups) => {
    appState.groups = groups || [];
    renderGroupsList();
});

// ===== FUNCIONES UI (Tus funciones + Audio) =====

function addMessageToUI(sender, text, timestamp, isOwn, animate = true) {
    // Eliminar estado vacío si existe
    const empty = elements.messagesWrapper.querySelector(".empty-state");
    if (empty) empty.remove();

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isOwn ? "own" : ""}`;
    if (animate) messageDiv.style.animation = "slide-in 0.3s ease";

    const avatar = getRandomEmoji(sender); // Asumo que está en utils.js

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${!isOwn ? `<div class="message-sender">${escapeHtml(sender)}</div>` : ""}
            <div class="message-bubble">${escapeHtml(text)}</div>
            <div class="message-time">${formatTime(timestamp)}</div>
        </div>
    `;
    elements.messagesWrapper.appendChild(messageDiv);
}

// Nueva función para pintar notas de voz
function addAudioMessageToUI(sender, fileName, timestamp, isOwn, animate = true) {
    const empty = elements.messagesWrapper.querySelector(".empty-state");
    if (empty) empty.remove();

    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${isOwn ? "own" : ""}`;
    if (animate) messageDiv.style.animation = "slide-in 0.3s ease";

    const avatar = getRandomEmoji(sender);

    // Burbuja estilo "audio"
    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${!isOwn ? `<div class="message-sender">${escapeHtml(sender)}</div>` : ""}
            <div class="message-bubble audio-bubble" style="background-color: #e1ffc7; color: #333; padding: 10px; display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.5em;">🎤</span>
                <div>
                    <p style="margin:0; font-weight:bold;">Nota de Voz</p>
                    <small style="font-size: 0.8em; opacity: 0.8;">${escapeHtml(fileName)}</small>
                </div>
            </div>
            <div class="message-time">${formatTime(timestamp)}</div>
        </div>
    `;
    elements.messagesWrapper.appendChild(messageDiv);
}

function scrollToBottom() {
    const container = document.getElementById("messagesContainer");
    if (container) container.scrollTop = container.scrollHeight;
}

function showEmptyHistory(name) {
    clearElement(elements.messagesWrapper);
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "empty-state";
    emptyMsg.innerHTML = `
        <span class="empty-icon">💬</span>
        <p>Chat con ${escapeHtml(name)}</p>
        <small>Envía tu primer mensaje</small>
    `;
    elements.messagesWrapper.appendChild(emptyMsg);
}

function clearElement(el) { el.innerHTML = ""; }

// ===== INICIALIZACIÓN =====
function init() {
    appState.currentUser = localStorage.getItem("cumbiachat_username");
    if (!appState.currentUser) {
        window.location.href = "index.html";
        return;
    }

    elements.currentUsername.textContent = appState.currentUser;
    setupEventListeners();
    
    // Disparar carga inicial
    socket.emit("login", { username: appState.currentUser });
    socket.emit("get_groups");

    console.log("🎵 CumbiaChat iniciado (WS) -", appState.currentUser);
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    elements.btnLogout.addEventListener("click", handleLogout);
    
    elements.tabButtons.forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });
    
    // Grupos
    elements.btnCreateGroup.addEventListener("click", openCreateGroupModal);
    elements.createGroupForm.addEventListener("submit", handleCreateGroup);
    elements.btnCloseModal.addEventListener("click", closeCreateGroupModal);
    elements.btnCancelGroup.addEventListener("click", closeCreateGroupModal);
    
    // Chat
    elements.messageForm.addEventListener("submit", handleSendMessage);
    elements.btnCloseChat.addEventListener("click", closeChat);
    elements.messageInput.addEventListener("input", autoResizeTextarea);
    
    // Audio (Configuramos el botón que antes era 'attach')
    if (elements.btnRecord) {
        elements.btnRecord.removeAttribute("disabled");
        elements.btnRecord.innerText = "🎤"; // Icono inicial
        elements.btnRecord.title = "Grabar nota de voz";
        elements.btnRecord.addEventListener("click", toggleRecording);
    }

    // Modal outside click
    elements.modalCreateGroup.addEventListener("click", (e) => {
        if (e.target === elements.modalCreateGroup) closeCreateGroupModal();
    });
    
    // Refresh manual
    elements.btnRefreshUsers.addEventListener("click", () => { socket.emit("get_groups"); });
}

// ===== LÓGICA AUDIO (MediaRecorder) =====
async function toggleRecording() {
    if (!appState.isRecording) {
        // INICIAR GRABACIÓN
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            appState.mediaRecorder = new MediaRecorder(stream);
            appState.audioChunks = [];

            appState.mediaRecorder.ondataavailable = (e) => {
                appState.audioChunks.push(e.data);
            };

            appState.mediaRecorder.onstop = async () => {
                const blob = new Blob(appState.audioChunks, { type: 'audio/webm' });
                uploadAudio(blob); // Enviar al terminar
            };

            appState.mediaRecorder.start();
            appState.isRecording = true;
            
            // Feedback Visual
            elements.btnRecord.innerText = "⏹️"; // Icono Stop
            elements.btnRecord.classList.add("recording-active"); // Clase para estilo rojo (definir en CSS)
            
        } catch (err) {
            console.error("Error micrófono:", err);
            alert("No se pudo acceder al micrófono. Revisa permisos.");
        }
    } else {
        // DETENER GRABACIÓN
        appState.mediaRecorder.stop();
        appState.isRecording = false;
        
        // Restaurar UI
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

    // Subir vía REST (Híbrido: Mejor para binarios)
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
        console.error("Error red audio:", e);
    }
}

// ===== CHAT ACTIONS =====
function openChat(name, type) {
    appState.activeChat = { name, type };
    elements.emptyChat.style.display = "none";
    elements.chatContainer.style.display = "flex";
    
    elements.chatName.textContent = name;
    elements.chatStatus.textContent = (type === "group") ? "Grupo" : "Privado";
    
    clearElement(elements.messagesWrapper);
    
    // Unirse a sala Socket
    if (type === "group") {
        socket.emit("join_group", { groupName: name, username: appState.currentUser });
    }
    
    elements.messageInput.focus();
    renderGroupsList(); // Refrescar UI para marcar activo
}

function closeChat() {
    appState.activeChat = null;
    elements.emptyChat.style.display = "flex";
    elements.chatContainer.style.display = "none";
    renderGroupsList();
}

async function handleSendMessage(e) {
    e.preventDefault();
    const text = elements.messageInput.value.trim();
    if (!text || !appState.activeChat) return;

    // Enviar por Socket
    socket.emit("send_message", {
        content: text,
        sender: appState.currentUser,
        groupName: appState.activeChat.name,
        type: "TEXT"
    });

    // Optimista
    addMessageToUI(appState.currentUser, text, Date.now(), true, true);
    elements.messageInput.value = "";
    autoResizeTextarea();
    scrollToBottom();
}

// ===== GRUPOS =====
function renderGroupsList() {
    clearElement(elements.groupsList);
    if (!appState.groups || appState.groups.length === 0) {
        elements.groupsList.innerHTML = `<div class="empty-state"><p>No hay grupos</p></div>`;
        return;
    }
    appState.groups.forEach(g => {
        const div = document.createElement("div");
        const isActive = appState.activeChat && appState.activeChat.name === g;
        div.className = `list-item ${isActive ? "active" : ""}`;
        div.innerHTML = `<div class="list-item-avatar">🎪</div><div class="list-item-name">${escapeHtml(g)}</div>`;
        div.onclick = () => openChat(g, "group");
        elements.groupsList.appendChild(div);
    });
}

function openCreateGroupModal() {
    elements.modalCreateGroup.style.display = "flex";
    elements.groupNameInput.value = "";
    elements.groupNameInput.focus();
}

function closeCreateGroupModal() {
    elements.modalCreateGroup.style.display = "none";
}

async function handleCreateGroup(e) {
    e.preventDefault();
    const name = elements.groupNameInput.value.trim();
    if (name) {
        // Crear grupo via REST (que llama a Ice)
        try {
            const res = await fetch("/api/groups", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({ groupName: name, creatorUsername: appState.currentUser })
            });
            if (res.ok) {
                closeCreateGroupModal();
                socket.emit("get_groups"); // Pedir refresco
            } else {
                alert("Error creando grupo");
            }
        } catch(err) { console.error(err); }
    }
}

// ===== UTILS =====
function autoResizeTextarea() {
    const textarea = elements.messageInput;
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
}

function handleLogout() {
    if (confirm("¿Salir?")) {
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

// Helpers de filtrado simples
function filterGroups() {} 
function filterUsers() {}
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Init
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}