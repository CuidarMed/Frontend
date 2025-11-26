// ============================================
// SERVICIO DE CHAT - CuidarMed+
// ============================================

const CHATMS_BASE_URLS = [
    "http://localhost:8085/api",
    "http://127.0.0.1:8085/api"
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
                signal: AbortSignal.timeout(8000) 
            });
            
            if (response.status !== 0 && response.status !== undefined) {
                return response;
            }
        } catch (err) {
            lastError = err;
            continue;
        }
    }
    throw lastError || new Error("No se pudo conectar al servicio de chat");
}

/**
 * Crea una sala de chat entre doctor y paciente
 */
export async function createChatRoom(doctorId, patientId, appointmentId, doctorInfo, patientInfo) {
    console.log('📨 Creando sala de chat:', { doctorId, patientId, appointmentId });
    
    const response = await tryFetch('/Chat/create/room', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            DoctorId: doctorId,
            PatientId: patientId,
            AppointmentId: appointmentId,
            DoctorInfo: doctorInfo || {
                Id: doctorId,
                Name: "Doctor",
                Email: "",
                Role: "Doctor"
            },
            PatientInfo: patientInfo  || {
                Id: patientId,
                Name: "Paciente",
                Email: "",
                Role: "Patient"
            }
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Error al crear sala de chat' }));
        throw new Error(error.message);
    }

    const result = await response.json();
    console.log('✅ Sala de chat creada:', result);
    return result;
}

/**
 * Obtiene las salas de chat de un usuario
 */
export async function getUserChatRooms(userId) {
    console.log('📋 Obteniendo salas de chat para usuario:', userId);
    
    const response = await tryFetch(`/Chat/rooms/user/${userId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Error al obtener salas' }));
        throw new Error(error.message);
    }

    const result = await response.json();
    console.log('✅ Salas obtenidas:', result);
    return Array.isArray(result) ? result : [];
}

/**
 * Obtiene una sala de chat específica
 */
export async function getChatRoom(chatRoomId, userId) {
    console.log('🔍 Obteniendo sala:', { chatRoomId, userId });
    
    const response = await tryFetch(`/Chat/rooms/${chatRoomId}/user/${userId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
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
export async function getChatMessages(chatRoomId, userId, pageNumber = 1, pageSize = 50) {
    console.log('💬 Obteniendo mensajes:', { chatRoomId, userId, pageNumber, pageSize });

    try {
        const skip = (pageNumber - 1) * pageSize;

        const response = await tryFetch(`/Chat/rooms/${chatRoomId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ChatRoomId: chatRoomId,
                UserId: userId,
                Skip: skip,
                Take: pageSize
            })
        });

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(txt || "Error al obtener mensajes");
        }

        const result = await response.json();

        console.log("📨 Mensajes obtenidos:", result);

        // 🔥 Si el backend devuelve un array → lo devolvemos limpio
        if (Array.isArray(result)) {
            return result;
        }

        // 🔥 Si devuelve paginado, igual devolvemos el array de items
        return result.items || result.Items || [];

    } catch (error) {
        console.error("❌ Error en getChatMessages:", error);
        return []; // evitar romper el frontend
    }
}


/**
 * Marca mensajes como leídos
 */
export async function markMessagesAsRead(chatRoomId, userId) {
    console.log('✓ Marcando mensajes como leídos:', { chatRoomId, userId });
    
    const response = await tryFetch(`/Chat/rooms/${chatRoomId}/read`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userId)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Error al marcar mensajes' }));
        throw new Error(error.message);
    }

    return await response.json();
}
export const CHAT_HUB_URL = "http://localhost:8085/chatHub";

console.log('🔧 Chat Service configurado:', {
    hubUrl: CHAT_HUB_URL
});