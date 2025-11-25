/**
 * Lógica principal del chat de CumbiaChat
 */

// ===== ESTADO DE LA APLICACIÓN =====
const appState = {
    currentUser: null,
    activeChat: null,
    users: [],
    groups: [],
    messages: {},
    pollInterval: null,
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
}

// ===== FUNCIONES AUXILIARES =====

function addMessageToUI(sender, text, timestamp, isOwn, animate = true) {
    const emptyState = elements.messagesWrapper.querySelector(".empty-state")
    if (emptyState) {
        emptyState.remove()
    }

    const messageDiv = document.createElement("div")
    messageDiv.className = `message ${isOwn ? "own" : ""}`

    if (animate) {
        messageDiv.style.animation = "slide-in 0.3s ease"
    }

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

function scrollToBottom() {
    const container = document.getElementById("messagesContainer")
    if (container) {
        container.scrollTop = container.scrollHeight
    }
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

function parseAndDisplayHistory(historyText) {
    clearElement(elements.messagesWrapper)

    if (!historyText || historyText.includes("vacío") || historyText.trim() === "") {
        showEmptyHistory(appState.activeChat.name)
        return
    }

    const lines = historyText.split("\n").filter((line) => line.trim())

    if (lines.length === 0) {
        showEmptyHistory(appState.activeChat.name)
        return
    }

    lines.forEach((line) => {
        const match = line.match(/\[(.*?)\]\s*\[(.*?)\]\s*(.*?)\s*->\s*(.*?)\s*:\s*(.*)/)

        if (match) {
            const [, timestamp, type, sender, dest, content] = match

            if (type === "TEXT") {
                const isOwn = sender === appState.currentUser
                addMessageToUI(sender, content, new Date(timestamp).getTime(), isOwn, false)
            } else if (type === "AUDIO") {
                const isOwn = sender === appState.currentUser
                addMessageToUI(sender, `🎵 Nota de voz: ${content}`, new Date(timestamp).getTime(), isOwn, false)
            }
        }
    })

    scrollToBottom()
}

async function loadChatHistory(name, type) {
    try {
        let response

        if (type === "group") {
            response = await api.getGroupHistory(name, appState.currentUser)
        } else {
            response = await api.getPrivateHistory(appState.currentUser, name, appState.currentUser)
        }

        console.log('[Chat] Response history:', response);

        // Corregir acceso a historial
        if (response.success && response.data.data && response.data.data.history) {
            parseAndDisplayHistory(response.data.data.history)
        } else if (response.success && response.data.history) {
            parseAndDisplayHistory(response.data.history)
        } else {
            showEmptyHistory(name)
        }
    } catch (error) {
        console.error("[Chat] Error cargando historial:", error)
        showEmptyHistory(name)
    }
}


async function refreshChatHistory() {
    if (!appState.activeChat) return

    const { name, type } = appState.activeChat

    try {
        let response

        if (type === "group") {
            response = await api.getGroupHistory(name, appState.currentUser)
        } else {
            response = await api.getPrivateHistory(appState.currentUser, name, appState.currentUser)
        }

        // Corregir acceso a historial
        if (response.success && response.data.data && response.data.data.history) {
            const container = document.getElementById("messagesContainer")
            const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100

            parseAndDisplayHistory(response.data.data.history)

            if (wasAtBottom) {
                scrollToBottom()
            }
        } else if (response.success && response.data.history) {
            const container = document.getElementById("messagesContainer")
            const wasAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100

            parseAndDisplayHistory(response.data.history)

            if (wasAtBottom) {
                scrollToBottom()
            }
        }
    } catch (error) {
        console.error("[Chat] Error refrescando historial:", error)
    }
}


// ===== INICIALIZACIÓN =====
function init() {
    appState.currentUser = checkSession()
    if (!appState.currentUser) return

    elements.currentUsername.textContent = appState.currentUser
    
    // Configurar usuario en iceClient
    if (window.iceClient) {
        window.iceClient.setCurrentUser(appState.currentUser);
        console.log("[Chat] Usuario configurado en iceClient:", appState.currentUser);
    } else {
        console.error("[Chat] iceClient no está disponible en init()");
    }
    
    setupEventListeners()
    loadInitialData()
    startPolling()

    console.log("[Chat] CumbiaChat iniciado -", appState.currentUser)
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    elements.btnLogout.addEventListener("click", handleLogout)
    elements.tabButtons.forEach((btn) => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab))
    })
    elements.btnRefreshUsers.addEventListener("click", loadUsers)
    elements.btnCreateGroup.addEventListener("click", openCreateGroupModal)
    elements.createGroupForm.addEventListener("submit", handleCreateGroup)
    elements.btnCloseModal.addEventListener("click", closeCreateGroupModal)
    elements.btnCancelGroup.addEventListener("click", closeCreateGroupModal)
    elements.searchUsers.addEventListener("input", debounce(filterUsers, 300))
    elements.searchGroups.addEventListener("input", debounce(filterGroups, 300))
    elements.messageForm.addEventListener("submit", handleSendMessage)
    elements.btnCloseChat.addEventListener("click", closeChat)
    elements.messageInput.addEventListener("input", autoResizeTextarea)
    elements.modalCreateGroup.addEventListener("click", (e) => {
        if (e.target === elements.modalCreateGroup) {
            closeCreateGroupModal()
        }
    })
}

