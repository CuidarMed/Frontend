// doctor-schedule.js
// Módulo para gestión de agenda y disponibilidad del doctor

import { showNotification } from './doctor-ui.js';
import { getId, formatDate, formatTime } from './doctor-core.js';

/**
 * Carga la vista de agenda completa
 */
export async function loadAgendaView() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    // Eliminar secciones anteriores
    const existingAgendas = dashboardContent.querySelectorAll('.agenda-section');
    existingAgendas.forEach(agenda => agenda.remove());
    
    const existingComingSoon = dashboardContent.querySelectorAll('.coming-soon-section');
    existingComingSoon.forEach(comingSoon => comingSoon.remove());
    
    // Ocultar otras secciones
    const mainDashboard = document.getElementById('mainDashboardSection');
    const profileSection = document.getElementById('doctorProfileSection');
    if (mainDashboard) mainDashboard.style.display = 'none';
    if (profileSection) {
        profileSection.style.display = 'none';
        profileSection.classList.add('hidden');
    }
    
    // Crear sección de agenda
    const agendaSection = document.createElement('div');
    agendaSection.className = 'agenda-section';
    
    // Mostrar loading
    agendaSection.innerHTML = `
        <div class="dashboard-section">
            <div class="section-header">
                <div>
                    <h2>Agenda Médica</h2>
                    <p>Gestión completa de tus turnos asignados</p>
                </div>
                <div class="section-header-actions">
                    <button class="btn btn-secondary" id="refreshAgendaBtn">
                        <i class="fas fa-sync-alt"></i> Actualizar
                    </button>
                </div>
            </div>
            <div id="agenda-content" style="padding: 2rem; text-align: center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #2563eb;"></i>
                <p style="margin-top: 1rem; color: #6b7280;">Cargando turnos...</p>
            </div>
        </div>
    `;
    
    dashboardContent.appendChild(agendaSection);
    
    // Agregar event listener al botón de actualizar
    setTimeout(() => {
        const refreshBtn = document.getElementById('refreshAgendaBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await renderAgendaContent(agendaSection);
            });
        }
    }, 100);
    
    // Cargar y renderizar turnos
    await renderAgendaContent(agendaSection);
}

/**
 * Renderiza el contenido de la agenda
 */
