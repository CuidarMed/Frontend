// ===================================
// DOCTOR APPOINTMENTS - Consultas y Turnos
// ===================================

import { 
    doctorState,
    getId,
    getValue,
    formatDate,
    formatTime
} from './doctor-core.js';

import { 
    showNotification 
} from './doctor-ui.js';

// ===================================
// CARGA DE CONSULTAS
// ===================================

/**
 * Carga las consultas del día (o fecha seleccionada)
 */
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
        
        const { ApiScheduling } = await import('../api.js');
        
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
        
        console.log('🔍 Buscando consultas para doctorId:', doctorId, 'desde', filterDate.toISOString(), 'hasta', nextDay.toISOString());
        
        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${doctorId}&startTime=${filterDate.toISOString()}&endTime=${nextDay.toISOString()}`
        );
        
        const allAppointments = Array.isArray(appointments) ? appointments : [];
        
        console.log('✅ Consultas encontradas:', allAppointments.length);
        
        consultationsList.innerHTML = '';
        
        if (allAppointments && allAppointments.length > 0) {
            // Cargar información de pacientes desde DirectoryMS
            const { Api } = await import('../api.js');
            for (const apt of allAppointments) {
                try {
                    const patientId = apt.patientId || apt.PatientId;
                    if (patientId) {
                        const patient = await Api.get(`v1/Patient/${patientId}`);
                        apt.patientName = `${patient.Name || patient.name || ''} ${patient.lastName || patient.LastName || ''}`.trim() || 'Paciente sin nombre';
                    } else {
                        apt.patientName = 'Paciente sin ID';
                    }
                } catch (err) {
                    console.warn('⚠️ Error al cargar paciente:', err);
                    apt.patientName = 'Paciente desconocido';
                }
                
                const consultationItem = createConsultationItemElement(apt);
                consultationsList.appendChild(consultationItem);
            }
        } else {
            const dateStr = filterDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
            consultationsList.innerHTML = `<p style="color: #6b7280; padding: 2rem; text-align: center;">No hay consultas para el ${dateStr}</p>`;
        }
        
    } catch (error) {
        console.error('❌ Error al cargar consultas:', error);
        consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudieron cargar las consultas del día</p>';
    }
    
    // Reinicializar botones después de renderizar
    setTimeout(() => {
        initializeAttendButtons();
    }, 100);
}

/**
 * Carga el historial completo del día
 */
export async function loadTodayFullHistory() {
    const container = document.getElementById('navbar-today-history');
    if (!container) return;

    if (!doctorState.currentDoctorData?.doctorId) {
        container.innerHTML = "<p>No se pudo identificar al médico.</p>";
        return;
    }

    try {
        const { ApiScheduling } = await import('../api.js');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${getId(doctorState.currentDoctorData, 'doctorId')}&startTime=${today.toISOString()}&endTime=${tomorrow.toISOString()}`
        );

        if (!appointments || appointments.length === 0) {
            container.innerHTML = "<p>No hay historial del día.</p>";
            return;
        }

        // Cargar nombre de paciente
        const { Api } = await import('../api.js');

        for (const ap of appointments) {
            try {
                const patient = await Api.get(`v1/Patient/${ap.patientId ?? ap.PatientId}`);

                const name = patient.name || patient.Name || "";
                const last = patient.lastName || patient.LastName || "";
                ap.patientName = `${name} ${last}`.trim();
            } catch {
                ap.patientName = "Paciente desconocido";
            }
        }

        // Render
        container.innerHTML = "";

        appointments.forEach(ap => {
            const item = createConsultationItemElement({
                ...ap,
                isHistory: true
            });
            container.appendChild(item);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error cargando historial.</p>";
    }
}

// ===================================
// CREACIÓN DE ELEMENTOS UI
// ===================================

/**
 * Crea el elemento HTML de un item de consulta
 */