// ===== CARGA DE DATOS =====
async function loadInitialData() {
    showLoader()
    await Promise.all([loadUsers(), loadGroups()])
    hideLoader()
}

async function loadUsers() {
    try {
        const response = await api.getActiveUsers(appState.currentUser)
        //console.log('[Chat] Response getActiveUsers:', response);
        
        // Corregir acceso a usuarios
        if (response.success && response.data.data && response.data.data.users) {
            appState.users = response.data.data.users.filter((u) => u !== appState.currentUser)
            renderUsersList()
        } else if (response.success && response.data.users) {
            // Fallback por si el formato cambia
            appState.users = response.data.users.filter((u) => u !== appState.currentUser)
            renderUsersList()
        }
    } catch (error) {
        console.error("[Chat] Error cargando usuarios:", error)
    }
}


async function loadGroups() {
    try {
        const response = await api.getAvailableGroups(appState.currentUser)
        //console.log('[Chat] Response getAvailableGroups:', response);
        
        // Corregir acceso a grupos
        if (response.success && response.data.data && response.data.data.groups) {
            appState.groups = response.data.data.groups
            renderGroupsList()
        } else if (response.success && response.data.groups) {
            // Fallback por si el formato cambia
            appState.groups = response.data.groups
            renderGroupsList()
        }
    } catch (error) {
        console.error("[Chat] Error cargando grupos:", error)
    }
}