export async function renderAgendaContent(agendaSection) {
    const agendaContent = agendaSection.querySelector('#agenda-content');
    if (!agendaContent) return;
    
    try {
        const { state } = await import('../state.js');
        const currentDoctorData = state.doctorData;
        
        let doctorId = getId(currentDoctorData, 'doctorId');
        if (!doctorId) {
            agendaContent.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: #dc2626;">
                    <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>No se pudo identificar al médico. Por favor, recarga la página.</p>
                </div>
            `;
            return;
        }
        
        const { ApiScheduling, Api } = await import('../api.js');
        
        // Obtener todos los turnos del médico (próximos 3 meses)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const threeMonthsLater = new Date(today);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
        
        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${currentDoctorData.doctorId}&startTime=${today.toISOString()}&endTime=${threeMonthsLater.toISOString()}`
        );
        
        console.log('=== APPOINTMENTS DESDE API ===');
        console.log('Total appointments:', appointments?.length);
        if (appointments && appointments.length > 0) {
            console.log('Primer appointment completo:', JSON.stringify(appointments[0], null, 2));
        }
        
        if (!appointments || appointments.length === 0) {
            agendaContent.innerHTML = `
                <div style="padding: 3rem; text-align: center; color: #6b7280;">
                    <i class="fas fa-calendar-times" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3 style="margin-bottom: 0.5rem;">No hay turnos asignados</h3>
                    <p>No tienes turnos programados en los próximos 3 meses.</p>
                </div>
            `;
            return;
        }
        
        // Cargar información de pacientes para cada turno
        const appointmentsWithPatients = await Promise.all(
            appointments.map(async (apt) => {
                try {
                    const patientId = apt.patientId || apt.PatientId;
                    const patient = await Api.get(`v1/Patient/${patientId}`);
                    return {
                        ...apt,
                        patientName: `${patient.name || patient.Name || ''} ${patient.lastName || patient.LastName || ''}`.trim() || 'Paciente sin nombre',
                        patientDni: patient.dni || patient.Dni || 'N/A'
                    };
                } catch (err) {
                    console.warn(`No se pudo cargar paciente ${apt.patientId || apt.PatientId}:`, err);
                    return {
                        ...apt,
                        patientName: 'Paciente desconocido',
                        patientDni: 'N/A'
                    };
                }
            })
        );
        
        // Agrupar turnos por fecha
        const appointmentsByDate = {};
        appointmentsWithPatients.forEach(apt => {
            const startTimeStr = apt.startTime || apt.StartTime;
            const startTime = new Date(startTimeStr);
            
            // Extraer la fecha en UTC para evitar cambios por zona horaria
            const year = startTime.getUTCFullYear();
            const month = String(startTime.getUTCMonth() + 1).padStart(2, '0');
            const day = String(startTime.getUTCDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;
            
            if (!appointmentsByDate[dateKey]) {
                appointmentsByDate[dateKey] = [];
            }
            appointmentsByDate[dateKey].push(apt);
        });
        
        // Ordenar fechas
        const sortedDates = Object.keys(appointmentsByDate).sort();
        
        // Renderizar HTML
        const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        let html = generateAgendaSummaryHTML(appointments);
        
        if (sortedDates.length === 0) {
            html += '<p style="color: #6b7280; text-align: center; padding: 2rem;">No hay turnos para mostrar</p>';
        } else {
            html += '<div class="agenda-days-container">';
            
            sortedDates.forEach(dateKey => {
                const [year, month, day] = dateKey.split('-').map(Number);
                const date = new Date(Date.UTC(year, month - 1, day));
                const dayName = daysOfWeek[date.getUTCDay()];
                const dayNumber = day;
                const monthName = months[month - 1];
                const dayAppointments = appointmentsByDate[dateKey].sort((a, b) => {
                    const timeA = new Date(a.startTime || a.StartTime);
                    const timeB = new Date(b.startTime || b.StartTime);
                    return timeA - timeB;
                });
                
                html += generateDayCardHTML(dayName, dayNumber, monthName, dayAppointments);
            });
            
            html += '</div>';
        }
        
        agendaContent.innerHTML = html;
        
        // Inicializar botones y controles
        setTimeout(() => {
            initializeAttendButtonsLocal();
            initializeStatusSelects();
        }, 100);
        
    } catch (error) {
        console.error('Error al cargar agenda:', error);
        agendaContent.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #dc2626;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Error al cargar la agenda: ${error.message || 'Error desconocido'}</p>
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 1rem;">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
    }
}

/**
 * Genera el HTML del resumen de la agenda
 */
function generateAgendaSummaryHTML(appointments) {
    return `
        <div style="margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: #1f2937;">Total de turnos: ${appointments.length}</h3>
                <div style="display: flex; gap: 0.5rem;">
                    <span style="padding: 0.25rem 0.75rem; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 0.875rem;">
                        Programados: ${appointments.filter(a => (a.status || a.Status) === 'SCHEDULED').length}
                    </span>
                    <span style="padding: 0.25rem 0.75rem; background: #d1fae5; color: #059669; border-radius: 4px; font-size: 0.875rem;">
                        Confirmados: ${appointments.filter(a => (a.status || a.Status) === 'CONFIRMED').length}
                    </span>
                    <span style="padding: 0.25rem 0.75rem; background: #dcfce7; color: #166534; border-radius: 4px; font-size: 0.875rem;">
                        Completados: ${appointments.filter(a => (a.status || a.Status) === 'COMPLETED').length}
                    </span>
                    <span style="padding: 0.25rem 0.75rem; background: #fee2e2; color: #991b1b; border-radius: 4px; font-size: 0.875rem;">
                        Cancelados: ${appointments.filter(a => (a.status || a.Status) === 'CANCELLED').length}
                    </span>
                    <span style="padding: 0.25rem 0.75rem; background: #d1fae5; color: #059669; border-radius: 4px; font-size: 0.875rem;">
                        En curso: ${appointments.filter(a => (a.status || a.Status) === 'IN_PROGRESS').length}
                    </span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Genera el HTML de una tarjeta de día
 */
function generateDayCardHTML(dayName, dayNumber, monthName, dayAppointments) {
    let html = `
        <div class="agenda-day-card" style="margin-bottom: 1.5rem; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
            <div class="agenda-day-header" style="background: #f3f4f6; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="margin: 0; color: #1f2937; font-size: 1.25rem;">
                            ${dayName}, ${dayNumber} de ${monthName}
                        </h3>
                        <p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.875rem;">
                            ${dayAppointments.length} ${dayAppointments.length === 1 ? 'turno' : 'turnos'}
                        </p>
                    </div>
                    <span style="padding: 0.5rem 1rem; background: #10b981; color: white; border-radius: 6px; font-weight: 600;">
                        ${dayAppointments.length}
                    </span>
                </div>
            </div>
            <div class="agenda-day-appointments" style="padding: 1rem 1.5rem;">
    `;
    
    dayAppointments.forEach(apt => {
        html += generateAppointmentItemHTML(apt);
    });
    
    html += `
            </div>
        </div>
    `;
    
    return html;
}

/**
 * Genera el HTML de un item de appointment
 */
function generateAppointmentItemHTML(apt) {
    const startTime = new Date(apt.startTime || apt.StartTime);
    const endTime = new Date(apt.endTime || apt.EndTime);
    const status = apt.status || apt.Status || 'SCHEDULED';
    
    const startHour = String(startTime.getHours()).padStart(2, '0');
    const startMin = String(startTime.getMinutes()).padStart(2, '0');
    const endHour = String(endTime.getHours()).padStart(2, '0');
    const endMin = String(endTime.getMinutes()).padStart(2, '0');
    const timeStr = `${startHour}:${startMin} - ${endHour}:${endMin}`;
    
    let reason = apt.reason || apt.Reason || apt.reasonText || apt.ReasonText || '';
    if (!reason || reason.trim() === '' || reason === 'null' || reason === 'undefined') {
        reason = 'Sin motivo especificado';
    }
    
    const appointmentId = apt.appointmentId || apt.AppointmentId;
    
    const { statusBadge, statusColor, actionButtons } = getAppointmentStatusInfo(status, appointmentId, apt);
    
    return `
        <div class="agenda-appointment-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; margin-bottom: 0.75rem; background: #f9fafb; border-radius: 6px; border-left: 4px solid ${statusColor};">
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                    <div style="font-weight: 600; color: #1f2937; font-size: 1.1rem;">
                        ${apt.patientName}
                    </div>
                    <select class="appointment-status-select" 
                            data-appointment-id="${appointmentId}"
                            style="padding: 0.25rem 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 0.75rem; background: white; color: ${statusColor}; font-weight: 600; cursor: pointer;">
                        <option value="SCHEDULED" ${status === 'SCHEDULED' ? 'selected' : ''}>Programado</option>
                        <option value="CONFIRMED" ${status === 'CONFIRMED' ? 'selected' : ''}>Confirmado</option>
                        <option value="IN_PROGRESS" ${status === 'IN_PROGRESS' ? 'selected' : ''}>En curso</option>
                        <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>Completado</option>
                        <option value="NO_SHOW" ${status === 'NO_SHOW' ? 'selected' : ''}>No asistió</option>
                        <option value="CANCELLED" ${status === 'CANCELLED' ? 'selected' : ''}>Cancelado</option>
                        <option value="RESCHEDULED" ${status === 'RESCHEDULED' ? 'selected' : ''}>Reprogramado</option>
                    </select>
                </div>
                <div style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.25rem;">
                    <i class="fas fa-clock" style="margin-right: 0.5rem;"></i>${timeStr}
                </div>
                <div style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.25rem;">
                    <i class="fas fa-user" style="margin-right: 0.5rem;"></i>DNI: ${apt.patientDni}
                </div>
                <div style="color: #6b7280; font-size: 0.875rem;">
                    <i class="fas fa-stethoscope" style="margin-right: 0.5rem;"></i>${reason}
                </div>
            </div>
            <div style="display: flex; gap: 0.5rem; margin-left: 1rem; align-items: center;">
                ${actionButtons}
            </div>
        </div>
    `;
}

/**
 * Obtiene la información de estado del appointment
 */
function getAppointmentStatusInfo(status, appointmentId, apt) {
    let statusBadge = '';
    let statusColor = '#6b7280';
    let actionButtons = '';
    
    if (status === 'SCHEDULED') {
        statusBadge = 'Programado';
        statusColor = '#f59e0b';
    } else if (status === 'CONFIRMED') {
        statusBadge = 'Confirmado';
        statusColor = '#10b981';
    } else if (status === 'COMPLETED') {
        statusBadge = 'Completado';
        statusColor = '#10b981';
    } else if (status === 'CANCELLED') {
        statusBadge = 'Cancelado';
        statusColor = '#dc2626';
    } else if (status === 'RESCHEDULED') {
        statusBadge = 'Reprogramado';
        statusColor = '#8b5cf6';
    } else if (status === 'NO_SHOW') {
        statusBadge = 'No asistió';
        statusColor = '#6b7280';
    } else if (status === 'IN_PROGRESS') {
        statusBadge = 'En curso';
        statusColor = '#3b82f6';
    } else {
        statusBadge = status;
    }
    
    // Determinar qué acciones mostrar según el estado
    if (status === 'COMPLETED') {
        actionButtons = `
            <span style="padding: 0.5rem 1rem; font-size: 0.875rem; color: #10b981; font-weight: 600;">
                <i class="fas fa-check-circle"></i> Consulta realizada
            </span>
        `;
    } else if (status === 'SCHEDULED' || status === 'CONFIRMED') {
        actionButtons = `
            <button class="btn btn-primary btn-sm attend-appointment-btn" 
                    data-appointment-id="${appointmentId}" 
                    data-patient-id="${apt.patientId || apt.PatientId}" 
                    data-patient-name="${apt.patientName}"
                    style="padding: 0.5rem 1rem; font-size: 0.875rem; margin-right: 0.5rem;">
                <i class="fas fa-video"></i> Atender
            </button>
        `;
    } else if (status === 'IN_PROGRESS') {
        actionButtons = `
            <button class="btn btn-success btn-sm complete-appointment-btn" 
                    data-appointment-id="${appointmentId}" 
                    data-patient-id="${apt.patientId || apt.PatientId}" 
                    data-patient-name="${apt.patientName}"
                    style="padding: 0.5rem 1rem; font-size: 0.875rem; margin-right: 0.5rem;">
                <i class="fas fa-check"></i> Completar
            </button>
            <button class="btn btn-warning btn-sm no-show-appointment-btn" 
                    data-appointment-id="${appointmentId}" 
                    style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                <i class="fas fa-times"></i> No asistió
            </button>
        `;
    }
    
    return { statusBadge, statusColor, actionButtons };
}

/**
 * Inicializa los botones de atender (versión local para agenda)
 */
function initializeAttendButtonsLocal() {
    console.log('🔘 Inicializando botones de atención en agenda');
    
    // Importar dinámicamente las funciones necesarias
    import('./doctor-appointments.js').then(module => {
        const { attendConsultation, updateAppointmentStatus } = module;
        
        // Buscar botones de atender
        const attendButtons = document.querySelectorAll('.btn-attend, .attend-appointment-btn');
        
        attendButtons.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', async function() {
                const appointmentId = this.getAttribute('data-appointment-id');
                const patientId = this.getAttribute('data-patient-id');
                const patientName = this.getAttribute('data-patient-name');
                
                console.log('👨‍⚕️ Atendiendo consulta desde agenda:', { appointmentId, patientId, patientName });
                
                if (appointmentId) {
                    await updateAppointmentStatus(appointmentId, 'IN_PROGRESS');
                    
                    if (patientId && patientName) {
                        await attendConsultation(appointmentId, patientId, patientName);
                    }
                }
            });
        });
        
        // Botones de completar
        const completeButtons = document.querySelectorAll('.complete-appointment-btn, .complete-consultation-btn');
        completeButtons.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', async function() {
                const appointmentId = this.getAttribute('data-appointment-id');
                const patientId = this.getAttribute('data-patient-id');
                const patientName = this.getAttribute('data-patient-name');
                
                if (appointmentId && patientId && patientName) {
                    await attendConsultation(appointmentId, patientId, patientName);
                }
            });
        });
        
        // Botones de no asistió
        const noShowButtons = document.querySelectorAll('.no-show-appointment-btn, .no-show-consultation-btn');
        noShowButtons.forEach(button => {
            const newButton = button.cloneNode(true);
            button.parentNode.replaceChild(newButton, button);
            
            newButton.addEventListener('click', async function() {
                const appointmentId = this.getAttribute('data-appointment-id');
                
                if (appointmentId && confirm('¿El paciente no asistió a la consulta?')) {
                    await updateAppointmentStatus(appointmentId, 'NO_SHOW', 'Paciente no asistió');
                    showNotification('Turno marcado como "No asistió"', 'info');
                    
                    // Recargar agenda
                    const agendaSection = document.querySelector('.agenda-section');
                    if (agendaSection) {
                        await renderAgendaContent(agendaSection);
                    }
                }
            });
        });
        
        console.log('✅ Botones de atención inicializados');
    }).catch(error => {
        console.error('❌ Error al inicializar botones:', error);
    });
}

/**
 * Inicializa los selectores de estado
 */
function initializeStatusSelects() {
    console.log('🔽 Inicializando selectores de estado en agenda');
    
    // Importar dinámicamente
    import('./doctor-appointments.js').then(module => {
        const { updateAppointmentStatus } = module;
        
        const statusSelects = document.querySelectorAll('.appointment-status-select');
        
        statusSelects.forEach(select => {
            const newSelect = select.cloneNode(true);
            select.parentNode.replaceChild(newSelect, select);
            
            newSelect.addEventListener('change', async function() {
                const appointmentId = this.getAttribute('data-appointment-id');
                const newStatus = this.value;
                
                if (appointmentId && newStatus) {
                    const currentStatus = this.options[this.selectedIndex].text;
                    
                    if (confirm(`¿Cambiar el estado del turno a "${currentStatus}"?`)) {
                        await updateAppointmentStatus(appointmentId, newStatus);
                    } else {
                        // Recargar agenda para revertir selección
                        const agendaSection = document.querySelector('.agenda-section');
                        if (agendaSection) {
                            await renderAgendaContent(agendaSection);
                        }
                    }
                }
            });
        });
        
        console.log('✅ Selectores de estado inicializados');
    }).catch(error => {
        console.error('❌ Error al inicializar selectores:', error);
    });
}

/**
 * Abre el gestor de horarios
 */
export async function openScheduleManager() {
    const { state } = await import('../state.js');
    const currentDoctorData = state.doctorData;
    
    if (!currentDoctorData?.doctorId) {
        showNotification('No se pudo identificar al médico', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.id = 'schedule-manager-modal';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>Gestionar Mi Agenda</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="schedule-manager-container">
                    <div class="schedule-actions" style="margin-bottom: 1.5rem;">
                        <button class="btn btn-primary" id="add-availability-btn">
                            <i class="fas fa-plus"></i> Agregar Horario
                        </button>
                    </div>
                    <div id="availability-list" style="margin-top: 1rem;">
                        <div style="text-align: center; padding: 2rem; color: #6b7280;">
                            <i class="fas fa-spinner fa-spin"></i> Cargando disponibilidad...
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.remove();
        });
    });
    
    modal.querySelector('#add-availability-btn').addEventListener('click', () => {
        openAddAvailabilityForm(modal);
    });
    
    await loadDoctorAvailability(modal);
}

/**
 * Carga la disponibilidad del doctor
 */
async function loadDoctorAvailability(modal) {
    try {
        const { state } = await import('../state.js');
        const currentDoctorData = state.doctorData;
        const doctorId = currentDoctorData?.doctorId || currentDoctorData?.DoctorId;
        
        if (!doctorId) {
            console.warn('No hay doctorId disponible para cargar disponibilidades');
            return;
        }

        const { ApiScheduling } = await import('../api.js');
        const availability = await ApiScheduling.get(`v1/DoctorAvailability/search?doctorId=${doctorId}`);
        
        const availabilityList = modal.querySelector('#availability-list');
        if (!availabilityList) return;

        if (!availability || availability.length === 0) {
            availabilityList.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 3rem; color: #6b7280;">
                    <i class="fas fa-calendar-times" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No tienes horarios configurados</p>
                    <p style="font-size: 0.9rem;">Agrega tu primer horario de disponibilidad para que los pacientes puedan agendar turnos contigo.</p>
                </div>
            `;
            return;
        }

        availabilityList.innerHTML = renderAvailabilityList(availability);
        attachAvailabilityEventListeners(modal, availabilityList);

    } catch (error) {
        console.error('Error al cargar disponibilidad:', error);
        const availabilityList = modal.querySelector('#availability-list');
        if (availabilityList) {
            availabilityList.innerHTML = `
                <div class="error-state" style="text-align: center; padding: 2rem; color: #dc2626;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No se pudo cargar la disponibilidad</p>
                </div>
            `;
        }
    }
}

