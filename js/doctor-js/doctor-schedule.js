// doctor-schedule.js
// Módulo para gestión de agenda y disponibilidad del doctor

import { isFinalState } from './appointment-state-machine.js';
import { showNotification } from './doctor-ui.js';
import { getId } from './doctor-core.js';

const DAYS_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const STATUS_CONFIG = {
    SCHEDULED: { label: 'Programado', color: '#f59e0b' },
    CONFIRMED: { label: 'Confirmado', color: '#10b981' },
    COMPLETED: { label: 'Completado', color: '#10b981' },
    CANCELLED: { label: 'Cancelado', color: '#dc2626' },
    RESCHEDULED: { label: 'Reprogramado', color: '#8b5cf6' },
    NO_SHOW: { label: 'No asistió', color: '#6b7280' },
    IN_PROGRESS: { label: 'En curso', color: '#3b82f6' }
};

/**
 * Carga la vista de agenda completa
 */
export async function loadAgendaView() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    // Limpiar y ocultar secciones
    dashboardContent.querySelectorAll('.agenda-section, .coming-soon-section').forEach(el => el.remove());
    ['mainDashboardSection', 'doctorProfileSection'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.style.display = 'none';
            el.classList.add('hidden');
        }
    });
    
    // Crear sección de agenda
    const agendaSection = createAgendaSection();
    dashboardContent.appendChild(agendaSection);
    
    // Event listener para actualizar
    setTimeout(() => {
        const refreshBtn = document.getElementById('refreshAgendaBtn');
        if (refreshBtn) refreshBtn.addEventListener('click', () => renderAgendaContent(agendaSection));
    }, 100);
    
    await renderAgendaContent(agendaSection);
}

/**
 * Crea la estructura base de la sección de agenda
 */
function createAgendaSection() {
    const section = document.createElement('div');
    section.className = 'agenda-section';
    section.innerHTML = `
        <div class="dashboard-section">
            <div class="section-header">
                <div>
                    <h2>Agenda Médica</h2>
                    <p>Gestión completa de tus turnos asignados</p>
                </div>
                <button class="btn btn-secondary" id="refreshAgendaBtn">
                    <i class="fas fa-sync-alt"></i> Actualizar
                </button>
            </div>
            <div id="agenda-content" style="padding: 2rem; text-align: center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #2563eb;"></i>
                <p style="margin-top: 1rem; color: #6b7280;">Cargando turnos...</p>
            </div>
        </div>
    `;
    return section;
}

/**
 * Renderiza el contenido de la agenda
 */
