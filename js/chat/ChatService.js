// ============================================
// SERVICIO DE CHAT - CuidarMed+
// ============================================

const CHATMS_BASE_URLS = [
    "http://localhost:5046/api",
    "http://127.0.0.1:5046/api"
];

/**
 * Intenta realizar fetch con múltiples URLs
 */
async function tryFetch(endpoint, options) {
    let lastError = null;
    for (const baseUrl of CHATMS_BASE_URLS) {
        try {
            const fullUrl = `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
            const response = await fetch(fullUrl, { 
                ...options, 
                signal: AbortSignal.timeout(5000) 
            });
            
            if (response.status !== 0 && response.status !== undefined) {
                return response;
            }
        } catch (err) {
            lastError = err;
            // Si es un error de conexión, no intentar con otras URLs
            if (err.message?.includes('Failed to fetch') || err.message?.includes('ERR_CONNECTION_REFUSED')) {
                throw new Error("El servicio de chat no está disponible. Por favor, verifica que el servicio esté corriendo.");
            }
            continue;
        }
    }
    throw lastError || new Error("No se pudo conectar al servicio de chat");
}

/**
 * Crea una sala de chat entre doctor y paciente
 */
export async function createChatRoom(doctorId, patientId, appointmentId, token) {
    if (!appointmentId) {
        throw new Error('AppointmentId es requerido para crear una sala de chat');
    }
    
    console.log('📨 Creando/buscando sala de chat:', { doctorId, patientId, appointmentId });
    
    // Validar que appointmentId sea un número válido
    const appointmentIdNum = Number(appointmentId);
    if (isNaN(appointmentIdNum) || appointmentIdNum <= 0) {
        console.error('❌ AppointmentId inválido:', appointmentId, 'Tipo:', typeof appointmentId);
        throw new Error(`AppointmentId inválido: ${appointmentId}. Debe ser un número mayor a 0.`);
    }
    
    // Asegurar que todos los valores sean números enteros
    const doctorIdNum = Number(doctorId);
    const patientIdNum = Number(patientId);
    
    if (isNaN(doctorIdNum) || doctorIdNum <= 0) {
        throw new Error(`DoctorId inválido: ${doctorId}`);
    }
    
    if (isNaN(patientIdNum) || patientIdNum <= 0) {
        throw new Error(`PatientId inválido: ${patientId}`);
    }
    
    const requestBody = {
        DoctorId: doctorIdNum,
        PatientId: patientIdNum,
        AppointmentId: appointmentIdNum // SIEMPRE incluir AppointmentId como número válido
    };
    
    console.log('📤 Request body (antes de enviar):', JSON.stringify(requestBody, null, 2));
    console.log('📤 Tipos:', {
        DoctorId: typeof requestBody.DoctorId,
        PatientId: typeof requestBody.PatientId,
        AppointmentId: typeof requestBody.AppointmentId
    });
    
    const response = await tryFetch('/Chat/create/room', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error al crear sala de chat:', errorText);
        let errorMessage = 'Error al crear sala de chat';
        try {
            const error = JSON.parse(errorText);
            errorMessage = error.message || errorMessage;
        } catch (e) {
            errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log('✅ Sala de chat creada/obtenida:', { 
        id: result.id || result.Id,
        appointmentId: result.appointmentId || result.AppointmentId,
        doctorId: result.doctorId || result.DoctorId,
        patientId: result.patientId || result.PatientId
    });
    return result;
}

/**
 * Obtiene las salas de chat de un usuario
 */
export async function getUserChatRooms(userId, token) {
    console.log('📋 Obteniendo salas de chat para usuario:', userId);
    
    const response = await tryFetch(`/Chat/rooms/user/${userId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Error al obtener salas' }));
        throw new Error(error.message);
    }

    const result = await response.json();
    console.log('✅ Salas obtenidas:', result);
    return result;
}

/**
 * Obtiene una sala de chat específica
 */
export async function getChatRoom(chatRoomId, userId, token) {
    console.log('🔍 Obteniendo sala:', { chatRoomId, userId });
    
    const response = await tryFetch(`/Chat/rooms/${chatRoomId}/user/${userId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Error al obtener sala' }));
        throw new Error(error.message);
    }

    const result = await response.json();
    return result;
}

/**
 * Obtiene mensajes de una sala de chat
 */
export async function getChatMessages(chatRoomId, userId, pageNumber = 1, pageSize = 50, token) {
    console.log('💬 Obteniendo mensajes:', { chatRoomId, userId, pageNumber, pageSize });
    
    const response = await tryFetch(`/Chat/rooms/${chatRoomId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            ChatRoomId: chatRoomId,
            UserId: userId,
            PageNumber: pageNumber,
            PageSize: pageSize
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Error al obtener mensajes' }));
        throw new Error(error.message);
    }

    const result = await response.json();
    console.log('✅ Mensajes obtenidos:', result);
    return result;
}

/**
 * Marca mensajes como leídos
 */
export async function markMessagesAsRead(chatRoomId, userId, token) {
    console.log('✓ Marcando mensajes como leídos:', { chatRoomId, userId });
    
    const response = await tryFetch(`/Chat/rooms/${chatRoomId}/read`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userId)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Error al marcar mensajes' }));
        throw new Error(error.message);
    }

    return await response.json();
}