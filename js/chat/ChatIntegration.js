import { createChatRoom, getUserChatRooms } from './ChatService.js';

export async function handleAppointmentChatCreation(appointment) {
    // Validamos que el turno este confirmado
    const status = (appointment.status || appointment.Status || '').toUpperCase();
    if(status !== 'CONFIRMED' && status !== 'IN_PROGRESS'){
        console.log("Turno no confirmado o no en progreso, chat no disponible. Status:", status)
        return null
    }

    // Obtener token
    const token = localStorage.getItem('token');
    if (!token) {
        console.error('No hay token disponible');
        return null;
    }

    // Verificamos si ya existe una sala de chat para este turno
    // CRÍTICO: Usar currentUserId (UserId de autenticación) para buscar salas
    // El backend busca salas donde el usuario participó (DoctorID o PatientId = UserId)
    // O donde el usuario envió mensajes (SenderId = UserId)
    const currentUserIdForRooms = appointment.currentUserId;
    
    let existingRooms = [];
    if (currentUserIdForRooms) {
        try {
            console.log('🔍 Buscando salas con currentUserId (autenticación):', currentUserIdForRooms);
            existingRooms = await getUserChatRooms(currentUserIdForRooms, token);
        } catch (error) {
            console.warn('⚠️ No se pudo obtener salas existentes:', error.message);
            // Continuar para intentar crear una nueva sala
        }
    } else {
        console.warn('⚠️ No se pudo determinar currentUserId para buscar salas existentes');
    }

    const appointmentId = appointment.appointmentId || appointment.AppointmentId;
    
    console.log('🔍 Appointment object recibido:', appointment);
    console.log('🔍 AppointmentId extraído:', appointmentId, 'Tipo:', typeof appointmentId);
    
    if (!appointmentId) {
        console.error('❌ No se proporcionó appointmentId para crear/buscar la sala de chat');
        console.error('❌ Objeto appointment completo:', JSON.stringify(appointment, null, 2));
        throw new Error('No se puede crear una sala de chat sin un appointmentId');
    }
    
    // Asegurar que appointmentId sea un número
    const appointmentIdNum = Number(appointmentId);
    if (isNaN(appointmentIdNum) || appointmentIdNum <= 0) {
        console.error('❌ AppointmentId no es un número válido:', appointmentId);
        throw new Error(`AppointmentId debe ser un número válido mayor a 0. Valor recibido: ${appointmentId}`);
    }
    
    console.log('✅ AppointmentId validado:', appointmentIdNum);
    
    // Buscar sala existente que coincida EXACTAMENTE con este appointmentId
    // IMPORTANTE: Ignorar salas con AppointmentId = null para evitar reutilizar salas antiguas
    console.log('🔍 Buscando sala existente para appointmentId:', appointmentId);
    console.log('🔍 Salas disponibles:', existingRooms.map(r => ({ 
        id: r.id || r.Id, 
        appointmentId: r.appointmentId || r.AppointmentId 
    })));
    
    const existingRoom = existingRooms.find(room => {
        const roomAppointmentId = room.appointmentId || room.AppointmentId;
        // Solo considerar salas que tengan AppointmentId y que coincidan exactamente
        if (roomAppointmentId === null || roomAppointmentId === undefined) {
            console.log('⚠️ Ignorando sala sin AppointmentId:', room.id || room.Id);
            return false; // Ignorar salas sin AppointmentId
        }
        const matches = Number(roomAppointmentId) === Number(appointmentId);
        console.log('🔍 Comparando:', { 
            roomAppointmentId, 
            requestedAppointmentId: appointmentId, 
            matches 
        });
        return matches;
    });

    if(existingRoom){
        // Si existe la devolvemos
        console.log("✅ La sala existe para esta consulta:", { 
            roomId: existingRoom.id || existingRoom.Id,
            appointmentId: existingRoom.appointmentId || existingRoom.AppointmentId,
            requestedAppointmentId: appointmentId
        });
        return existingRoom;
    }
    
    console.log("📝 No se encontró sala existente para appointmentId:", appointmentIdNum);

    // Si no existe la creamos
    console.log("🆕 Creando nueva sala para appointmentId:", appointmentIdNum);
    
    // CRÍTICO: Obtener UserId (no IDs clínicos) para doctor y paciente
    // El ChatMS espera UserId de la tabla Users, no doctorId/patientId clínicos
    let doctorUserId = appointment.doctorUserId || appointment.DoctorUserId;
    let patientUserId = appointment.patientUserId || appointment.PatientUserId;
    
    const { Api } = await import('../api.js');
    
    // SIEMPRE obtener doctorUserId desde la API si no viene en el appointment
    if (!doctorUserId && (appointment.doctorId || appointment.DoctorId)) {
        const doctorId = appointment.doctorId || appointment.DoctorId;
        try {
            console.log(`🔍 Obteniendo doctorUserId desde API para doctorId: ${doctorId}`);
            const doctor = await Api.get(`v1/Doctor/${doctorId}`);
            doctorUserId = doctor?.userId || doctor?.UserId;
            console.log('✅ DoctorUserId obtenido desde API:', doctorUserId, 'del doctor:', doctor);
            
            if (!doctorUserId || doctorUserId <= 0) {
                throw new Error(`Doctor con ID ${doctorId} no tiene userId válido`);
            }
        } catch (err) {
            console.error('❌ Error al obtener doctorUserId desde API:', err);
            // Si es doctor y tiene currentUserId, usarlo como fallback
            if (appointment.currentUserId && appointment.userType === 'doctor') {
                doctorUserId = appointment.currentUserId;
                console.log('⚠️ Usando currentUserId como fallback para doctor:', doctorUserId);
            } else {
                throw new Error(`No se pudo obtener el UserId del doctor (doctorId: ${doctorId}). Error: ${err.message}`);
            }
        }
    }
    
    // SIEMPRE obtener patientUserId desde la API si no viene en el appointment
    if (!patientUserId && (appointment.patientId || appointment.PatientId)) {
        const patientId = appointment.patientId || appointment.PatientId;
        try {
            console.log(`🔍 Obteniendo patientUserId desde API para patientId: ${patientId}`);
            const patient = await Api.get(`v1/Patient/${patientId}`);
            patientUserId = patient?.userId || patient?.UserId;
            console.log('✅ PatientUserId obtenido desde API:', patientUserId, 'del paciente:', patient);
            
            if (!patientUserId || patientUserId <= 0) {
                throw new Error(`Paciente con ID ${patientId} no tiene userId válido`);
            }
        } catch (err) {
            console.error('❌ Error al obtener patientUserId desde API:', err);
            // Si es paciente y tiene currentUserId, usarlo como fallback
            if (appointment.currentUserId && appointment.userType === 'patient') {
                patientUserId = appointment.currentUserId;
                console.log('⚠️ Usando currentUserId como fallback para paciente:', patientUserId);
            } else {
                throw new Error(`No se pudo obtener el UserId del paciente (patientId: ${patientId}). Error: ${err.message}`);
            }
        }
    }
    
    console.log("📋 Datos para crear sala:", { 
        doctorUserId, 
        patientUserId, 
        appointmentId: appointmentIdNum,
        originalDoctorId: appointment.doctorId || appointment.DoctorId,
        originalPatientId: appointment.patientId || appointment.PatientId
    });
    
    // Validaciones más estrictas - ahora validamos UserId
    if (!doctorUserId || doctorUserId <= 0) {
        console.error('❌ DoctorUserId inválido:', doctorUserId);
        throw new Error('DoctorUserId es requerido y debe ser un número válido. No se pudo obtener el UserId del doctor.');
    }
    
    if (!patientUserId || patientUserId <= 0) {
        console.error('❌ PatientUserId inválido:', patientUserId);
        throw new Error('PatientUserId es requerido y debe ser un número válido. No se pudo obtener el UserId del paciente.');
    }
    
    // appointmentIdNum ya está validado arriba, no necesitamos validarlo de nuevo
    console.log("✅ Validaciones pasadas. Creando sala con:", { 
        doctorUserId: Number(doctorUserId), 
        patientUserId: Number(patientUserId), 
        appointmentId: appointmentIdNum 
    });
    
    try {
        const newRoom = await createChatRoom(
            doctorUserId,  // Usar UserId, no doctorId clínico
            patientUserId, // Usar UserId, no patientId clínico
            appointmentId,
            token
        )
        
        console.log("✅ Nueva sala creada:", { 
            roomId: newRoom.id || newRoom.Id, 
            appointmentId: newRoom.appointmentId || newRoom.AppointmentId,
            requestedAppointmentId: appointmentId
        });
        
        // Re-unir al módulo de notificaciones para que detecte la nueva sala
        try {
            const { rejoinNotificationRooms } = await import('./ChatNotification.js');
            rejoinNotificationRooms().catch(() => {});
        } catch (err) {
            // Ignorar si el módulo no está disponible
        }
        
        return newRoom
    } catch (error) {
        console.error('❌ Error al crear sala de chat:', error);
        // Re-lanzar el error con un mensaje más claro
        if (error.message?.includes('no está disponible')) {
            throw new Error('El servicio de chat no está disponible. Por favor, verifica que el servicio esté corriendo en el puerto 5046.');
        }
        throw error;
    }
}

