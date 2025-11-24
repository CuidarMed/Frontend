// COMPONENTE DE CHAT - CuidarMed+

import { getChatMessages, markMessagesAsRead } from './ChatService.js';

// SignalR se carga como script global desde el CDN
const signalR = window.signalR || window.SignalR;

const SIGNALR_URL = "http://localhost:5046/chathub";

export class ChatComponent {
    constructor(config) {
        this.chatRoomId = config.chatRoomId;
        this.currentUserId = config.currentUserId; // Este es el senderId (doctorId o patientId)
        this.originalUserId = config.originalUserId || config.currentUserId; // userId del usuario autenticado
        this.currentUserName = config.currentUserName;
        this.otherUserName = config.otherUserName;
        this.token = config.token;
        this.theme = config.theme || 'doctor'; // 'doctor' o 'patient'
        this.container = config.container;
        
        this.connection = null;
        this.messages = [];
        this.isTyping = false;
        this.typingTimeout = null;
        this.onClose = config.onClose || null; // Callback para cuando se cierra
        
        console.log('🔍 ChatComponent inicializado:', {
            chatRoomId: this.chatRoomId,
            currentUserId: this.currentUserId,
            'TIPO currentUserId': typeof this.currentUserId,
            originalUserId: this.originalUserId,
            'TIPO originalUserId': typeof this.originalUserId,
            currentUserName: this.currentUserName,
            otherUserName: this.otherUserName
        });
        
        this.init();
    }

    
     // Inicializa el componente
     