// ===== RENDERIZADO =====
function renderUsersList() {
    clearElement(elements.usersList)

    if (appState.users.length === 0) {
        elements.usersList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">😴</span>
                <p>No hay usuarios conectados</p>
            </div>
        `
        return
    }

    appState.users.forEach((username) => {
        const item = createListItem(username, "user")
        elements.usersList.appendChild(item)
    })
}

function renderGroupsList() {
    clearElement(elements.groupsList)

    if (appState.groups.length === 0) {
        elements.groupsList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🎭</span>
                <p>No hay grupos aún</p>
                <small>¡Crea el primero!</small>
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
    const isActive = appState.activeChat && appState.activeChat.name === name && appState.activeChat.type === type

    const item = document.createElement("div")
    item.className = `list-item ${isActive ? "active" : ""}`
    item.onclick = () => openChat(name, type)

    const avatar = type === "group" ? "🎪" : getRandomEmoji(name)
    const status = type === "group" ? "Grupo" : "En línea"

    item.innerHTML = `
        <div class="list-item-avatar">${avatar}</div>
        <div class="list-item-info">
            <div class="list-item-name">${escapeHtml(name)}</div>
            <div class="list-item-status">${status}</div>
        </div>
    `

    return item
}

// ===== FILTRADO =====
function filterUsers() {
    const query = elements.searchUsers.value.toLowerCase()
    const items = elements.usersList.querySelectorAll(".list-item")
    items.forEach((item) => {
        const name = item.querySelector(".list-item-name").textContent.toLowerCase()
        item.style.display = name.includes(query) ? "flex" : "none"
    })
}

function filterGroups() {
    const query = elements.searchGroups.value.toLowerCase()
    const items = elements.groupsList.querySelectorAll(".list-item")
    items.forEach((item) => {
        const name = item.querySelector(".list-item-name").textContent.toLowerCase()
        item.style.display = name.includes(query) ? "flex" : "none"
    })
}

// ===== TABS =====
function switchTab(tabName) {
    elements.tabButtons.forEach((btn) => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add("active")
        } else {
            btn.classList.remove("active")
        }
    })

    const tabs = document.querySelectorAll(".tab-content")
    tabs.forEach((tab) => tab.classList.remove("active"))

    if (tabName === "users") {
        elements.usersTab.classList.add("active")
    } else {
        elements.groupsTab.classList.add("active")
    }
}

// ===== CHAT =====
async function openChat(name, type) {
    appState.activeChat = { name, type }

    elements.emptyChat.style.display = "none"
    elements.chatContainer.style.display = "flex"

    const avatar = type === "group" ? "🎪" : getRandomEmoji(name)
    elements.chatAvatar.innerHTML = `<span>${avatar}</span>`
    elements.chatName.textContent = name
    elements.chatStatus.textContent = type === "group" ? "Grupo" : "En línea"

    elements.messageInput.value = ""
    clearElement(elements.messagesWrapper)

    const loadingMsg = document.createElement("div")
    loadingMsg.className = "empty-state"
    loadingMsg.innerHTML = "<p>Cargando historial...</p>"
    elements.messagesWrapper.appendChild(loadingMsg)

    await loadChatHistory(name, type)

    elements.messageInput.focus()
    renderUsersList()
    renderGroupsList()

    // Normalizar tipo de chat
    const normalizedType = (type === 'group') ? 'group' : 'private';
    updateCurrentChat(normalizedType, name);

    console.log("[Chat] Chat abierto:", name, "Tipo:", normalizedType)
}

function closeChat() {
    appState.activeChat = null
    elements.emptyChat.style.display = "flex"
    elements.chatContainer.style.display = "none"
    renderUsersList()
    renderGroupsList()
}

// ===== MENSAJES =====
async function handleSendMessage(e) {
    e.preventDefault()

    const messageText = elements.messageInput.value.trim()

    if (!messageText || !appState.activeChat) {
        return
    }

    if (!isValidMessageLength(messageText)) {
        showToast(`Máximo ${CONFIG.APP.MESSAGE_MAX_LENGTH} caracteres`, "warning")
        return
    }

    try {
        const { name, type } = appState.activeChat
        let response

        if (type === "group") {
            response = await api.sendMessageToGroup(name, appState.currentUser, messageText)
        } else {
            response = await api.sendPrivateMessage(appState.currentUser, name, messageText)
        }

        if (response.success) {
            elements.messageInput.value = ""
            autoResizeTextarea()
            addMessageToUI(appState.currentUser, messageText, Date.now(), true)
            scrollToBottom()
            showToast("Mensaje enviado", "success", 2000)
        } else {
            showToast("Error enviando mensaje", "error")
        }
    } catch (error) {
        console.error("[Chat] Error enviando mensaje:", error)
        showToast("Error de conexión", "error")
    }
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

    const groupName = elements.groupNameInput.value.trim()

    if (!groupName || groupName.length < 3) {
        showToast("El nombre debe tener al menos 3 caracteres", "warning")
        return
    }

    showLoader()

    try {
        const response = await api.createGroup(groupName, appState.currentUser)

        if (response.success) {
            showToast("¡Grupo creado!", "success")
            closeCreateGroupModal()
            await loadGroups()
            switchTab("groups")
            openChat(groupName, "group")
        } else {
            showToast(response.error || "El grupo ya existe", "error")
        }
    } catch (error) {
        console.error("[Chat] Error creando grupo:", error)
        showToast("Error de conexión", "error")
    } finally {
        hideLoader()
    }
}

// ===== POLLING =====
function startPolling() {
    appState.pollInterval = setInterval(async () => {
        await loadUsers()
        await loadGroups()

        if (appState.activeChat) {
            await refreshChatHistory()
        }
        
        // Verificar llamadas entrantes cada 3 segundos
        await checkIncomingCalls()
    }, CONFIG.APP.POLL_INTERVAL)
}


function stopPolling() {
    if (appState.pollInterval) {
        clearInterval(appState.pollInterval)
        appState.pollInterval = null
    }
}

// ===== POLLING DE LLAMADAS ENTRANTES =====

async function checkIncomingCalls() {
    if (!window.iceClient || !window.iceClient.currentUser) return;
    
    try {
        const response = await fetch(`http://localhost:5000/api/calls/pending?username=${window.iceClient.currentUser}`);
        const data = await response.json();
        
        if (data.pendingCalls && data.pendingCalls.length > 0) {
            // Mostrar modal para la primera llamada pendiente
            const caller = data.pendingCalls[0];
            showIncomingCallModal(caller);
        }
    } catch (error) {
        console.error('[Call] Error checking incoming calls:', error);
    }
}

