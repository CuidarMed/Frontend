// ===================================
// DOCTOR APPOINTMENTS - Consultas y Turnos
// ===================================

import { doctorState, getId, formatTime, getDoctorDisplayName } from './doctor-core.js';
import { showNotification } from './doctor-ui.js';
// Chat se carga de forma lazy para no bloquear la carga inicial 

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
    NO_SHOW: { class: 'no-show', text: 'No asistiÃ³' }
};

const getStatusInfo = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.SCHEDULED;

/**
 * Obtiene los botones de acción según el estado del turno
 */
const getActionButtons = (status, appointmentId, patientId, patientName) => {
    const dataAttrs = `data-appointment-id="${appointmentId}" data-patient-id="${patientId}" data-patient-name="${patientName}"`;
    
    if (status === 'COMPLETED') {
        return `
            <span class="status-completed">
                <i class="fas fa-check-circle"></i> Consulta realizada
            </span>
        `;
    }
    
    if (status === 'CANCELLED') {
        return `
            <span class="status-cancelled">
                <i class="fas fa-times-circle"></i> Cancelado
            </span>
        `;
    }
    
    if (status === 'NO_SHOW') {
        return `
            <span class="status-no-show">
                <i class="fas fa-user-slash"></i> No asistió
            </span>
        `;
    }
    
    let buttons = '';
    
    if (status === 'SCHEDULED') {
        buttons = `
            <button class="btn btn-success btn-sm confirm-appointment-btn" ${dataAttrs}>
                <i class="fas fa-check"></i> Confirmar
            </button>
        `;
    } else if (status === 'CONFIRMED') {
        buttons = `
            <button class="btn btn-primary btn-sm attend-appointment-btn" ${dataAttrs}>
                <i class="fas fa-video"></i> Atender
            </button>
            <!-- Boton del chat -->
            <button class="btn btn-chat-doctor btn-sm open-chat-btn" ${dataAttrs} style="background: #10b981; color: white; border: none;>
                <i class="fas fa-comments"></i> Chat
            </button>
        `;
    } else if (status === 'IN_PROGRESS') {
        buttons = `
            <button class="btn btn-success btn-sm complete-appointment-btn" ${dataAttrs}>
                <i class="fas fa-check-circle"></i> Completar
            </button>
            <button class="btn btn-warning btn-sm no-show-appointment-btn" data-appointment-id="${appointmentId}">
                <i class="fas fa-user-slash"></i> No asistió
            </button>
            <!-- Boton del chat -->
            <button class="btn btn-chat-doctor btn-sm open-chat-btn" ${dataAttrs} style="background: #10b981; color: white; border: none;>
                <i class="fas fa-comments"></i> Chat
            </button>
        `;
    }
    
    // ——— Dropdown de opciones (Reprogramar / Cancelar) ———
    // No mostrar dropdown para estados finales (COMPLETED, NO_SHOW, CANCELLED) ni para IN_PROGRESS
    if (status !== 'COMPLETED' && status !== 'IN_PROGRESS' && status !== 'NO_SHOW' && status !== 'CANCELLED') {
        buttons += `
            <div class="appointment-action-menu">
                <button class="appointment-action-toggle" type="button">
                    <i class="fas fa-ellipsis-v"></i>
                </button>

                <div class="appointment-action-dropdown">
                    <button class="dropdown-item reschedule-appointment-btn" data-appointment-id="${appointmentId}">
                        <i class="fas fa-calendar-alt"></i>
                        Reprogramar
                    </button>

                    <button class="dropdown-item cancel-appointment-btn" data-appointment-id="${appointmentId}">
                        <i class="fas fa-times"></i>
                        Cancelar
                    </button>
                </div>
            </div>
        `;
    }

    return buttons;
};
document.addEventListener("click", (e) => {
    const toggle = e.target.closest(".appointment-action-toggle");

    // Si tocaste el botón → abrir/cerrar
    if (toggle) {
        const menu = toggle.nextElementSibling;
        menu.classList.toggle("show");
        return;
    }

    // Si tocaste afuera → cerrar todos
    document.querySelectorAll(".appointment-action-dropdown.show")
        .forEach(drop => drop.classList.remove("show"));
});

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
    
    console.log('Buscando consultas para doctorId:', doctorId);
    
    const appointments = await ApiScheduling.get(
        `v1/Appointments?doctorId=${doctorId}&startTime=${filterDate.toISOString()}&endTime=${nextDay.toISOString()}`
    );
    
    const allAppointments = Array.isArray(appointments) ? appointments : [];
    
    console.log('âœ… Consultas encontradas:', allAppointments.length);
    console.log(allAppointments);
    
    // Cargar nombres de pacientes
    for (const apt of allAppointments) {

    // Si ya viene el nombre desde el backend â†’ lo usamos tal cual
    if (apt.patientName && apt.patientName.trim() !== '') {
        continue;
    }

    const patientId = apt.patientId || apt.PatientId;
    if (!patientId) {
        apt.patientName = 'Paciente sin ID';
        continue;
    }

    // Como fallback, recién ahí­ pedimos el patient
    apt.patientName = await fetchPatientName(patientId);
}
    
    return { appointments: allAppointments, filterDate };
};

// ===================================
// RENDERIZADO
// ===================================