export function addChatButtomToAppointment(appointmentCard, appointment, userType, onChatOpen){
    // Solo si el turno esta confirmado
    const status = appointment.status || appointment.Status || '';
    if(status.toLowerCase() !== 'confirmed') return;

    let actionContainer = appointmentCard.querySelector('.appintment-actions')
    if(!actionContainer){
        actionContainer = document.createElement('div')
        appointmentCard.appendChild(actionContainer)
    }

    // Crear boton con estilo del theme
    const themeColor = userType === 'doctor' ? '#10b981' : '#3b82f6'
    const chatBtn = document.createElement('button')
    chatBtn.innerHTML = `Chat con ${userType === 'doctor' ? 'Paciente' : 'Doctor'}`
    chatBtn.style.background = themeColor;

    // Al hacer click, llama al callback
    chatBtn.onclick = () => onChatOpen(appointment)

    // Agregar al contenedor 
    actionContainer.appendChild(chatBtn)
}

import { ChatComponent } from './ChatComponent.js';
import { setActiveChatRoom } from './ChatNotification.js';

export function openChatModal(chatRoom, config){
    // Verificar si ya existe un chat abierto y cerrarlo primero
    const existingChat = document.getElementById('chatModal');
    if (existingChat) {
        existingChat.remove();
    }

    // Crear contenedor del chat flotante (sin overlay)
    const modal = document.createElement('div')
    modal.id = 'chatModal'
    modal.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        width: 380px;
        max-width: calc(100vw - 40px);
        height: 600px;
        max-height: calc(100vh - 40px);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        border-radius: 16px;
        overflow: hidden;
        animation: slideInUp 0.3s ease-out;
        background: white;
    `

    // Agregar animación de entrada
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInUp {
            from {
                transform: translateY(100%);
                opacity: 0;
            }
            to {
                transform: translateY(0);
                opacity: 1;
            }
        }
        @keyframes slideOutDown {
            from {
                transform: translateY(0);
                opacity: 1;
            }
            to {
                transform: translateY(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);

    // Creamos contenedor del chat
    const modalContent = document.createElement('div')
    modalContent.style.cssText = `
        width: 100%;
        height: 100%;
        background: white;
        display: flex;
        flex-direction: column;
    `

    modal.appendChild(modalContent)
    document.body.appendChild(modal)

    // Obtener token
    const token = localStorage.getItem('token');

    // Inicializar chatComponent dentro del contenedor
    const rawChatRoomId = chatRoom.Id || chatRoom.id || chatRoom.chatRoomId || chatRoom.ChatRoomId;
    const chatRoomId = Number(rawChatRoomId);
    const chatRoomAppointmentId = chatRoom.AppointmentId || chatRoom.appointmentId;
    
    console.log('🔍 ChatRoom recibido:', chatRoom);
    console.log('🔍 ChatRoomId extraído:', rawChatRoomId);
    console.log('🔍 ChatRoom AppointmentId:', chatRoomAppointmentId);
    
    if (!Number.isFinite(chatRoomId) || chatRoomId <= 0) {
        console.error('❌ No se pudo obtener un chatRoomId válido del objeto:', { chatRoom, rawChatRoomId });
        alert('Error: No se pudo identificar la sala de chat');
        modal.remove();
        return;
    }
    
    // Verificar que la sala tenga AppointmentId
    if (!chatRoomAppointmentId) {
        console.warn('⚠️ La sala de chat no tiene AppointmentId asociado. Esto puede causar que se reutilice para múltiples consultas.');
    }
    
    const currentUserId = config.currentUserId || config.currentUSerId;
    console.log('🔍 Config recibida:', config);
    console.log('🔍 CurrentUserId extraído:', currentUserId);
    
    if (!currentUserId) {
        console.error('❌ No se pudo obtener el currentUserId del config:', config);
        alert('Error: No se pudo identificar al usuario');
        modal.remove();
        return;
    }
    
    // Determinar el identificador del participante (doctor/paciente) para referencias adicionales
    // CRÍTICO: participantId debe ser el doctorId o patientId, NO el userId de autenticación
    let participantId = (config.participantId ?? config.senderId ?? null);
    const appointment = config.appointment || config.appoinment || null;
    
    // Si no viene en config, intentar obtenerlo del chatRoom o del appointment
    if (!participantId) {
        if (config.userType === 'doctor') {
            participantId = (chatRoom.DoctorId ?? chatRoom.doctorId ?? chatRoom.DoctorID ?? config.doctorId ?? appointment?.DoctorId ?? appointment?.doctorId ?? null);
        } else if (config.userType === 'patient') {
            participantId = (chatRoom.PatientId ?? chatRoom.patientId ?? config.patientId ?? appointment?.PatientId ?? appointment?.patientId ?? null);
        }
    }
    
    // Si aún no hay participantId, cerrar el modal con error
    if (!participantId) {
        console.error('❌ No se pudo determinar participantId (doctorId/patientId). No se abrirá el chat para evitar marcar todo como propio.');
        alert('Error: no se pudo identificar al participante del chat. Volvé a abrir el turno e intentá de nuevo.');
        modal.remove();
        return;
    }
    
    console.log('🔍 Participante determinado:', { 
        userType: config.userType, 
        currentUserId, 
        participantId,
        'participantId type': typeof participantId,
        'chatRoom DoctorId': chatRoom.DoctorId || chatRoom.doctorId || chatRoom.DoctorID,
        'chatRoom PatientId': chatRoom.PatientId || chatRoom.patientId,
        'appointment DoctorId': appointment?.DoctorId || appointment?.doctorId,
        'appointment PatientId': appointment?.PatientId || appointment?.patientId,
        chatRoom 
    });
    
    // Declarar chat primero para que esté disponible en closeChat
    let chat = null;
    
    // Definir closeChat antes de crear el componente
    async function closeChat(){
        console.log('🔒 Cerrando modal de chat...');
        
        // Cerrar el componente de chat antes de remover el modal
        if (chat && typeof chat.close === 'function') {
            try {
                await chat.close();
            } catch (err) {
                console.warn('⚠️ Error al cerrar componente de chat (no crítico):', err);
            }
        }
        
        // Limpiar sala activa
        setActiveChatRoom(null);
        console.log('🔷 Sala activa limpiada al cerrar chat');
        
        // Animación de salida antes de remover
        if (modal && modal.parentNode) {
            modal.style.animation = 'slideOutDown 0.3s ease-out';
            setTimeout(() => {
                if (modal && modal.parentNode) {
                    modal.remove();
                    console.log('✅ Modal removido del DOM');
                }
            }, 300);
        } else {
            console.warn('⚠️ No se pudo encontrar el modal para remover');
        }
    }
    
    // Establecer sala activa
    setActiveChatRoom(chatRoomId);
    console.log('🔷 Sala activa establecida al abrir chat:', chatRoomId);
    
    // Asegurar que el Map tenga esta sala (inicializar en 0 si no está)
    // Esto evita problemas cuando se despacha el evento antes de que el Map se actualice
    (async () => {
        try {
            const { refreshUnreadCount } = await import('./ChatNotification.js');
            // Refrescar el contador para asegurar que el Map tenga todas las salas
            await refreshUnreadCount();
            console.log('✅ Map actualizado antes de abrir el chat');
        } catch (err) {
            console.warn('⚠️ No se pudo actualizar el Map antes de abrir el chat:', err);
        }
    })();
    
    // Ahora crear el componente de chat
    chat = new ChatComponent({
        chatRoomId: chatRoomId,
        currentUserId: currentUserId, // userId autenticado
        participantId,
        originalUserId: currentUserId, // Guardar el userId original para referencia
        currentUserName: config.currentUserName || 'Usuario',
        otherUserName: config.otherUserName || 'Otro usuario',
        theme: config.theme || config.userType || 'patient',
        token: token,
        container: modalContent,
        onClose: closeChat // Pasar la función de cierre como callback
    })
    
    // Re-unir al módulo de notificaciones para asegurar que está suscrito a esta sala
    (async () => {
        try {
            const mod = await import('./ChatNotification.js');
            if (typeof mod.rejoinNotificationRooms === 'function') {
                try {
                    await mod.rejoinNotificationRooms();
                } catch {}
            }
        } catch {}
    })();

    // Hacer el chat arrastrable desde el header
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let xOffset = 0;
    let yOffset = 0;

    // Buscar el header del chat para hacerlo arrastrable
    setTimeout(() => {
        const chatHeader = modalContent.querySelector('.chat-header');
        if (chatHeader) {
            chatHeader.style.cursor = 'move';
            chatHeader.style.userSelect = 'none';
            
            const dragStart = (e) => {
                // No arrastrar si se hace clic en un botón o enlace
                if (e.target.tagName === 'BUTTON' || 
                    e.target.closest('button') || 
                    e.target.tagName === 'I' && e.target.closest('button')) {
                    return;
                }
                
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
                
                if (e.target === chatHeader || chatHeader.contains(e.target)) {
                    isDragging = true;
                }
            };

            const drag = (e) => {
                if (isDragging) {
                    e.preventDefault();
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;

                    xOffset = currentX;
                    yOffset = currentY;

                    // Calcular posición relativa a la ventana
                    const rect = modal.getBoundingClientRect();
                    const newLeft = window.innerWidth - rect.width - (window.innerWidth - e.clientX - (rect.width / 2));
                    const newTop = window.innerHeight - rect.height - (window.innerHeight - e.clientY - (rect.height / 2));

                    // Limitar dentro de la ventana
                    const maxLeft = window.innerWidth - rect.width;
                    const maxTop = window.innerHeight - rect.height;
                    
                    const finalLeft = Math.max(0, Math.min(newLeft, maxLeft));
                    const finalTop = Math.max(0, Math.min(newTop, maxTop));

                    modal.style.right = 'auto';
                    modal.style.bottom = 'auto';
                    modal.style.left = `${finalLeft}px`;
                    modal.style.top = `${finalTop}px`;
                }
            };

            const dragEnd = () => {
                if (isDragging) {
                    initialX = currentX;
                    initialY = currentY;
                    isDragging = false;
                }
            };

            chatHeader.addEventListener('mousedown', dragStart);
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);
        }
    }, 500);
}