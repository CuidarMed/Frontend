// ============================================
// GESTIÓN DE TURNOS
// ============================================

import { appState } from './patient-state.js';
import { getActiveSection } from './patient-utils.js';
import { showNotification } from './patient-notifications.js';

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

        const appointmentId = apt.appointmentId || apt.AppointmentId;
        const canCancel = status === "confirmed" || status === "scheduled" || status === "rescheduled";

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
                ${canCancel ? `
                <div class="appointment-clean-actions">
                    <button class="btn-clean-cancel" onclick="cancelAppointment(${appointmentId})" title="Cancelar turno">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                </div>` : ""}
            </div>
        `;
    }).join('');
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