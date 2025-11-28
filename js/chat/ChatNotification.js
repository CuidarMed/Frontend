// Módulo de notificaciones de chat para la navbar
// Funciona tanto para doctor como para paciente

import { getUserChatRooms } from './ChatService.js';

const SIGNALR_URL = "http://localhost:5046/chathub";
let chatNotificationConnection = null;
let unreadCount = 0;
let currentUserId = null; // userId de autenticación
let participantId = null; // doctorId/patientId (ID clínico) para buscar salas
let userType = null; // 'doctor' o 'patient'
let onChatClickCallback = null;
let chatBtnElement = null;
let toastContainer = null;
let activeRoomId = null; // sala abierta ahora
const perRoomUnread = new Map(); // roomId -> unread
let messagesReadListenerAdded = false; // Flag para evitar agregar el listener múltiples veces

/**
 * Inicializa el sistema de notificaciones de chat para el doctor
 */
export async function initializeChatNotifications() {
    // Obtener userId del estado del doctor
    const { doctorState } = await import('../doctor-js/doctor-core.js');
    const userId = doctorState.currentUser?.userId || 
                  doctorState.currentUser?.UserId || 
                  doctorState.currentUser?.id || 
                  doctorState.currentUser?.Id;
    
    if (!userId) {
        console.warn('⚠️ No se pudo obtener userId para notificaciones de chat');
        return;
    }
    
    currentUserId = userId;
    userType = 'doctor';
    
    // Obtener doctorId (participantId clínico) para buscar salas
    participantId = doctorState.currentDoctorData?.doctorId || doctorState.currentDoctorData?.id;
    if (!participantId) {
        console.warn('⚠️ No se pudo obtener doctorId para notificaciones de chat');
    } else {
        console.log('✅ DoctorId obtenido para notificaciones:', participantId);
    }
    
    // Callback para abrir lista de chats disponibles
    onChatClickCallback = async () => {
        await showChatListModal('doctor');
    };
    
    console.log('🔔 Inicializando notificaciones de chat para doctor:', { userId });
    
    // Cargar contador inicial de mensajes no leídos
    await updateUnreadCount();
    
    // Conectar a SignalR para recibir notificaciones en tiempo real
    await setupSignalRNotifications();
    
    // Configurar el botón de chat
    setupChatButton();
    
    // Descontar de badge cuando alguien nos avisa cuántos leímos
    document.addEventListener('chat:messagesRead', (e) => {
        const { roomId, count } = e.detail || {};
        const rid = Number(roomId);
        const c = Number(count);
        
        console.log('📖 Evento chat:messagesRead recibido:', { roomId: rid, count: c, detail: e.detail });
        
        if (!Number.isFinite(c) || c <= 0) {
            console.warn('⚠️ Evento chat:messagesRead con count inválido:', c);
            return;
        }
        
        if (!Number.isFinite(rid) || rid <= 0) {
            console.warn('⚠️ Evento chat:messagesRead con roomId inválido:', rid);
            return;
        }
        
        // Actualizar el Map: si la sala no está, inicializarla en 0 y luego descontar
        const currentUnread = perRoomUnread.get(rid) || 0;
        const newUnread = Math.max(0, currentUnread - c);
        perRoomUnread.set(rid, newUnread);
        
        // Recalcular total desde el Map
        const previousUnreadCount = unreadCount;
        unreadCount = [...perRoomUnread.values()].reduce((a, b) => a + b, 0);
        
        console.log('📊 Actualizando Map por sala:', {
            roomId: rid,
            currentUnread,
            countLeidos: c,
            newUnread,
            previousTotal: previousUnreadCount,
            newTotal: unreadCount,
            mapSize: perRoomUnread.size,
            mapKeys: [...perRoomUnread.keys()],
            'sala estaba en Map?': perRoomUnread.has(rid) || currentUnread > 0
        });
        
        // Si el total no cambió pero debería haber cambiado, forzar actualización desde backend
        if (previousUnreadCount === unreadCount && c > 0 && currentUnread > 0) {
            console.warn('⚠️ El total no cambió después de descontar, refrescando desde backend');
            updateUnreadCount().catch(err => {
                console.warn('⚠️ Error al refrescar desde backend:', err);
            });
        } else {
            updateChatBadge();
            console.log('✅ Badge actualizado después de evento chat:messagesRead');
        }
    });
}

/**
 * Inicializa el sistema de notificaciones de chat para el paciente
 */