// Actualizar la función createConsultationItemElement
export function createConsultationItemElement(appointment) {
    const item = document.createElement('div');
    item.className = 'consultation-item';
    
    const startTime = new Date(appointment.startTime || appointment.StartTime);
    const endTime = new Date(appointment.endTime || appointment.EndTime);
    const status = appointment.status || appointment.Status || 'SCHEDULED';
    const statusInfo = getStatusInfo(status);
    
    // Formatear fecha
    const dateStr = startTime.toLocaleDateString('es-AR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long', 
        year: 'numeric' 
    });
    const dateFormatted = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
    
    item.innerHTML = `
        <div class="consultation-header">
            <div class="consultation-icon-wrapper">
            <div class="consultation-icon"><i class="fas fa-user-md"></i></div>
            </div>
            <div class="consultation-info">
                <h4 class="consultation-patient">${appointment.patientName || 'Paciente Desconocido'}</h4>
                <div class="consultation-meta">
                    <span class="consultation-date"><i class="fas fa-calendar-alt"></i> ${dateFormatted}</span>
                    <span class="consultation-time"><i class="fas fa-clock"></i> ${formatTime(startTime)} - ${formatTime(endTime)}</span>
                </div>
            </div>
            <span class="status-badge status ${statusInfo.class}">${statusInfo.text}</span>
        </div>
        <div class="consultation-body">
            <div class="consultation-reason-wrapper">
                <i class="fas fa-stethoscope"></i>
                <div class="consultation-reason-content">
                <strong>Motivo:</strong> ${appointment.reason || appointment.Reason || 'Sin motivo especificado'}
                </div>
            </div>
        </div>
        <div class="consultation-actions">
            ${getActionButtons(status, appointment.appointmentId || appointment.AppointmentId, appointment.patientId || appointment.PatientId, appointment.patientName)}
            ${status === 'COMPLETED' ? `
                <button class="btn btn-info btn-sm btn-hl7-download" 
                        data-appointment-id="${appointment.appointmentId || appointment.AppointmentId}" 
                        data-patient-id="${appointment.patientId || appointment.PatientId}">
                    <i class="fas fa-file-download"></i> Descargar HL7
                </button>
            ` : ''}
        </div>
    `;
    
    // Agregar event listener para el botón HL7 si existe
    const hl7Button = item.querySelector('.btn-hl7-download');
    if (hl7Button) {
        hl7Button.addEventListener('click', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            const patientId = this.getAttribute('data-patient-id');
            await downloadHl7Summary(appointmentId, patientId);
        });
    }
    
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
    
    console.log('ðŸ“… Cargando consultas del dÃ­a:', selectedDate || 'hoy');
    
    try {
        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
        if (!doctorId) {
            consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudo identificar al mÃ©dico</p>';
            return;
        }
        
        const { appointments, filterDate } = await loadAppointments(doctorId, selectedDate);
        renderAppointmentsList(consultationsList, appointments, filterDate);
        
    } catch (error) {
        console.error('âŒ Error al cargar consultas:', error);
        consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudieron cargar las consultas del dÃ­a</p>';
    }
    
    setTimeout(initializeAttendButtons, 100);
}

export async function loadTodayFullHistory() {
    const container = document.getElementById('navbar-today-history');
    if (!container) return;

    if (!doctorState.currentDoctorData?.doctorId) {
        container.innerHTML = "<p>No se pudo identificar al mÃ©dico.</p>";
        return;
    }

    try {
        const { appointments } = await loadAppointments(doctorState.currentDoctorData.doctorId);
        
        if (!appointments || appointments.length === 0) {
            container.innerHTML = "<p>No hay historial del dÃ­a.</p>";
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
        console.log('Actualizando estado del turno:', appointmentId, 'a', newStatus);
        
        const { ApiScheduling } = await import('../api.js');
        const currentAppointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`);
        
        if (!currentAppointment) throw new Error('No se encontró el appointment');
        
        // Prevenir cambios cuando el estado es final (COMPLETED o NO_SHOW)
        const currentStatus = currentAppointment.status || currentAppointment.Status;
        if (currentStatus === 'COMPLETED' || currentStatus === 'NO_SHOW') {
            const statusText = currentStatus === 'COMPLETED' ? 'Completado' : 'No asistió';
            if (!silent) {
                showNotification(`No se puede cambiar el estado de un turno ${statusText.toLowerCase()}`, 'warning');
            }
            throw new Error(`El turno ya está ${statusText.toLowerCase()} y no puede modificarse`);
        }
        
        await ApiScheduling.patch(`v1/Appointments/${appointmentId}/status`, {
            Status: newStatus,
            Reason: reason || currentAppointment.reason || currentAppointment.Reason || null
        });
        
        if (!silent) {
            showNotification('Estado del turno actualizado', 'success');
        }
        
        console.log('Estado actualizado exitosamente');
        
        await reloadAppointmentViews();
        
        const { loadDoctorStats } = await import('./doctor-main.js');
        if (loadDoctorStats) await loadDoctorStats();
        
        setTimeout(() => {
            initializeAttendButtons();
            initializeStatusSelects();
        }, 300);
        
    } catch (error) {
        console.error('Error al actualizar estado del turno:', error);
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

export async function handlerDoctorChatOpen(appointmentId, patientId, patientName){
    try{
        console.log('Abriendo chat: ', {appointmentId, patientId, patientName})

        const {ApiScheduling} = await import('../api.js')

        // Obtener datos completos del appoinment
        const appoinment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`)

        if(!appoinment){
            showNotification('No se encontró el turno', 'error')
            return
        }
        
        console.log('🔍 Appointment obtenido del backend:', appoinment);
        console.log('🔍 AppointmentId en el objeto:', appoinment.appointmentId || appoinment.AppointmentId);

        // Verificar que este confirmado
        const status = (appoinment.status || appoinment.Status || '').toUpperCase()
        if(status !== 'CONFIRMED' && status !== 'IN_PROGRESS'){
            showNotification('El chat solo esta disponible para turnos confirmados', 'warning')
            return
        }

        // Crear o recuperar sala del chat
        // Cargar módulo de chat de forma lazy
        const { handleAppointmentChatCreation, openChatModal } = await import('../chat/ChatIntegration.js');
        
        // Obtener userId con múltiples fallbacks
        const userId = doctorState.currentUser?.userId || 
                      doctorState.currentUser?.UserId || 
                      doctorState.currentUser?.id ||
                      doctorState.currentUser?.Id ||
                      doctorState.currentUser?.user?.userId ||
                      doctorState.currentUser?.user?.UserId;
        
        if (!userId) {
            console.error('❌ No se pudo obtener el userId para crear la sala de chat');
            showNotification('Error: No se pudo identificar al usuario. Por favor, recarga la página.', 'error');
            return;
        }
        
        // Asegurar que appointmentId esté presente
        const finalAppointmentId = appoinment.appointmentId || 
                                   appoinment.AppointmentId || 
                                   appoinment.id ||
                                   appoinment.Id ||
                                   appointmentId;
        
        console.log('🔍 Intentando obtener AppointmentId:', {
            'appoinment.appointmentId': appoinment.appointmentId,
            'appoinment.AppointmentId': appoinment.AppointmentId,
            'appoinment.id': appoinment.id,
            'appoinment.Id': appoinment.Id,
            'appointmentId (parámetro)': appointmentId,
            'finalAppointmentId': finalAppointmentId
        });
        
        if (!finalAppointmentId) {
            console.error('❌ No se pudo obtener appointmentId del appointment:', appoinment);
            console.error('❌ Todas las claves del objeto:', Object.keys(appoinment));
            showNotification('Error: No se pudo identificar el ID del turno. Por favor, recarga la página.', 'error');
            return;
        }
        
        const finalAppointmentIdNum = Number(finalAppointmentId);
        if (isNaN(finalAppointmentIdNum) || finalAppointmentIdNum <= 0) {
            console.error('❌ AppointmentId no es un número válido:', finalAppointmentId);
            showNotification('Error: El ID del turno no es válido. Por favor, recarga la página.', 'error');
            return;
        }
        
        console.log('✅ AppointmentId final para crear sala:', finalAppointmentIdNum);
        
        const chatRoom = await handleAppointmentChatCreation({
            ...appoinment,
            appointmentId: finalAppointmentIdNum, // Usar el número validado
            doctorId: appoinment.doctorId || appoinment.DoctorId,
            patientId: appoinment.patientId || appoinment.PatientId || patientId,
            doctorUserId: userId, // UserId del doctor logueado (se usará si no se puede obtener desde API)
            patientUserId: null, // Se obtendrá desde la API usando patientId
            status: appoinment.status || appoinment.Status,
            currentUserId: userId,
            userType: 'doctor'
        })

        if(!chatRoom){
            showNotification('No se pudo iniciar el chat. El servicio de chat no está disponible.', 'error')
            return
        }

        // Obtener nombre del doctor
        const { getDoctorDisplayName } = await import('./doctor-core.js')
        const doctorName = getDoctorDisplayName() || 'Doctor'

        // Obtener el doctorId de la sala o del appointment
        const doctorId = chatRoom.DoctorId || chatRoom.doctorId || chatRoom.DoctorID || 
                        appoinment.doctorId || appoinment.DoctorId;
        
        console.log('🔍 DoctorId para el chat:', { 
            chatRoom, 
            appoinment, 
            doctorId,
            userId 
        });

        // Obtener nombre del paciente con fallbacks
        let finalPatientName = patientName;
        if (!finalPatientName || finalPatientName === 'undefined undefined' || finalPatientName.includes('undefined')) {
            // Intentar obtener del appointment
            if (appoinment.patientName) {
                finalPatientName = appoinment.patientName;
            } else if (appoinment.patientFirstName || appoinment.patientLastName) {
                const firstName = appoinment.patientFirstName || '';
                const lastName = appoinment.patientLastName || '';
                finalPatientName = `${firstName} ${lastName}`.trim() || 'Paciente';
            } else {
                finalPatientName = 'Paciente';
            }
        }
        
        console.log('👤 Nombres para el chat:', { doctorName, patientName: finalPatientName });

        // Abrir modal del chat
        openChatModal(chatRoom, {
            currentUserId: userId, // userId original para referencia
            participantId: doctorId, // doctorId para referencia
            otherParticipantId: chatRoom.PatientId || chatRoom.patientId || appoinment.patientId || appoinment.PatientId || patientId,
            currentUserName: doctorName,
            otherUserName: finalPatientName,
            userType: 'doctor',
            appointment: appoinment, // Pasar appointment para fallback de IDs
            doctorId: doctorId,
            patientId: chatRoom.PatientId || chatRoom.patientId || appoinment.patientId || appoinment.PatientId || patientId
        })

        showNotification('Chat iniciado', 'success')
    } catch(error){
        console.error('Error al abrir chat: ', error)
        const errorMessage = error.message || 'Error desconocido';
        if (errorMessage.includes('no está disponible') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
            showNotification('El servicio de chat no está disponible. Por favor, verifica que el servicio esté corriendo.', 'error')
        } else {
            showNotification(`Error al abrir el chat: ${errorMessage}`, 'error')
        }
    }
}