export async function renderAgendaContent(agendaSection) {
    const agendaContent = agendaSection.querySelector('#agenda-content');
    if (!agendaContent) return;
    
    try {
        const { state } = await import('../state.js');
        const { ApiScheduling, Api } = await import('../api.js');
        
        const doctorId = getId(state.doctorData, 'doctorId');
        if (!doctorId) {
            agendaContent.innerHTML = createErrorHTML('No se pudo identificar al médico');
            return;
        }
        
        // Obtener turnos (3 meses)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const threeMonths = new Date(today);
        threeMonths.setMonth(threeMonths.getMonth() + 3);
        
        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${doctorId}&startTime=${today.toISOString()}&endTime=${threeMonths.toISOString()}`
        );
        
        if (!appointments?.length) {
            agendaContent.innerHTML = createEmptyStateHTML('No hay turnos asignados', 'No tienes turnos programados en los próximos 3 meses.');
            return;
        }
        
        // Cargar pacientes y agrupar por fecha
        const appointmentsWithPatients = await loadPatientsData(appointments, Api);
        const appointmentsByDate = groupByDate(appointmentsWithPatients);
        
        // Renderizar
        agendaContent.innerHTML = generateAgendaHTML(appointments, appointmentsByDate);
        
        setTimeout(() => {
            initializeEventHandlers();
        }, 100);
        
    } catch (error) {
        console.error('Error al cargar agenda:', error);
        agendaContent.innerHTML = createErrorHTML(`Error al cargar la agenda: ${error.message}`);
    }
}

/**
 * Carga datos de pacientes para cada turno
 */
async function loadPatientsData(appointments, Api) {
    return Promise.all(appointments.map(async (apt) => {
        try {
            const patientId = apt.patientId || apt.PatientId;
            const patient = await Api.get(`v1/Patient/${patientId}`);
            return {
                ...apt,
                patientName: `${patient.name || patient.Name || ''} ${patient.lastName || patient.LastName || ''}`.trim() || 'Paciente sin nombre',
                patientDni: patient.dni || patient.Dni || 'N/A'
            };
        } catch {
            return { ...apt, patientName: 'Paciente desconocido', patientDni: 'N/A' };
        }
    }));
}

/**
 * Agrupa turnos por fecha
 */
function groupByDate(appointments) {
    const grouped = {};
    appointments.forEach(apt => {
        const startTime = new Date(apt.startTime || apt.StartTime);
        const dateKey = `${startTime.getUTCFullYear()}-${String(startTime.getUTCMonth() + 1).padStart(2, '0')}-${String(startTime.getUTCDate()).padStart(2, '0')}`;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(apt);
    });
    return grouped;
}

/**
 * Genera el HTML completo de la agenda
 */
function generateAgendaHTML(appointments, appointmentsByDate) {
    const summary = generateSummaryHTML(appointments);
    const sortedDates = Object.keys(appointmentsByDate).sort();
    
    const daysHTML = sortedDates.map(dateKey => {
        const [year, month, day] = dateKey.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        const dayAppointments = appointmentsByDate[dateKey].sort((a, b) => 
            new Date(a.startTime || a.StartTime) - new Date(b.startTime || b.StartTime)
        );
        
        return generateDayCardHTML(
            DAYS_NAMES[date.getUTCDay()],
            day,
            MONTHS_NAMES[month - 1],
            dayAppointments
        );
    }).join('');
    
    return `${summary}<div class="agenda-days-container">${daysHTML}</div>`;
}

/**
 * Genera HTML del resumen
 */
function generateSummaryHTML(appointments) {
    const statuses = ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'IN_PROGRESS'];
    const badges = statuses.map(status => {
        const count = appointments.filter(a => (a.status || a.Status) === status).length;
        const config = STATUS_CONFIG[status];
        const bgColors = { SCHEDULED: '#fef3c7', CONFIRMED: '#d1fae5', COMPLETED: '#dcfce7', CANCELLED: '#fee2e2', IN_PROGRESS: '#d1fae5' };
        const textColors = { SCHEDULED: '#92400e', CONFIRMED: '#059669', COMPLETED: '#166534', CANCELLED: '#991b1b', IN_PROGRESS: '#059669' };
        return `<span style="padding: 0.25rem 0.75rem; background: ${bgColors[status]}; color: ${textColors[status]}; border-radius: 4px; font-size: 0.875rem;">${config.label}s: ${count}</span>`;
    }).join('');
    
    return `
        <div style="margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: #1f2937;">Total de turnos: ${appointments.length}</h3>
                <div style="display: flex; gap: 0.5rem;">${badges}</div>
            </div>
        </div>
    `;
}

/**
 * Genera HTML de tarjeta de día
 */
function generateDayCardHTML(dayName, dayNumber, monthName, appointments) {
    const appointmentsHTML = appointments.map(apt => generateAppointmentHTML(apt)).join('');
    return `
        <div class="agenda-day-card" style="margin-bottom: 1.5rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div style="background: #f3f4f6; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 style="margin: 0; color: #1f2937; font-size: 1.25rem;">${dayName}, ${dayNumber} de ${monthName}</h3>
                    <p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.875rem;">${appointments.length} ${appointments.length === 1 ? 'turno' : 'turnos'}</p>
                </div>
                <span style="padding: 0.5rem 1rem; background: #10b981; color: white; border-radius: 6px; font-weight: 600;">${appointments.length}</span>
            </div>
            <div style="padding: 1rem 1.5rem;">${appointmentsHTML}</div>
        </div>
    `;
}

/**
 * Genera HTML de un turno
 */
function generateAppointmentHTML(apt) {
    const start = new Date(apt.startTime || apt.StartTime);
    const end = new Date(apt.endTime || apt.EndTime);
    const timeStr = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')} - ${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    const status = apt.status || apt.Status || 'SCHEDULED';
    const config = STATUS_CONFIG[status] || { color: '#6b7280', label: status };
    const reason = (apt.reason || apt.Reason || apt.reasonText || apt.ReasonText || '').trim() || 'Sin motivo especificado';
    const appointmentId = apt.appointmentId || apt.AppointmentId;
    const patientId = apt.patientId || apt.PatientId;
    
    const statusOptions = Object.entries(STATUS_CONFIG).map(([key, val]) => 
        `<option value="${key}" ${status === key ? 'selected' : ''}>${val.label}</option>`
    ).join('');
    
    let statusElement;

    if (isFinalState(status)) {
        // 🔒 Estado final → no editable → solo texto
        statusElement = `
            <span class="appointment-status-final"
                  style="padding: 0.25rem 0.5rem; 
                         font-size: 0.75rem; 
                         font-weight: 600; 
                         color: ${config.color};">
                ${config.label}
            </span>
        `;
    } else {
        // ✏️ Estado editable → select normal
        statusElement = `
            <select class="appointment-status-select"
                    data-appointment-id="${appointmentId}"
                    style="padding: 0.25rem 0.5rem; 
                           border: 1px solid #e5e7eb; 
                           border-radius: 4px; 
                           font-size: 0.75rem; 
                           background: white; 
                           color: ${config.color}; 
                           font-weight: 600; 
                           cursor: pointer;">
                ${statusOptions}
            </select>
        `;
    }

    //
    // ============================
    // 3) Botones de acción (solo si aplica)
    // ============================
    //
    const actions = getActionButtons(status, appointmentId, patientId, apt.patientName);

    //
    // ============================
    // 4) HTML final del turno
    // ============================
    //
    return `
        <div style="display: flex; justify-content: space-between; align-items: center; 
                    padding: 1rem; margin-bottom: 0.75rem; 
                    background: #f9fafb; border-radius: 6px; 
                    border-left: 4px solid ${config.color};">
            
            <div style="flex: 1;">
                
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                    <div style="font-weight: 600; color: #1f2937; font-size: 1.1rem;">
                        ${apt.patientName}
                    </div>

                    <!-- El elemento dinámico de estado -->
                    ${statusElement}
                </div>

                <div style="color: #6b7280; font-size: 0.875rem;">
                    <i class="fas fa-clock" style="margin-right: 0.5rem;"></i>${timeStr}
                </div>

                <div style="color: #6b7280; font-size: 0.875rem;">
                    <i class="fas fa-user" style="margin-right: 0.5rem;"></i>DNI: ${apt.patientDni}
                </div>

                <div style="color: #6b7280; font-size: 0.875rem;">
                    <i class="fas fa-stethoscope" style="margin-right: 0.5rem;"></i>${reason}
                </div>
            </div>

            <div style="display: flex; gap: 0.5rem; margin-left: 1rem;">
                ${actions}
            </div>
        </div>
    `;
}

/**
 * Obtiene los botones de acción según el estado
 */
function getActionButtons(status, appointmentId, patientId, patientName) {
    if (status === 'COMPLETED') {
        return '<span style="padding: 0.5rem 1rem; font-size: 0.875rem; color: #10b981; font-weight: 600;"><i class="fas fa-check-circle"></i> Consulta realizada</span>';
    }
    if (status === 'SCHEDULED' || status === 'CONFIRMED') {
    return `
        <button class="btn btn-primary btn-sm attend-appointment-btn"
                data-appointment-id="${appointmentId}"
                data-patient-id="${patientId}"
                data-patient-name="${patientName}"
                style="padding: 0.5rem 1rem; font-size: 0.875rem;">
            <i class="fas fa-video"></i> Atender
        </button>

        <button class="btn btn-chat-doctor btn-sm open-chat-btn"
                data-appointment-id="${appointmentId}"
                data-patient-id="${patientId}"
                data-patient-name="${patientName}"
                title="Chatear con el paciente"
                style="background: #10b981; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 6px; display: inline-flex; align-items: center; gap: 0.4rem;">
            <i class="fas fa-comments"></i> Chat
        </button>
    `;
}
    if (status === 'IN_PROGRESS') {
        return `
            <button class="btn btn-success btn-sm complete-appointment-btn" data-appointment-id="${appointmentId}" data-patient-id="${patientId}" data-patient-name="${patientName}" style="padding: 0.5rem 1rem; font-size: 0.875rem; margin-right: 0.5rem;"><i class="fas fa-check"></i> Completar</button>
            <button class="btn btn-warning btn-sm no-show-appointment-btn" data-appointment-id="${appointmentId}" style="padding: 0.5rem 1rem; font-size: 0.875rem;"><i class="fas fa-times"></i> No asistió</button>
        `;
    }
    return '';
}

/**
 * Inicializa todos los event handlers
 */
function initializeEventHandlers() {
    import('./doctor-appointments.js').then(({ attendConsultation, updateAppointmentStatus,handleDoctorChatOpen  }) => {
        // Botones de atender
        attachEventListeners('.attend-appointment-btn', async function() {
            const { appointmentId, patientId, patientName } = this.dataset;
            await updateAppointmentStatus(appointmentId, 'IN_PROGRESS');
            if (patientId && patientName) await attendConsultation(appointmentId, patientId, patientName);
        });
        
        // Botones de completar
        attachEventListeners('.complete-appointment-btn, .complete-consultation-btn', async function() {
            const { appointmentId, patientId, patientName } = this.dataset;
            if (appointmentId && patientId && patientName) await attendConsultation(appointmentId, patientId, patientName);
        });
        
        // Botones de no asistió
        attachEventListeners('.no-show-appointment-btn', async function() {
            const appointmentId = this.dataset.appointmentId;
            if (appointmentId && confirm('¿El paciente no asistió a la consulta?')) {
                await updateAppointmentStatus(appointmentId, 'NO_SHOW', 'Paciente no asistió');
                showNotification('Turno marcado como "No asistió"', 'info');
                const agendaSection = document.querySelector('.agenda-section');
                if (agendaSection) await renderAgendaContent(agendaSection);
            }
        });
        
        
        // Selectores de estado (Agenda)
        attachEventListeners('.appointment-status-select', async function () {
            const appointmentId = this.dataset.appointmentId;
            const newStatus = this.value;

            // Guardamos el estado anterior por si cancelan
            const previousStatus = [...this.options].find(o => o.defaultSelected)?.value || this.value;

            // 🔄 Si eligió REPROGRAMADO → abrir modal en lugar de cambiar estado
            if (newStatus === "RESCHEDULED") {
                try {
                    const { ApiScheduling } = await import("../api.js");
                    const { openDoctorRescheduleModal } = await import("./doctor-appointments.js");

                    const appointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`);

                    // Abrimos modal de reprogramación
                    await openDoctorRescheduleModal(appointment);

                    // Volvemos el select a su estado original (la reprogramación se hará desde el modal)
                    this.value = previousStatus;

                    return; // aca NO ejecutamos updateAppointmentStatus
                } catch (err) {
                    console.error("❌ Error abriendo modal de reprogramación desde agenda:", err);
                    showNotification("No se pudo abrir la ventana de reprogramación", "error");
                }
            }

            // 🔁 Si NO es reprogramado → flujo normal
            if (
                appointmentId &&
                confirm(`¿Cambiar el estado del turno a "${this.options[this.selectedIndex].text}"?`)
            ) {
                await updateAppointmentStatus(appointmentId, newStatus);
            } else {
                // Restaurar estado si canceló
                this.value = previousStatus;

                const agendaSection = document.querySelector(".agenda-section");
                if (agendaSection) await renderAgendaContent(agendaSection);
            }
        }, "change");

        
        // Botones de chat
        attachEventListeners('.open-chat-btn', async function() {
            const { appointmentId, patientId, patientName } = this.dataset;
            console.log('Click en boton de chat:', { appointmentId, patientId, patientName });
            if (appointmentId && patientId && patientName) {
                await handleDoctorChatOpen(appointmentId, patientId, patientName);  // ✅ Nombre correcto
            }
        });
    });
}