function showIncomingCallModal(fromUser) {
    // Evitar mostrar múltiples modales
    if (document.getElementById('incoming-call-modal')) return;
    
    const modal = document.createElement('div');
    modal.id = 'incoming-call-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 10px; text-align: center; min-width: 300px;">
            <h2>Llamada entrante</h2>
            <p style="font-size: 20px; margin: 20px 0;">${fromUser}</p>
            <div style="display: flex; gap: 15px; justify-content: center;">
                <button id="accept-call-btn" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                    Aceptar
                </button>
                <button id="reject-call-btn" style="padding: 10px 20px; background: #f44336; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
                    Rechazar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    document.getElementById('accept-call-btn').onclick = () => acceptIncomingCall(fromUser);
    document.getElementById('reject-call-btn').onclick = () => rejectIncomingCall(fromUser);
}

async function acceptIncomingCall(fromUser) {
    console.log('[Call] Aceptando llamada de:', fromUser);
    
    // Limpiar llamada pendiente
    await fetch('http://localhost:5000/api/calls/clear-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: window.iceClient.currentUser,
            fromUser: fromUser
        })
    });
    
    // Aceptar llamada
    await window.iceClient.acceptCall(fromUser);
    
    // Cerrar modal
    const modal = document.getElementById('incoming-call-modal');
    if (modal) modal.remove();
    
    // Actualizar UI
    updateCallUI(true, fromUser);
    showToast('success', 'Llamada aceptada');
}

async function rejectIncomingCall(fromUser) {
    console.log('[Call] Rechazando llamada de:', fromUser);
    
    // Limpiar llamada pendiente
    await fetch('http://localhost:5000/api/calls/clear-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: window.iceClient.currentUser,
            fromUser: fromUser
        })
    });
    
    // Rechazar llamada
    await window.iceClient.rejectCall(fromUser);
    
    // Cerrar modal
    const modal = document.getElementById('incoming-call-modal');
    if (modal) modal.remove();
    
    showToast('info', 'Llamada rechazada');
}


// ========== FUNCIONES DE AUDIO Y LLAMADAS ==========

let isRecording = false;
let currentChatType = 'private';
let currentChatTarget = null;

