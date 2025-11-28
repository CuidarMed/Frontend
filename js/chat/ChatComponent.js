// COMPONENTE DE CHAT - CuidarMed+

import { getChatMessages, markMessagesAsRead } from './ChatService.js';

// SignalR se carga como script global desde el CDN
const signalR = window.signalR || window.SignalR;

const SIGNALR_URL = "http://localhost:5046/chathub";

export class ChatComponent {
    constructor(config) {
        this.chatRoomIdRaw = config.chatRoomId;
        this.chatRoomId = Number(config.chatRoomId);
        if (!Number.isFinite(this.chatRoomId) || this.chatRoomId <= 0) {
            console.error('❌ ChatComponent: chatRoomId inválido', { rawChatRoomId: config.chatRoomId });
            this.chatRoomId = null;
        }
        this.currentUserId = config.currentUserId; // userId autenticado
        this.originalUserId = config.originalUserId || config.currentUserId; // userId del usuario autenticado
        // participantId = doctorId/patientId del usuario actual (solo para UI)
        this.participantId = (config.participantId ?? config.senderId ?? null);
        this.otherParticipantId = config.otherParticipantId ?? null;
        this.currentUserName = config.currentUserName || 'Usuario';
        this.otherUserName = config.otherUserName || 'Otro usuario';
        this.token = config.token;
        this.theme = config.theme || 'doctor'; // 'doctor' o 'patient'
        this.container = config.container;
        this.timeZone = config.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Argentina/Buenos_Aires';
        this.timeFormatter = new Intl.DateTimeFormat('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: this.timeZone
        });
        
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
            participantId: this.participantId,
            timeZone: this.timeZone,
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
        // No esperar a que termine para no bloquear la inicialización
        this.loadMessages().catch(error => {
            console.error('❌ Error al cargar mensajes en init:', error);
            // Continuar con la inicialización aunque falle la carga de mensajes
        });
        
        // Luego conectar SignalR para recibir mensajes en tiempo real
        await this.setupSignalR();
        
        // Informar cuál es la sala activa
        import('./ChatNotification.js').then(m => m.setActiveChatRoom?.(this.chatRoomId)).catch(() => {});
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
                border-radius: 0;
                box-shadow: none;
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
                            ${(this.otherUserName || 'Usuario').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 style="margin: 0; font-size: 1rem; font-weight: 600;">
                                ${this.otherUserName || 'Usuario'}
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
            
            const senderUserIdNum = Number(message.SenderId ?? message.senderId);
            if (message.senderParticipantId === undefined && message.SenderParticipantId === undefined) {
                if (Number.isFinite(senderUserIdNum) && Number.isFinite(Number(this.originalUserId)) && senderUserIdNum === Number(this.originalUserId)) {
                    message.senderParticipantId = this.participantId;
                } else {
                    message.senderParticipantId = this.otherParticipantId;
                }
            }
            
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
                // Marcá como leído y descontá ya
                try {
                    await markMessagesAsRead(this.chatRoomId, this.currentUserId, this.token);
                    document.dispatchEvent(new CustomEvent('chat:messagesRead', {
                        detail: { roomId: this.chatRoomId, count: 1 }
                    }));
                } catch (err) {
                    console.warn('⚠️ No se pudo marcar como leído en sala activa:', err);
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
            
            // Unirse a la sala usando el userId real (para el backend)
            const roomIdNum = Number(this.chatRoomId);
            const senderUserIdNum = Number(this.originalUserId);
            if (!Number.isFinite(roomIdNum) || roomIdNum <= 0 || !Number.isFinite(senderUserIdNum) || senderUserIdNum <= 0) {
                console.error('❌ JoinChatRoom: IDs inválidos', { roomIdNum, senderUserIdNum, rawRoomId: this.chatRoomId, rawUserId: this.originalUserId });
            } else {
                await this.connection.invoke("JoinChatRoom", roomIdNum, senderUserIdNum);
                console.log('✅ Unido a la sala con userId:', { roomIdNum, senderUserIdNum });
            }
        } catch (err) {
            console.error('❌ Error al conectar SignalR:', err);
        }
    }

