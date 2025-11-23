// ============================================
// GESTIÓN DE TURNOS
// ============================================

import { appState } from './patient-state.js';
import { getActiveSection } from './patient-utils.js';
import { showNotification } from './patient-notifications.js';
import { handleAppointmentChatCreation, openChatModal } from '../chat/chat-integration.js';

/**
 * Renderiza turnos para la página de inicio (solo 3 próximos)
 */
export function renderAppointmentsHome(appointments) {
    return appointments.map(apt => {
        const aptStart = new Date(apt.startTime || apt.StartTime);

        const year = aptStart.getFullYear();
        const month = String(aptStart.getMonth() + 1).padStart(2, '0');
        const day = String(aptStart.getDate()).padStart(2, '0');
        const time = aptStart.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        
        const dateStr = `${year}-${month}-${day} - ${time}`;

        const d = window.doctorsMap.get(apt.doctorId || apt.DoctorId) || {};
        const doctorName = d.name || "Dr. Desconocido";
        const specialty = d.specialty || "Especialidad no disponible";

        const status = (apt.status || apt.Status || "SCHEDULED").toLowerCase();
        const statusMap = {
            scheduled: "Programado",
            confirmed: "Confirmado",
            cancelled: "Cancelado",
            completed: "Completado",
            in_progress: "En curso",
            pending: "Pendiente",
            no_show: "Ausente",
            rescheduled: "Reprogramado"
        };

        return `
            <div class="appointment-home-card">
                <div class="appointment-home-icon">
                    <i class="fas fa-calendar-day"></i>
                </div>
                <div class="appointment-home-content">
                    <h4 class="appointment-home-doctor">${doctorName}</h4>
                    <div class="appointment-home-specialty">${specialty}</div>
                    <div class="appointment-home-datetime">
                        <i class="fas fa-clock"></i>
                        <span>${dateStr}</span>
                    </div>
                </div>
                <div class="appointment-clean-status status-${status}">
                    ${statusMap[status] || status}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Renderiza lista completa de turnos (para sección Mis Turnos)
 */
export function renderAppointmentsFull(appointments) {
    return appointments.map(apt => {
        // ✅ DEBUG: Ver TODO el objeto
        console.log('📋 APPOINTMENT COMPLETO:', JSON.stringify(apt, null, 2));

        const aptStart = new Date(apt.startTime || apt.StartTime);

        const weekday = aptStart.toLocaleDateString("es-AR", { weekday: "long" });
        const day = aptStart.getDate();
        const month = aptStart.toLocaleDateString("es-AR", { month: "long" });
        const year = aptStart.getFullYear();
        const time = aptStart.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        
        const dateTimeStr = `${weekday}, ${day} de ${month} de ${year} - ${time}`;

        const d = window.doctorsMap.get(apt.doctorId || apt.DoctorId) || {};
        const doctorName = d.name || "Dr. Desconocido";
        const specialty = d.specialty || "Especialidad no disponible";

        const reason = apt.reason || apt.Reason || apt.reasonText || "Sin motivo especificado";

        const status = (apt.status || apt.Status || "SCHEDULED").toLowerCase();
        const statusMap = {
            scheduled: "Programado",
            confirmed: "Confirmado",
            cancelled: "Cancelado",
            completed: "Completado",
            in_progress: "En curso",
            no_show: "Ausente",
            rescheduled: "Reprogramado"
        };

        const appointmentId = 
            apt.appointmentId || 
            apt.AppointmentId || 
            apt.id || 
            apt.Id || 
            apt.appointmentID ||
            apt.AppointmentID;
        const doctorId = apt.doctorId || apt.DoctorId
        const canCancel = status === "confirmed" || status === "scheduled" || status === "rescheduled";

        // Verificarmos si el chat esta disponible(turno confirmado o en progreso)
        const chatAvailable = status === 'confirmed' || status === 'in-progress'

        return `
            <div class="appointment-clean-card">
                <div class="appointment-clean-icon">
                    <i class="fas fa-calendar-alt"></i>
                </div>
                <div class="appointment-clean-content">
                    <div class="appointment-clean-header">
                        <h4 class="appointment-clean-doctor">${doctorName}</h4>
                        <span class="appointment-clean-status status-${status}">
                            ${statusMap[status] || status}
                        </span>
                    </div>
                    <div class="appointment-clean-specialty">${specialty}</div>
                    <div class="appointment-clean-datetime">
                        <i class="fa-regular fa-clock"></i>
                        <span>${dateTimeStr}</span>
                    </div>
                    <div class="appointment-clean-reason">
                        <strong>Motivo:</strong> ${reason}
                    </div>
                </div>
                <div class="appointment-clean-actions">
                    ${chatAvailable && appointmentId && doctorId && doctorName ? `
                            <button class="btn-clean-chat"
                                data-appoinment-id="${appointmentId}"
                                data-doctor-id="${apt.doctorId || apt.DoctorId}"
                                data-doctor-name=${doctorName}
                                title="Chat con el doctor"
                                style="background: #3b82f6; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-comments"></i> Chat
                            </button>
                        ` : ""}
                    ${canCancel ? `
                    <button class="btn-clean-cancel" onclick="cancelAppointment(${appointmentId})" title="Cancelar turno">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                </div>` : ""}
            </div>
        `;
    }).join('');
}

// Funcion Handle del chat para pasiente

async function handlePatientChatOpen(appointmentId, doctorId, doctorName){
    try{
        console.log('Abriendo chat: ', {appointmentId, doctorId, doctorName})

        if (!appointmentId || !doctorId || !doctorName) {
            console.error('❌ Parámetros incompletos:', { appointmentId, doctorId, doctorName });
            showNotification('No se puede abrir el chat: datos incompletos', 'error');
            return;
        }
        
        // ✅ Validar que tengamos el usuario actual
        if (!appState.currentUser) {
            console.error('❌ No hay usuario autenticado');
            showNotification('Error: No hay usuario autenticado', 'error');
            return;
        }
        
        // ✅ Obtener userId con múltiples fallbacks
        const currentUserId = appState.currentUser.userId || 
                            appState.currentUser.UserId || 
                            appState.currentUser.id || 
                            appState.currentUser.Id;
        
        console.log('👤 Usuario actual:', {
            currentUser: appState.currentUser,
            currentUserId: currentUserId
        });

        if (!currentUserId) {
            console.error('❌ No se pudo obtener userId:', appState.currentUser);
            showNotification('Error: No se pudo identificar al usuario', 'error');
            return;
        }

        const {ApiScheduling} = await import('../api.js')

        // Obtenemos los datos completos del appointment
        const appoinment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`)

        if(!appoinment){
            showNotification('No se encontro el turno', error)
            return
        }

        // Verificamos que este confirmado 
        const status = (appoinment.status || appoinment.Status || '').toLowerCase()
        if(status !== 'confirmed' && status !== 'in_progress'){
            showNotification(' El chat solo esta disponible para turnos confirmados', 'warning')
            return
        }

        // Crear o recurar sala de chat
        const chatRoom = await handleAppointmentChatCreation(
            {
                ...appoinment,
                currentUSerId: currentUserId
            }
        )

        if(!chatRoom){
            showNotification('No se pudo iniciar el chat. Verificar la conexion.', 'error')
            return
        }

        const patientFirstName = appState.currentPatient?.firstName || appState.currentPatient?.FirstName || ''

        const patientLastName = appState.currentPatient?.LastName || appState.currentPatient?.LastName || ''

        const patientName = `${patientFirstName} ${patientLastName}`.trim() || 'Paciente'

        // abrir modal del chat 
        openChatModal(chatRoom, {
            currentUSerId: appState.currentUser.UserId,
            currentUserName: patientName,
            otherUserName: doctorName || 'Doctor',
            userType: 'patient'
        })

        showNotification('Chat iniciado', 'success') 
    } catch(error){
        console.error('Error al abrir el chat: ', error)
        showNotification('Ocurrio un error al intentar abrir el chat', 'error')
    }
}