export async function initializeChatNotificationsPatient() {
    // Obtener userId del estado del paciente
    const { appState } = await import('../patients-js/patient-state.js');
    const userId = appState.currentUser?.userId || 
                  appState.currentUser?.UserId || 
                  appState.currentUser?.id || 
                  appState.currentUser?.Id;
    
    if (!userId) {
        console.warn('⚠️ No se pudo obtener userId para notificaciones de chat');
        return;
    }
    
    currentUserId = userId;
    userType = 'patient';
    
    // Obtener patientId (participantId clínico) para buscar salas
    participantId = appState.currentPatient?.id || appState.currentPatient?.Id || appState.currentPatient?.patientId;
    if (!participantId) {
        console.warn('⚠️ No se pudo obtener patientId para notificaciones de chat');
    } else {
        console.log('✅ PatientId obtenido para notificaciones:', participantId);
    }
    
    // Callback para abrir lista de chats disponibles
    onChatClickCallback = async () => {
        await showChatListModal('patient');
    };
    
    console.log('🔔 Inicializando notificaciones de chat para paciente:', { userId });
    
    // Cargar contador inicial de mensajes no leídos
    await updateUnreadCount();
    
    // Conectar a SignalR para recibir notificaciones en tiempo real
    await setupSignalRNotifications();
    
    // Configurar el botón de chat
    setupChatButton();
    
    // Listener global para eventos de mensajes leídos (ya se agregó en initializeChatNotifications, pero lo agregamos aquí también por si acaso)
    // Nota: El listener se agrega una vez, no importa si se llama desde doctor o paciente
}

/**
 * Establece la sala de chat activa (abierta)
 * @param {number|null} roomId - ID de la sala activa, o null si no hay sala abierta
 */
export function setActiveChatRoom(roomId) {
    activeRoomId = (roomId != null) ? Number(roomId) : null;
    console.log('🔷 Sala activa:', activeRoomId);
}

/**
 * Configura el botón de chat en la navbar
 */
function setupChatButton() {
    chatBtnElement = document.getElementById('chatNotificationBtn');
    
    if (!chatBtnElement) {
        console.warn('⚠️ No se encontró el botón de chat en la navbar');
        return;
    }
    
    requestBrowserNotifications();
    
    chatBtnElement.addEventListener('click', async () => {
        if (onChatClickCallback) {
            await onChatClickCallback();
        } else {
            console.warn('⚠️ No hay callback configurado para abrir el chat');
        }
    });
    
    // Actualizar badge inicial (esperar un momento para asegurar que el DOM esté listo)
    setTimeout(() => {
    updateChatBadge();
    }, 100);
}

/**
 * Actualiza el badge de notificaciones en el icono de la navbar
 */
function updateChatBadge() {
    const chatBadge = document.getElementById('chatBadge');
    if (!chatBadge) {
        console.warn('⚠️ No se encontró el elemento chatBadge en el DOM');
        // Intentar buscar de nuevo después de un breve delay
        setTimeout(() => {
            const retryBadge = document.getElementById('chatBadge');
            if (retryBadge) {
                console.log('✅ Badge encontrado en reintento');
                updateChatBadge();
            }
        }, 500);
        return;
    }
    
    console.log('🔔 Actualizando badge en navbar:', { unreadCount, chatBadgeExists: !!chatBadge, chatBtnExists: !!chatBtnElement });
    
    if (unreadCount > 0) {
        chatBadge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
        chatBadge.style.display = 'flex';
        chatBadge.style.visibility = 'visible';
        chatBadge.style.opacity = '1';
        chatBtnElement?.classList.add('has-unread');
        console.log('✅ Badge mostrado en navbar con contador:', unreadCount);
    } else {
        chatBadge.style.display = 'none';
        chatBadge.style.visibility = 'hidden';
        chatBadge.style.opacity = '0';
        chatBtnElement?.classList.remove('has-unread');
        console.log('ℹ️ Badge ocultado en navbar (sin mensajes no leídos)');
    }
}

/**
 * Actualiza el contador de mensajes no leídos
 */