    //Carga mensajes existentes
    async loadMessages() {
        // CRÍTICO: SIEMPRE usar currentUserId (UserId de autenticación) para cargar mensajes
        // El backend espera el UserId de la tabla Users, NO el participantId clínico
        const userIdForLoad = this.currentUserId;
        // Para marcar como leído, también usar currentUserId
        const userIdForRead = this.currentUserId;

        try {
            if (!this.chatRoomId || !userIdForLoad) {
                console.error('❌ No se pueden cargar mensajes: faltan chatRoomId o currentUserId', {
                    chatRoomId: this.chatRoomId,
                    currentUserId: userIdForLoad,
                    participantId: this.participantId
                });
                // Inicializar con array vacío en lugar de mostrar error
                this.messages = [];
                this.renderMessages();
                return;
            }
            
            console.log('📥 Cargando mensajes para ChatRoomId:', this.chatRoomId, 'UserId:', userIdForLoad, '(participantId clínico:', this.participantId, ')');
            
            // Verificar que tenemos el token
            if (!this.token) {
                console.warn('⚠️ No hay token disponible, intentando obtener del localStorage');
                this.token = localStorage.getItem('token');
            }
            
            const response = await getChatMessages(
                this.chatRoomId, 
                userIdForLoad, // Usar UserId, no participantId
                1, 
                50, 
                this.token
            );
            
            // Asegurarse de que response es un array
            const messagesArray = Array.isArray(response) 
                ? response 
                : (response?.items || response?.data || response?.value || []);
            
            // Filtrar mensajes para asegurar que pertenecen a este ChatRoomId
            const filteredMessages = messagesArray.filter(msg => {
                const msgRoomId = msg.ChatRoomId || msg.chatRoomId || msg.ChatRoomID;
                return Number(msgRoomId) === Number(this.chatRoomId);
            });
            
            this.messages = filteredMessages.map(msg => ({
                ...msg,
                senderParticipantId: msg.senderParticipantId ?? msg.SenderParticipantId ?? this.deriveParticipantId(msg)
            }));
            console.log('✅ Mensajes cargados del historial:', this.messages.length, 'mensajes para ChatRoomId:', this.chatRoomId);
            
            // Renderizar mensajes
            this.renderMessages();
            this.scrollToBottom();
            
            // Marcar como leídos usando currentUserId (userId de autenticación)
            // Esto actualizará el contador en el backend
            try {
                if (userIdForRead && this.chatRoomId) {
                    console.log('✓ Marcando mensajes como leídos con userId:', userIdForRead);
                    
                    // Contar mensajes no leídos antes de marcarlos
                    const unreadBefore = this.messages.filter(m => {
                        const senderId = Number(m.SenderId ?? m.senderId ?? 0);
                        const myUserId = Number(userIdForRead);
                        return !m.IsRead && senderId !== myUserId;
                    }).length;
                    
                    await markMessagesAsRead(this.chatRoomId, userIdForRead, this.token);
                    console.log('✅ Mensajes marcados como leídos en el backend');
                    
                    // Despachar evento para actualizar contador inmediatamente
                    if (unreadBefore > 0) {
                        console.log('📤 Despachando evento chat:messagesRead:', {
                            roomId: this.chatRoomId,
                            count: unreadBefore,
                            'tipo roomId': typeof this.chatRoomId,
                            'tipo count': typeof unreadBefore
                        });
                        const event = new CustomEvent('chat:messagesRead', {
                            detail: { roomId: this.chatRoomId, count: unreadBefore }
                        });
                        document.dispatchEvent(event);
                        console.log('✅ Evento chat:messagesRead despachado');
                    } else {
                        console.log('ℹ️ No hay mensajes no leídos para despachar evento (unreadBefore = 0)');
                    }
                    
                    // Actualizar contador de notificaciones desde el backend como fallback
                    // Hacer múltiples intentos para asegurar que se actualice
                    const updateCounter = async (attempt = 1) => {
                        try {
                            const { refreshUnreadCount } = await import('./ChatNotification.js');
                            await refreshUnreadCount();
                            console.log(`✅ Contador de notificaciones actualizado (intento ${attempt})`);
                            
                            // Si es el primer intento, hacer otro después de 1 segundo por si el backend aún está procesando
                            if (attempt === 1) {
                                setTimeout(() => updateCounter(2), 1000);
                            }
                        } catch (err) {
                            console.warn(`⚠️ No se pudo actualizar contador de notificaciones (intento ${attempt}):`, err);
                        }
                    };
                    
                    // Primer intento inmediato
                    setTimeout(() => updateCounter(1), 300);
                }
            } catch (readError) {
                console.warn('⚠️ No se pudieron marcar mensajes como leídos:', readError);
                // Continuar sin fallar
            }
        } catch (error) {
            console.error('❌ Error al cargar mensajes:', error);
            console.error('❌ Detalles del error:', {
                message: error.message,
                stack: error.stack,
                chatRoomId: this.chatRoomId,
                currentUserId: membershipId,
                hasToken: !!this.token
            });
            
            // En lugar de mostrar error, inicializar con array vacío para que el chat funcione
            this.messages = [];
            this.renderMessages();
            
            // Mostrar un mensaje informativo pero no bloqueante
            const messagesContainer = document.getElementById('chat-messages');
            if (messagesContainer && this.messages.length === 0) {
                // Solo mostrar mensaje si no hay mensajes
                const existingContent = messagesContainer.innerHTML;
                if (!existingContent.includes('No hay mensajes')) {
                    messagesContainer.innerHTML = `
                        <div style="
                            text-align: center;
                            color: #6b7280;
                            padding: 2rem;
                            font-size: 0.875rem;
                        ">
                            <i class="fas fa-comments" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                            <p>No hay mensajes aún. ¡Inicia la conversación!</p>
                            <p style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.5rem;">
                                ${error.message ? `Nota: ${error.message}` : ''}
                            </p>
                        </div>
                    `;
                }
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
        
        // Asegurar scroll al final después de renderizar todos los mensajes
        setTimeout(() => {
            this.scrollToBottom();
        }, 100);
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
        
        const messageSenderUserId = (message.SenderId ?? message.senderId ?? null);
        const messageSenderParticipantId = (message.SenderParticipantId ?? message.senderParticipantId ?? null);
        
        let finalIsOwn = false;
        if (messageSenderParticipantId !== null && this.participantId !== null) {
            const a = Number(messageSenderParticipantId);
            const b = Number(this.participantId);
            if (Number.isFinite(a) && Number.isFinite(b)) {
                finalIsOwn = (a === b);
            }
        }
        if (!finalIsOwn && messageSenderUserId !== null && this.originalUserId !== null) {
            const userMessage = Number(messageSenderUserId);
            const userCurrent = Number(this.originalUserId);
            if (Number.isFinite(userMessage) && Number.isFinite(userCurrent)) {
                finalIsOwn = (userMessage === userCurrent);
            }
        }
        
        const effectiveParticipantId = finalIsOwn
            ? this.participantId
            : (messageSenderParticipantId ?? this.otherParticipantId);
        
        console.log('🔍 Comparando mensaje:', {
            messageSenderUserId,
            messageSenderParticipantId,
            participantIdPropio: this.participantId,
            otherParticipantId: this.otherParticipantId,
            originalUserId: this.originalUserId,
            finalIsOwn,
            'RESULTADO': finalIsOwn ? '✅ PROPIO (derecha, verde)' : '❌ AJENO (izquierda, azul)',
            message: (message.Message || message.message || '').substring(0, 50),
            'message object keys': Object.keys(message)
        });
        
        // Mensajes propios: derecha, verde (#10b981)
        // Mensajes del otro: izquierda, azul claro (#e3f2fd)
        const bgColor   = finalIsOwn ? '#10b981' : '#e3f2fd'; // Verde (propios) / Celeste (ajenos)
        const textColor = finalIsOwn ? 'white'   : '#1f2937';
        const alignment = finalIsOwn ? 'flex-end': 'flex-start';

        const messageTimeValue = message.SendAt || message.sendAt || message.SentAt || message.sentAt || new Date();
        const timeString = this.formatMessageTime(messageTimeValue);

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
                margin-bottom: 0.5rem;
            ">
                <p style="margin: 0; font-size: 0.9375rem; line-height: 1.5; white-space: pre-wrap;">
                    ${(message.message || message.Message || '').replace(/\n/g, '<br>')}
                </p>
                <p style="
                    margin: 0.25rem 0 0 0;
                    font-size: 0.75rem;
                    opacity: ${finalIsOwn ? '0.9' : '0.7'};
                    text-align: ${finalIsOwn ? 'right' : 'left'};
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
        const senderIdNum = Number(this.originalUserId);
        const roomIdNum = Number(this.chatRoomId);
        if (!Number.isFinite(senderIdNum) || !Number.isFinite(roomIdNum)) {
            console.warn('⚠️ UserTyping: IDs inválidos', { roomIdNum, senderIdNum });
            return;
        }
        if (!this.isTyping) {
            this.isTyping = true;
            this.connection?.invoke("UserTyping", roomIdNum, senderIdNum, this.currentUserName);
        }

        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.isTyping = false;
            this.connection?.invoke("UserStoppedTyping", roomIdNum, senderIdNum);
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
        
        // CRÍTICO: Usar SOLO participantId para enviar mensajes (doctorId o patientId)
        // Si no hay participantId, mostrar error
        if (!this.participantId) {
            console.error('❌ No hay participantId configurado. No se puede enviar el mensaje.');
            alert('Error: No se pudo identificar al usuario. Por favor, recarga la página.');
            return;
        }
        
        const membershipId = this.participantId;

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

        // Crear mensaje optimista (se mostrará inmediatamente)
        const senderParticipantId = membershipId;
        const senderIdForServer = this.originalUserId;

        const optimisticMessage = {
            Id: Date.now(), // ID temporal
            ChatRoomId: this.chatRoomId,
            SenderId: senderIdForServer, // userId para persistencia
            senderId: senderIdForServer, // También en minúsculas para compatibilidad
            SenderParticipantId: senderParticipantId,
            senderParticipantId: senderParticipantId,
            SenderName: this.currentUserName || 'Tú',
            Message: message,
            message: message, // También en minúsculas para compatibilidad
            SendAt: new Date().toISOString(),
            sendAt: new Date().toISOString(), // También en minúsculas para compatibilidad
            IsRead: false
        };
        
        try {
            console.log('📤 Mensaje optimista creado:', {
                SenderId: optimisticMessage.SenderId,
                senderParticipantId: optimisticMessage.SenderParticipantId,
                originalUserId: this.originalUserId,
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
                senderId: senderIdForServer,
                senderParticipantId: senderParticipantId,
                message: message,
                'senderId type': typeof senderIdForServer,
                'currentUserId value': this.currentUserId,
                participantId: this.participantId
            });
            
            const roomIdNum = Number(this.chatRoomId);
            const senderIdNum = Number(senderIdForServer);
            if (!Number.isFinite(roomIdNum) || !Number.isFinite(senderIdNum) || roomIdNum <= 0 || senderIdNum <= 0) {
                console.error('❌ SendMessage: IDs inválidos', { roomIdNum, senderIdNum, rawRoomId: this.chatRoomId, rawSenderId: senderIdForServer });
                throw new Error('IDs inválidos al enviar mensaje');
            }
            
            await this.connection.invoke("SendMessage", roomIdNum, senderIdNum, message);
            
            console.log('✅ Mensaje enviado al servidor con userId:', { senderIdNum, roomIdNum });
            
            // Detener indicador de escritura
            this.isTyping = false;
            this.connection?.invoke("UserStoppedTyping", roomIdNum, senderIdNum);
            
            // Actualizar contador de notificaciones después de enviar mensaje
            // Con delay para dar tiempo al backend de procesar y actualizar LastSenderId
            setTimeout(async () => {
                try {
                    const { refreshUnreadCount } = await import('./ChatNotification.js');
                    await refreshUnreadCount();
                    console.log('✅ Contador de notificaciones actualizado después de enviar mensaje');
                } catch (err) {
                    console.warn('⚠️ Error al actualizar contador después de enviar mensaje:', err);
                }
            }, 500); // 500ms de delay para dar tiempo al backend
            
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
            // Usar múltiples métodos para asegurar el scroll
            const scroll = () => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                // También usar scrollIntoView en el último mensaje
                const lastMessage = messagesContainer.lastElementChild;
                if (lastMessage) {
                    lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
                }
            };
            
            // Usar requestAnimationFrame para asegurar que el DOM se haya actualizado
            requestAnimationFrame(() => {
                scroll();
                // También intentar después de un pequeño delay por si acaso
                setTimeout(() => {
                    scroll();
                }, 100);
            });
        }
    }

    formatMessageTime(dateValue) {
        if (!dateValue) return '';
        
        let date;
        
        // Manejar diferentes formatos de fecha
        if (typeof dateValue === 'string') {
            // Si es un string, verificar si tiene información de zona horaria
            const hasTimezone = dateValue.includes('Z') || 
                               dateValue.includes('+') || 
                               (dateValue.includes('-') && dateValue.length > 19); // ISO con offset
            
            if (!hasTimezone && dateValue.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
                // Si es formato ISO sin zona horaria (ej: "2025-11-29T10:00:00"), asumir UTC
                date = new Date(dateValue + 'Z');
            } else {
                // Intentar parsear directamente
                date = new Date(dateValue);
            }
        } else if (dateValue instanceof Date) {
            date = dateValue;
        } else {
            // Intentar crear Date desde el valor
            date = new Date(dateValue);
        }
        
        if (isNaN(date.getTime())) {
            console.warn('⚠️ Fecha inválida:', dateValue);
            return '';
        }
        
        try {
            // Usar el formateador con zona horaria local
            // El formateador ya está configurado para convertir UTC a la zona horaria local
            return this.timeFormatter.format(date);
        } catch (err) {
            console.warn('⚠️ No se pudo formatear la fecha del mensaje:', err);
            // Fallback: formatear directamente con zona horaria local
            return date.toLocaleTimeString('es-AR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: this.timeZone
            });
        }
    }

    deriveParticipantId(message) {
        const senderUserId = Number(message.SenderId ?? message.senderId);
        if (Number.isFinite(senderUserId) && Number.isFinite(Number(this.originalUserId)) && senderUserId === Number(this.originalUserId)) {
            return this.participantId;
        }
        return this.otherParticipantId;
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
        
        // Limpiar sala activa
        try {
            (await import('./ChatNotification.js')).setActiveChatRoom?.(null);
        } catch {}
        
        // Actualizar contador de notificaciones al cerrar el chat
        // (por si se marcaron mensajes como leídos mientras estaba abierto)
        try {
            const { refreshUnreadCount } = await import('./ChatNotification.js');
            setTimeout(async () => {
                await refreshUnreadCount();
                console.log('✅ Contador actualizado al cerrar el chat');
            }, 300);
        } catch (err) {
            // Ignorar si el módulo no está disponible
        }
        
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