/**
 * Helper para adjuntar event listeners
 */
function attachEventListeners(selector, handler, event = 'click') {
    document.querySelectorAll(selector).forEach(el => {
        const newEl = el.cloneNode(true);
        el.parentNode.replaceChild(newEl, el);
        newEl.addEventListener(event, handler);
    });
}

/**
 * Helpers para HTML de estados
 */
function createErrorHTML(message) {
    return `<div style="padding: 2rem; text-align: center; color: #dc2626;"><i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>${message}</p></div>`;
}

function createEmptyStateHTML(title, message) {
    return `<div style="padding: 3rem; text-align: center; color: #6b7280;"><i class="fas fa-calendar-times" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i><h3 style="margin-bottom: 0.5rem;">${title}</h3><p>${message}</p></div>`;
}

/**
 * Gestión de disponibilidad
 */
export async function openScheduleManager() {
    const { state } = await import('../state.js');
    const doctorId = state.doctorData?.doctorId || state.doctorData?.DoctorId;
    
    if (!doctorId) {
        showNotification('No se pudo identificar al médico', 'error');
        return;
    }

    const modal = createModal('Gestionar Mi Agenda', `
        <div class="schedule-manager-container">
            <div style="margin-bottom: 1.5rem;">
                <button class="btn btn-primary" id="add-availability-btn"><i class="fas fa-plus"></i> Agregar Horario</button>
            </div>
            <div id="availability-list" style="margin-top: 1rem;">
                <div style="text-align: center; padding: 2rem; color: #6b7280;"><i class="fas fa-spinner fa-spin"></i> Cargando disponibilidad...</div>
            </div>
        </div>
    `, '1000px');
    
    modal.querySelector('#add-availability-btn').addEventListener('click', () => openAvailabilityForm(modal, doctorId));
    await loadDoctorAvailability(modal, doctorId);
}

