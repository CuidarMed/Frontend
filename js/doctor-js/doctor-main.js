// doctor-main.js
// Módulo principal para inicializar el panel del doctor

import { 
    doctorState,
    loadDoctorContext, 
    loadDoctorData,
    getId,
    getValue,
    formatTime
} from './doctor-core.js';

import { 
    updateDoctorHeader 
} from './doctor-ui.js';

import { 
    initializeSidebarNavigation, 
    initializeQuickActions 
} from './doctor-navigation.js';

import { 
    initializeConsultationDateFilter,
    loadTodayConsultations,
    loadTodayFullHistory,
    createConsultationItemElement
} from './doctor-appointments.js';

import { 
    initializeProfileEditing 
} from './doctor-profile.js';

import { 
    initializePrescriptionModal 
} from './doctor-prescriptions.js';

/**
 * Inicializa el panel del doctor
 */
export async function initializeDoctorPanel() {
    console.log('🚀 Inicializando panel del doctor...');
    
    try {
        // 1. Cargar contexto del usuario
        await loadDoctorContext();
        
        // 2. Esperar un momento si los datos no están listos
        if (!doctorState.currentUser?.firstName || !doctorState.currentUser?.lastName) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const { state } = await import('../state.js');
            doctorState.currentUser = state.user;
        }
        
        // 3. Cargar datos del doctor
        const doctorData = await loadDoctorData();
        
        // 4. Actualizar header
        updateDoctorHeader(doctorData);
        
        // 5. Inicializar navegación del sidebar
        await initializeSidebarNavigation();
        
        // 6. Inicializar acciones rápidas
        initializeQuickActions();
        
        // 7. Inicializar modal de receta
        initializePrescriptionModal();
        
        // 8. Inicializar funcionalidad de editar perfil
        initializeProfileEditing();
        
        // 9. Inicializar filtro de fecha para historial de consultas
        initializeConsultationDateFilter();
        
        // 10. Cargar estadísticas y datos del dashboard inicial
        await loadDoctorStats();
        await loadTodayConsultationsForDashboard();
        await loadWeeklySchedule();
        
        // 11. Cargar datos periódicamente (cada 30 segundos)
        setInterval(async () => {
            await loadDoctorData();
            await loadDoctorStats();
            await loadTodayConsultationsForDashboard();
            await loadWeeklySchedule();
        }, 30000);
        
        console.log('✅ Panel del doctor inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error en la inicialización del panel del doctor:', error);
        updateDoctorHeader(null);
    }
}

/**
 * Carga las estadísticas del doctor
 */