/**
 * Renderiza la lista de disponibilidad
 */
function renderAvailabilityList(availability) {
    const daysOfWeek = {
        1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
        5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
    };

    const groupedByDay = {};
    availability.forEach(av => {
        let day = av.dayOfWeek || av.DayOfWeek;
        
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
            day = dayNameToNumber[day] || parseInt(day) || day;
        }
        
        day = parseInt(day);
        
        if (isNaN(day) || day < 1 || day > 7) {
            console.warn('Día de la semana inválido:', av.dayOfWeek || av.DayOfWeek);
            return;
        }
        
        if (!groupedByDay[day]) {
            groupedByDay[day] = [];
        }
        groupedByDay[day].push(av);
    });

    return Object.keys(groupedByDay)
        .sort((a, b) => parseInt(a) - parseInt(b))
        .map(day => {
            const dayNum = parseInt(day);
            const dayName = daysOfWeek[dayNum];
            
            if (!dayName) return '';
            
            const slots = groupedByDay[day];
            
            return `
                <div class="availability-day-group" style="margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
                    <h4 style="margin-bottom: 1rem; color: #1f2937;">
                        <i class="fas fa-calendar-day"></i> ${dayName}
                    </h4>
                    <div class="availability-slots">
                        ${slots.map(slot => createAvailabilitySlotHTML(slot, dayNum, dayName)).join('')}
                    </div>
                </div>
            `;
        })
        .filter(html => html !== '')
        .join('');
}