// Inicializar controles de audio
document.addEventListener('DOMContentLoaded', function() {
    initializeAudioControls();
});

function initializeAudioControls() {
    const recordBtn = document.getElementById('btn-record-audio');
    const callBtn = document.getElementById('btn-start-call');
    const endCallBtn = document.getElementById('btn-end-call');

    if (recordBtn) {
        recordBtn.addEventListener('click', toggleAudioRecording);
        console.log('[Audio] Boton de grabacion configurado');
    }

    if (callBtn) {
        callBtn.addEventListener('click', startCall);
        console.log('[Audio] Boton de llamada configurado');
    }

    if (endCallBtn) {
        endCallBtn.addEventListener('click', endCall);
        console.log('[Audio] Boton de colgar configurado');
    }
}

async function toggleAudioRecording() {
    console.log('[Audio] === INICIO toggleAudioRecording ===');
    console.log('[Audio] currentChatTarget:', currentChatTarget);
    console.log('[Audio] isRecording:', isRecording);
    
    if (!window.iceClient) {
        console.error('[Audio] IceClient no esta disponible');
        alert('Error: Sistema de audio no inicializado. Recarga la página.');
        return;
    }

    if (!currentChatTarget) {
        console.error('[Audio] currentChatTarget es null');
        if (typeof showToast === 'function') {
            showToast('error', 'Selecciona un chat primero');
        } else {
            alert('Selecciona un chat primero');
        }
        return;
    }

    const btn = document.getElementById('btn-record-audio');

    if (!isRecording) {
        try {
            const success = await window.iceClient.startAudioRecording();
            if (success) {
                isRecording = true;
                btn.innerHTML = '⏹️ <span class="btn-text">Detener</span>';
                btn.classList.add('recording');

                if (typeof showToast === 'function') {
                    showToast('info', 'Grabando audio...');
                }
            }
        } catch (error) {
            console.error('[Audio] Error en startAudioRecording:', error);
            alert('Error al acceder al micrófono: ' + error.message);
        }
    } else {
        try {
            window.iceClient.stopAudioRecording();

            setTimeout(async () => {
                if (window.iceClient.audioChunks && window.iceClient.audioChunks.length > 0) {
                    const audioBlob = new Blob(window.iceClient.audioChunks, { type: 'audio/wav' });

                    if (typeof showLoader === 'function') showLoader();

                    try {
                        if (currentChatType === 'private') {
                            const result = await window.iceClient.sendAudioMessage(currentChatTarget, audioBlob);
                            console.log('[Audio] Resultado envio audio:', result);
                            if (typeof showToast === 'function') {
                                showToast('success', 'Audio enviado');
                            }
                        } else if (currentChatType === 'group') {
                            const result = await window.iceClient.sendAudioMessageToGroup(currentChatTarget, audioBlob);
                            console.log('[Audio] Resultado envio audio grupo:', result);
                            if (typeof showToast === 'function') {
                                showToast('success', 'Audio enviado al grupo');
                            }
                        }
                    } catch (error) {
                        console.error('[Audio] Error enviando audio:', error);
                        if (typeof showToast === 'function') {
                            showToast('error', 'Error enviando audio: ' + error.message);
                        }
                    }

                    if (typeof hideLoader === 'function') hideLoader();
                }
            }, 500);

            isRecording = false;
            btn.innerHTML = '🎤 <span class="btn-text">Grabar Audio</span>';
            btn.classList.remove('recording');

        } catch (error) {
            console.error('[Audio] Error deteniendo grabacion:', error);
            alert('Error deteniendo grabación: ' + error.message);
        }
    }
}

