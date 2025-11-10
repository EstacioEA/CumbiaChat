/**
 * Lógica principal del chat de CumbiaChat
 */

// ===== ESTADO DE LA APLICACIÓN =====
const appState = {
    currentUser: null,
    activeChat: null,  // { type: 'user'|'group', name: string }
    users: [],
    groups: [],
    messages: {},      // Por chat
    pollInterval: null
};

// ===== ELEMENTOS DEL DOM =====
const elements = {
    // Navbar
    currentUsername: document.getElementById('currentUsername'),
    btnLogout: document.getElementById('btnLogout'),

    // Tabs
    tabButtons: document.querySelectorAll('.tab-btn'),
    usersTab: document.getElementById('usersTab'),
    groupsTab: document.getElementById('groupsTab'),

    // Listas
    usersList: document.getElementById('usersList'),
    groupsList: document.getElementById('groupsList'),

    // Búsqueda
    searchUsers: document.getElementById('searchUsers'),
    searchGroups: document.getElementById('searchGroups'),

    // Botones
    btnRefreshUsers: document.getElementById('btnRefreshUsers'),
    btnCreateGroup: document.getElementById('btnCreateGroup'),

    // Chat
    emptyChat: document.getElementById('emptyChat'),
    chatContainer: document.getElementById('chatContainer'),
    chatName: document.getElementById('chatName'),
    chatStatus: document.getElementById('chatStatus'),
    chatAvatar: document.getElementById('chatAvatar'),
    messagesWrapper: document.getElementById('messagesWrapper'),
    messageInput: document.getElementById('messageInput'),
    messageForm: document.getElementById('messageForm'),
    btnCloseChat: document.getElementById('btnCloseChat'),

    // Modal
    modalCreateGroup: document.getElementById('modalCreateGroup'),
    createGroupForm: document.getElementById('createGroupForm'),
    groupNameInput: document.getElementById('groupName'),
    btnCloseModal: document.getElementById('btnCloseModal'),
    btnCancelGroup: document.getElementById('btnCancelGroup')
};

// ===== INICIALIZACIÓN =====
function init() {
    // Verificar sesión
    appState.currentUser = checkSession();
    if (!appState.currentUser) return;

    // Mostrar nombre de usuario
    elements.currentUsername.textContent = appState.currentUser;

    // Event Listeners
    setupEventListeners();

    // Cargar datos iniciales
    loadInitialData();

    // Iniciar polling para actualizar listas
    startPolling();

    console.log('🎵 CumbiaChat iniciado -', appState.currentUser);
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Logout
    elements.btnLogout.addEventListener('click', handleLogout);

    // Tabs
    elements.tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Refresh
    elements.btnRefreshUsers.addEventListener('click', loadUsers);

    // Crear grupo
    elements.btnCreateGroup.addEventListener('click', openCreateGroupModal);
    elements.createGroupForm.addEventListener('submit', handleCreateGroup);
    elements.btnCloseModal.addEventListener('click', closeCreateGroupModal);
    elements.btnCancelGroup.addEventListener('click', closeCreateGroupModal);

    // Búsqueda
    elements.searchUsers.addEventListener('input', debounce(filterUsers, 300));
    elements.searchGroups.addEventListener('input', debounce(filterGroups, 300));

    // Chat
    elements.messageForm.addEventListener('submit', handleSendMessage);
    elements.btnCloseChat.addEventListener('click', closeChat);

    // Auto-resize textarea
    elements.messageInput.addEventListener('input', autoResizeTextarea);

    // Click fuera del modal para cerrar
    elements.modalCreateGroup.addEventListener('click', (e) => {
        if (e.target === elements.modalCreateGroup) {
            closeCreateGroupModal();
        }
    });
}

// ===== CARGA DE DATOS =====
async function loadInitialData() {
    showLoader();
    await Promise.all([
        loadUsers(),
        loadGroups()
    ]);
    hideLoader();
}

async function loadUsers() {
    try {
        const response = await api.getActiveUsers(appState.currentUser);

        if (response.success && response.data.users) {
            appState.users = response.data.users.filter(u => u !== appState.currentUser);
            renderUsersList();
        }
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        showToast('Error cargando usuarios', 'error');
    }
}