const replaceEventListener = (button, eventType, handler) => {
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    newButton.addEventListener(eventType, handler);
};

// Actualizar initializeAttendButtons para incluir los nuevos botones
export function initializeAttendButtons() {
    console.log('🔘 Inicializando botones de atención');
    
    // Botón Confirmar
    document.querySelectorAll('.confirm-appointment-btn').forEach(button => {
        replaceEventListener(button, 'click', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            
            console.log('✅ Confirmando turno:', appointmentId);
            
            if (appointmentId) {
                await updateAppointmentStatus(appointmentId, 'CONFIRMED');
            }
        });
    });
    
    // Botón Atender (CONFIRMED -> IN_PROGRESS)
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
    
    // Botón Completar
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
    
    // Botón No asistió
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
    
    // Botón Cancelar
    document.querySelectorAll('.cancel-appointment-btn').forEach(button => {
        replaceEventListener(button, 'click', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            
            if (appointmentId && confirm('¿Estás seguro de que deseas cancelar este turno?')) {
                console.log('🚫 Cancelando turno:', appointmentId);
                
                // Pedir motivo de cancelación
                const reason = prompt('Motivo de la cancelación (opcional):');
                
                await updateAppointmentStatus(appointmentId, 'CANCELLED', reason || 'Cancelado por el médico');
                showNotification('Turno cancelado exitosamente', 'success');
                await reloadAppointmentViews();
            }
        });
    });
    
    // Botón Reprogramar
    document.querySelectorAll('.reschedule-appointment-btn').forEach(button => {
        replaceEventListener(button, 'click', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            
            if (appointmentId) {
                console.log('📅 Reprogramando turno:', appointmentId);
                
                // Pedir motivo de reprogramación
                const reason = prompt('Motivo de la reprogramación (opcional):');
                
                if (reason !== null) { // null si cancela el prompt
                    await updateAppointmentStatus(appointmentId, 'RESCHEDULED', reason || 'Reprogramado por el médico');
                    showNotification('Turno marcado como reprogramado. Contacta al paciente para agendar uno nuevo.', 'info');
                    await reloadAppointmentViews();
                }
            }
        });
    });

    document.querySelectorAll('.open-chat-btn').forEach(button => {
        replaceEventListener(button, 'click', async function(e) {
            e.preventDefault()
            e.stopPropagation()

            const appointmentId = this.getAttribute('data-appointment-id')
            const patientId = this.getAttribute('data-patient-id')
            const patientName = this.getAttribute('data-patient-name')

            console.log('Click en boton de chat: ', { appointmentId, patientId, patientName })

            if(appointmentId && patientId && patientName){
                await handlerDoctorChatOpen(appointmentId, patientId, patientName)
            } else {
                console.error('Datos incompletas para abrir chat')
                showNotification('No se puede abrir el chat: datos incompletos', 'error')
            }
        })
    })
    
    // Inicializar dropdowns (para los botones de menú)
    initializeDropdowns();
}