async function updateUnreadCount() {
    try {
        const token = localStorage.getItem('token');
        // CRÍTICO: Usar currentUserId (UserId de autenticación) para buscar salas
        // El backend busca salas donde el usuario participó (DoctorID o PatientId = UserId)
        // O donde el usuario envió mensajes (SenderId = UserId)
        if (!token || !currentUserId) {
            console.warn('⚠️ No hay token o currentUserId para actualizar contador');
            return;
        }
        
        console.log('📊 Actualizando contador con UserId:', currentUserId, '(participantId clínico:', participantId, ')');
        const rooms = await getUserChatRooms(currentUserId, token);
        
        // Debug: verificar estructura de la primera sala
        if (rooms && rooms.length > 0) {
            console.log('🔍 Estructura de la primera sala (para debugging):', {
                room: rooms[0],
                keys: Object.keys(rooms[0]),
                lastSenderId: rooms[0].lastSenderId,
                LastSenderId: rooms[0].LastSenderId,
                lastSenderUserId: rooms[0].lastSenderUserId,
                LastSenderUserId: rooms[0].LastSenderUserId
            });
        }
        
        // Contar mensajes no leídos de todas las salas
        // IMPORTANTE: No contar como "no leído" si el último mensaje fue enviado por el usuario actual
        let totalUnread = 0;
        const myUserIdNum = Number(currentUserId);
        
        console.log('🔍 Comparando LastSenderId con currentUserId:', {
            currentUserId: currentUserId,
            myUserIdNum: myUserIdNum,
            'tipo currentUserId': typeof currentUserId,
            'es número válido': Number.isFinite(myUserIdNum)
        });
        
        for (const room of rooms) {
            const roomId = room.id || room.Id || 'unknown';
            
            // Identificar último emisor que venga del backend (probar varias claves)
            const lastSenderRaw = room.lastSenderId ?? room.LastSenderId ?? 
                                 room.lastSenderUserId ?? room.LastSenderUserId ?? null;
            
            const lastSenderId = Number(lastSenderRaw);
            
            // Unread reportado por el backend
            let unread = room.unreadCount || room.UnreadCount || 0;
            
            console.log(`🔍 Sala ${roomId}:`, {
                lastSenderRaw: lastSenderRaw,
                lastSenderId: lastSenderId,
                myUserIdNum: myUserIdNum,
                unreadOriginal: unread,
                'lastSenderId es número': Number.isFinite(lastSenderId),
                'myUserIdNum es número': Number.isFinite(myUserIdNum),
                'son iguales?': lastSenderId === myUserIdNum
            });
            
            // Si el último mensaje es mío, NO debería contarse como no leído
            // IMPORTANTE: Solo ignorar si puedo verificar que el último mensaje es mío
            // Si LastSenderId es null/0, confiar en el unreadCount del backend
            if (Number.isFinite(lastSenderId) && Number.isFinite(myUserIdNum) && lastSenderId > 0) {
                // LastSenderId es válido, puedo comparar
                if (lastSenderId === myUserIdNum) {
                    console.log(`✅ Ignorando ${unread} mensajes no leídos de sala ${roomId} porque el último mensaje es propio (LastSenderId=${lastSenderId} === currentUserId=${myUserIdNum})`);
                    unread = 0; // El último mensaje es mío, no contar como no leído
                } else {
                    console.log(`ℹ️ Sala ${roomId}: último mensaje es de otro usuario (LastSenderId=${lastSenderId} !== currentUserId=${myUserIdNum}), contando ${unread} no leídos`);
                    // El último mensaje es de otro usuario, contar los no leídos normalmente
                }
            } else {
                // LastSenderId es null/0 o inválido - confiar en el unreadCount del backend
                if (lastSenderRaw === null || lastSenderRaw === undefined || lastSenderId === 0) {
                    console.log(`⚠️ Sala ${roomId}: LastSenderId es null/0, confiando en unreadCount del backend (${unread})`);
                    // No modificar unread, usar el valor del backend
                } else {
                    console.warn(`⚠️ Sala ${roomId}: No se pudo comparar LastSenderId (${lastSenderId}) con currentUserId (${myUserIdNum}) - tipos inválidos. Confiando en unreadCount del backend (${unread}).`);
                    // No modificar unread, usar el valor del backend
                }
            }
            
            totalUnread += unread;
        }
        
        // Poblar Map por sala
        perRoomUnread.clear();
        for (const room of rooms) {
            const rid = Number(room.id || room.Id);
            const unread = Number(room.unreadCount || room.UnreadCount || 0);
            if (Number.isFinite(rid)) {
                perRoomUnread.set(rid, unread);
            }
        }
        
        // Calcular total desde el Map
        unreadCount = [...perRoomUnread.values()].reduce((a, b) => a + b, 0);
        
        const previousUnreadCount = unreadCount;
        console.log('📊 Mensajes no leídos actualizados desde backend:', unreadCount, 'de', rooms.length, 'salas', 
                    previousUnreadCount !== unreadCount ? `(antes: ${previousUnreadCount})` : '');
        updateChatBadge();
        
        // Forzar actualización visual del badge
        if (previousUnreadCount !== unreadCount) {
            console.log('🔄 Contador cambió de', previousUnreadCount, 'a', unreadCount);
        }
    } catch (error) {
        console.error('❌ Error al actualizar contador de mensajes no leídos:', error);
    }
}

/**
 * Configura SignalR para recibir notificaciones de nuevos mensajes
 */
