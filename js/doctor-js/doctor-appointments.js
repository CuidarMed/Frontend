// ===================================
// DOCTOR APPOINTMENTS - Consultas y Turnos
// ===================================

import { doctorState, getId, formatTime } from './doctor-core.js';
import { showNotification } from './doctor-ui.js';

// ===================================
// UTILIDADES
// ===================================

const STATUS_CONFIG = {
    SCHEDULED: { class: 'pending', text: 'Programado' },
    CONFIRMED: { class: 'waiting', text: 'Confirmado' },
    IN_PROGRESS: { class: 'in-progress', text: 'En curso' },
    COMPLETED: { class: 'completed', text: 'Completado' },
    CANCELLED: { class: 'cancelled', text: 'Cancelado' },
    RESCHEDULED: { class: 'pending', text: 'Reprogramado' },
    NO_SHOW: { class: 'no-show', text: 'No asistió' }
};

const getStatusInfo = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.SCHEDULED;

const getActionButtons = (status, appointmentId, patientId, patientName) => {
    const dataAttrs = `data-appointment-id="${appointmentId}" data-patient-id="${patientId}" data-patient-name="${patientName}"`;
    
    if (status === 'COMPLETED') {
        return '<span style="color: #10b981; font-weight: 600; font-size: 0.875rem;"><i class="fas fa-check-circle"></i> Consulta realizada</span>';
    }
    if (status === 'CONFIRMED' || status === 'SCHEDULED') {
        return `<button class="btn-attend" ${dataAttrs}>Atender</button>`;
    }
    if (status === 'IN_PROGRESS') {
        return `
            <button class="btn btn-success btn-sm complete-consultation-btn" ${dataAttrs}><i class="fas fa-check"></i> Completar</button>
            <button class="btn btn-warning btn-sm no-show-consultation-btn" data-appointment-id="${appointmentId}" style="margin-left: 0.5rem;"><i class="fas fa-times"></i> No asistió</button>
        `;
    }
    return '';
};

// ===================================
// CARGA DE DATOS
// ===================================

const fetchPatientName = async (patientId) => {
    try {
        const { Api } = await import('../api.js');
        const patient = await Api.get(`v1/Patient/${patientId}`);
        return `${patient.Name || patient.name || ''} ${patient.lastName || patient.LastName || ''}`.trim() || 'Paciente sin nombre';
    } catch {
        return 'Paciente desconocido';
    }
};