export async function loadDoctorStats() {
    try {
        const doctorId = doctorState.currentDoctorData?.doctorId;
        if (!doctorId) {
            console.warn('No hay doctorId disponible para cargar estadísticas');
            return;
        }

        const { ApiScheduling } = await import('../api.js');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const todayAppointmentsResponse = await ApiScheduling.get(
            `v1/Appointments?doctorId=${doctorId}&startTime=${today.toISOString()}&endTime=${tomorrow.toISOString()}`
        );
        
        const todayAppointments = todayAppointmentsResponse?.filter(a => {
            const status = a.status || a.Status;
            return status === 'SCHEDULED' || status === 'CONFIRMED' || status === 'IN_PROGRESS';
        }) || [];
        
        const weekAppointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${doctorId}&startTime=${today.toISOString()}&endTime=${nextWeek.toISOString()}`
        );
        
        // Actualizar tarjetas de resumen
        const patientsToday = document.getElementById('patients-today');
        const weeklyAppointments = document.getElementById('weekly-appointments');
        const activeConsultation = document.getElementById('active-consultation');
        const prescriptionsToday = document.getElementById('prescriptions-today');
        
        if (patientsToday) {
            patientsToday.textContent = todayAppointments?.length || 0;
        }
        
        if (weeklyAppointments) {
            weeklyAppointments.textContent = weekAppointments?.length || 0;
        }
        
        const activeConsultations = todayAppointments.filter(a => (a.status || a.Status) === 'IN_PROGRESS');
        if (activeConsultation) {
            activeConsultation.textContent = activeConsultations.length;
        }
        
        // Cargar prescripciones del día
        try {
            const { ApiClinical } = await import('../api.js');
            const prescriptionsResponse = await ApiClinical.get(`v1/Prescription/doctor/${doctorId}`).catch(() => []);
            const todayPrescriptions = Array.isArray(prescriptionsResponse) ? prescriptionsResponse.filter(p => {
                const prescDate = new Date(p.prescriptionDate || p.PrescriptionDate);
                return prescDate >= today && prescDate < tomorrow;
            }) : [];
            
            if (prescriptionsToday) {
                prescriptionsToday.textContent = todayPrescriptions.length;
            }
        } catch (err) {
            if (prescriptionsToday) {
                prescriptionsToday.textContent = '0';
            }
        }
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

/**
 * Carga las consultas del día para el dashboard principal
 */
async function loadTodayConsultationsForDashboard() {
    const consultationsList = document.getElementById('consultations-list');
    if (!consultationsList) return;

    try {
        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
        if (!doctorId) {
            consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudo identificar al médico</p>';
            return;
        }

        const { ApiScheduling } = await import('../api.js');

        // --- FECHAS LOCALES SIN UTC ---
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const formatLocal = (d) =>
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T00:00:00`;

        const startLocal = formatLocal(today);
        const endLocal = formatLocal(tomorrow);
        // --------------------------------

        console.log('📅 Cargando consultas del día para dashboard');

        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${doctorId}&startTime=${startLocal}&endTime=${endLocal}`
        );

        const allAppointments = Array.isArray(appointments) ? appointments : [];

        console.log('✅ Consultas encontradas:', allAppointments.length);

        // Cargar nombres de pacientes
        const { Api } = await import('../api.js');

        for (const apt of allAppointments) {
            if (apt.patientName && apt.patientName.trim() !== '') continue;

            const patientId = apt.patientId || apt.PatientId;
            if (!patientId) {
                apt.patientName = 'Paciente sin ID';
                continue;
            }

            try {
                const patient = await Api.get(`v1/Patient/${patientId}`);
                apt.patientName = `${patient.Name || patient.name || ''} ${patient.lastName || patient.LastName || ''}`.trim() || 'Paciente sin nombre';
            } catch (err) {
                console.warn('Error al cargar paciente:', err);
                apt.patientName = 'Paciente desconocido';
            }
        }

        // --- FILTRO: SOLO CONSULTAS NO COMPLETADAS ---
        const pendingAppointments = allAppointments.filter(apt => {
            const status = apt.status || apt.Status || apt.appointmentStatus || apt.state;
            const s = (status || "").toString().toLowerCase();

            return !(
                s.includes("completed") ||
                s.includes("done") ||
                s.includes("finalizada") ||
                s.includes("cancel") ||
                s.includes("attended")
            );
        });
        // ------------------------------------------------

        // Renderizar lista
        consultationsList.innerHTML = '';

        if (pendingAppointments.length > 0) {
            pendingAppointments.forEach(apt => {
                const consultationItem = createConsultationItemElement(apt);
                consultationsList.appendChild(consultationItem);
            });
        } else {
            const dateStr = today.toLocaleDateString('es-AR', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
            consultationsList.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #6b7280;">
                    <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 1rem; color: #10b981; opacity: 0.5;"></i>
                    <h4 style="margin-bottom: 0.5rem; color: #111827;">¡Todo listo!</h4>
                    <p>No hay consultas pendientes para el ${dateStr}</p>
                </div>
            `;
        }

    } catch (error) {
        console.error('❌ Error al cargar consultas:', error);
        consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudieron cargar las consultas del día</p>';
    }

    // Reinicializar botones de atención
    setTimeout(async () => {
        const { initializeAttendButtons } = await import('./doctor-appointments.js');
        initializeAttendButtons();
    }, 100);
}

/**
 * Carga la agenda semanal para el dashboard principal
 */