/**
 * Carga disponibilidad del doctor
 */
async function loadDoctorAvailability(modal, doctorId) {
    try {
        const { ApiScheduling } = await import('../api.js');
        const availability = await ApiScheduling.get(`v1/DoctorAvailability/search?doctorId=${doctorId}`);
        const list = modal.querySelector('#availability-list');
        
        if (!availability?.length) {
            list.innerHTML = createEmptyStateHTML('No tienes horarios configurados', 'Agrega tu primer horario de disponibilidad.');
            return;
        }

        list.innerHTML = renderAvailabilityList(availability);
        attachAvailabilityHandlers(modal, list, doctorId);
    } catch (error) {
        console.error('Error:', error);
        modal.querySelector('#availability-list').innerHTML = createErrorHTML('No se pudo cargar la disponibilidad');
    }
}

/**
 * Renderiza lista de disponibilidad
 */
/**
 * Renderiza lista de disponibilidad
 */
function renderAvailabilityList(availability) {
    const dayNames = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 7: 'Domingo' };
    const grouped = {};
    
    availability.forEach(av => {
        let day = av.dayOfWeek || av.DayOfWeek;
        
        // Convertir string a número si es necesario
        if (typeof day === 'string') {
            const dayNameToNumber = {
                'Monday': 1, 'Lunes': 1,
                'Tuesday': 2, 'Martes': 2,
                'Wednesday': 3, 'Miércoles': 3,
                'Thursday': 4, 'Jueves': 4,
                'Friday': 5, 'Viernes': 5,
                'Saturday': 6, 'Sábado': 6,
                'Sunday': 7, 'Domingo': 7
            };
            day = dayNameToNumber[day] || parseInt(day);
        }
        
        day = parseInt(day);
        
        if (isNaN(day) || day < 1 || day > 7) {
            console.warn('Día inválido:', av.dayOfWeek || av.DayOfWeek, av);
            return;
        }
        
        if (!grouped[day]) grouped[day] = [];
        grouped[day].push(av);
    });

    console.log('Disponibilidades agrupadas:', grouped);

    return Object.keys(grouped).sort((a, b) => a - b).map(day => {
        const dayName = dayNames[day];
        const slots = grouped[day];
        
        const slotsHTML = slots.map(slot => {
            const start = formatTime(slot.startTime || slot.StartTime);
            const end = formatTime(slot.endTime || slot.EndTime);
            const duration = slot.durationMinutes || slot.DurationMinutes || 30;
            const id = slot.availabilityId || slot.AvailabilityId;
            const active = slot.isActive !== false;
            
            return `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; margin-bottom: 0.5rem; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; gap: 1rem;">
                        <span style="font-weight: 600; color: #1f2937;">${start} - ${end}</span>
                        <span style="color: #6b7280;">Duración: ${duration} min</span>
                        ${!active ? '<span style="color: #dc2626;">(Inactivo)</span>' : ''}
                    </div>
                    <div>
                        <button class="btn btn-sm btn-secondary edit-availability-btn" data-id="${id}" style="margin-right: 0.5rem;">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn btn-sm btn-danger delete-availability-btn" data-id="${id}">
                            <i class="fas fa-trash"></i> Eliminar
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div style="margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
                <h4 style="margin-bottom: 1rem; color: #1f2937;"><i class="fas fa-calendar-day"></i> ${dayName}</h4>
                ${slotsHTML}
            </div>
        `;
    }).join('');
}

/**
 * Formatea tiempo
 */
/**
 * Formatea tiempo
 */
function formatTime(time) {
    if (!time) return '00:00';
    
    // Si es un string tipo "HH:mm:ss" o "HH:mm"
    if (typeof time === 'string') {
        const parts = time.split(':');
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    
    // Si es un objeto con propiedades hours/minutes
    const hours = time.hours || time.Hours || 0;
    const minutes = time.minutes || time.Minutes || 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Adjunta handlers de disponibilidad
 */
function attachAvailabilityHandlers(modal, list, doctorId) {
    list.querySelectorAll('.edit-availability-btn').forEach(btn => {
        btn.addEventListener('click', () => openAvailabilityForm(modal, doctorId, btn.dataset.id));
    });
    list.querySelectorAll('.delete-availability-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteAvailability(modal, doctorId, btn.dataset.id));
    });
}

/**
 * Abre formulario de disponibilidad
 */
async function openAvailabilityForm(parentModal, doctorId, availabilityId = null) {
    let availability = null;

    if (availabilityId) {
        const { ApiScheduling } = await import('../api.js');
        availability = await ApiScheduling.get(`v1/DoctorAvailability/${availabilityId}`);
        console.log("🟦 Disponibilidad cargada para editar:", availability);
    }

    // Map para convertir string → número
    const dayMap = {
        "Monday": 1,
        "Tuesday": 2,
        "Wednesday": 3,
        "Thursday": 4,
        "Friday": 5,
        "Saturday": 6,
        "Sunday": 7
    };

    let selectedDay = 0;

    if (availability) {
        // Detecta si viene "Monday" o si viene number
        const rawDay = availability.dayOfWeek || availability.DayOfWeek;

        if (typeof rawDay === "string") {
            selectedDay = dayMap[rawDay] || 0;
        } else {
            selectedDay = parseInt(rawDay) || 0;
        }
    }

    console.log("📌 Día detectado:", selectedDay);

    const names = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

    const dayOptions = [1, 2, 3, 4, 5, 6, 7].map(d => `
        <option value="${d}" ${selectedDay === d ? 'selected' : ''}>${names[d]}</option>
    `).join('');

    const startTime = availability ? formatTime(availability.startTime || availability.StartTime) : '';
    const endTime = availability ? formatTime(availability.endTime || availability.EndTime) : '';
    const duration = availability ? (availability.durationMinutes || availability.DurationMinutes) : 30;

    const modal = createModal(
        availabilityId ? 'Editar Horario' : 'Agregar Horario',
        `
        <form id="availability-form">
            <div class="form-group">
                <label style="display: block; margin-bottom: 0.5rem; color: #374151; font-weight: 600; font-size: 0.9rem;">Día de la semana:</label>
                <select name="dayOfWeek" required style="width: 100%; padding: 0.75rem 1rem; border: 2px solid #e5e7eb; border-radius: 10px; font-size: 0.95rem; color: #374151; background: white; cursor: pointer; transition: all 0.3s ease; appearance: none; background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23374151' d='M6 9L1 4h10z'/%3E%3C/svg%3E\"); background-repeat: no-repeat; background-position: right 1rem center; padding-right: 2.5rem;">
                    <option value="">Seleccionar día</option>
                    ${dayOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Hora de inicio:</label>
                <input type="time" name="startTime" value="${startTime}" required>
            </div>
            <div class="form-group">
                <label>Hora de fin:</label>
                <input type="time" name="endTime" value="${endTime}" required>
            </div>
            <div class="form-group">
                <label>Duración (minutos):</label>
                <input type="number" name="durationMinutes" min="15" max="480" value="${duration}" required>
            </div>
            <div class="form-actions" style="display: flex; gap: 1rem; justify-content: flex-end; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; flex-wrap: wrap;">
                <button type="button" class="btn btn-secondary cancel-modal">Cancelar</button>
                <button type="submit" class="btn btn-primary">Guardar</button>
            </div>
        </form>
        `,
        '600px',
        1001
    );

    modal.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAvailability(modal, parentModal, doctorId, availabilityId);
    });
}