async function setupSignalRNotifications() {
    const signalR = window.signalR || window.SignalR;
    
    if (!signalR || !signalR.HubConnectionBuilder) {
        console.warn('⚠️ SignalR no está disponible para notificaciones');
        return;
    }
    
    try {
        chatNotificationConnection = new signalR.HubConnectionBuilder()
            .withUrl(SIGNALR_URL, {
                skipNegotiation: false,
                transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
                withCredentials: true
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: retryContext => {
                    if (retryContext.elapsedMilliseconds < 60000) {
                        return 2000;
                    }
                    return 10000;
                }
            })
            .build();
        
        // Escuchar nuevos mensajes
        chatNotificationConnection.on("ReceiveMessage", async (message) => {
            console.log('🔔 Nuevo mensaje recibido (notificación):', message);
            
            const messageRoomId = Number(message.RoomId ?? message.roomId ?? message.ChatRoomId ?? message.chatRoomId ?? 0);
            
            if (Number.isFinite(activeRoomId) && activeRoomId === messageRoomId) {
                console.log('✅ Llega mensaje a sala activa: NO incremento badge');
                return;
            }
            
            // Validar que currentUserId esté disponible
            if (!currentUserId) {
                console.warn('⚠️ currentUserId no está disponible, intentando obtenerlo nuevamente...');
                // Intentar obtenerlo nuevamente
                try {
                    if (userType === 'doctor') {
                        const { doctorState } = await import('../doctor-js/doctor-core.js');
                        currentUserId = doctorState.currentUser?.userId || 
                                       doctorState.currentUser?.UserId || 
                                       doctorState.currentUser?.id || 
                                       doctorState.currentUser?.Id;
                    } else if (userType === 'patient') {
                        const { appState } = await import('../patients-js/patient-state.js');
                        currentUserId = appState.currentUser?.userId || 
                                      appState.currentUser?.UserId || 
                                      appState.currentUser?.id || 
                                      appState.currentUser?.Id;
                    }
                } catch (importError) {
                    console.error('❌ Error al importar módulo para obtener currentUserId:', importError);
                }
                
                if (!currentUserId) {
                    console.error('❌ No se pudo obtener currentUserId, ignorando mensaje');
                    return;
                }
                console.log('✅ currentUserId recuperado:', currentUserId);
            }
            
            // Extraer SenderId del mensaje (puede venir como SenderId o senderId)
            const messageSenderId = message.SenderId ?? message.senderId ?? null;
            
            if (messageSenderId === null || messageSenderId === undefined) {
                console.warn('⚠️ El mensaje no tiene SenderId, ignorando');
                return;
            }
            
            // Convertir ambos IDs a números para comparación precisa
            const messageSenderIdNum = Number(messageSenderId);
            const currentUserIdNum = Number(currentUserId);
            
            console.log('🔍 Comparando IDs:', {
                messageSenderId: messageSenderId,
                messageSenderIdNum: messageSenderIdNum,
                currentUserId: currentUserId,
                currentUserIdNum: currentUserIdNum,
                messageSenderIdType: typeof messageSenderId,
                currentUserIdType: typeof currentUserId,
                areEqual: messageSenderIdNum === currentUserIdNum
            });
            
            // Validar que ambos IDs sean números válidos
            const isValidMessageId = Number.isFinite(messageSenderIdNum) && messageSenderIdNum > 0;
            const isValidCurrentId = Number.isFinite(currentUserIdNum) && currentUserIdNum > 0;
            
            if (!isValidMessageId || !isValidCurrentId) {
                console.warn('⚠️ IDs inválidos para comparación, ignorando mensaje', {
                    isValidMessageId,
                    isValidCurrentId,
                    messageSenderIdNum,
                    currentUserIdNum
                });
                return;
            }
            
            // CRÍTICO: Solo incrementar contador si el mensaje NO es del usuario actual
            // Comparación estricta: ambos deben ser números válidos y diferentes
            if (messageSenderIdNum === currentUserIdNum) {
                console.log('✅ Mensaje propio detectado en ReceiveMessage, NO incrementando contador', {
                    messageSenderId: messageSenderIdNum,
                    currentUserId: currentUserIdNum,
                    'son iguales': true
                });
                return; // Salir temprano si es mensaje propio - NO incrementar contador
            }
            
            // El mensaje es de otro usuario, incrementar contador
            console.log('🔔 Mensaje de otro usuario detectado en ReceiveMessage, incrementando contador', {
                messageSenderId: messageSenderIdNum,
                currentUserId: currentUserIdNum,
                diferencia: Math.abs(messageSenderIdNum - currentUserIdNum),
                'son diferentes': true
            });
            
                unreadCount++;
            
            // Reflejar por sala
            if (Number.isFinite(messageRoomId)) {
                perRoomUnread.set(messageRoomId, (perRoomUnread.get(messageRoomId) || 0) + 1);
            }
            
                updateChatBadge();
            showChatToast(message);
                
                // Mostrar notificación del sistema si está disponible
                if ('Notification' in window && Notification.permission === 'granted') {
                try {
                    new Notification('Nuevo mensaje', {
                        body: message.Message || message.message || 'Tienes un nuevo mensaje',
                        icon: '/favicon.ico'
                    });
                } catch (notifError) {
                    console.warn('⚠️ Error al mostrar notificación del sistema:', notifError);
                }
            }
        });
        
        await chatNotificationConnection.start();
        console.log('✅ Notificaciones de chat conectadas');
        
        // Unirse a todas las salas del usuario para recibir notificaciones
        await joinAllUserRooms();
        
        // Si el socket se reconecta, volver a unirse a las salas y refrescar contador
        chatNotificationConnection.onreconnecting(() => {
            console.log('🔄 Reconectando SignalR...');
        });
        
        chatNotificationConnection.onreconnected(async () => {
            console.log('🔌 Reconnected. Rejoining rooms...');
            await joinAllUserRooms();
            await updateUnreadCount();
        });
        
        // Refrescar contador periódicamente (cada 30 segundos)
        setInterval(async () => {
            try {
                await updateUnreadCount();
            } catch (err) {
                console.warn('⚠️ Error en actualización periódica de contador:', err);
            }
        }, 30000);
        
    } catch (error) {
        console.error('❌ Error al conectar notificaciones de chat:', error);
    }
}