const getDateRange = (selectedDate = null) => {
    let filterDate;
    if (selectedDate) {
        const [year, month, day] = selectedDate.split('-').map(Number);
        filterDate = new Date(year, month - 1, day);
    } else {
        filterDate = new Date();
    }
    filterDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(filterDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    return { filterDate, nextDay };
};

const loadAppointments = async (doctorId, selectedDate = null) => {
    const { ApiScheduling } = await import('../api.js');
    const { filterDate, nextDay } = getDateRange(selectedDate);
    
    console.log('🔍 Buscando consultas para doctorId:', doctorId);
    
    const appointments = await ApiScheduling.get(
        `v1/Appointments?doctorId=${doctorId}&startTime=${filterDate.toISOString()}&endTime=${nextDay.toISOString()}`
    );
    
    const allAppointments = Array.isArray(appointments) ? appointments : [];
    
    console.log('✅ Consultas encontradas:', allAppointments.length);
    console.log(allAppointments);
    
    // Cargar nombres de pacientes
    for (const apt of allAppointments) {

    // Si ya viene el nombre desde el backend → lo usamos tal cual
    if (apt.patientName && apt.patientName.trim() !== '') {
        continue;
    }

    const patientId = apt.patientId || apt.PatientId;
    if (!patientId) {
        apt.patientName = 'Paciente sin ID';
        continue;
    }

    // Como fallback, recién ahí pedimos el patient
    apt.patientName = await fetchPatientName(patientId);
}
    
    return { appointments: allAppointments, filterDate };
};

// ===================================
// RENDERIZADO
// ===================================

export function createConsultationItemElement(appointment) {
    const item = document.createElement('div');
    item.className = 'consultation-item';
    
    const startTime = new Date(appointment.startTime || appointment.StartTime);
    const endTime = new Date(appointment.endTime || appointment.EndTime);
    const status = appointment.status || appointment.Status || 'SCHEDULED';
    const statusInfo = getStatusInfo(status);
    
    item.innerHTML = `
        <div class="consultation-icon"><i class="fas fa-clock"></i></div>
        <div class="consultation-info">
            <h4>${appointment.patientName || 'Paciente Desconocido'}</h4>
            <p>${appointment.reason || appointment.Reason || 'Sin motivo'}</p>
            <span>${formatTime(startTime)} - ${formatTime(endTime)}</span>
        </div>
        <div class="consultation-actions">
            <span class="status ${statusInfo.class}">${statusInfo.text}</span>
            ${getActionButtons(status, appointment.appointmentId || appointment.AppointmentId, appointment.patientId || appointment.PatientId, appointment.patientName)}
        </div>
    `;
    
    return item;
}

const renderAppointmentsList = (container, appointments, filterDate) => {
    container.innerHTML = '';
    
    if (!appointments || appointments.length === 0) {
        const dateStr = filterDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
        container.innerHTML = `<p style="color: #6b7280; padding: 2rem; text-align: center;">No hay consultas para el ${dateStr}</p>`;
        return;
    }
    
    appointments.forEach(apt => container.appendChild(createConsultationItemElement(apt)));
};

// ===================================
// CARGA DE CONSULTAS
// ===================================

export async function loadTodayConsultations(selectedDate = null) {
    const consultationsList = document.getElementById('consultations-list');
    if (!consultationsList) return;
    
    console.log('📅 Cargando consultas del día:', selectedDate || 'hoy');
    
    try {
        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
        if (!doctorId) {
            consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudo identificar al médico</p>';
            return;
        }
        
        const { appointments, filterDate } = await loadAppointments(doctorId, selectedDate);
        renderAppointmentsList(consultationsList, appointments, filterDate);
        
    } catch (error) {
        console.error('❌ Error al cargar consultas:', error);
        consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudieron cargar las consultas del día</p>';
    }
    
    setTimeout(initializeAttendButtons, 100);
}

export async function loadTodayFullHistory() {
    const container = document.getElementById('navbar-today-history');
    if (!container) return;

    if (!doctorState.currentDoctorData?.doctorId) {
        container.innerHTML = "<p>No se pudo identificar al médico.</p>";
        return;
    }

    try {
        const { appointments } = await loadAppointments(doctorState.currentDoctorData.doctorId);
        
        if (!appointments || appointments.length === 0) {
            container.innerHTML = "<p>No hay historial del día.</p>";
            return;
        }

        container.innerHTML = "";
        appointments.forEach(ap => {
            container.appendChild(createConsultationItemElement({ ...ap, isHistory: true }));
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error cargando historial.</p>";
    }
}

// ===================================
// GESTIÓN DE ESTADOS
// ===================================

export async function updateAppointmentStatus(appointmentId, newStatus, reason = null, silent = false) {
    try {
        console.log('🔄 Actualizando estado del turno:', appointmentId, 'a', newStatus);
        
        const { ApiScheduling } = await import('../api.js');
        const currentAppointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`);
        
        if (!currentAppointment) throw new Error('No se encontró el appointment');
        
        await ApiScheduling.patch(`v1/Appointments/${appointmentId}/status`, {
            status: newStatus,
            reason: reason || currentAppointment.reason || currentAppointment.Reason || null
        });
        
        if (!silent) {
            showNotification('Estado del turno actualizado', 'success');
        }
        
        console.log('✅ Estado actualizado exitosamente');
        
        await reloadAppointmentViews();
        
        const { loadDoctorStats } = await import('./doctor-main.js');
        if (loadDoctorStats) await loadDoctorStats();
        
        setTimeout(() => {
            initializeAttendButtons();
            initializeStatusSelects();
        }, 300);
        
    } catch (error) {
        console.error('❌ Error al actualizar estado del turno:', error);
        if (!silent) {
            showNotification(`Error al actualizar estado: ${error.message || 'Error desconocido'}`, 'error');
        }
        throw error;
    }
}

async function reloadAppointmentViews() {
    const agendaSection = document.querySelector('.agenda-section');
    if (agendaSection && agendaSection.style.display !== 'none') {
        const { renderAgendaContent } = await import('./doctor-schedule.js');
        if (renderAgendaContent) await renderAgendaContent(agendaSection);
    }
    
    const consultationsSection = document.querySelector('.consultations-section');
    if (consultationsSection && consultationsSection.style.display !== 'none') {
        const dateFilter = document.getElementById('consultation-date-filter') || document.getElementById('consultation-date-filter-view');
        await loadTodayConsultations(dateFilter?.value || null);
    }
}

// ===================================
// EVENT HANDLERS
// ===================================

const replaceEventListener = (button, eventType, handler) => {
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    newButton.addEventListener(eventType, handler);
};

export function initializeAttendButtons() {
    console.log('🔘 Inicializando botones de atención');
    
    document.querySelectorAll('.btn-attend, .attend-appointment-btn').forEach(button => {
        replaceEventListener(button, 'click', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            const patientId = this.getAttribute('data-patient-id');
            const patientName = this.getAttribute('data-patient-name');
            
            console.log('👨‍⚕️ Atendiendo consulta:', { appointmentId, patientId, patientName });
            
            if (appointmentId) {
                await updateAppointmentStatus(appointmentId, 'IN_PROGRESS');
                if (patientId && patientName) attendConsultation(appointmentId, patientId, patientName);
            }
        });
    });
    
    document.querySelectorAll('.complete-appointment-btn, .complete-consultation-btn').forEach(button => {
        replaceEventListener(button, 'click', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            const patientId = this.getAttribute('data-patient-id');
            const patientName = this.getAttribute('data-patient-name');
            
            console.log('✅ Completando consulta:', { appointmentId, patientId, patientName });
            
            if (appointmentId && patientId && patientName) {
                attendConsultation(appointmentId, patientId, patientName);
            }
        });
    });
    
    document.querySelectorAll('.no-show-appointment-btn, .no-show-consultation-btn').forEach(button => {
        replaceEventListener(button, 'click', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            
            if (appointmentId && confirm('¿El paciente no asistió a la consulta?')) {
                console.log('❌ Marcando como no asistió:', appointmentId);
                await updateAppointmentStatus(appointmentId, 'NO_SHOW', 'Paciente no asistió');
                showNotification('Turno marcado como "No asistió"', 'info');
                await reloadAppointmentViews();
            }
        });
    });
}

export function initializeStatusSelects() {
    console.log('🔽 Inicializando selectores de estado');
    
    document.querySelectorAll('.appointment-status-select').forEach(select => {
        replaceEventListener(select, 'change', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            const newStatus = this.value;
            
            if (appointmentId && newStatus) {
                const currentStatus = this.options[this.selectedIndex].text;
                
                if (confirm(`¿Cambiar el estado del turno a "${currentStatus}"?`)) {
                    console.log('🔄 Cambiando estado:', appointmentId, 'a', newStatus);
                    await updateAppointmentStatus(appointmentId, newStatus);
                } else {
                    await reloadAppointmentViews();
                }
            }
        });
    });
}

export async function attendConsultation(appointmentId, patientId, patientName) {
    try {
        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
        if (!doctorId) {
            showNotification('No se pudo identificar al médico', 'error');
            return;
        }

        console.log('🥼 Iniciando consulta:', { appointmentId, patientId, patientName });
        
        showNotification(`Iniciando consulta con ${patientName}...`, 'info');
        
        const button = document.querySelector(`[data-appointment-id="${appointmentId}"]`);
        if (button) {
            button.innerHTML = '<i class="fas fa-video"></i> En consulta';
            button.classList.add('in-consultation');
            button.disabled = true;
        }
        
        const { updateCounter } = await import('./doctor-core.js');
        updateCounter('active-consultation', 1);
        
        const { openEncounterModal } = await import('./doctor-encounters.js');
        openEncounterModal(appointmentId, patientId, patientName);
        
    } catch (error) {
        console.error('❌ Error al iniciar consulta:', error);
        showNotification('Error al iniciar la consulta', 'error');
    }
}

// ===================================
// VISTAS
// ===================================

export function initializeConsultationDateFilter() {
    const dateFilter = document.getElementById('consultation-date-filter');
    if (!dateFilter) return;
    
    console.log('📅 Inicializando filtro de fecha');
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    dateFilter.value = todayStr;
    
    dateFilter.addEventListener('change', async function(e) {
        const selectedDate = e.target.value;
        if (selectedDate) {
            console.log('📆 Fecha seleccionada:', selectedDate);
            await loadTodayConsultations(selectedDate);
        }
    });
}

export async function loadTodayConsultationsView() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;

    dashboardContent.querySelectorAll('.consultas-section').forEach(sec => sec.remove());

    const section = document.createElement('div');
    section.className = 'dashboard-section consultas-section';
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    section.innerHTML = `
        <div class="section-header">
            <div>
                <h3>Historial de Consultas</h3>
                <p>Filtra las consultas por fecha</p>
            </div>
            <div class="date-filter-container">
                <label for="consultation-date-filter-view" style="margin-right: 0.5rem; color: #6b7280; font-size: 0.875rem;">
                    <i class="fas fa-calendar-alt"></i> Fecha:
                </label>
                <input type="date" id="consultation-date-filter-view" class="date-filter-input" value="${todayStr}"
                       style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem;">
            </div>
        </div>
        <div id="consultas-hoy-list" class="consultations-list">
            <p style="padding:1rem;">Cargando...</p>
        </div>
    `;
    
    dashboardContent.appendChild(section);

    const dateFilterView = document.getElementById('consultation-date-filter-view');
    if (dateFilterView) {
        dateFilterView.addEventListener('change', async function(e) {
            const selectedDate = e.target.value;
            if (selectedDate) {
                await loadTodayConsultationsForNav(selectedDate);
            }
        });
    }

    await loadTodayConsultationsForNav(todayStr);
}

async function loadTodayConsultationsForNav(selectedDate = null) {
    const list = document.getElementById('consultas-hoy-list');
    if (!list) return;

    try {
        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
        if (!doctorId) {
            list.innerHTML = '<p style="padding:1rem; text-align:center;">No se pudo identificar al médico</p>';
            return;
        }

        const { appointments, filterDate } = await loadAppointments(doctorId, selectedDate);
        renderAppointmentsList(list, appointments, filterDate);

    } catch (e) {
        console.error('Error cargando consultas', e);
        list.innerHTML = `<p>Error cargando consultas</p>`;
    }
}

export async function loadPatientsView() {
    console.log('👥 Cargando vista de pacientes...');
    
    const { loadClinicalHistoryView } = await import('./doctor-clinical.js');
    await loadClinicalHistoryView();
}

export function updateCounter(elementId, change) {
    const element = document.getElementById(elementId);
    if (element) {
        const currentValue = parseInt(element.textContent) || 0;
        element.textContent = Math.max(0, currentValue + change);
    }
}

export { doctorState };