    async init() {
        // Validar que tenemos los datos necesarios
        if (!this.chatRoomId || !this.currentUserId) {
            console.error('❌ Faltan datos necesarios:', { 
                chatRoomId: this.chatRoomId, 
                currentUserId: this.currentUserId 
            });
            if (this.container) {
                this.container.innerHTML = '<div style="padding: 2rem; text-align: center; color: red;">Error: Faltan datos necesarios para el chat</div>';
            }
            return;
        }
        
        console.log('🚀 Inicializando chat:', { 
            chatRoomId: this.chatRoomId, 
            currentUserId: this.currentUserId 
        });
        
        this.render();
        this.attachEventListeners();
        
        // Cargar mensajes primero (antes de conectar SignalR)
        await this.loadMessages();
        
        // Luego conectar SignalR para recibir mensajes en tiempo real
        await this.setupSignalR();
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
        // Verificar que SignalR esté disponible
        if (!signalR || !signalR.HubConnectionBuilder) {
            console.warn('⚠️ SignalR no está disponible. El chat funcionará sin tiempo real.');
            return;
        }
        
        if (!this.chatRoomId || !this.currentUserId) {
            console.error('❌ No se puede configurar SignalR: faltan chatRoomId o currentUserId');
            return;
        }

        // Configurar SignalR con opciones de transporte
        const transportOptions = {
            skipNegotiation: false
        };
        
        // Intentar WebSockets primero, luego LongPolling como fallback
        this.connection = new signalR.HubConnectionBuilder()
            .withUrl(SIGNALR_URL, transportOptions)
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: retryContext => {
                    if (retryContext.elapsedMilliseconds < 60000) {
                        return 2000; // Reintentar cada 2 segundos durante el primer minuto
                    }
                    return 10000; // Luego cada 10 segundos
                }
            })
            .build();

        // Evento: Recibir mensaje
        this.connection.on("ReceiveMessage", async (message) => {
            console.log('📨 Mensaje recibido:', message);
            console.log('📨 Detalles del mensaje recibido:', {
                SenderId: message.SenderId,
                senderId: message.senderId,
                'currentUserId (nuestro)': this.currentUserId,
                'TIPO SenderId': typeof message.SenderId,
                'TIPO currentUserId': typeof this.currentUserId,
                'SON IGUALES?': Number(message.SenderId) === Number(this.currentUserId),
                'Message': message.Message || message.message,
                'message object completo': message
            });
            
            // Verificar si es un mensaje optimista que debemos reemplazar
            // Buscar por mensaje y senderId (más confiable que por ID temporal)
            const messageSenderId = message.SenderId || message.senderId;
            const optimisticIndex = this.messages.findIndex(m => {
                const mSenderId = m.SenderId || m.senderId;
                return m.Id && m.Id > 1000000000000 && // IDs temporales son timestamps grandes
                       (m.Message || m.message) === (message.Message || message.message) &&
                       (Number(mSenderId) === Number(messageSenderId) || 
                        String(mSenderId).toLowerCase() === String(messageSenderId).toLowerCase()) &&
                       Math.abs(new Date(m.SendAt || m.sendAt || m.SentAt || m.sentAt).getTime() - 
                               new Date(message.SendAt || message.sendAt || message.SentAt || message.sentAt).getTime()) < 5000; // Dentro de 5 segundos
            });
            
            if (optimisticIndex !== -1) {
                // Reemplazar mensaje optimista con el real
                this.messages[optimisticIndex] = message;
                console.log('✅ Mensaje optimista reemplazado por el real');
                // Re-renderizar solo este mensaje específico
                this.renderMessages();
                this.scrollToBottom();
                return; // Salir temprano para evitar procesamiento adicional
            }
            
            // Verificar si el mensaje ya existe (por ID real)
            const messageExists = this.messages.some(m => 
                (m.Id || m.id) === (message.Id || message.id) &&
                (m.Id || m.id) < 1000000000000 // Solo IDs reales, no temporales
            );
            
            if (!messageExists) {
                this.messages.push(message);
                console.log('✅ Mensaje agregado al array. Total mensajes:', this.messages.length);
                // Re-renderizar todos los mensajes
                this.renderMessages();
                this.scrollToBottom();
            } else {
                console.log('⚠️ Mensaje ya existe en el array, ignorando duplicado');
            }
            
            // Marcar como leído si no es nuestro mensaje (reutilizar messageSenderId ya declarado arriba)
            if (Number(messageSenderId) !== Number(this.currentUserId)) {
                markMessagesAsRead(this.chatRoomId, this.currentUserId, this.token).catch(err => {
                    console.warn('⚠️ No se pudo marcar como leído:', err);
                });
                
                // Notificar al sistema de notificaciones que se recibió un mensaje
                try {
                    const { markMessageAsRead } = await import('./ChatNotification.js');
                    markMessageAsRead();
                } catch (err) {
                    // Ignorar si el módulo no está disponible
                }
            }
        });

        // Evento: Usuario escribiendo
        this.connection.on("UserTyping", (data) => {
            const userId = typeof data === 'object' ? data.userId : data;
            if (userId !== this.currentUserId) {
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
            if (!this.chatRoomId || !this.currentUserId) {
                console.error('❌ No se puede conectar: faltan chatRoomId o currentUserId');
                return;
            }
            
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
            if (!this.chatRoomId || !this.currentUserId) {
                console.error('❌ No se pueden cargar mensajes: faltan chatRoomId o currentUserId');
                return;
            }
            
            console.log('📥 Cargando mensajes para ChatRoomId:', this.chatRoomId);
            
            const response = await getChatMessages(
                this.chatRoomId, 
                this.currentUserId, 
                1, 
                50, 
                this.token
            );
            
            // Asegurarse de que response es un array
            const messagesArray = Array.isArray(response) 
                ? response 
                : (response?.items || response?.data || []);
            
            // Filtrar mensajes para asegurar que pertenecen a este ChatRoomId
            const filteredMessages = messagesArray.filter(msg => {
                const msgRoomId = msg.ChatRoomId || msg.chatRoomId || msg.ChatRoomID;
                return Number(msgRoomId) === Number(this.chatRoomId);
            });
            
            this.messages = filteredMessages;
            console.log('✅ Mensajes cargados del historial:', this.messages.length, 'mensajes para ChatRoomId:', this.chatRoomId);
            
            // Renderizar mensajes
            this.renderMessages();
            this.scrollToBottom();
            
            // Marcar como leídos (no crítico si falla)
            try {
                await markMessagesAsRead(this.chatRoomId, this.currentUserId, this.token);
                
                // Actualizar contador de notificaciones
                try {
                    const { refreshUnreadCount } = await import('./ChatNotification.js');
                    await refreshUnreadCount();
                } catch (err) {
                    // Ignorar si el módulo no está disponible
                }
            } catch (readError) {
                console.warn('⚠️ No se pudieron marcar mensajes como leídos:', readError);
                // Continuar sin fallar
            }
        } catch (error) {
            console.error('❌ Error al cargar mensajes:', error);
            // Mostrar mensaje de error en el chat
            const messagesContainer = document.getElementById('chat-messages');
            if (messagesContainer) {
                messagesContainer.innerHTML = `
                    <div style="
                        text-align: center;
                        color: #ef4444;
                        padding: 2rem;
                        font-size: 0.875rem;
                    ">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                        <p>Error al cargar mensajes. Por favor, recarga la página.</p>
                    </div>
                `;
            }
        }
    }

    //Renderiza todos los mensajes
    renderMessages() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) {
            console.error('❌ No se encontró el contenedor de mensajes');
            return;
        }
        
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

        // Ordenar mensajes por fecha (más antiguos primero)
        const sortedMessages = [...this.messages].sort((a, b) => {
            const dateA = new Date(a.SendAt || a.sendAt || a.SentAt || a.sentAt || 0);
            const dateB = new Date(b.SendAt || b.sendAt || b.SentAt || b.sentAt || 0);
            return dateA - dateB;
        });
        
        console.log('📋 Renderizando', sortedMessages.length, 'mensajes');
        if (sortedMessages.length > 0) {
            console.log('📋 Primeros 3 mensajes:', sortedMessages.slice(0, 3).map(m => ({
                id: m.Id || m.id,
                senderId: m.SenderId || m.senderId,
                message: m.Message || m.message,
                sendAt: m.SendAt || m.sendAt || m.SentAt || m.sentAt
            })));
        }
        
        sortedMessages.forEach((message, index) => {
            this.addMessage(message, true); // append = true para agregar al final
        });
    }

    //Agrega un mensaje al chat
    addMessage(message, append = true) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) {
            console.error('❌ No se encontró el contenedor de mensajes');
            return;
        }
        
        // Si el contenedor tiene el mensaje de "No hay mensajes", limpiarlo
        if (messagesContainer.querySelector('div[style*="text-align: center"]')) {
            messagesContainer.innerHTML = '';
        }
        
        // Comparar senderId del mensaje con el currentUserId (senderId del usuario actual)
        // Manejar diferentes formatos de propiedades (mayúsculas/minúsculas)
        const messageSenderId = message.SenderId !== undefined ? message.SenderId : 
                                (message.senderId !== undefined ? message.senderId : null);
        const currentSenderId = this.currentUserId;
        
        // Convertir a números para comparación precisa
        const messageSenderIdNum = messageSenderId !== null ? Number(messageSenderId) : NaN;
        const currentSenderIdNum = currentSenderId !== null && currentSenderId !== undefined ? Number(currentSenderId) : NaN;
        
        // Comparar como números (más confiable)
        const isOwn = !isNaN(messageSenderIdNum) && !isNaN(currentSenderIdNum) && 
                     messageSenderIdNum === currentSenderIdNum;
        
        // Si la comparación numérica falla, intentar como strings
        const isOwnString = !isOwn && 
                           messageSenderId !== null && 
                           currentSenderId !== null &&
                           String(messageSenderId).trim() === String(currentSenderId).trim();
        
        const finalIsOwn = isOwn || isOwnString;
        
        console.log('🔍 Comparando mensaje:', {
            messageSenderId: messageSenderId,
            messageSenderIdNum: messageSenderIdNum,
            currentSenderId: currentSenderId,
            currentSenderIdNum: currentSenderIdNum,
            isOwn: isOwn,
            isOwnString: isOwnString,
            finalIsOwn: finalIsOwn,
            message: message.Message || message.message,
            'message object keys': Object.keys(message)
        });
        
        // Mensajes propios: derecha, verde (#10b981)
        // Mensajes del otro: izquierda, azul claro (#e3f2fd) o gris (#f3f4f6)
        const bgColor = finalIsOwn ? '#10b981' : '#e3f2fd'; // Verde para propios, azul claro para otros
        const textColor = finalIsOwn ? 'white' : '#1f2937'; // Blanco para propios, oscuro para otros
        const alignment = finalIsOwn ? 'flex-end' : 'flex-start'; // Derecha para propios, izquierda para otros

        const messageTime = new Date(message.SendAt || message.sendAt || message.SentAt || message.sentAt || new Date());
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
                border-radius: ${finalIsOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                word-wrap: break-word;
            ">
                <p style="margin: 0; font-size: 0.9375rem; line-height: 1.5;">
                    ${message.message || message.Message}
                </p>
                <p style="
                    margin: 0.25rem 0 0 0;
                    font-size: 0.75rem;
                    opacity: ${finalIsOwn ? '0.8' : '0.6'};
                    text-align: right;
                ">
                    ${timeString}
                </p>
            </div>
        `;

        // Siempre agregar al final para que los mensajes nuevos aparezcan abajo
        messagesContainer.appendChild(messageEl);
        
        // Hacer scroll al final después de agregar el mensaje
        this.scrollToBottom();
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

        // Verificar que la conexión esté activa
        if (!this.connection) {
            console.error('❌ No hay conexión SignalR disponible');
            alert('No se puede enviar el mensaje. La conexión no está establecida. Por favor, recarga la página.');
            return;
        }
        
        // Verificar el estado de la conexión (puede ser número o string dependiendo de la versión)
        const state = this.connection.state;
        const isConnected = state === signalR.HubConnectionState.Connected || 
                           state === 'Connected' || 
                           state === 1;
        
        if (!isConnected) {
            console.error('❌ La conexión SignalR no está activa. Estado:', state);
            alert('No se puede enviar el mensaje. La conexión no está establecida. Por favor, recarga la página.');
            return;
        }

        try {
            // Crear mensaje optimista (se mostrará inmediatamente)
            const optimisticMessage = {
                Id: Date.now(), // ID temporal
                ChatRoomId: this.chatRoomId,
                SenderId: this.currentUserId, // Usar el senderId correcto
                senderId: this.currentUserId, // También en minúsculas para compatibilidad
                SenderName: this.currentUserName || 'Tú',
                Message: message,
                message: message, // También en minúsculas para compatibilidad
                SendAt: new Date().toISOString(),
                sendAt: new Date().toISOString(), // También en minúsculas para compatibilidad
                IsRead: false
            };
            
            console.log('📤 Mensaje optimista creado:', {
                SenderId: optimisticMessage.SenderId,
                currentUserId: this.currentUserId,
                message: message
            });
            
            // Agregar mensaje optimista solo al array (no al DOM directamente)
            // Se renderizará cuando se llame a renderMessages()
            this.messages.push(optimisticMessage);
            this.renderMessages(); // Re-renderizar para mostrar el mensaje optimista
            this.scrollToBottom();
            
            // Limpiar input
            input.value = '';
            input.style.height = 'auto';
            
            // Enviar mensaje al servidor
            console.log('📤 Enviando mensaje:', {
                chatRoomId: this.chatRoomId,
                senderId: this.currentUserId,
                message: message,
                'currentUserId type': typeof this.currentUserId,
                'currentUserId value': this.currentUserId
            });
            
            await this.connection.invoke("SendMessage", this.chatRoomId, this.currentUserId, message);
            
            console.log('✅ Mensaje enviado al servidor con senderId:', this.currentUserId);
            
            // Detener indicador de escritura
            this.isTyping = false;
            this.connection?.invoke("UserStoppedTyping", this.chatRoomId, this.currentUserId);
            
            // El mensaje real llegará a través de SignalR y reemplazará el optimista
        } catch (error) {
            console.error('❌ Error al enviar mensaje:', error);
            
            // Remover mensaje optimista si falló
            const optimisticIndex = this.messages.findIndex(m => m.Id === optimisticMessage.Id);
            if (optimisticIndex !== -1) {
                this.messages.splice(optimisticIndex, 1);
                this.renderMessages(); // Re-renderizar sin el mensaje fallido
            }
            
            alert('No se pudo enviar el mensaje. Intenta nuevamente.');
        }
    }

    // Desplazar hacia abajo
    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            // Usar requestAnimationFrame para asegurar que el DOM se haya actualizado
            requestAnimationFrame(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                // También intentar después de un pequeño delay por si acaso
                setTimeout(() => {
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                }, 50);
            });
        }
    }

    // Cerrar el chat
    async close() {
        console.log('🔒 Cerrando chat...');
        try {
            // Solo intentar salir de la sala si la conexión está activa
            if (this.connection) {
                const state = this.connection.state;
                const isConnected = state === signalR.HubConnectionState.Connected || 
                                 state === 'Connected' || 
                                 state === 1;
                
                if (isConnected) {
                    try {
                        await this.connection.invoke("LeaveChatRoom", this.chatRoomId, this.currentUserId);
                    } catch (leaveError) {
                        console.warn('⚠️ Error al salir de la sala (no crítico):', leaveError);
                    }
                    
                    try {
                        await this.connection.stop();
                        console.log('✅ Conexión SignalR detenida');
                    } catch (stopError) {
                        console.warn('⚠️ Error al detener conexión:', stopError);
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Error al cerrar chat (no crítico):', error);
        }
        
        // Limpiar referencias
        this.connection = null;
        this.messages = [];
        
        // NO limpiar el contenedor aquí, eso lo hace closeChat() en ChatIntegration.js
        // Llamar al callback si existe (esto removerá el modal)
        if (this.onClose && typeof this.onClose === 'function') {
            await this.onClose();
        }
        
        console.log('✅ Chat cerrado');
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