/**
 * Une al usuario a todas sus salas de chat para recibir notificaciones
 */
async function joinAllUserRooms() {
    try {
        const token = localStorage.getItem('token');
        // CRÍTICO: Usar participantId (doctorId/patientId) en lugar de currentUserId para buscar salas
        const idToUse = participantId || currentUserId;
        if (!token || !idToUse || !chatNotificationConnection) {
            console.warn('⚠️ No se puede unir a salas: faltan token, ID o conexión');
            return;
        }
        
        console.log('📋 Uniéndose a salas con ID:', idToUse, 'tipo:', participantId ? 'participantId (clínico)' : 'currentUserId (auth)');
        const rooms = await getUserChatRooms(idToUse, token);
        const roomsArray = Array.isArray(rooms) ? rooms : [];
        
        console.log('📋 Uniéndose a', roomsArray.length, 'salas para notificaciones');
        
        // Si no hay salas, reintentar después de 3-5 segundos (por si se creó una sala recientemente)
        if (roomsArray.length === 0) {
            console.log('⚠️ No hay salas disponibles. Reintentando en 3 segundos...');
            setTimeout(async () => {
                try {
                    await joinAllUserRooms();
                } catch (err) {
                    console.warn('⚠️ Error en reintento de unión a salas:', err);
                }
            }, 3000);
            return;
        }
        
        // Unirse a todas las salas
        for (const room of roomsArray) {
            const roomId = room.id || room.Id;
            if (!roomId) {
                console.warn('⚠️ Sala sin ID válido:', room);
                continue;
            }
            
            try {
                const roomIdNum = Number(roomId);
                const userIdNum = Number(currentUserId);
                
                if (!Number.isFinite(roomIdNum) || !Number.isFinite(userIdNum)) {
                    console.warn('⚠️ IDs inválidos para unirse a sala:', { roomId: roomIdNum, userId: userIdNum });
                    continue;
                }
                
                await chatNotificationConnection.invoke("JoinChatRoom", roomIdNum, userIdNum);
                console.log('✅ Unido a sala para notificaciones:', roomIdNum, 'con userId:', userIdNum);
                } catch (err) {
                    console.warn('⚠️ Error al unirse a sala:', roomId, err);
            }
        }
    } catch (error) {
        console.error('❌ Error al unirse a salas para notificaciones:', error);
    }
}

/**
 * Actualiza el contador cuando se marca un mensaje como leído
 */
export function markMessageAsRead() {
    if (unreadCount > 0) {
        unreadCount--;
        updateChatBadge();
    }
}

/**
 * Actualiza el contador cuando se abre un chat
 * Esto debe llamarse después de marcar mensajes como leídos en el backend
 */
export async function refreshUnreadCount() {
    console.log('🔄 Actualizando contador de mensajes no leídos desde el backend...');
    await updateUnreadCount();
}

/**
 * Re-une al usuario a todas sus salas de chat y actualiza el contador
 * Útil cuando se crea una nueva sala y el módulo de notificaciones ya estaba iniciado
 */
export async function rejoinNotificationRooms() {
    console.log('🔄 Re-uniendo a salas de notificaciones...');
    await joinAllUserRooms();
    await updateUnreadCount();
}

function requestBrowserNotifications() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
}

function showChatToast(message) {
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'chat-toast-container';
        document.body.appendChild(toastContainer);
    }
    
    const senderName = message.SenderName || message.senderName || (userType === 'doctor' ? 'Paciente' : 'Doctor');
    const preview = (message.Message || message.message || 'Nuevo mensaje').slice(0, 90);
    
    const toast = document.createElement('div');
    toast.className = 'chat-toast';
    toast.innerHTML = `
        <strong>${senderName}</strong>
        <p>${preview}</p>
    `;
    
    toastContainer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

/**
 * Muestra un modal con la lista de chats disponibles
 */