function initializeDropdowns() {
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        const newToggle = toggle.cloneNode(true);
        toggle.parentNode.replaceChild(newToggle, toggle);
        
        newToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Cerrar otros dropdowns
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                if (menu !== this.nextElementSibling) {
                    menu.style.display = 'none';
                }
            });
            
            // Toggle este dropdown
            const menu = this.nextElementSibling;
            if (menu && menu.classList.contains('dropdown-menu')) {
                menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
            }
        });
    });
    
    // Cerrar dropdowns al hacer click fuera
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.btn-group')) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    });
    
    // Prevenir que el dropdown se cierre al hacer click en los items
    document.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            // Cerrar el dropdown después de la acción
            setTimeout(() => {
                const menu = this.closest('.dropdown-menu');
                if (menu) menu.style.display = 'none';
            }, 100);
        });
    });
}

export function initializeStatusSelects() {
    console.log('Inicializando selectores de estado');
    
    document.querySelectorAll('.appointment-status-select').forEach(select => {
        // Verificar si el selector está deshabilitado (no debería aparecer para estados finales)
        const appointmentId = select.getAttribute('data-appointment-id');
        if (!appointmentId) return;
        
        replaceEventListener(select, 'change', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            const newStatus = this.value;
            
            if (appointmentId && newStatus) {
                // Prevenir cambios a estados finales desde el selector
                if (newStatus === 'COMPLETED' || newStatus === 'NO_SHOW') {
                    showNotification('No se puede cambiar el estado a "Completado" o "No asistió" desde aquí. Use los botones de acción.', 'warning');
                    await reloadAppointmentViews();
                    return;
                }
                
                const currentStatus = this.options[this.selectedIndex].text;
                
                if (confirm(`¿Cambiar el estado del turno a "${currentStatus}"?`)) {
                    console.log('Cambiando estado:', appointmentId, 'a', newStatus);
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
            showNotification('No se pudo identificar al mÃ©dico', 'error');
            return;
        }

        console.log('Iniciando consulta:', { appointmentId, patientId, patientName });
        
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
        console.error('Error al iniciar consulta:', error);
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
    
    // Obtener fecha de hoy en zona horaria local (no UTC)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    console.log('📅 Fecha de hoy (local):', todayStr);
    
    dateFilter.value = todayStr;
    
    // Cargar consultas de hoy automáticamente al inicializar
    loadTodayConsultations(todayStr).catch(err => {
        console.error('❌ Error al cargar consultas de hoy:', err);
    });
    
    dateFilter.addEventListener('change', async function(e) {
        const selectedDate = e.target.value;
        if (selectedDate) {
            console.log('📅 Fecha seleccionada:', selectedDate);
            await loadTodayConsultations(selectedDate);
        }
    });

    // Botones de navegación de fecha
    const prevDayBtn = document.getElementById('prev-day-btn');
    const nextDayBtn = document.getElementById('next-day-btn');
    const todayBtn = document.getElementById('today-btn');

    if (prevDayBtn) {
        prevDayBtn.addEventListener('click', () => {
            const currentDate = new Date(dateFilter.value || todayStr + 'T00:00:00');
            currentDate.setDate(currentDate.getDate() - 1);
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const newDateStr = `${year}-${month}-${day}`;
            dateFilter.value = newDateStr;
            dateFilter.dispatchEvent(new Event('change'));
        });
    }

    if (nextDayBtn) {
        nextDayBtn.addEventListener('click', () => {
            const currentDate = new Date(dateFilter.value || todayStr + 'T00:00:00');
            currentDate.setDate(currentDate.getDate() + 1);
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const newDateStr = `${year}-${month}-${day}`;
            dateFilter.value = newDateStr;
            dateFilter.dispatchEvent(new Event('change'));
        });
    }

    if (todayBtn) {
        todayBtn.addEventListener('click', () => {
            // Recalcular fecha de hoy para asegurar que sea correcta
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const currentTodayStr = `${year}-${month}-${day}`;
            dateFilter.value = currentTodayStr;
            dateFilter.dispatchEvent(new Event('change'));
        });
    }
}

export async function loadTodayConsultationsView() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;

    dashboardContent.querySelectorAll('.consultas-section').forEach(sec => sec.remove());

    const section = document.createElement('div');
    section.className = 'dashboard-section consultas-section';
    // Obtener fecha de hoy en zona horaria local (no UTC)
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
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
                <div class="date-navigation">
                    <button type="button" id="prev-day-btn-view" class="date-nav-btn" title="Día anterior">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <input type="date" id="consultation-date-filter-view" class="date-filter-input" value="${todayStr}"
                           style="padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem;">
                    <button type="button" id="next-day-btn-view" class="date-nav-btn" title="Día siguiente">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                    <button type="button" id="today-btn-view" class="date-nav-btn today-btn" title="Ir a hoy">
                        Hoy
                    </button>
                </div>
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

    // Botones de navegación de fecha para la vista dinámica
    const prevDayBtnView = document.getElementById('prev-day-btn-view');
    const nextDayBtnView = document.getElementById('next-day-btn-view');

    if (prevDayBtnView && dateFilterView) {
        prevDayBtnView.addEventListener('click', () => {
            const currentDate = new Date(dateFilterView.value || todayStr + 'T00:00:00');
            currentDate.setDate(currentDate.getDate() - 1);
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const newDateStr = `${year}-${month}-${day}`;
            dateFilterView.value = newDateStr;
            dateFilterView.dispatchEvent(new Event('change'));
        });
    }

    if (nextDayBtnView && dateFilterView) {
        nextDayBtnView.addEventListener('click', () => {
            const currentDate = new Date(dateFilterView.value || todayStr + 'T00:00:00');
            currentDate.setDate(currentDate.getDate() + 1);
            const year = currentDate.getFullYear();
            const month = String(currentDate.getMonth() + 1).padStart(2, '0');
            const day = String(currentDate.getDate()).padStart(2, '0');
            const newDateStr = `${year}-${month}-${day}`;
            dateFilterView.value = newDateStr;
            dateFilterView.dispatchEvent(new Event('change'));
        });
    }

    const todayBtnView = document.getElementById('today-btn-view');
    if (todayBtnView && dateFilterView) {
        todayBtnView.addEventListener('click', () => {
            // Recalcular fecha de hoy para asegurar que sea correcta
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const currentTodayStr = `${year}-${month}-${day}`;
            dateFilterView.value = currentTodayStr;
            dateFilterView.dispatchEvent(new Event('change'));
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
            list.innerHTML = '<p style="padding:1rem; text-align:center;">No se pudo identificar al mÃ©dico</p>';
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
    console.log('Cargando vista de pacientes...');
    
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

/**
 * Genera el resumen HL7 si no existe
 */
async function generateHl7SummaryIfNeeded(appointmentId, patientId) {
    try {
        const { ApiHl7Gateway, ApiClinical, Api, ApiScheduling } = await import('../api.js');
        
        // Obtener encounter por appointmentId - intentar múltiples formas
        let encounter = null;
        let encounterId = null;
        
        // Método 1: Buscar por appointmentId (con retries, sin delays)
        // NOTA: La búsqueda por appointmentId NO filtra por status, así que debería encontrar todos los encounters
        let retries = 3; // Reducir a 3 intentos (sin delays, son rápidos)
        
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`🔍 Buscando encounter por appointmentId (intento ${attempt}/${retries}):`, appointmentId);
                const url = `v1/Encounter?appointmentId=${appointmentId}`;
                console.log(`📡 URL de búsqueda: ${url}`);
                
                const encounters = await ApiClinical.get(url);
                const encountersArray = Array.isArray(encounters) ? encounters : (encounters?.value || []);
                
                console.log(`📋 Respuesta del API (intento ${attempt}):`, encountersArray.length, 'encounters encontrados');
                
                if (encountersArray.length > 0) {
                    // Si hay múltiples, usar el más reciente
                    encounter = encountersArray.sort((a, b) => {
                        const dateA = new Date(a.date || a.Date || a.createdAt || a.CreatedAt || 0);
                        const dateB = new Date(b.date || b.Date || b.createdAt || b.CreatedAt || 0);
                        return dateB - dateA; // Más reciente primero
                    })[0];
                    
                encounterId = encounter.encounterId || encounter.EncounterId;
                    console.log('✅ Encounter encontrado por appointmentId:', encounterId);
                    console.log('📋 Datos del encounter encontrado:', {
                        encounterId: encounterId,
                        appointmentId: encounter.appointmentId || encounter.AppointmentId,
                        patientId: encounter.patientId || encounter.PatientId,
                        doctorId: encounter.doctorId || encounter.DoctorId,
                        status: encounter.status || encounter.Status,
                        date: encounter.date || encounter.Date
                    });
                    break; // Salir del loop si encontramos el encounter
                } else {
                    console.warn(`⚠️ No se encontraron encounters por appointmentId (intento ${attempt}/${retries})`);
                    // Sin delay - continuar inmediatamente
            }
        } catch (err) {
                console.warn(`⚠️ Error al buscar encounter por appointmentId (intento ${attempt}/${retries}):`, err);
                console.warn(`   Detalles del error:`, {
                    message: err.message,
                    status: err.status,
                    stack: err.stack?.substring(0, 200)
                });
                // Sin delay - continuar inmediatamente
            }
        }
        
        // Método 2: Si no se encontró, intentar buscar por patientId y luego filtrar (con retries, sin delays)
        if (!encounterId && patientId) {
            retries = 3;
            
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    console.log(`🔍 Buscando encounter por patientId (intento ${attempt}/${retries}):`, patientId);
                    
                    // Obtener la fecha del appointment para usar un rango más preciso
                    let appointmentStartTime = null;
                    try {
                        const { ApiScheduling } = await import('../api.js');
                        const appointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`).catch(() => null);
                        if (appointment) {
                            appointmentStartTime = new Date(appointment.startTime || appointment.StartTime);
                            console.log('📅 Fecha del appointment:', appointmentStartTime.toISOString());
                        }
                    } catch (err) {
                        console.warn('⚠️ No se pudo obtener la fecha del appointment:', err);
                    }
                    
                    const now = new Date();
                    // Usar un rango centrado en la fecha del appointment si está disponible
                    let from, to;
                    if (appointmentStartTime) {
                        // Rango de 60 días antes y después del appointment
                        from = new Date(appointmentStartTime.getTime() - 60 * 24 * 60 * 60 * 1000);
                        to = new Date(appointmentStartTime.getTime() + 60 * 24 * 60 * 60 * 1000);
                    } else {
                        // Rango amplio: desde hace 2 años hasta 1 día en el futuro
                        from = new Date(now.getFullYear() - 2, 0, 1);
                        to = new Date(now.getTime() + 24 * 60 * 60 * 1000);
                    }
                    
                    console.log(`📅 Rango de búsqueda: desde ${from.toISOString()} hasta ${to.toISOString()}`);
                    
                    // NOTA: La búsqueda por patientId con rango filtra por Status == "OPEN" || "SIGNED"
                    // Si el encounter tiene otro status (como "Open" con mayúscula inicial), no se devolverá
                    const encounters = await ApiClinical.get(`v1/Encounter?patientId=${patientId}&from=${from.toISOString()}&to=${to.toISOString()}`);
                    const encountersArray = Array.isArray(encounters) ? encounters : (encounters?.value || []);
                    
                    console.log(`📋 Encontrados ${encountersArray.length} encounters para el paciente (intento ${attempt})`);
                    if (encountersArray.length === 0) {
                        console.warn('⚠️ No se encontraron encounters. Posibles causas:');
                        console.warn('   1. El encounter no existe en la base de datos');
                        console.warn('   2. El encounter tiene un Status diferente a "OPEN" o "SIGNED" (el backend filtra por estos)');
                        console.warn('   3. La fecha del encounter está fuera del rango de búsqueda');
                        console.warn('   4. El patientId no coincide');
                    } else {
                        console.log('📋 Primeros 3 encounters (muestra):', encountersArray.slice(0, 3).map(e => ({
                            encounterId: e.encounterId || e.EncounterId,
                            appointmentId: e.appointmentId || e.AppointmentId || e.appointmentID || e.AppointmentID,
                            patientId: e.patientId || e.PatientId,
                            status: e.status || e.Status,
                            date: e.date || e.Date || e.createdAt || e.CreatedAt
                        })));
                    }
                    
                    if (encountersArray.length > 0) {
                        console.log('📋 Todos los encounters encontrados:', encountersArray.map(e => ({
                            encounterId: e.encounterId || e.EncounterId,
                            appointmentId: e.appointmentId || e.AppointmentId || e.appointmentID || e.AppointmentID,
                            patientId: e.patientId || e.PatientId,
                            date: e.date || e.Date || e.createdAt || e.CreatedAt
                        })));
                        
                        // Normalizar appointmentId para comparación (convertir a número)
                        const appointmentIdNum = typeof appointmentId === 'string' ? parseInt(appointmentId, 10) : appointmentId;
                        
                        // Buscar el encounter que coincida con el appointmentId
                        // Intentar múltiples campos y comparaciones
                        const matchingEncounter = encountersArray.find(e => {
                            const eAppointmentId = e.appointmentId || e.AppointmentId || e.appointmentID || e.AppointmentID;
                            if (eAppointmentId == null || eAppointmentId === undefined) {
                                return false;
                            }
                            // Comparar como números y como strings
                            const eAppointmentIdNum = typeof eAppointmentId === 'string' ? parseInt(eAppointmentId, 10) : eAppointmentId;
                            return eAppointmentIdNum === appointmentIdNum || 
                                   eAppointmentId == appointmentId ||
                                   String(eAppointmentId) === String(appointmentId);
                        });
                        
                        if (matchingEncounter) {
                            encounter = matchingEncounter;
                            encounterId = encounter.encounterId || encounter.EncounterId;
                            console.log('✅ Encounter encontrado por patientId y filtrado por appointmentId:', encounterId);
                            console.log('📋 Datos del encounter:', {
                                encounterId: encounterId,
                                appointmentId: encounter.appointmentId || encounter.AppointmentId,
                                patientId: encounter.patientId || encounter.PatientId,
                                doctorId: encounter.doctorId || encounter.DoctorId
                            });
                            break; // Salir del loop si encontramos el encounter
                        } else {
                            console.warn(`⚠️ No se encontró encounter que coincida con appointmentId (intento ${attempt})`);
                            console.log('📋 Encounters encontrados (para debugging):', encountersArray.map(e => ({
                                encounterId: e.encounterId || e.EncounterId,
                                appointmentId: e.appointmentId || e.AppointmentId || e.appointmentID || e.AppointmentID,
                                patientId: e.patientId || e.PatientId
                            })));
                            console.log('🔍 AppointmentId buscado:', appointmentId, '(tipo:', typeof appointmentId, ')');
                            
                            // Si solo hay un encounter reciente (últimos 7 días), usarlo como fallback
                            const recentEncounters = encountersArray.filter(e => {
                                const encounterDate = e.encounterDate || e.EncounterDate || e.createdAt || e.CreatedAt;
                                if (!encounterDate) return false;
                                const encDate = new Date(encounterDate);
                                const daysDiff = (now - encDate) / (1000 * 60 * 60 * 24);
                                return daysDiff <= 7;
                            });
                            
                            if (recentEncounters.length === 1) {
                                console.log('⚠️ Usando el único encounter reciente como fallback');
                                encounter = recentEncounters[0];
                                encounterId = encounter.encounterId || encounter.EncounterId;
                                console.log('✅ Encounter encontrado (fallback):', encounterId);
                                break; // Salir del loop si encontramos el encounter
                            }
                        }
                    }
                    
                    // Sin delay - continuar inmediatamente
                    if (encounterId) {
                        break; // Salir del loop si encontramos el encounter
                    }
                } catch (err) {
                    console.warn(`⚠️ Error al buscar encounter por patientId (intento ${attempt}/${retries}):`, err);
                    // Sin delay - continuar inmediatamente
                }
            }
        }
        
        if (!encounterId) {
            console.error('❌ No se encontró encounter para appointmentId:', appointmentId);
            console.error('   - Intentos de búsqueda: por appointmentId y por patientId');
            console.error('   - PatientId usado:', patientId);
            console.error('   - Posibles soluciones:');
            console.error('     1. Verificar que el encounter existe en la base de datos');
            console.error('     2. Verificar que el encounter tiene el status correcto (OPEN o SIGNED)');
            console.error('     3. Reiniciar los microservicios (ClinicalMS) para refrescar la conexión a la BD');
            console.error('     4. Verificar que el appointmentId y patientId son correctos');
            
            // Intentar generar el HL7 sin encounter si el usuario lo desea
            const shouldGenerateWithoutEncounter = confirm(
                'No se encontró el encounter en la base de datos. ' +
                '¿Deseas intentar generar el HL7 solo con los datos del appointment, paciente y doctor? ' +
                '(Nota: El resumen será incompleto sin los datos SOAP)'
            );
            
            if (shouldGenerateWithoutEncounter) {
                console.log('⚠️ Generando HL7 sin datos del encounter (solo con appointment, paciente y doctor)');
                // Continuar con el flujo pero sin datos del encounter
                encounter = null;
                encounterId = null;
            } else {
                throw new Error('No se encontró un encounter para este appointment. Por favor, verifica que la consulta haya sido guardada correctamente o reinicia los microservicios.');
            }
        }
        
        // Verificar que el encounter tenga datos SOAP (solo para logging, no bloqueamos la generación)
        // NOTA: El campo se llama "Objetive" (con "e"), no "Objective"
        // Si no hay encounter, estos campos serán undefined/null
        const hasSubjective = encounter?.subjective || encounter?.Subjective;
        const hasObjective = encounter?.objetive || encounter?.Objetive || encounter?.objective || encounter?.Objective;
        const hasAssessment = encounter?.assessment || encounter?.Assessment;
        const hasPlan = encounter?.plan || encounter?.Plan;
        
        console.log('📋 Verificando datos SOAP del encounter:', {
            hasSubjective: !!hasSubjective,
            hasObjective: !!hasObjective,
            hasAssessment: !!hasAssessment,
            hasPlan: !!hasPlan,
            encounterId: encounterId,
            subjective: hasSubjective ? (hasSubjective.substring(0, 50) + '...') : 'vacío',
            objective: hasObjective ? (hasObjective.substring(0, 50) + '...') : 'vacío',
            assessment: hasAssessment ? (hasAssessment.substring(0, 50) + '...') : 'vacío',
            plan: hasPlan ? (hasPlan.substring(0, 50) + '...') : 'vacío'
        });
        
        // Si no tiene datos SOAP completos, continuar de todas formas
        // El HL7 se generará con los datos disponibles
        if (!hasSubjective && !hasObjective && !hasAssessment && !hasPlan) {
            console.warn('⚠️ El encounter no tiene datos SOAP completos, pero se generará el HL7 con los datos disponibles');
            console.log('📋 Encounter completo (para debugging):', encounter);
        } else if (!hasSubjective || !hasObjective || !hasAssessment || !hasPlan) {
            const missingFields = [];
            if (!hasSubjective) missingFields.push('Subjetivo');
            if (!hasObjective) missingFields.push('Objetivo');
            if (!hasAssessment) missingFields.push('Evaluación');
            if (!hasPlan) missingFields.push('Plan');
            console.warn(`⚠️ El encounter tiene algunos campos SOAP faltantes: ${missingFields.join(', ')}. Se generará el HL7 con los datos disponibles.`);
        }
        
        // Si no hay encounter, intentar obtener el doctorId del appointment
        let doctorId = null;
        if (encounter) {
            doctorId = encounter.doctorId || encounter.DoctorId;
        }
        
        if (!doctorId) {
            // Intentar obtener el doctorId del appointment
            try {
                const { ApiScheduling } = await import('../api.js');
                const appointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`).catch(() => null);
                if (appointment) {
                    doctorId = appointment.doctorId || appointment.DoctorId;
                    console.log('✅ DoctorId obtenido del appointment:', doctorId);
                }
            } catch (err) {
                console.warn('⚠️ No se pudo obtener doctorId del appointment:', err);
            }
        }
        
        if (!doctorId) {
            throw new Error('No se pudo obtener el doctorId del encounter ni del appointment');
        }
        
        // Obtener datos del appointment
        let appointment = null;
        try {
            appointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`);
            console.log('✅ Appointment obtenido:', appointment);
        } catch (err) {
            console.warn('⚠️ No se pudo obtener appointment:', err);
            // Si no se puede obtener el appointment, intentar continuar con los datos del encounter
            if (!appointment) {
                console.warn('⚠️ Continuando sin datos del appointment, usando solo datos del encounter');
            }
        }
        
        // Obtener datos del paciente
        let patient;
        try {
            patient = await Api.get(`v1/Patient/${patientId}`);
        } catch (err) {
            console.error('❌ Error obteniendo datos del paciente:', err);
            throw new Error('No se pudo obtener los datos del paciente para generar el resumen HL7');
        }
        
        // Obtener datos del doctor
        let doctor;
        try {
            doctor = await Api.get(`v1/Doctor/${doctorId}`);
        } catch (err) {
            console.error('❌ Error obteniendo datos del doctor:', err);
            throw new Error('No se pudo obtener los datos del doctor para generar el resumen HL7');
        }
        
        // Validar que tenemos los datos mínimos necesarios
        if (!patient || !doctor) {
            throw new Error('No se pudieron obtener los datos necesarios del paciente o doctor');
        }
        
        // Construir request para generar el resumen
        // Incluir todos los datos disponibles, incluso si algunos campos SOAP están vacíos
        const generateRequest = {
            EncounterId: encounterId ? Number(encounterId) : null, // Permitir null si no hay encounter
            PatientId: Number(patientId),
            DoctorId: Number(doctorId),
            AppointmentId: Number(appointmentId),
            PatientDni: patient.dni || patient.Dni || patient.documentNumber || patient.DocumentNumber || null,
            PatientFirstName: patient.firstName || patient.FirstName || patient.name || patient.Name || null,
            PatientLastName: patient.lastName || patient.LastName || null,
            PatientDateOfBirth: patient.dateOfBirth || patient.DateOfBirth ? new Date(patient.dateOfBirth || patient.DateOfBirth).toISOString() : null,
            PatientPhone: patient.phone || patient.Phone || patient.phoneNumber || patient.PhoneNumber || null,
            PatientAddress: patient.address || patient.Address || patient.adress || patient.Adress || null,
            DoctorFirstName: doctor.firstName || doctor.FirstName || doctor.name || doctor.Name || null,
            DoctorLastName: doctor.lastName || doctor.LastName || null,
            DoctorSpecialty: doctor.specialty || doctor.Specialty || null,
            AppointmentStartTime: appointment?.startTime || appointment?.StartTime ? new Date(appointment.startTime || appointment.StartTime).toISOString() : null,
            AppointmentEndTime: appointment?.endTime || appointment?.EndTime ? new Date(appointment.endTime || appointment.EndTime).toISOString() : null,
            AppointmentReason: appointment?.reason || appointment?.Reason || null,
            // Incluir datos SOAP incluso si están vacíos o si no hay encounter (el backend los manejará)
            EncounterReasons: encounter?.reasons || encounter?.Reasons || encounter?.subjective || encounter?.Subjective || null,
            EncounterSubjective: encounter?.subjective || encounter?.Subjective || null,
            EncounterObjective: encounter?.objetive || encounter?.Objetive || encounter?.objective || encounter?.Objective || null,
            EncounterAssessment: encounter?.assessment || encounter?.Assessment || null,
            EncounterPlan: encounter?.plan || encounter?.Plan || null,
            EncounterDate: encounter?.date || encounter?.Date ? new Date(encounter.date || encounter.Date).toISOString() : (appointment?.startTime || appointment?.StartTime ? new Date(appointment.startTime || appointment.StartTime).toISOString() : new Date().toISOString())
        };
        
        console.log('📤 Generando HL7 con datos disponibles (algunos campos SOAP pueden estar vacíos):', {
            hasSubjective: !!generateRequest.EncounterSubjective,
            hasObjective: !!generateRequest.EncounterObjective,
            hasAssessment: !!generateRequest.EncounterAssessment,
            hasPlan: !!generateRequest.EncounterPlan,
            message: 'El HL7 se generará con los datos disponibles, incluso si faltan algunos campos SOAP'
        });
        
        // Validar que los IDs sean válidos (EncounterId puede ser null si no se encontró el encounter)
        if (generateRequest.EncounterId !== null && (!generateRequest.EncounterId || generateRequest.EncounterId <= 0)) {
            throw new Error('EncounterId inválido');
        }
        
        if (!generateRequest.EncounterId) {
            console.warn('⚠️ Generando HL7 sin EncounterId - solo con datos del appointment, paciente y doctor');
        }
        if (!generateRequest.PatientId || generateRequest.PatientId <= 0) {
            throw new Error('PatientId inválido');
        }
        if (!generateRequest.DoctorId || generateRequest.DoctorId <= 0) {
            throw new Error('DoctorId inválido');
        }
        if (!generateRequest.AppointmentId || generateRequest.AppointmentId <= 0) {
            throw new Error('AppointmentId inválido');
        }
        
        console.log('📤 Generando resumen HL7:', generateRequest);
        
        // Llamar al endpoint de generación
        const generateResponse = await ApiHl7Gateway.post('v1/Hl7Summary/generate', generateRequest);
        console.log('📥 Respuesta de generación:', generateResponse);
        
        console.log('✅ Resumen HL7 generado exitosamente');
        
    } catch (error) {
        console.error('❌ Error al generar resumen HL7:', error);
        throw error;
    }
}

/**
 * Descarga el resumen HL7 para una consulta
 */
export async function downloadHl7Summary(appointmentId, patientId) {
    try {
        console.log('📥 Descargando resumen HL7 para consulta:', { appointmentId, patientId });
        
        const { ApiHl7Gateway } = await import('../api.js');
        
        if (!appointmentId && !patientId) {
            showNotification('No se pudo identificar la consulta', 'error');
            return;
        }

        // Si tenemos appointmentId, intentar primero generar el resumen (por si no existe)
        // y luego descargarlo
        if (appointmentId) {
            try {
                // Primero intentar descargar directamente
                await ApiHl7Gateway.download(
                    `v1/Hl7Summary/by-appointment/${appointmentId}`, 
                    `resumen-hl7-appointment-${appointmentId}.txt`
                );
                showNotification('Resumen HL7 descargado exitosamente', 'success');
                return;
            } catch (downloadError) {
                console.warn('⚠️ No se pudo descargar por appointmentId:', downloadError);
                
                // Si es 404, el resumen no existe, intentar generarlo
                if (downloadError.message?.includes('404') || downloadError.message?.includes('No se encontró')) {
                    console.log('🔄 Resumen no existe, intentando generarlo automáticamente...');
                    
                    try {
                        // Generar el resumen
                        console.log('🔄 Generando resumen HL7 automáticamente...');
                        await generateHl7SummaryIfNeeded(appointmentId, patientId);
                        
                        // Intentar descargar inmediatamente después de generar (sin delay)
                        console.log('📥 Intentando descargar después de generar...');
                        try {
                            await ApiHl7Gateway.download(
                                `v1/Hl7Summary/by-appointment/${appointmentId}`, 
                                `resumen-hl7-appointment-${appointmentId}.txt`
                            );
                            showNotification('Resumen HL7 generado y descargado exitosamente', 'success');
                            return;
                        } catch (retryError) {
                            console.warn('⚠️ No se pudo descargar después de generar:', retryError);
                            // Reintentar inmediatamente sin delay
                            try {
                                await ApiHl7Gateway.download(
                                    `v1/Hl7Summary/by-appointment/${appointmentId}`, 
                                    `resumen-hl7-appointment-${appointmentId}.txt`
                                );
                                showNotification('Resumen HL7 generado y descargado exitosamente', 'success');
                                return;
                            } catch (secondRetryError) {
                                console.warn('⚠️ Segundo intento de descarga falló:', secondRetryError);
                                showNotification('Resumen HL7 generado, pero hubo un problema al descargarlo. Intenta nuevamente.', 'warning');
                                // Continuar con el flujo alternativo
                            }
                        }
                    } catch (genError) {
                        console.error('❌ Error al generar resumen HL7:', genError);
                        const genErrorMessage = genError.message || 'Error desconocido';
                        
                        // Si el error es que no hay encounter, mostrar mensaje específico y ofrecer abrir el modal
                        if (genErrorMessage.includes('encounter') || genErrorMessage.includes('No se encontró')) {
                            const shouldOpenModal = confirm('No se puede generar el resumen HL7 porque la consulta no tiene datos SOAP guardados. ¿Deseas completar la consulta ahora?');
                            if (shouldOpenModal) {
                                // Abrir el modal de encounter para completar la consulta
                                const { attendConsultation } = await import('./doctor-appointments.js');
                                const appointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`).catch(() => null);
                                if (appointment) {
                                    const patientName = appointment.patientName || appointment.PatientName || 'Paciente';
                                    await attendConsultation(appointmentId, patientId, patientName);
                                } else {
                                    showNotification('No se puede generar el resumen HL7: la consulta no ha sido completada aún. Por favor, completa la consulta primero guardando los datos SOAP (Subjetivo, Objetivo, Evaluación, Plan).', 'warning');
                                }
                            } else {
                                showNotification('No se puede generar el resumen HL7: la consulta no ha sido completada aún. Por favor, completa la consulta primero guardando los datos SOAP (Subjetivo, Objetivo, Evaluación, Plan).', 'warning');
                            }
                            return;
                        }
                        
                        showNotification(`Error al generar resumen HL7: ${genErrorMessage}`, 'error');
                        // Continuar con el flujo alternativo
                    }
                }
            }
        }

        // Si no hay appointmentId o falló, intentar por patientId
        if (patientId) {
            try {
                await ApiHl7Gateway.download(
                    `v1/Hl7Summary/by-patient/${patientId}`, 
                    `resumen-hl7-patient-${patientId}.txt`
                );
                showNotification('Resumen HL7 descargado exitosamente', 'success');
                return;
            } catch (error) {
                console.error('❌ Error descargando HL7 por patientId:', error);
                // Mostrar mensaje más específico según el tipo de error
                const errorMessage = error.message || 'Error desconocido';
                if (errorMessage.includes('no está disponible') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
                    showNotification('El servicio Hl7Gateway no está disponible. Por favor, verifica que esté corriendo.', 'error');
                } else if (errorMessage.includes('No se encontró')) {
                    showNotification('No se encontró resumen HL7 para esta consulta. El resumen se genera automáticamente cuando se completa una consulta.', 'warning');
                } else {
                    showNotification(`Error al descargar HL7: ${errorMessage}`, 'error');
                }
            }
        } else {
            showNotification('No se encontró resumen HL7 para esta consulta', 'warning');
        }
    } catch (error) {
        console.error('❌ Error al descargar resumen HL7:', error);
        const errorMessage = error.message || 'Error desconocido';
        if (errorMessage.includes('no está disponible') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
            showNotification('El servicio Hl7Gateway no está disponible. Por favor, verifica que esté corriendo.', 'error');
        } else {
            showNotification(`Error al descargar el resumen HL7: ${errorMessage}`, 'error');
        }
    }
}

export { doctorState };