async function loadGroups() {
    try {
        const response = await api.getAvailableGroups(appState.currentUser);

        if (response.success && response.data.groups) {
            appState.groups = response.data.groups;
            renderGroupsList();
        }
    } catch (error) {
        console.error('Error cargando grupos:', error);
        showToast('Error cargando grupos', 'error');
    }
}

// ===== RENDERIZADO DE LISTAS =====
function renderUsersList() {
    clearElement(elements.usersList);

    if (appState.users.length === 0) {
        elements.usersList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">😴</span>
                <p>No hay usuarios conectados</p>
            </div>
        `;
        return;
    }

    appState.users.forEach(username => {
        const item = createListItem(username, 'user');
        elements.usersList.appendChild(item);
    });
}

function renderGroupsList() {
    clearElement(elements.groupsList);

    if (appState.groups.length === 0) {
        elements.groupsList.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🎭</span>
                <p>No hay grupos aún</p>
                <small>¡Crea el primero!</small>
            </div>
        `;
        return;
    }

    appState.groups.forEach(groupName => {
        const item = createListItem(groupName, 'group');
        elements.groupsList.appendChild(item);
    });
}

function createListItem(name, type) {
    const isActive = appState.activeChat &&
        appState.activeChat.name === name &&
        appState.activeChat.type === type;

    const item = document.createElement('div');
    item.className = `list-item ${isActive ? 'active' : ''}`;
    item.onclick = () => openChat(name, type);

    const avatar = type === 'group' ? '🎪' : getRandomEmoji(name);
    const status = type === 'group' ? 'Grupo' : 'En línea';

    item.innerHTML = `
        <div class="list-item-avatar">${avatar}</div>
        <div class="list-item-info">
            <div class="list-item-name">${escapeHtml(name)}</div>
            <div class="list-item-status">${status}</div>
        </div>
    `;

    return item;
}