async function showChatListModal(userType) {
    try {
        const token = localStorage.getItem('token');
        if (!token || !currentUserId) {
            console.error('❌ No hay token o userId para cargar chats');
            return;
        }
        
        // CRÍTICO: Usar currentUserId (UserId de autenticación) para buscar salas
        // El backend busca salas donde el usuario participó (DoctorID o PatientId = UserId)
        // O donde el usuario envió mensajes (SenderId = UserId)
        if (!currentUserId) {
            console.error('❌ No hay currentUserId para cargar chats');
            return;
        }
        console.log('📋 Cargando chats con UserId:', currentUserId, '(participantId clínico:', participantId, ')');
        const rooms = await getUserChatRooms(currentUserId, token);
        const roomsArray = Array.isArray(rooms) ? rooms : [];
        
        // Marcar todos los mensajes no leídos como leídos cuando se abre la lista
        // Esto actualiza el contador automáticamente
        if (roomsArray.length > 0 && currentUserId) {
            console.log('📖 Marcando mensajes como leídos al abrir la lista de chats...');
            try {
                const { markMessagesAsRead } = await import('./ChatService.js');
                
                // Marcar como leídos en todas las salas que tengan mensajes no leídos
                const markPromises = roomsArray
                    .filter(room => {
                        const unread = room.unreadCount || room.UnreadCount || 0;
                        return unread > 0;
                    })
                    .map(async (room) => {
                        const roomId = room.id || room.Id;
                        const unread = room.unreadCount || room.UnreadCount || 0;
                        if (roomId && unread > 0) {
                            try {
                                await markMessagesAsRead(roomId, currentUserId, token);
                                console.log(`✅ Mensajes marcados como leídos en sala ${roomId}`);
                                
                                // Despachar evento para actualizar contador inmediatamente
                                document.dispatchEvent(new CustomEvent('chat:messagesRead', {
                                    detail: { roomId, count: unread }
                                }));
                            } catch (err) {
                                console.warn(`⚠️ Error al marcar mensajes como leídos en sala ${roomId}:`, err);
                            }
                        }
                    });
                
                // Esperar a que se marquen todos los mensajes
                await Promise.allSettled(markPromises);
                
                // Actualizar el contador después de marcar como leídos
                setTimeout(async () => {
                    await updateUnreadCount();
                    console.log('✅ Contador actualizado después de marcar mensajes como leídos');
                }, 500); // Delay para dar tiempo al backend de procesar
                
            } catch (err) {
                console.warn('⚠️ Error al marcar mensajes como leídos:', err);
                // Continuar mostrando la lista aunque falle marcar como leídos
            }
        }
        
        if (roomsArray.length === 0) {
            // Mostrar modal informativo en lugar de alert
            const modal = document.createElement('div');
            modal.id = 'chatListModal';
            modal.style.cssText = `
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
            `;
            
            const modalContent = document.createElement('div');
            modalContent.style.cssText = `
                background: white;
                border-radius: 12px;
                padding: 2rem;
                max-width: 400px;
                width: 90%;
            `;
            
            modalContent.innerHTML = `
                <div style="text-align: center;">
                    <h3 style="margin: 0 0 1rem 0; font-size: 1.5rem; color: #1f2937;">No hay chats disponibles</h3>
                    <p style="color: #6b7280; margin-bottom: 1.5rem;">
                        No hay chats aún. Abrí cualquiera de tus turnos confirmados y tocá "Chat" para crear la sala.
                    </p>
                    <button id="closeEmptyChatModal" style="
                        background: #3b82f6;
                        color: white;
                        border: none;
                        padding: 0.75rem 1.5rem;
                        border-radius: 8px;
                        cursor: pointer;
                        font-size: 1rem;
                    ">Cerrar</button>
                </div>
            `;
            
            modal.appendChild(modalContent);
            document.body.appendChild(modal);
            
            document.getElementById('closeEmptyChatModal').addEventListener('click', () => {
                modal.remove();
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });
            
            return;
        }
        
        // Crear modal con lista de chats
        const modal = document.createElement('div');
        modal.id = 'chatListModal';
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 2rem;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;
        
        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0; font-size: 1.5rem; color: #1f2937;">Chats Disponibles</h3>
                <button id="closeChatListModal" style="
                    background: none;
                    border: none;
                    font-size: 1.5rem;
                    cursor: pointer;
                    color: #6b7280;
                    padding: 0.25rem 0.5rem;
                ">&times;</button>
            </div>
            <div id="chatListContent">
                ${roomsArray.map(room => {
                    // Manejar tanto camelCase como PascalCase
                    const roomId = room.id || room.Id || 0;
                    const appointmentId = room.appointmentId || room.AppointmentId || 0;
                    const doctorId = room.doctorId || room.DoctorId || room.doctorID || room.DoctorID || 0;
                    const patientId = room.patientId || room.PatientId || 0;
                    const otherName = userType === 'doctor' 
                        ? (room.patientName || room.PatientName || 'Paciente')
                        : (room.doctorName || room.DoctorName || 'Doctor');
                    // Identificar último emisor para filtrar mensajes propios
                    const lastSenderRaw = room.lastSenderId ?? room.LastSenderId ?? 
                                         room.lastSenderUserId ?? room.LastSenderUserId ?? null;
                    const lastSenderId = Number(lastSenderRaw);
                    const myUserIdNum = Number(currentUserId);
                    
                    // Unread reportado por el backend
                    let unread = room.unreadCount || room.UnreadCount || 0;
                    
                    // Si el último mensaje es mío, NO debería mostrarse como no leído
                    // IMPORTANTE: Solo ignorar si puedo verificar que el último mensaje es mío
                    // Si LastSenderId es null/0, confiar en el unreadCount del backend
                    if (Number.isFinite(lastSenderId) && Number.isFinite(myUserIdNum) && lastSenderId > 0) {
                        // LastSenderId es válido, puedo comparar
                        if (lastSenderId === myUserIdNum) {
                            console.log(`✅ Lista de chats: Ignorando ${unread} mensajes no leídos de sala ${roomId} porque el último mensaje es propio`);
                            unread = 0; // El último mensaje es mío, no mostrar badge
                        }
                        // Si es de otro usuario, mantener el unread original
                    }
                    // Si LastSenderId es null/0, confiar en el unreadCount del backend (no modificar)
                    
                    const lastMessage = room.lastMessage || room.LastMessage || 'Sin mensajes';
                    const lastMessageTime = room.lastMessageTime || room.LastMessageTime;
                    
                    return `
                        <div class="chat-list-item" 
                             data-room-id="${roomId}" 
                             data-appointment-id="${appointmentId}"
                             data-doctor-id="${doctorId}"
                             data-patient-id="${patientId}"
                             data-user-type="${userType}" style="
                            padding: 1rem;
                            border: 1px solid #e5e7eb;
                            border-radius: 8px;
                            margin-bottom: 0.75rem;
                            cursor: pointer;
                            transition: all 0.2s;
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        ">
                            <div style="flex: 1;">
                                <div style="font-weight: 600; color: #1f2937; margin-bottom: 0.25rem;">
                                    ${otherName}
                                </div>
                                <div style="font-size: 0.875rem; color: #6b7280; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${lastMessage}
                                </div>
                                ${lastMessageTime ? `
                                    <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem;">
                                        ${new Date(lastMessageTime).toLocaleString('es-AR')}
                                    </div>
                                ` : ''}
                            </div>
                            ${unread > 0 ? `
                                <span style="
                                    background: #ef4444;
                                    color: white;
                                    border-radius: 50%;
                                    width: 24px;
                                    height: 24px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    font-size: 0.75rem;
                                    font-weight: bold;
                                    margin-left: 1rem;
                                ">${unread > 99 ? '99+' : unread}</span>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Cerrar modal y actualizar contador
        const closeModalAndUpdate = async () => {
            modal.remove();
            // Actualizar contador después de cerrar el modal
            setTimeout(async () => {
                await updateUnreadCount();
                console.log('✅ Contador actualizado después de cerrar la lista de chats');
            }, 300);
        };
        
        document.getElementById('closeChatListModal').addEventListener('click', closeModalAndUpdate);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModalAndUpdate();
            }
        });
        
        // Utilidad: parseo seguro de números
        const toInt = (v) => {
            const num = Number(v);
            return Number.isFinite(num) && num > 0 ? parseInt(v, 10) : 0;
        };
        
        // Normalizar tipo (quitar tildes y convertir a minúsculas)
        const normalizeType = (tipo) => {
            if (!tipo) return '';
            return String(tipo)
                .normalize('NFD')
                .replace(/\p{Diacritic}/gu, '')
                .toLowerCase();
        };
        
        // Abrir chat al hacer clic en un item - Handler robusto
        modalContent.querySelectorAll('.chat-list-item').forEach(item => {
            item.addEventListener('click', async () => {
                try {
                    // 1) Obtener y validar data-attributes
                    const roomIdRaw = item.getAttribute('data-room-id');
                    const appointmentIdRaw = item.getAttribute('data-appointment-id');
                    const doctorIdRaw = item.getAttribute('data-doctor-id');
                    const patientIdRaw = item.getAttribute('data-patient-id');
                    const userTypeRaw = item.getAttribute('data-user-type') || userType;
                    
                    const roomId = toInt(roomIdRaw);
                    const appointmentId = toInt(appointmentIdRaw);
                    const doctorId = toInt(doctorIdRaw);
                    const patientId = toInt(patientIdRaw);
                    const tipoNormalizado = normalizeType(userTypeRaw);
                    
                    console.log('🔍 Abriendo chat con:', { 
                        roomId, 
                        appointmentId, 
                        doctorId, 
                        patientId, 
                        userType: tipoNormalizado,
                        raw: { roomIdRaw, appointmentIdRaw, doctorIdRaw, patientIdRaw }
                    });
                    
                    // 2) Validar que tenemos al menos roomId o appointmentId
                    if (!roomId && !appointmentId) {
                        throw new Error('Faltan identificadores (roomId/appointmentId). No se puede abrir el chat.');
                    }
                    
                    // 3) Cerrar modal antes de abrir el chat
                modal.remove();
                
                    // 4) Obtener token y validar
                    const token = localStorage.getItem('token');
                    if (!token) {
                        throw new Error('No hay token de autenticación. Por favor, inicia sesión nuevamente.');
                    }
                    
                    console.debug('🔐 Token presente:', token.substring(0, 20) + '...');
                    
                    // 5) Intentar obtener datos del appointment si tenemos appointmentId
                    let appointment = null;
                    if (appointmentId > 0) {
                        try {
                const { ApiScheduling } = await import('../api.js');
                            appointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`);
                            console.log('✅ Appointment obtenido:', appointment);
                        } catch (appError) {
                            console.warn('⚠️ No se pudo obtener appointment, continuando con datos del room:', appError);
                            // Continuar sin appointment, usaremos los datos del room
                        }
                    }
                    
                    // 6) Determinar IDs finales (prioridad: appointment > room > data-attributes)
                    const finalDoctorId = appointment?.doctorId || appointment?.DoctorId || doctorId;
                    const finalPatientId = appointment?.patientId || appointment?.PatientId || patientId;
                    const finalAppointmentId = appointmentId || appointment?.id || appointment?.Id || appointment?.appointmentId || appointment?.AppointmentId;
                    
                    // 7) Validar que tenemos los IDs necesarios
                    if (tipoNormalizado === 'doctor') {
                        if (!finalPatientId) {
                            throw new Error('No se pudo determinar el patientId. No se puede abrir el chat.');
                        }
                    } else if (tipoNormalizado === 'patient') {
                        if (!finalDoctorId) {
                            throw new Error('No se pudo determinar el doctorId. No se puede abrir el chat.');
                        }
                    }
                    
                    // 8) Obtener nombres (con fallbacks seguros)
                    let otherName = 'Usuario';
                    if (tipoNormalizado === 'doctor') {
                        // Intentar obtener nombre del paciente
                        if (appointment?.patientName) {
                            otherName = appointment.patientName;
                        } else if (appointment?.patientFirstName || appointment?.patientLastName) {
                            const firstName = appointment.patientFirstName || '';
                            const lastName = appointment.patientLastName || '';
                            otherName = `${firstName} ${lastName}`.trim() || 'Paciente';
                        } else {
                            otherName = 'Paciente';
                        }
                    } else {
                        // Intentar obtener nombre del doctor
                        if (appointment?.doctorName) {
                            otherName = appointment.doctorName;
                        } else if (appointment?.doctorFirstName || appointment?.doctorLastName) {
                            const firstName = appointment.doctorFirstName || '';
                            const lastName = appointment.doctorLastName || '';
                            otherName = `${firstName} ${lastName}`.trim() || 'Doctor';
                        } else {
                            otherName = 'Doctor';
                        }
                    }
                    
                    console.log('👤 Nombre del otro participante determinado:', otherName);
                    
                    // 9) Abrir el chat usando el handler correspondiente
                    if (tipoNormalizado === 'doctor') {
                        const doctorModule = await import('../doctor-js/doctor-appointments.js');
                        if (!doctorModule.handlerDoctorChatOpen || typeof doctorModule.handlerDoctorChatOpen !== 'function') {
                            throw new Error('handlerDoctorChatOpen no está disponible o no es una función');
                        }
                        console.log('📞 Llamando handlerDoctorChatOpen con:', { finalAppointmentId, finalPatientId, otherName });
                        await doctorModule.handlerDoctorChatOpen(finalAppointmentId, finalPatientId, otherName);
                    } else {
                        const patientModule = await import('../patients-js/patient-appointments.js');
                        if (!patientModule.handlerPatientChatOpen || typeof patientModule.handlerPatientChatOpen !== 'function') {
                            throw new Error('handlerPatientChatOpen no está disponible o no es una función');
                        }
                        console.log('📞 Llamando handlerPatientChatOpen con:', { finalAppointmentId, finalDoctorId, otherName });
                        await patientModule.handlerPatientChatOpen(finalAppointmentId, finalDoctorId, otherName);
                    }
                    
                    console.log('✅ Chat abierto correctamente');
                    
                } catch (error) {
                    console.error('❌ Error al abrir chat:', error);
                    console.error('❌ Stack:', error.stack);
                    
                    // Mostrar error más descriptivo
                    const errorMessage = error.message || 'Error desconocido al abrir el chat';
                    alert(`Error al abrir el chat: ${errorMessage}\n\nPor favor, intenta nuevamente.`);
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Error al mostrar lista de chats:', error);
        alert('Error al cargar los chats. Por favor, intenta nuevamente.');
    }
}

/**
 * Limpia las notificaciones al cerrar sesión
 */
export function cleanupChatNotifications() {
    if (chatNotificationConnection) {
        chatNotificationConnection.stop().catch(err => {
            console.warn('⚠️ Error al detener conexión de notificaciones:', err);
        });
        chatNotificationConnection = null;
    }
    unreadCount = 0;
    updateChatBadge();
}