export function createConsultationItemElement(appointment) {
    const item = document.createElement('div');
    item.className = 'consultation-item';
    
    const startTime = new Date(appointment.startTime || appointment.StartTime);
    const endTime = new Date(appointment.endTime || appointment.EndTime);
    const status = appointment.status || appointment.Status || 'SCHEDULED';
    const reason = appointment.reason || appointment.Reason || 'Sin motivo';
    const patientName = appointment.patientName || 'Paciente Desconocido';
    const appointmentId = appointment.appointmentId || appointment.AppointmentId;
    const patientId = appointment.patientId || appointment.PatientId;
    
    const statusClass = getStatusClass(status);
    const statusText = getStatusText(status);
    const timeStr = `${formatTime(startTime)} - ${formatTime(endTime)}`;
    
    item.innerHTML = `
        <div class="consultation-icon">
            <i class="fas fa-clock"></i>
        </div>
        <div class="consultation-info">
            <h4>${patientName}</h4>
            <p>${reason}</p>
            <span>${timeStr}</span>
        </div>
        <div class="consultation-actions">
            <span class="status ${statusClass}">${statusText}</span>
            ${getConsultationActionButtons(status, appointmentId, patientId, patientName)}
        </div>
    `;
    
    return item;
}

/**
 * Obtiene la clase CSS según el estado
 */
function getStatusClass(status) {
    const statusMap = {
        'SCHEDULED': 'pending',
        'CONFIRMED': 'waiting',
        'IN_PROGRESS': 'in-progress',
        'COMPLETED': 'completed',
        'CANCELLED': 'cancelled',
        'NO_SHOW': 'no-show'
    };
    return statusMap[status] || 'pending';
}

/**
 * Obtiene el texto en español según el estado
 */
function getStatusText(status) {
    const textMap = {
        'SCHEDULED': 'Programado',
        'CONFIRMED': 'Confirmado',
        'IN_PROGRESS': 'En curso',
        'COMPLETED': 'Completado',
        'CANCELLED': 'Cancelado',
        'RESCHEDULED': 'Reprogramado',
        'NO_SHOW': 'No asistió'
    };
    return textMap[status] || 'Pendiente';
}

/**
 * Genera los botones de acción según el estado
 */
function getConsultationActionButtons(status, appointmentId, patientId, patientName) {
    if (status === 'COMPLETED') {
        return `
            <span style="color: #10b981; font-weight: 600; font-size: 0.875rem;">
                <i class="fas fa-check-circle"></i> Consulta realizada
            </span>
        `;
    } else if (status === 'CONFIRMED' || status === 'SCHEDULED') {
        return `
            <button class="btn-attend" data-appointment-id="${appointmentId}" data-patient-id="${patientId}" data-patient-name="${patientName}">
                Atender
            </button>
        `;
    } else if (status === 'IN_PROGRESS') {
        return `
            <button class="btn btn-success btn-sm complete-consultation-btn" data-appointment-id="${appointmentId}" data-patient-id="${patientId}" data-patient-name="${patientName}">
                <i class="fas fa-check"></i> Completar
            </button>
            <button class="btn btn-warning btn-sm no-show-consultation-btn" data-appointment-id="${appointmentId}" style="margin-left: 0.5rem;">
                <i class="fas fa-times"></i> No asistió
            </button>
        `;
    }
    return '';
}

// ===================================
// ATENCIÓN DE CONSULTAS
// ===================================

/**
 * Inicializa los botones de atender
 */
export function initializeAttendButtons() {
    console.log('🔘 Inicializando botones de atención');
    
    // Buscar botones tanto en la vista de inicio como en la vista de agenda
    const attendButtons = document.querySelectorAll('.btn-attend, .attend-appointment-btn');
    
    attendButtons.forEach(button => {
        // Remover listeners previos para evitar duplicados
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            const patientId = this.getAttribute('data-patient-id');
            const patientName = this.getAttribute('data-patient-name');
            
            console.log('👨‍⚕️ Atendiendo consulta:', { appointmentId, patientId, patientName });
            
            if (appointmentId) {
                // Cambiar estado a IN_PROGRESS antes de abrir el modal
                await updateAppointmentStatus(appointmentId, 'IN_PROGRESS');
                
                if (patientId && patientName) {
                    // Abrir modal de encuentro clínico
                    attendConsultation(appointmentId, patientId, patientName);
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
            
            console.log('✅ Completando consulta:', { appointmentId, patientId, patientName });
            
            if (appointmentId && patientId && patientName) {
                // Abrir modal para completar (crear encounter)
                attendConsultation(appointmentId, patientId, patientName);
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
                console.log('❌ Marcando como no asistió:', appointmentId);
                await updateAppointmentStatus(appointmentId, 'NO_SHOW', 'Paciente no asistió');
                showNotification('Turno marcado como "No asistió"', 'info');
                
                // Recargar vistas
                await reloadAppointmentViews();
            }
        });
    });
}

