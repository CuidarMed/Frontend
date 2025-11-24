// Módulo de notificaciones de chat para la navbar
// Funciona tanto para doctor como para paciente

import { getUserChatRooms } from './ChatService.js';

const SIGNALR_URL = "http://localhost:5046/chathub";
let chatNotificationConnection = null;
let unreadCount = 0;
let currentUserId = null;
let userType = null; // 'doctor' o 'patient'
let onChatClickCallback = null;

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
}

/**
 * Configura el botón de chat en la navbar
 */
function setupChatButton() {
    const chatBtn = document.getElementById('chatNotificationBtn');
    const chatBadge = document.getElementById('chatBadge');
    
    if (!chatBtn) {
        console.warn('⚠️ No se encontró el botón de chat en la navbar');
        return;
    }
    
    chatBtn.addEventListener('click', async () => {
        if (onChatClickCallback) {
            await onChatClickCallback();
        } else {
            console.warn('⚠️ No hay callback configurado para abrir el chat');
        }
    });
    
    // Actualizar badge inicial
    updateChatBadge();
}

/**
 * Actualiza el badge de notificaciones
 */
function updateChatBadge() {
    const chatBadge = document.getElementById('chatBadge');
    if (!chatBadge) return;
    
    if (unreadCount > 0) {
        chatBadge.textContent = unreadCount > 99 ? '99+' : unreadCount.toString();
        chatBadge.style.display = 'flex';
    } else {
        chatBadge.style.display = 'none';
    }
}

/**
 * Actualiza el contador de mensajes no leídos
 */
async function updateUnreadCount() {
    try {
        const token = localStorage.getItem('token');
        if (!token || !currentUserId) return;
        
        const rooms = await getUserChatRooms(currentUserId, token);
        
        // Contar mensajes no leídos de todas las salas
        let totalUnread = 0;
        for (const room of rooms) {
            const unread = room.unreadCount || room.UnreadCount || 0;
            totalUnread += unread;
        }
        
        unreadCount = totalUnread;
        updateChatBadge();
        
        console.log('📊 Mensajes no leídos:', unreadCount);
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
        chatNotificationConnection.on("ReceiveMessage", (message) => {
            console.log('🔔 Nuevo mensaje recibido (notificación):', message);
            
            // Solo incrementar si el mensaje no es del usuario actual
            const messageSenderId = message.SenderId || message.senderId;
            if (Number(messageSenderId) !== Number(currentUserId)) {
                unreadCount++;
                updateChatBadge();
                
                // Mostrar notificación del sistema si está disponible
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Nuevo mensaje', {
                        body: message.Message || message.message || 'Tienes un nuevo mensaje',
                        icon: '/favicon.ico'
                    });
                }
            }
        });
        
        await chatNotificationConnection.start();
        console.log('✅ Notificaciones de chat conectadas');
        
        // Unirse a todas las salas del usuario para recibir notificaciones
        await joinAllUserRooms();
        
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
        if (!token || !currentUserId || !chatNotificationConnection) return;
        
        const rooms = await getUserChatRooms(currentUserId, token);
        
        console.log('📋 Uniéndose a', rooms.length, 'salas para notificaciones');
        
        for (const room of rooms) {
            const roomId = room.id || room.Id;
            if (roomId) {
                try {
                    // Usar el senderId correcto (doctorId o patientId) según el tipo de usuario
                    let senderId = currentUserId;
                    
                    if (userType === 'doctor') {
                        senderId = room.doctorId || room.DoctorId || room.DoctorID || currentUserId;
                    } else if (userType === 'patient') {
                        senderId = room.patientId || room.PatientId || currentUserId;
                    }
                    
                    await chatNotificationConnection.invoke("JoinChatRoom", roomId, senderId);
                    console.log('✅ Unido a sala para notificaciones:', roomId, 'con senderId:', senderId);
                } catch (err) {
                    console.warn('⚠️ Error al unirse a sala:', roomId, err);
                }
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
 */
export async function refreshUnreadCount() {
    await updateUnreadCount();
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
        
        const rooms = await getUserChatRooms(currentUserId, token);
        
        if (rooms.length === 0) {
            alert('No tienes chats disponibles');
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
                ${rooms.map(room => {
                    const roomId = room.id || room.Id;
                    const appointmentId = room.appointmentId || room.AppointmentId;
                    const otherName = userType === 'doctor' 
                        ? (room.patientName || room.PatientName || 'Paciente')
                        : (room.doctorName || room.DoctorName || 'Doctor');
                    const unread = room.unreadCount || room.UnreadCount || 0;
                    const lastMessage = room.lastMessage || room.LastMessage || 'Sin mensajes';
                    const lastMessageTime = room.lastMessageTime || room.LastMessageTime;
                    
                    return `
                        <div class="chat-list-item" data-room-id="${roomId}" data-appointment-id="${appointmentId}" style="
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
        
        // Cerrar modal
        document.getElementById('closeChatListModal').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Abrir chat al hacer clic en un item
        modalContent.querySelectorAll('.chat-list-item').forEach(item => {
            item.addEventListener('click', async () => {
                const roomId = item.getAttribute('data-room-id');
                const appointmentId = item.getAttribute('data-appointment-id');
                
                modal.remove();
                
                // Obtener datos del appointment para abrir el chat
                const { ApiScheduling } = await import('../api.js');
                try {
                    const appointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`);
                    
                    if (userType === 'doctor') {
                        const { handlerDoctorChatOpen } = await import('../doctor-js/doctor-appointments.js');
                        const patientId = appointment.patientId || appointment.PatientId;
                        const patientName = 'Paciente'; // TODO: Obtener nombre real
                        await handlerDoctorChatOpen(appointmentId, patientId, patientName);
                    } else {
                        const { handlerPatientChatOpen } = await import('../patients-js/patient-appointments.js');
                        const doctorId = appointment.doctorId || appointment.DoctorId;
                        const doctorName = 'Doctor'; // TODO: Obtener nombre real
                        await handlerPatientChatOpen(appointmentId, doctorId, doctorName);
                    }
                } catch (error) {
                    console.error('❌ Error al abrir chat:', error);
                    alert('Error al abrir el chat. Por favor, intenta nuevamente.');
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