/**
 * Carga la agenda semanal para el dashboard principal
 */
async function loadWeeklySchedule() {
    const weeklySchedule = document.getElementById('weekly-schedule');
    if (!weeklySchedule) return;
    
    try {
        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
        if (!doctorId) {
            console.warn('No hay doctorId disponible para cargar agenda');
            weeklySchedule.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudo identificar al médico</p>';
            return;
        }

        const { ApiScheduling } = await import('../api.js');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${doctorId}&startTime=${today.toISOString()}&endTime=${nextWeek.toISOString()}`
        );
        
        weeklySchedule.innerHTML = '';
        
        if (appointments && appointments.length > 0) {
            // Agrupar por día de la semana
            const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const appointmentsByDay = {};
            
            appointments.forEach(apt => {
                const date = new Date(apt.startTime || apt.StartTime);
                const dayOfWeek = date.getDay();
                const dayKey = daysOfWeek[dayOfWeek];
                
                // Crear clave única con la fecha completa
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                
                if (!appointmentsByDay[dateKey]) {
                    appointmentsByDay[dateKey] = {
                        abbreviation: dayKey,
                        dayNumber: date.getDate().toString(),
                        count: 0,
                        date: date,
                        dateStr: dateKey
                    };
                }
                appointmentsByDay[dateKey].count++;
            });
            
            // Mostrar los próximos 7 días
            const scheduleItems = [];
            for (let i = 0; i < 7; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() + i);
                const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const dayKey = daysOfWeek[date.getDay()];
                
                const dayData = appointmentsByDay[dateKey] || {
                    abbreviation: dayKey,
                    dayNumber: date.getDate().toString(),
                    count: 0,
                    date: date,
                    dateStr: dateKey
                };
                scheduleItems.push(dayData);
            }
            
            scheduleItems.forEach(day => {
            const scheduleItem = createScheduleItemElement(day);

            // === Resaltar HOY ===
            const today = new Date();
            const todayStr = today.toISOString().split("T")[0];

            if (day.dateStr === todayStr) {
                scheduleItem.style.border = "2px solid #10b981"; // verde
                scheduleItem.setAttribute("data-is-today", "true");
            }

            weeklySchedule.appendChild(scheduleItem);
        });
            
            // Agregar event listeners a los items de la agenda
            initializeScheduleItemClickHandlers();
        } else {
            weeklySchedule.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No hay agenda disponible</p>';
        }
        
    } catch (error) {
        console.error('Error al cargar agenda:', error);
        weeklySchedule.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudo cargar la agenda</p>';
    }
}

/**
 * Crea el elemento HTML para un día de la agenda
 */
function createScheduleItemElement(day) {
    const item = document.createElement('div');
    item.className = 'schedule-item';
    item.style.cursor = 'pointer';
    item.style.transition = 'all 0.2s ease';
    item.setAttribute('data-date', day.dateStr);
    item.setAttribute('data-day-name', `${day.abbreviation} ${day.dayNumber}`);
    
    // Añadir efecto hover
    item.addEventListener('mouseenter', function() {
        this.style.backgroundColor = '#f0fdf4';
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    });
    
    item.addEventListener('mouseleave', function() {
        this.style.backgroundColor = '';
        this.style.transform = '';
        this.style.boxShadow = '';
    });
    
    item.innerHTML = `
        <div class="schedule-day-badge">
            <span class="day-abbr">${day.abbreviation || ''}</span>
            <span class="day-num">${day.dayNumber || ''}</span>
        </div>
        <span>${day.count || 0} consultas</span>
        <div class="schedule-count-badge">${day.count || 0}</div>
    `;
    
    return item;
}
function highlightTodayInSchedule() {
    const todayItem = document.querySelector('.schedule-item[data-is-today="true"]');
    
    if (todayItem) {
        // Resetear estilos del resto
        document.querySelectorAll('.schedule-item').forEach(si => {
            si.style.border = '';
            si.style.backgroundColor = '';
        });

        // Marcar HOY en verde
        todayItem.style.border = "3px solid #10b981";
        todayItem.style.backgroundColor = "#f0fdf4";
    }
}

/**
 * Inicializa los event handlers para los items de la agenda
 */
function initializeScheduleItemClickHandlers() {
    const scheduleItems = document.querySelectorAll('.schedule-item[data-date]');
    
    scheduleItems.forEach(item => {
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);

        const isToday = newItem.getAttribute("data-is-today") === "true";

        newItem.addEventListener('mouseenter', function() {
            this.style.backgroundColor = '#f0fdf4';
            this.style.transform = 'translateY(-2px)';
            this.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        });
        
        newItem.addEventListener('mouseleave', function() {
            this.style.backgroundColor = '';
            this.style.transform = '';
            this.style.boxShadow = '';
        });

        newItem.addEventListener('click', async function() {
            const dateStr = this.getAttribute('data-date');
            const isTodayClick = this.getAttribute("data-is-today") === "true";

            // Resetear bordes primero
            document.querySelectorAll('.schedule-item').forEach(si => {
                si.style.border = '';
                si.style.backgroundColor = '';
            });

            // Marcar el día clickeado
            this.style.border = "3px solid #10b981";
            this.style.backgroundColor = "#f0fdf4";

            const consultationsList = document.getElementById('consultations-list');

            // === CLIC EN HOY ===
            if (isTodayClick) {
                console.log("📅 Clic en HOY → cargar consultas de hoy");

                if (consultationsList) {
                    consultationsList.innerHTML = `
                        <div style="text-align:center; padding:1.2rem; color:#6b7280;">
                            <i class="fas fa-spinner fa-spin" style="font-size:1.8rem;"></i>
                            <p>Cargando tus consultas de hoy...</p>
                        </div>
                    `;
                }

                await loadTodayConsultationsForDashboard();
                return;
            }

            // === OTRO DÍA ===
            console.log("📅 Cargando consultas para:", dateStr);
            updateConsultationsListTitle(this.getAttribute('data-day-name'), dateStr);
            await loadConsultationsForDate(dateStr);
        });

        // Al cargar la agenda, resaltar HOY
        if (isToday) {
            newItem.style.border = "3px solid #10b981";
        }
    });
}



/**
 * Actualiza el título de la sección de consultas
 */
function updateConsultationsListTitle(dayName, dateStr) {
    // Buscar el título de la sección de consultas
    const consultationsSection = document.querySelector('#consultations-list')?.closest('.dashboard-section');
    if (!consultationsSection) return;
    
    const header = consultationsSection.querySelector('.section-header h3');
    if (header) {
        // Parsear la fecha correctamente usando componentes locales
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        
        // Formatear la fecha en zona horaria local
        const formattedDate = date.toLocaleDateString('es-AR', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        // Capitalizar primera letra
        const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
        
        header.innerHTML = `
            <span style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fas fa-calendar-day" style="color: #10b981;"></i>
                Consultas del ${capitalizedDate}
            </span>
        `;
        
        // Agregar botón para volver a hoy
        let backButton = consultationsSection.querySelector('.back-to-today-btn');
        if (!backButton) {
            backButton = document.createElement('button');
            backButton.className = 'btn btn-secondary btn-sm back-to-today-btn';
            backButton.innerHTML = '<i class="fas fa-arrow-left"></i> Hoy';
            backButton.style.marginLeft = '1rem';
            
            backButton.addEventListener('click', async () => {
                
                // 1️⃣ Limpiar estilos previos de la agenda
                document.querySelectorAll('.schedule-item').forEach(si => {
                    si.style.border = '';
                    si.style.backgroundColor = '';
                });

                // 2️⃣ Marcar día actual en verde
                const todayItem = document.querySelector('.schedule-item[data-is-today="true"]');
                if (todayItem) {
                    todayItem.style.border = "3px solid #10b981";
                    todayItem.style.backgroundColor = "#f0fdf4";
                }

                // 3️⃣ Restaurar título
                header.innerHTML = 'Consultas de Hoy';

                // 4️⃣ Eliminar botón
                backButton.remove();

                // 5️⃣ Cargar consultas del día
                await loadTodayConsultationsForDashboard();
            });
            
            header.parentElement.appendChild(backButton);
        }

    }
}

/**
 * Carga las consultas para una fecha específica
 */

async function loadConsultationsForDate(dateStr) {
    const consultationsList = document.getElementById('consultations-list');
    if (!consultationsList) return;
    // Si recibe HOY por error → no mostrar nada
    const today = new Date().toISOString().split("T")[0];
    if (dateStr === today) {
        console.log("⛔ loadConsultationsForDate recibido HOY → no mostrar nada");
        const consultationsList = document.getElementById('consultations-list');
        if (consultationsList) consultationsList.innerHTML = "";
        return;
    }
    
    try {
        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
        if (!doctorId) {
            consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudo identificar al médico</p>';
            return;
        }
        
        // Mostrar loading
        consultationsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #6b7280;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Cargando consultas...</p>
            </div>
        `;
        
        const { ApiScheduling } = await import('../api.js');
        
        // Parsear la fecha
        const [year, month, day] = dateStr.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        selectedDate.setHours(0, 0, 0, 0);
        
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        console.log('📅 Buscando consultas entre:', selectedDate.toISOString(), 'y', nextDay.toISOString());
        
        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${doctorId}&startTime=${selectedDate.toISOString()}&endTime=${nextDay.toISOString()}`
        );
        // --- DETECCIÓN DE FECHA HOY ---
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [Y, M, D] = dateStr.split('-').map(Number);
        const parsedDate = new Date(Y, M - 1, D);
        parsedDate.setHours(0, 0, 0, 0);

        if (parsedDate.getTime() === today.getTime()) {
            console.log("📅 loadConsultationsForDate recibió HOY → redirigiendo a historial");
            return await loadTodayConsultationsForDashboard();
        }
        // Filtrar consultas completadas, canceladas y no show
        const allAppointments = Array.isArray(appointments) 
            ? appointments.filter(apt => {
                const status = apt.status || apt.Status;
                return status !== 'COMPLETED' && status !== 'CANCELLED' && status !== 'NO_SHOW';
            })
            : [];
        
        console.log('✅ Consultas activas encontradas:', allAppointments.length);
        
        // Cargar nombres de pacientes
        const { Api } = await import('../api.js');
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
            try {
                const patient = await Api.get(`v1/Patient/${patientId}`);
                apt.patientName = `${patient.Name || patient.name || ''} ${patient.lastName || patient.LastName || ''}`.trim() || 'Paciente sin nombre';
            } catch (err) {
                console.warn('Error al cargar paciente:', err);
                apt.patientName = 'Paciente desconocido';
            }
        }
        
        // Renderizar lista
        consultationsList.innerHTML = '';
        
        if (allAppointments && allAppointments.length > 0) {
            allAppointments.forEach(apt => {
                const consultationItem = createConsultationItemElement(apt);
                consultationsList.appendChild(consultationItem);
            });
        } else {
            const formattedDate = selectedDate.toLocaleDateString('es-AR', { 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            });
            consultationsList.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #6b7280;">
                    <i class="fas fa-check-circle" style="font-size: 3rem; margin-bottom: 1rem; color: #10b981; opacity: 0.5;"></i>
                    <h4 style="margin-bottom: 0.5rem; color: #111827;">¡Todo listo!</h4>
                    <p>No hay consultas pendientes para el ${formattedDate}</p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('❌ Error al cargar consultas:', error);
        consultationsList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #ef4444;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Error al cargar las consultas</p>
            </div>
        `;
    }
    
    // Reinicializar botones de atención
    setTimeout(async () => {
        const { initializeAttendButtons } = await import('./doctor-appointments.js');
        initializeAttendButtons();
    }, 100);
}

// Exportar las nuevas funciones
export { loadConsultationsForDate, updateConsultationsListTitle };

// Exportar doctorState
export { doctorState };