// Inicializar botones del chat
function initializeChatButtons(){
    console.log('Inicializando botones de chat para paciente')

    document.querySelectorAll('.btn-clean-chat').forEach(button => {
        const newButton = button.cloneNode(true)
        button.parentNode.replaceChild(newButton, button)

        newButton.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const appointmentId = this.getAttribute('data-appointment-id');
            const doctorId = this.getAttribute('data-doctor-id');
            const doctorName = this.getAttribute('data-doctor-name');
            
            console.log('🗨️ Click en botón de chat:', { appointmentId, doctorId, doctorName });
            
            // ✅ Validar que todos los datos existan
            if (!appointmentId || !doctorId || !doctorName) {
                console.error('❌ Datos incompletos:', { 
                    appointmentId: appointmentId || 'FALTA', 
                    doctorId: doctorId || 'FALTA', 
                    doctorName: doctorName || 'FALTA' 
                });
                showNotification('No se puede abrir el chat: datos incompletos', 'error');
                return;
            }
            
            await handlePatientChatOpen(appointmentId, doctorId, doctorName)
        })
    })
}

/**
 * Carga turnos del paciente desde el backend
 */
export async function loadPatientAppointments() {
    try {
        if (!appState.currentPatient?.patientId) {
            console.warn('No hay patientId disponible para cargar turnos');
            return;
        }

        // RUTA CORREGIDA: api.js está en js/
        const { ApiScheduling, Api } = await import('../api.js');
        const appointmentsResponse = await ApiScheduling.get(`v1/Appointments?patientId=${appState.currentPatient.patientId}`);

        const appointments = Array.isArray(appointmentsResponse)
            ? appointmentsResponse
            : (appointmentsResponse?.value || appointmentsResponse || []);

        const appointmentsList = document.getElementById('appointments-list');
        if (!appointmentsList) return;

        if (!appointments || appointments.length === 0) {
            appointmentsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No tienes turnos programados</p>
                </div>`;
            return;
        }

        appointments.sort((a, b) =>
            new Date(a.startTime || a.StartTime) -
            new Date(b.startTime || b.StartTime)
        );

        // Obtener info del doctor
        const doctorIds = [...new Set(appointments.map(a => a.doctorId || a.DoctorId))];
        const doctorsMap = new Map();

        for (const id of doctorIds) {
            try {
                const d = await Api.get(`v1/Doctor/${id}`);
                doctorsMap.set(id, {
                    name: `Dr. ${d.firstName || d.FirstName || ''} ${d.lastName || d.LastName || ''}`.trim(),
                    specialty: d.specialty || d.Specialty || "Especialidad no disponible"
                });
            } catch {
                doctorsMap.set(id, {
                    name: "Dr. Desconocido",
                    specialty: "Especialidad no disponible"
                });
            }
        }

        window.doctorsMap = doctorsMap;

        const activeSection = getActiveSection();

        if (activeSection === "inicio") {
            const latestAppointments = appointments.slice(0, 3);
            appointmentsList.innerHTML = renderAppointmentsHome(latestAppointments);
        }
        else if (activeSection === "turnos") {
            appointmentsList.innerHTML = renderAppointmentsFull(appointments);

            // Inicializamos botones de chat despues de renderizar
            setTimeout(() => {
                initializeChatButtons();
            }, 100)
        }

    } catch (error) {
        console.error('Error al cargar turnos:', error);

        const appointmentsList = document.getElementById('appointments-list');
        if (appointmentsList) {
            appointmentsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No se pudieron cargar los turnos</p>
                </div>`;
        }
    }
}

/**
 * Cancela un turno
 */
export async function cancelAppointment(appointmentId) {
    if (!confirm('¿Estás seguro de que deseas cancelar este turno?')) {
        return;
    }

    try {
        // RUTA CORREGIDA: api.js está en js/
        const { ApiScheduling } = await import('../api.js');
        
        await ApiScheduling.patch(`v1/Appointments/${appointmentId}/cancel`, {
            reason: 'Cancelado por el paciente'
        });
        
        showNotification('Turno cancelado exitosamente', 'success');
        
        await loadPatientAppointments();
        
        const { loadPatientStats } = await import('./patient-dashboard.js');
        await loadPatientStats();
    } catch (error) {
        console.error('Error al cancelar turno:', error);
        const errorMessage = error.message || error.toString();
        if (errorMessage.includes('Failed to fetch') || errorMessage.includes('ERR_CONNECTION')) {
            showNotification('No se pudo conectar con el servidor. Verifica que SchedulingMS esté corriendo.', 'error');
        } else {
            showNotification(`No se pudo cancelar el turno: ${errorMessage}`, 'error');
        }
    }
}

// Exportar para uso global
window.cancelAppointment = cancelAppointment;