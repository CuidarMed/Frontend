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
    const userId = appointment.currentUserId || appointment.currentUSerId || appointment.userId;
    
    let existingRooms = [];
    try {
        existingRooms = await getUserChatRooms(userId, token);
    } catch (error) {
        console.warn('⚠️ No se pudo obtener salas existentes:', error.message);
        // Continuar para intentar crear una nueva sala
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
    const doctorId = appointment.doctorId || appointment.DoctorId;
    const patientId = appointment.patientId || appointment.PatientId;
    
    console.log("📋 Datos para crear sala:", { doctorId, patientId, appointmentId: appointmentIdNum });
    
    // Validaciones más estrictas
    if (!doctorId || doctorId <= 0) {
        console.error('❌ DoctorId inválido:', doctorId);
        throw new Error('DoctorId es requerido y debe ser un número válido');
    }
    
    if (!patientId || patientId <= 0) {
        console.error('❌ PatientId inválido:', patientId);
        throw new Error('PatientId es requerido y debe ser un número válido');
    }
    
    // appointmentIdNum ya está validado arriba, no necesitamos validarlo de nuevo
    console.log("✅ Validaciones pasadas. Creando sala con:", { 
        doctorId: Number(doctorId), 
        patientId: Number(patientId), 
        appointmentId: appointmentIdNum 
    });
    
    try {
        const newRoom = await createChatRoom(
            doctorId,
            patientId,
            appointmentId,
            token
        )
        
        console.log("✅ Nueva sala creada:", { 
            roomId: newRoom.id || newRoom.Id, 
            appointmentId: newRoom.appointmentId || newRoom.AppointmentId,
            requestedAppointmentId: appointmentId
        });
        
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

export function openChatModal(chatRoom, config){
    // Crear overlay oscuro
    const modal = document.createElement('div')
    modal.id = 'chatModal'
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
    `

    // Creamos contenedor del chat
    const modalContent = document.createElement('div')
    modalContent.style.cssText = `
        width: 600px;
        height: 80vh;
        background: white;
        border-radius: 12px;
        display: flex;
        flex-direction: column;
    `

    modal.appendChild(modalContent)
    document.body.appendChild(modal)

    // Obtener token
    const token = localStorage.getItem('token');

    // Inicializar chatComponent dentro del contenedor
    const chatRoomId = chatRoom.Id || chatRoom.id || chatRoom.chatRoomId || chatRoom.ChatRoomId;
    const chatRoomAppointmentId = chatRoom.AppointmentId || chatRoom.appointmentId;
    
    console.log('🔍 ChatRoom recibido:', chatRoom);
    console.log('🔍 ChatRoomId extraído:', chatRoomId);
    console.log('🔍 ChatRoom AppointmentId:', chatRoomAppointmentId);
    
    if (!chatRoomId) {
        console.error('❌ No se pudo obtener el chatRoomId del objeto:', chatRoom);
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
    
    // Determinar el senderId correcto basado en el rol del usuario
    // Si es doctor, usar doctorId; si es paciente, usar patientId
    const senderId = config.senderId || 
                    (config.userType === 'doctor' 
                        ? (chatRoom.DoctorId || chatRoom.doctorId || chatRoom.DoctorID)
                        : (chatRoom.PatientId || chatRoom.patientId)) || 
                    currentUserId;
    
    console.log('🔍 SenderId determinado:', { 
        userType: config.userType, 
        currentUserId, 
        senderId,
        chatRoom 
    });
    
    const chat = new ChatComponent({
        chatRoomId: chatRoomId,
        currentUserId: senderId, // Usar el senderId correcto (doctorId o patientId)
        originalUserId: currentUserId, // Guardar el userId original para referencia
        currentUserName: config.currentUserName || 'Usuario',
        otherUserName: config.otherUserName || 'Otro usuario',
        theme: config.theme || config.userType || 'patient',
        token: token,
        container: modalContent,
        onClose: closeChat // Pasar la función de cierre como callback
    })

    // Cerrar al hacer click fuera
    modal.addEventListener('click', (e) => {
        if(e.target === modal)
            closeChat()
    })

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
        
        // Remover el modal completo del DOM
        if (modal && modal.parentNode) {
            modal.remove();
            console.log('✅ Modal removido del DOM');
        } else {
            console.warn('⚠️ No se pudo encontrar el modal para remover');
        }
    }
}