/**
 * Crea el HTML de un slot de disponibilidad
 */
function createAvailabilitySlotHTML(slot, dayNum, dayName) {
    const startTime = formatTimeSpan(slot.startTime || slot.StartTime);
    const endTime = formatTimeSpan(slot.endTime || slot.EndTime);
    const duration = slot.durationMinutes || slot.DurationMinutes || 30;
    const isActive = slot.isActive !== false;
    const availabilityId = slot.availabilityId || slot.AvailabilityId;

    return `
        <div class="availability-slot" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; margin-bottom: 0.5rem; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
            <div class="slot-info" style="display: flex; align-items: center; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-lock" style="color: #6b7280; font-size: 0.875rem;"></i>
                    <span style="font-weight: 600; color: #1f2937; font-size: 0.875rem;">${dayName}</span>
                </div>
                <span style="font-weight: 600; color: #1f2937;">${startTime} - ${endTime}</span>
                <span style="color: #6b7280; margin-left: 1rem;">Duración: ${duration} min</span>
                ${!isActive ? '<span style="color: #dc2626; margin-left: 1rem;">(Inactivo)</span>' : ''}
            </div>
            <div class="slot-actions">
                <button class="btn btn-sm btn-secondary edit-availability-btn" data-availability-id="${availabilityId}" style="margin-right: 0.5rem;">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-sm btn-danger delete-availability-btn" data-availability-id="${availabilityId}">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;
}

/**
 * Formatea un TimeSpan a string HH:mm
 */
function formatTimeSpan(timeSpan) {
    if (!timeSpan) return '00:00';
    if (typeof timeSpan === 'string') {
        const parts = timeSpan.split(':');
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    const hours = (timeSpan.hours || timeSpan.Hours || 0).toString().padStart(2, '0');
    const minutes = (timeSpan.minutes || timeSpan.Minutes || 0).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Adjunta event listeners a los elementos de disponibilidad
 */
function attachAvailabilityEventListeners(modal, availabilityList) {
    availabilityList.querySelectorAll('.edit-availability-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const availabilityId = this.getAttribute('data-availability-id');
            openEditAvailabilityForm(modal, availabilityId);
        });
    });

    availabilityList.querySelectorAll('.delete-availability-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const availabilityId = this.getAttribute('data-availability-id');
            deleteAvailability(modal, availabilityId);
        });
    });
}

/**
 * Abre el formulario para agregar disponibilidad
 */
function openAddAvailabilityForm(modal) {
    const formModal = document.createElement('div');
    formModal.className = 'modal';
    formModal.style.display = 'flex';
    formModal.style.zIndex = '1001';
    
    formModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>Agregar Horario de Disponibilidad</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="add-availability-form">
                    <div class="form-group">
                        <label for="av-day">Día de la semana:</label>
                        <select id="av-day" name="dayOfWeek" required>
                            <option value="">Seleccionar día</option>
                            <option value="1">Lunes</option>
                            <option value="2">Martes</option>
                            <option value="3">Miércoles</option>
                            <option value="4">Jueves</option>
                            <option value="5">Viernes</option>
                            <option value="6">Sábado</option>
                            <option value="7">Domingo</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="av-start-time">Hora de inicio:</label>
                        <input type="time" id="av-start-time" name="startTime" required>
                    </div>
                    <div class="form-group">
                        <label for="av-end-time">Hora de fin:</label>
                        <input type="time" id="av-end-time" name="endTime" required>
                    </div>
                    <div class="form-group">
                        <label for="av-duration">Duración de cada turno (minutos):</label>
                        <input type="number" id="av-duration" name="durationMinutes" min="15" max="480" value="30" required>
                        <small style="color: #6b7280;">Entre 15 y 480 minutos</small>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary close-modal">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Horario</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(formModal);
    
    formModal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            formModal.remove();
        });
    });
    
    formModal.querySelector('#add-availability-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAvailability(formModal, modal, null);
    });
}

/**
 * Abre el formulario para editar disponibilidad
 */
async function openEditAvailabilityForm(modal, availabilityId) {
    try {
        const { ApiScheduling } = await import('../api.js');
        const availability = await ApiScheduling.get(`v1/DoctorAvailability/${availabilityId}`);
        
        if (!availability) {
            showNotification('No se encontró el horario', 'error');
            return;
        }

        const formModal = document.createElement('div');
        formModal.className = 'modal';
        formModal.style.display = 'flex';
        formModal.style.zIndex = '1001';
        
        const startTime = formatTimeSpan(availability.startTime || availability.StartTime);
        const endTime = formatTimeSpan(availability.endTime || availability.EndTime);
        const dayOfWeek = availability.dayOfWeek || availability.DayOfWeek;
        const duration = availability.durationMinutes || availability.DurationMinutes;

        formModal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Editar Horario de Disponibilidad</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="edit-availability-form">
                        <div class="form-group">
                            <label for="av-day-edit">Día de la semana:</label>
                            <select id="av-day-edit" name="dayOfWeek" required>
                                <option value="1" ${dayOfWeek === 1 ? 'selected' : ''}>Lunes</option>
                                <option value="2" ${dayOfWeek === 2 ? 'selected' : ''}>Martes</option>
                                <option value="3" ${dayOfWeek === 3 ? 'selected' : ''}>Miércoles</option>
                                <option value="4" ${dayOfWeek === 4 ? 'selected' : ''}>Jueves</option>
                                <option value="5" ${dayOfWeek === 5 ? 'selected' : ''}>Viernes</option>
                                <option value="6" ${dayOfWeek === 6 ? 'selected' : ''}>Sábado</option>
                                <option value="7" ${dayOfWeek === 7 ? 'selected' : ''}>Domingo</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="av-start-time-edit">Hora de inicio:</label>
                            <input type="time" id="av-start-time-edit" name="startTime" value="${startTime}" required>
                        </div>
                        <div class="form-group">
                            <label for="av-end-time-edit">Hora de fin:</label>
                            <input type="time" id="av-end-time-edit" name="endTime" value="${endTime}" required>
                        </div>
                        <div class="form-group">
                            <label for="av-duration-edit">Duración de cada turno (minutos):</label>
                            <input type="number" id="av-duration-edit" name="durationMinutes" min="15" max="480" value="${duration}" required>
                            <small style="color: #6b7280;">Entre 15 y 480 minutos</small>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary close-modal">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(formModal);
        
        formModal.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                formModal.remove();
            });
        });
        
        formModal.querySelector('#edit-availability-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveAvailability(formModal, modal, availabilityId);
        });
    } catch (error) {
        console.error('Error al cargar horario para editar:', error);
        showNotification('No se pudo cargar el horario', 'error');
    }
}

/**
 * Guarda la disponibilidad (crear o actualizar)
 */
async function saveAvailability(formModal, scheduleModal, availabilityId) {
    try {
        const { state } = await import('../state.js');
        const currentDoctorData = state.doctorData;
        const doctorId = currentDoctorData?.doctorId || currentDoctorData?.DoctorId;
        
        if (!doctorId) {
            showNotification('No se pudo identificar al médico', 'error');
            return;
        }

        const form = formModal.querySelector('form');
        const formData = new FormData(form);
        
        const dayOfWeek = parseInt(formData.get('dayOfWeek'));
        const startTimeStr = formData.get('startTime');
        const endTimeStr = formData.get('endTime');
        const durationMinutes = parseInt(formData.get('durationMinutes'));

        const [startHours, startMinutes] = startTimeStr.split(':').map(Number);
        const [endHours, endMinutes] = endTimeStr.split(':').map(Number);

        const availabilityData = {
            dayOfWeek: dayOfWeek,
            startTime: `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}:00`,
            endTime: `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`,
            durationMinutes: durationMinutes
        };

        const { ApiScheduling } = await import('../api.js');
        
        if (availabilityId) {
            await ApiScheduling.patch(`v1/DoctorAvailability/${availabilityId}`, availabilityData);
            showNotification('Horario actualizado exitosamente', 'success');
        } else {
            await ApiScheduling.post(`v1/DoctorAvailability/${doctorId}`, availabilityData);
            showNotification('Horario agregado exitosamente', 'success');
        }

        formModal.remove();
        await loadDoctorAvailability(scheduleModal);
        
    } catch (error) {
        console.error('Error al guardar disponibilidad:', error);
        showNotification(`Error al guardar horario: ${error.message || 'Error desconocido'}`, 'error');
    }
}

/**
 * Elimina una disponibilidad
 */
async function deleteAvailability(modal, availabilityId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este horario?')) {
        return;
    }

    try {
        const { ApiScheduling } = await import('../api.js');
        await ApiScheduling.delete(`v1/DoctorAvailability/${availabilityId}`);
        
        showNotification('Horario eliminado exitosamente', 'success');
        await loadDoctorAvailability(modal);
    } catch (error) {
        console.error('Error al eliminar disponibilidad:', error);
        showNotification('No se pudo eliminar el horario', 'error');
    }
}