async function startCall() {
    console.log('[Call] === INICIO startCall ===');
    console.log('[Call] currentChatTarget:', currentChatTarget);
    console.log('[Call] currentChatType:', currentChatType);
    console.log('[Call] iceClient.currentUser:', window.iceClient?.currentUser);

    if (!window.iceClient) {
        console.error('[Call] IceClient no esta disponible');
        alert('Error: Sistema de llamadas no inicializado. Recarga la página.');
        return;
    }

    if (!window.iceClient.currentUser) {
        console.error('[Call] currentUser no esta configurado en iceClient');
        alert('Error: Usuario no configurado. Recarga la página.');
        return;
    }

    if (!currentChatTarget || currentChatType !== 'private') {
        if (typeof showToast === 'function') {
            showToast('error', 'Selecciona un usuario para llamar');
        } else {
            alert('Selecciona un usuario para llamar');
        }
        return;
    }

    try {
        if (typeof showLoader === 'function') showLoader();

        const success = await window.iceClient.startCall(currentChatTarget);

        if (typeof hideLoader === 'function') hideLoader();

        if (success) {
            updateCallUI(true, currentChatTarget);
            if (typeof showToast === 'function') {
                showToast('success', `Llamando a ${currentChatTarget}...`);
            }
        } else {
            if (typeof showToast === 'function') {
                showToast('error', 'No se pudo iniciar la llamada');
            }
        }
    } catch (error) {
        console.error('[Call] Error iniciando llamada:', error);
        if (typeof hideLoader === 'function') hideLoader();
        alert('Error iniciando llamada: ' + error.message);
    }
}

async function endCall() {
    console.log('[Call] Boton de colgar presionado');

    if (!window.iceClient) {
        console.error('[Call] IceClient no esta disponible');
        alert('Error: Sistema de llamadas no inicializado. Recarga la página.');
        return;
    }

    try {
        if (typeof showLoader === 'function') showLoader();

        const success = await window.iceClient.endCall();

        if (typeof hideLoader === 'function') hideLoader();

        if (success) {
            updateCallUI(false, null);
            if (typeof showToast === 'function') {
                showToast('info', 'Llamada finalizada');
            }
        }
    } catch (error) {
        console.error('[Call] Error finalizando llamada:', error);
        if (typeof hideLoader === 'function') hideLoader();
        alert('Error finalizando llamada: ' + error.message);
    }
}

function updateCallUI(isActive, target) {
    const indicator = document.getElementById('call-status-indicator');
    const statusText = document.getElementById('call-status-text');
    const startBtn = document.getElementById('btn-start-call');
    const endBtn = document.getElementById('btn-end-call');

    if (isActive) {
        if (indicator) indicator.style.display = 'flex';
        if (statusText) statusText.textContent = `En llamada con ${target}`;
        if (startBtn) startBtn.disabled = true;
        if (endBtn) endBtn.disabled = false;
    } else {
        if (indicator) indicator.style.display = 'none';
        if (startBtn) startBtn.disabled = false;
        if (endBtn) endBtn.disabled = true;
    }
}

function updateCurrentChat(type, target) {
    currentChatType = type;
    currentChatTarget = target;

    console.log('[Chat] Chat actualizado:', type, '-', target);

    const callBtn = document.getElementById('btn-start-call');
    if (callBtn) {
        if (type === 'private') {
            callBtn.disabled = false;
            callBtn.title = 'Iniciar llamada';
            console.log('[Chat] Boton de llamada HABILITADO');
        } else {
            callBtn.disabled = true;
            callBtn.title = 'Solo llamadas privadas';
            console.log('[Chat] Boton de llamada DESHABILITADO (grupo)');
        }
    }
}

// ===== UTILIDADES =====
function autoResizeTextarea() {
    const textarea = elements.messageInput
    textarea.style.height = "auto"
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px"
}

function handleLogout() {
    if (confirm("¿Seguro que quieres salir?")) {
        stopPolling()
        logout()
    }
}

// ===== CLEANUP =====
window.addEventListener("beforeunload", async () => {
    stopPolling()
    const username = getCurrentUser()
    if (username) {
        try {
            await api.logout(username)
        } catch (e) {
            // Ignorar
        }
    }
})

// ===== INICIAR =====
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
} else {
    init()
}