// ===== FILTRADO =====
function filterUsers() {
    const query = elements.searchUsers.value.toLowerCase();
    const items = elements.usersList.querySelectorAll('.list-item');

    items.forEach(item => {
        const name = item.querySelector('.list-item-name').textContent.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

function filterGroups() {
    const query = elements.searchGroups.value.toLowerCase();
    const items = elements.groupsList.querySelectorAll('.list-item');

    items.forEach(item => {
        const name = item.querySelector('.list-item-name').textContent.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
    });
}

// ===== CAMBIO DE TABS =====
function switchTab(tabName) {
    // Actualizar botones
    elements.tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Actualizar contenido
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));

    if (tabName === 'users') {
        elements.usersTab.classList.add('active');
    } else {
        elements.groupsTab.classList.add('active');
    }
}

// ===== CHAT =====
async function openChat(name, type) {
    appState.activeChat = { name, type };

    // Ocultar empty state
    elements.emptyChat.style.display = 'none';
    elements.chatContainer.style.display = 'flex';

    // Actualizar header
    const avatar = type === 'group' ? '🎪' : getRandomEmoji(name);
    elements.chatAvatar.innerHTML = `<span>${avatar}</span>`;
    elements.chatName.textContent = name;
    elements.chatStatus.textContent = type === 'group' ? 'Grupo' : 'En línea';

    // Limpiar input
    elements.messageInput.value = '';

    // Cargar mensajes (por ahora vacío, se implementará con historial)
    clearElement(elements.messagesWrapper);

    // Mensaje de bienvenida temporal
    const welcomeMsg = document.createElement('div');
    welcomeMsg.className = 'empty-state';
    welcomeMsg.innerHTML = `
        <span class="empty-icon">💬</span>
        <p>Chat con ${escapeHtml(name)}</p>
        <small>Envía tu primer mensaje</small>
    `;
    elements.messagesWrapper.appendChild(welcomeMsg);

    // Focus en input
    elements.messageInput.focus();

    // Actualizar UI de listas
    renderUsersList();
    renderGroupsList();

    console.log('Chat abierto:', name, type);
}

function closeChat() {
    appState.activeChat = null;
    elements.emptyChat.style.display = 'flex';
    elements.chatContainer.style.display = 'none';

    // Actualizar listas
    renderUsersList();
    renderGroupsList();
}

// ===== ENVÍO DE MENSAJES =====
async function handleSendMessage(e) {
    e.preventDefault();

    const messageText = elements.messageInput.value.trim();

    if (!messageText) {
        return;
    }

    if (!isValidMessageLength(messageText)) {
        showToast(`Máximo ${CONFIG.APP.MESSAGE_MAX_LENGTH} caracteres`, 'warning');
        return;
    }

    if (!appState.activeChat) {
        showToast('No hay chat seleccionado', 'warning');
        return;
    }

    try {
        const { name, type } = appState.activeChat;
        let response;

        if (type === 'group') {
            response = await api.sendMessageToGroup(name, appState.currentUser, messageText);
        } else {
            response = await api.sendPrivateMessage(appState.currentUser, name, messageText);
        }

        if (response.success) {
            // Limpiar input
            elements.messageInput.value = '';
            autoResizeTextarea();

            // Agregar mensaje a la UI
            addMessageToUI(appState.currentUser, messageText, Date.now(), true);

            // Scroll al final
            scrollToBottom();
        } else {
            showToast('Error enviando mensaje', 'error');
        }
    } catch (error) {
        console.error('Error enviando mensaje:', error);
        showToast('Error de conexión', 'error');
    }
}

function addMessageToUI(sender, text, timestamp, isOwn) {
    // Remover empty state si existe
    const emptyState = elements.messagesWrapper.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isOwn ? 'own' : ''}`;

    const avatar = getRandomEmoji(sender);

    messageDiv.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
            ${!isOwn ? `<div class="message-sender">${escapeHtml(sender)}</div>` : ''}
            <div class="message-bubble">${escapeHtml(text)}</div>
            <div class="message-time">${formatTime(timestamp)}</div>
        </div>
    `;

    elements.messagesWrapper.appendChild(messageDiv);
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// ===== CREAR GRUPO =====
function openCreateGroupModal() {
    elements.modalCreateGroup.style.display = 'flex';
    elements.groupNameInput.value = '';
    elements.groupNameInput.focus();
}

function closeCreateGroupModal() {
    elements.modalCreateGroup.style.display = 'none';
}

async function handleCreateGroup(e) {
    e.preventDefault();

    const groupName = elements.groupNameInput.value.trim();

    if (!groupName) {
        showToast('Ingresa un nombre de grupo', 'warning');
        return;
    }

    if (groupName.length < 3) {
        showToast('El nombre debe tener al menos 3 caracteres', 'warning');
        return;
    }

    showLoader();

    try {
        const response = await api.createGroup(groupName, appState.currentUser);

        if (response.success) {
            showToast('¡Grupo creado!', 'success');
            closeCreateGroupModal();

            // Recargar grupos
            await loadGroups();

            // Cambiar a tab de grupos
            switchTab('groups');

            // Abrir el nuevo grupo
            openChat(groupName, 'group');
        } else {
            showToast(response.error || 'El grupo ya existe', 'error');
        }
    } catch (error) {
        console.error('Error creando grupo:', error);
        showToast('Error de conexión', 'error');
    } finally {
        hideLoader();
    }
}

// ===== POLLING =====
function startPolling() {
    // Actualizar listas cada cierto tiempo
    appState.pollInterval = setInterval(async () => {
        await loadUsers();
        await loadGroups();
    }, CONFIG.APP.POLL_INTERVAL);
}

function stopPolling() {
    if (appState.pollInterval) {
        clearInterval(appState.pollInterval);
        appState.pollInterval = null;
    }
}

// ===== UTILIDADES UI =====
function autoResizeTextarea() {
    const textarea = elements.messageInput;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

function handleLogout() {
    if (confirm('¿Seguro que quieres salir?')) {
        stopPolling();
        logout(); // Esta función ya hace el API call
    }
}

// ===== CLEANUP =====
window.addEventListener('beforeunload', async () => {
    stopPolling();

    // Intentar hacer logout silencioso
    const username = getCurrentUser();
    if (username) {
        try {
            await api.logout(username);
        } catch (e) {
            // Ignorar errores en beforeunload
        }
    }
});

// ===== INICIAR APLICACIÓN =====
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}