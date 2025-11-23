// COMPONENTE DE CHAT - CuidarMed+
import { getChatMessages, markMessagesAsRead } from './chat-service.js';

const SIGNALR_URL = "http://localhost:5046/chathub";

export class ChatComponent {
    constructor(config) {
        this.chatRoomId = config.chatRoomId;
        this.currentUserId = config.currentUserId;
        this.currentUserName = config.currentUserName;
        this.otherUserName = config.otherUserName;
        this.token = config.token;
        this.theme = config.theme || 'doctor'; // 'doctor' o 'patient'
        this.container = config.container;
        
        // ✅ Validar que los IDs existan
        console.log('🔧 ChatComponent config:', {
            chatRoomId: this.chatRoomId,
            currentUserId: this.currentUserId,
            currentUserName: this.currentUserName,
            otherUserName: this.otherUserName
        });
        
        if (!this.chatRoomId || !this.currentUserId) {
            console.error('❌ Faltan IDs requeridos:', {
                chatRoomId: this.chatRoomId,
                currentUserId: this.currentUserId
            });
            this.container.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: #ef4444;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                    <p>Error: No se pudo inicializar el chat</p>
                    <p style="font-size: 0.875rem; color: #6b7280;">Faltan datos necesarios</p>
                </div>
            `;
            return;
        }

        this.connection = null;
        this.messages = [];
        this.isTyping = false;
        this.typingTimeout = null;
        
        this.init();
    }

    
     // Inicializa el componente
    async init() {
        this.render();
        await this.setupSignalR();
        await this.loadMessages();
        this.attachEventListeners();
    }

    //Renderiza la UI del chat
    render() {
        const themeColors = this.theme === 'doctor' 
            ? { primary: '#10b981', secondary: '#f0fdf4', accent: '#059669' }
            : { primary: '#3b82f6', secondary: '#eff6ff', accent: '#2563eb' };

        this.container.innerHTML = `
            <div class="chat-container" style="
                display: flex;
                flex-direction: column;
                height: 100%;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                overflow: hidden;
            ">
                <!-- Header -->
                <div class="chat-header" style="
                    background: linear-gradient(135deg, ${themeColors.primary} 0%, ${themeColors.accent} 100%);
                    color: white;
                    padding: 1rem 1.5rem;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                ">
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <div style="
                            width: 40px;
                            height: 40px;
                            border-radius: 50%;
                            background: white;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            color: ${themeColors.primary};
                            font-weight: bold;
                        ">
                            ${this.otherUserName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 600;">
                                ${this.otherUserName}
                            </h3>
                            <p id="chat-status" style="
                                margin: 0;
                                font-size: 0.75rem;
                                opacity: 0.9;
                            ">
                                <i class="fas fa-circle" style="font-size: 0.5rem;"></i> En línea
                            </p>
                        </div>
                    </div>
                    <button id="chat-close-btn" style="
                        background: rgba(255,255,255,0.2);
                        border: none;
                        color: white;
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                       onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                        <i class="fas fa-times"></i>
                    </button>
                </div>

                <!-- Typing indicator -->
                <div id="typing-indicator" style="
                    display: none;
                    padding: 0.5rem 1.5rem;
                    background: ${themeColors.secondary};
                    font-size: 0.875rem;
                    color: #6b7280;
                    font-style: italic;
                ">
                    <i class="fas fa-ellipsis-h fa-fade"></i> ${this.otherUserName} está escribiendo...
                </div>

                <!-- Messages area -->
                <div id="chat-messages" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 1.5rem;
                    background: white;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                ">
                    <!-- Los mensajes se cargarán aquí -->
                </div>

                <!-- Input area -->
                <div class="chat-input-area" style="
                    padding: 1rem 1.5rem;
                    background: #f9fafb;
                    border-top: 1px solid #e5e7eb;
                    display: flex;
                    gap: 0.75rem;
                    align-items: flex-end;
                ">
                    <textarea 
                        id="chat-message-input" 
                        placeholder="Escribe un mensaje..."
                        rows="1"
                        style="
                            flex: 1;
                            padding: 0.75rem 1rem;
                            border: 1px solid #d1d5db;
                            border-radius: 24px;
                            resize: none;
                            font-family: inherit;
                            font-size: 0.875rem;
                            max-height: 120px;
                            outline: none;
                            transition: border-color 0.2s;
                        "
                        onfocus="this.style.borderColor='${themeColors.primary}'"
                        onblur="this.style.borderColor='#d1d5db'"
                    ></textarea>
                    <button id="chat-send-btn" style="
                        background: ${themeColors.primary};
                        color: white;
                        border: none;
                        width: 44px;
                        height: 44px;
                        border-radius: 50%;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    " onmouseover="this.style.transform='scale(1.05)'; this.style.background='${themeColors.accent}'" 
                       onmouseout="this.style.transform='scale(1)'; this.style.background='${themeColors.primary}'">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        `;
    }

    //Configura SignalR
    async setupSignalR() {
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(SIGNALR_URL)
            .withAutomaticReconnect()
            .build();

        // Evento: Recibir mensaje
        this.connection.on("ReceiveMessage", (message) => {
            this.addMessage(message);
            this.scrollToBottom();
            
            // Marcar como leído si no es nuestro mensaje
            if (message.senderId !== this.currentUserId) {
                markMessagesAsRead(this.chatRoomId, this.currentUserId, this.token);
            }
        });

        // Evento: Usuario escribiendo
        this.connection.on("UserTyping", (data) => {
            if (data.userId !== this.currentUserId) {
                this.showTypingIndicator();
            }
        });

        // Evento: Usuario dejó de escribir
        this.connection.on("UserStoppedTyping", (userId) => {
            if (userId !== this.currentUserId) {
                this.hideTypingIndicator();
            }
        });

        // Conectar
        try {
            await this.connection.start();
            console.log('✅ Conectado a SignalR');
            
            // Unirse a la sala
            await this.connection.invoke("JoinChatRoom", this.chatRoomId, this.currentUserId);
            console.log('✅ Unido a la sala:', this.chatRoomId);
        } catch (err) {
            console.error('❌ Error al conectar SignalR:', err);
        }
    }

    //Carga mensajes existentes
    async loadMessages() {
        try {
            console.log('💬 Cargando mensajes con:', {
                chatRoomId: this.chatRoomId,
                currentUserId: this.currentUserId
            });

            const response = await getChatMessages(
                this.chatRoomId, 
                this.currentUserId, 
                1, 
                50, 
            );
            
            this.messages = response.items || [];
            this.renderMessages();
            this.scrollToBottom();
            
            // ✅ Solo marcar como leídos si hay mensajes
        if (this.messages.length > 0) {
            try {
                await markMessagesAsRead(this.chatRoomId, this.currentUserId);
            } catch (err) {
                console.warn('⚠️ No se pudieron marcar mensajes como leídos:', err);
            }
        }
        } catch (error) {
            console.error('❌ Error al cargar mensajes:', error);
            // ✅ Mostrar UI vacía en lugar de fallar
            this.messages = [];
            this.renderMessages();
        }
    }

    //Renderiza todos los mensajes
    renderMessages() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';
        
        if (this.messages.length === 0) {
            messagesContainer.innerHTML = `
                <div style="
                    text-align: center;
                    color: #9ca3af;
                    padding: 2rem;
                    font-size: 0.875rem;
                ">
                    <i class="fas fa-comments" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                    <p>No hay mensajes aún. ¡Inicia la conversación!</p>
                </div>
            `;
            return;
        }

        this.messages.forEach(message => {
            this.addMessage(message, false);
        });
    }

    //Agrega un mensaje al chat
    addMessage(message, append = true) {
        const messagesContainer = document.getElementById('chat-messages');
        const isOwn = message.senderId === this.currentUserId;
        
        const themeColor = this.theme === 'doctor' ? '#10b981' : '#3b82f6';
        const bgColor = isOwn ? themeColor : '#f3f4f6';
        const textColor = isOwn ? 'white' : '#1f2937';
        const alignment = isOwn ? 'flex-end' : 'flex-start';

        const messageTime = new Date(message.sentAt || message.SentAt);
        const timeString = messageTime.toLocaleTimeString('es-AR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        const messageEl = document.createElement('div');
        messageEl.style.cssText = `
            display: flex;
            justify-content: ${alignment};
            animation: slideIn 0.3s ease-out;
        `;

        messageEl.innerHTML = `
            <div style="
                max-width: 70%;
                background: ${bgColor};
                color: ${textColor};
                padding: 0.75rem 1rem;
                border-radius: ${isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                word-wrap: break-word;
            ">
                <p style="margin: 0; font-size: 0.9375rem; line-height: 1.5;">
                    ${message.message || message.Message}
                </p>
                <p style="
                    margin: 0.25rem 0 0 0;
                    font-size: 0.75rem;
                    opacity: ${isOwn ? '0.8' : '0.6'};
                    text-align: right;
                ">
                    ${timeString}
                </p>
            </div>
        `;

        if (append) {
            messagesContainer.appendChild(messageEl);
        } else {
            messagesContainer.insertBefore(messageEl, messagesContainer.firstChild);
        }
    }

    // Adjuntar event listeners
    attachEventListeners() {
        const input = document.getElementById('chat-message-input');
        const sendBtn = document.getElementById('chat-send-btn');
        const closeBtn = document.getElementById('chat-close-btn');

        // Auto-resize del textarea
        input.addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
            
            // Notificar que está escribiendo
            this.handleTyping();
        });

        // Enviar con Enter (Shift+Enter para nueva línea)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Enviar con botón
        sendBtn.addEventListener('click', () => this.sendMessage());

        // Cerrar chat
        closeBtn.addEventListener('click', () => this.close());
    }

    // Notificar que está escribiendo
    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            this.connection?.invoke("UserTyping", this.chatRoomId, this.currentUserId, this.currentUserName);
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            this.connection?.invoke("UserStoppedTyping", this.chatRoomId, this.currentUserId);
        }, 1000);
    }

    // Mostrar el indicador de escritura
    showTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.style.display = 'block';
        }
    }

    // Ocultar el indicador de escritura
    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    // Enviar el mensaje
    async sendMessage() {
        const input = document.getElementById('chat-message-input');
        const message = input.value.trim();

        if (!message) return;

        try {
            await this.connection.invoke("SendMessage", {
                ChatRoomId: this.chatRoomId,
                SenderId: this.currentUserId,
                Message: message
            });

            input.value = '';
            input.style.height = 'auto';
            
            // Detener indicador de escritura
            this.isTyping = false;
            this.connection?.invoke("UserStoppedTyping", this.chatRoomId, this.currentUserId);
        } catch (error) {
            console.error('❌ Error al enviar mensaje:', error);
            alert('No se pudo enviar el mensaje. Intenta nuevamente.');
        }
    }

    // Desplazar hacia abajo
    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 100);
        }
    }

    // Cerrar el chat
    async close() {
        try {
            await this.connection?.invoke("LeaveChatRoom", this.chatRoomId);
            await this.connection?.stop();
        } catch (error) {
            console.error('Error al cerrar chat:', error);
        }
        
        this.container.innerHTML = '';
        
        // Callback de cierre si existe
        if (this.onClose) {
            this.onClose();
        }
    }
}

// Agregar animación CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;

document.head.appendChild(style);