/**
 * Guarda disponibilidad
 */
/**
 * Guarda disponibilidad
 */
async function saveAvailability(formModal, parentModal, doctorId, availabilityId) {
    try {
        const formData = new FormData(formModal.querySelector('form'));

        const dayNames = {
            1: "Monday",
            2: "Tuesday",
            3: "Wednesday",
            4: "Thursday",
            5: "Friday",
            6: "Saturday",
            7: "Sunday"
        };

        const numericDay = parseInt(formData.get('dayOfWeek'));
        const dayString = dayNames[numericDay];

        const [startH, startM] = formData.get('startTime').split(':');
        const [endH, endM] = formData.get('endTime').split(':');

        const data = {
            doctorId: doctorId,
            dayOfWeek: dayString, // ← ← ← el backend lo quiere en texto
            startTime: `${startH.padStart(2, '0')}:${startM.padStart(2, '0')}:00`,
            endTime: `${endH.padStart(2, '0')}:${endM.padStart(2, '0')}:00`,
            durationMinutes: parseInt(formData.get('durationMinutes'))
        };

        console.log("📤 Enviando PATCH/POST:", data);

        const { ApiScheduling } = await import('../api.js');

        let response;
        if (availabilityId) {
            response = await ApiScheduling.patch(`v1/DoctorAvailability/${availabilityId}`, data);
            showNotification('Horario actualizado', 'success');
        } else {
            response = await ApiScheduling.post(`v1/DoctorAvailability/${doctorId}`, data);
            showNotification('Horario agregado', 'success');
        }

        console.log("📥 Respuesta servidor:", response);

        formModal.remove();
        await loadDoctorAvailability(parentModal, doctorId);

    } catch (error) {
        console.error('❌ Error al guardar disponibilidad:', error);
        showNotification(`Error: ${error.message}`, 'error');
    }
}


/**
 * Elimina disponibilidad
 */
async function deleteAvailability(modal, doctorId, availabilityId) {
    if (!confirm('¿Eliminar este horario?')) return;
    try {
        const { ApiScheduling } = await import('../api.js');
        await ApiScheduling.delete(`v1/DoctorAvailability/${availabilityId}`);
        showNotification('Horario eliminado', 'success');
        await loadDoctorAvailability(modal, doctorId);
    } catch (error) {
        showNotification('Error al eliminar', 'error');
    }
}

/**
 * Helper para crear modales
 */
function createModal(title, content, maxWidth = '1000px', zIndex = 1000) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `display: flex; z-index: ${zIndex};`;
    modal.innerHTML = `
        <div class="modal-content" style="max-width: ${maxWidth}; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>${title}</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">${content}</div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => modal.remove()));
    modal.querySelectorAll('.cancel-modal').forEach(btn => btn.addEventListener('click', () => modal.remove()));
    return modal;
}