/**
 * Inicializa los selectores de estado
 */
export function initializeStatusSelects() {
    console.log('🔽 Inicializando selectores de estado');
    
    const statusSelects = document.querySelectorAll('.appointment-status-select');
    
    statusSelects.forEach(select => {
        const newSelect = select.cloneNode(true);
        select.parentNode.replaceChild(newSelect, select);
        
        newSelect.addEventListener('change', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            const newStatus = this.value;
            
            if (appointmentId && newStatus) {
                const currentStatus = this.options[this.selectedIndex].text;
                
                // Confirmar cambio de estado
                if (confirm(`¿Cambiar el estado del turno a "${currentStatus}"?`)) {
                    console.log('🔄 Cambiando estado:', appointmentId, 'a', newStatus);
                    await updateAppointmentStatus(appointmentId, newStatus);
                } else {
                    // Revertir selección
                    await reloadAppointmentViews();
                }
            }
        });
    });
}

/**
 * Actualiza el estado de un turno
 */
export async function updateAppointmentStatus(appointmentId, newStatus, reason = null, silent = false) {
    try {
        console.log('📝 Actualizando estado del turno:', appointmentId, 'a', newStatus);
        
        const { ApiScheduling } = await import('../api.js');
        
        // Obtener el appointment actual para mantener los otros campos
        const currentAppointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`);
        
        if (!currentAppointment) {
            throw new Error('No se encontró el appointment');
        }
        
        // Actualizar solo el estado
        await ApiScheduling.patch(`v1/Appointments/${appointmentId}/status`, {
            status: newStatus,
            reason: reason || currentAppointment.reason || currentAppointment.Reason || null
        });
        
        if (!silent) {
            showNotification('Estado del turno actualizado', 'success');
        }
        
        console.log('✅ Estado actualizado exitosamente');
        
        // Recargar vistas
        await reloadAppointmentViews();
        
        // Cargar estadísticas
        const { loadDoctorStats } = await import('./doctor-main.js');
        if (loadDoctorStats) {
            await loadDoctorStats();
        }
        
        // Reinicializar botones después de un breve delay
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

/**
 * Recarga las vistas de appointments
 */
async function reloadAppointmentViews() {
    // Recargar agenda si está visible
    const agendaSection = document.querySelector('.agenda-section');
    if (agendaSection && agendaSection.style.display !== 'none') {
        const { renderAgendaContent } = await import('./doctor-schedule.js');
        if (renderAgendaContent) {
            await renderAgendaContent(agendaSection);
        }
    }
    
    // Recargar consultas de hoy si están visibles
    const consultationsSection = document.querySelector('.consultations-section');
    if (consultationsSection && consultationsSection.style.display !== 'none') {
        const dateFilter = document.getElementById('consultation-date-filter') || document.getElementById('consultation-date-filter-view');
        const selectedDate = dateFilter?.value || null;
        await loadTodayConsultations(selectedDate);
    }
}

/**
 * Atender una consulta
 */
export async function attendConsultation(appointmentId, patientId, patientName) {
    try {
        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
        if (!doctorId) {
            showNotification('No se pudo identificar al médico', 'error');
            return;
        }

        console.log('🥼 Iniciando consulta:', { appointmentId, patientId, patientName });
        
        showNotification(`Iniciando consulta con ${patientName}...`, 'info');
        
        // Cambiar estado del botón
        const button = document.querySelector(`[data-appointment-id="${appointmentId}"]`);
        if (button) {
            button.innerHTML = '<i class="fas fa-video"></i> En consulta';
            button.classList.add('in-consultation');
            button.disabled = true;
        }
        
        // Actualizar contador de consultas activas
        const { updateCounter } = await import('./doctor-core.js');
        updateCounter('active-consultation', 1);
        
        // Abrir modal para crear encuentro clínico
        const { openEncounterModal } = await import('../doctor-encounters.js');
        openEncounterModal(appointmentId, patientId, patientName);
        
    } catch (error) {
        console.error('❌ Error al iniciar consulta:', error);
        showNotification('Error al iniciar la consulta', 'error');
    }
}

// ===================================
// INICIALIZACIÓN DE FILTROS
// ===================================

/**
 * Inicializa el filtro de fecha para consultas
 */
export function initializeConsultationDateFilter() {
    const dateFilter = document.getElementById('consultation-date-filter');
    if (!dateFilter) return;
    
    console.log('📅 Inicializando filtro de fecha');
    
    // Establecer la fecha de hoy por defecto
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    dateFilter.value = todayStr;
    
    // Event listener para cuando cambie la fecha
    dateFilter.addEventListener('change', async function(e) {
        const selectedDate = e.target.value;
        if (selectedDate) {
            console.log('📆 Fecha seleccionada:', selectedDate);
            await loadTodayConsultations(selectedDate);
        }
    });
}

// ===================================
// VISTA DE CONSULTAS
// ===================================

/**
 * Carga la vista de consultas de hoy (EXPORTADA)
 */
export async function loadTodayConsultationsView() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;

    // Eliminar pantallas anteriores
    const existingConsultas = dashboardContent.querySelectorAll('.consultas-section');
    existingConsultas.forEach(sec => sec.remove());

    // Crear contenedor
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
                <input type="date" 
                       id="consultation-date-filter-view" 
                       class="date-filter-input"
                       value="${todayStr}"
                       style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem;">
            </div>
        </div>
        <div id="consultas-hoy-list" class="consultations-list">
            <p style="padding:1rem;">Cargando...</p>
        </div>
    `;
    
    dashboardContent.appendChild(section);

    // Inicializar el filtro de fecha para esta vista
    const dateFilterView = document.getElementById('consultation-date-filter-view');
    if (dateFilterView) {
        dateFilterView.addEventListener('change', async function(e) {
            const selectedDate = e.target.value;
            if (selectedDate) {
                await loadTodayConsultationsForNav(selectedDate);
            }
        });
    }

    // Cargar consultas
    await loadTodayConsultationsForNav(todayStr);
}

/**
 * Carga consultas para la navegación
 */
async function loadTodayConsultationsForNav(selectedDate = null) {
    const list = document.getElementById('consultas-hoy-list');
    if (!list) return;

    try {
        const { ApiScheduling, Api } = await import('../api.js');

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

        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${doctorState.currentDoctorData.doctorId}&startTime=${filterDate.toISOString()}&endTime=${nextDay.toISOString()}`
        );

        list.innerHTML = '';

        if (!appointments || appointments.length === 0) {
            const dateStr = filterDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });
            list.innerHTML = `<p style="padding:1rem; text-align:center;">No hay consultas para el ${dateStr}</p>`;
            return;
        }

        for (const apt of appointments) {
            const patient = await Api.get(`v1/Patient/${apt.patientId}`);
            apt.patientName = `${patient.name} ${patient.lastName}`;

            const item = createConsultationItemElement(apt);
            list.appendChild(item);
        }

    } catch (e) {
        console.error('Error cargando consultas', e);
        list.innerHTML = `<p>Error cargando consultas</p>`;
    }
}

// ===================================
// VISTA DE PACIENTES
// ===================================

/**
 * Carga la vista de pacientes (EXPORTADA)
 */
export async function loadPatientsView() {
    console.log('👥 Cargando vista de pacientes...');
    
    // Importar y usar la función de clinical history que muestra el buscador de pacientes
    const { loadClinicalHistoryView } = await import('./doctor-clinical.js');
    await loadClinicalHistoryView();
}

/**
 * Actualiza el contador de un elemento
 */
export function updateCounter(elementId, change) {
    const element = document.getElementById(elementId);
    if (element) {
        const currentValue = parseInt(element.textContent) || 0;
        element.textContent = Math.max(0, currentValue + change);
    }
}

// ===================================
// EXPORTACIONES
// ===================================

export { doctorState };