// Funcionalidades específicas del panel médico
const DEFAULT_AVATAR_URL = "https://icons.veryicon.com/png/o/internet--web/prejudice/user-128.png";
let currentUser = null;
let currentDoctorData = null;
let autoRefreshInterval = null;
let currentPrescriptionData = null;

document.addEventListener('DOMContentLoaded', async function() {
    await loadDoctorContext();
    initializeDoctorPanel();
    updateDoctorHeader();
    loadDoctorData(); // Cargar datos del backend
});

async function loadDoctorContext() {
    const { state, loadUserFromStorage } = await import('./state.js');
    loadUserFromStorage();

    currentUser = state.user;

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    await ensureDoctorProfile(state.token);
}

async function ensureDoctorProfile(token) {
    const userId = currentUser?.userId;

    if (!token || !userId) {
        return;
    }

    // Verificar si la imagen actual es la por defecto o si no hay datos completos
    const currentImageUrl = currentUser?.imageUrl || '';
    const isDefaultImage = currentImageUrl === DEFAULT_AVATAR_URL || 
                          currentImageUrl.includes('icons.veryicon.com/png/o/internet--web/prejudice/user-128.png') ||
                          !currentImageUrl ||
                          !currentUser?.firstName || 
                          !currentUser?.lastName;

    // Siempre buscar actualización si es imagen por defecto o si faltan datos
    if (isDefaultImage || !currentUser?.firstName || !currentUser?.lastName) {
        try {
            const { getUserById } = await import('./apis/authms.js');
            const profile = await getUserById(userId, token);

            if (profile) {
                const newImageUrl = profile.imageUrl ?? profile.ImageUrl ?? currentUser.imageUrl;
                
                // Solo actualizar si la nueva imagen es diferente de la por defecto o si no teníamos imagen
                const shouldUpdate = newImageUrl !== DEFAULT_AVATAR_URL && 
                                   !newImageUrl.includes('icons.veryicon.com/png/o/internet--web/prejudice/user-128.png') &&
                                   newImageUrl && 
                                   newImageUrl.trim() !== '';

                if (shouldUpdate || !currentUser?.imageUrl || !currentUser?.firstName || !currentUser?.lastName) {
                    currentUser = {
                        ...currentUser,
                        firstName: profile.firstName ?? profile.FirstName ?? currentUser.firstName,
                        lastName: profile.lastName ?? profile.LastName ?? currentUser.lastName,
                        imageUrl: shouldUpdate ? newImageUrl : (currentUser.imageUrl || DEFAULT_AVATAR_URL),
                        email: profile.email ?? profile.Email ?? currentUser.email,
                        role: profile.role ?? profile.Role ?? currentUser.role,
                    };

                    const { state } = await import('./state.js');
                    state.user = currentUser;
                    localStorage.setItem('user', JSON.stringify(currentUser));

                    updateDoctorHeader();
                }
            }
        } catch (error) {
            console.warn('No se pudo sincronizar el perfil del profesional', error);
        }
    } else {
        // Si ya tenemos una imagen personalizada, asegurarnos de que se muestre
        updateDoctorHeader();
    }
}

function getDoctorAvatarUrl() {
    const candidate = currentUser?.imageUrl;
    if (candidate && typeof candidate === 'string' && candidate.trim() && candidate !== 'null' && candidate !== 'undefined') {
        return candidate;
    }
    return DEFAULT_AVATAR_URL;
}

function getDoctorDisplayName(doctorInfo) {
    const info = doctorInfo || {};
    const doctorFirstName = info.firstName ?? info.FirstName ?? currentUser?.firstName;
    const doctorLastName = info.lastName ?? info.LastName ?? currentUser?.lastName;
    const fullName = [doctorFirstName, doctorLastName].filter(Boolean).join(' ').trim();

    if (fullName) {
        return fullName;
    }

    return currentUser?.email || 'Profesional';
}

function updateDoctorHeader(doctorInfo) {
    const displayName = getDoctorDisplayName(doctorInfo);
    const avatarUrl = getDoctorAvatarUrl();

    const welcomeNameElement = document.getElementById('welcome-name');
    const welcomeMessageElement = document.getElementById('welcome-message');
    const userMenuAvatar = document.getElementById('userMenuAvatar');
    const userMenuName = document.getElementById('userMenuName');
    const profileAvatarElement = document.getElementById('profile-avatar');

    if (welcomeNameElement) {
        welcomeNameElement.textContent = `Hola, ${displayName}`;
    }

    if (welcomeMessageElement && !welcomeMessageElement.dataset.custom) {
        welcomeMessageElement.textContent = 'Panel de gestión médica';
    }

    if (userMenuAvatar) {
        userMenuAvatar.src = avatarUrl;
        userMenuAvatar.alt = `Foto de ${displayName}`;
    }

    if (userMenuName) {
        userMenuName.textContent = currentUser?.firstName ? currentUser.firstName : 'Mi cuenta';
    }

    if (profileAvatarElement) {
        profileAvatarElement.src = avatarUrl;
        profileAvatarElement.alt = `Foto de perfil de ${displayName}`;
    }

    updateDoctorProfileSection(doctorInfo);
}

function updateDoctorProfileSection(doctorInfo) {
    const info = doctorInfo || {};
    const profileSection = document.getElementById('doctorProfileSection');
    if (!profileSection) {
        return;
    }

    const displayName = getDoctorDisplayName(info);
    const avatarUrl = getDoctorAvatarUrl();

    const avatarElement = document.getElementById('profile-avatar');
    if (avatarElement) {
        avatarElement.src = avatarUrl;
        avatarElement.alt = `Foto de ${displayName}`;
    }

    const profileName = document.getElementById('profile-name');
    if (profileName) {
        profileName.textContent = displayName ? `Dr. ${displayName}` : 'Profesional';
    }

    const profileSpecialty = document.getElementById('profile-specialty');
    const specialtyValue = info.specialty ?? info.specialtyName ?? info.Specialty ?? 'Especialidad no especificada';
    if (profileSpecialty) {
        profileSpecialty.textContent = specialtyValue;
    }

    const profileLicense = document.getElementById('profile-license');
    if (profileLicense) {
        const license = info.licenseNumber ?? info.matricula ?? info.LicenseNumber ?? '—';
        profileLicense.textContent = `Matrícula: ${license}`;
    }

    const profileEmailInput = document.getElementById('profileEmailInput');
    const profilePhoneInput = document.getElementById('profilePhoneInput');
    const profileLocationInput = document.getElementById('profileLocationInput');
    const profileBioInput = document.getElementById('profileBioInput');

    if (profileEmailInput) {
        profileEmailInput.value = currentUser?.email ?? info.email ?? info.Email ?? '';
    }

    if (profilePhoneInput) {
        profilePhoneInput.value = info.phone ?? info.Phone ?? '';
    }

    if (profileLocationInput) {
        profileLocationInput.value = info.location ?? info.consultory ?? info.Consultory ?? info.office ?? '';
    }

    if (profileBioInput) {
        const bio = info.biography ?? info.Biography ?? '';
        profileBioInput.value = bio;
        profileBioInput.placeholder = 'Comparte tu experiencia, especialidad y enfoque profesional.';
    }
}

function initializeDoctorPanel() {
    // Inicializar navegación del sidebar
    initializeSidebarNavigation();
    
    // Inicializar botones de atención
    initializeAttendButtons();
    
    // Inicializar acciones rápidas
    initializeQuickActions();
    
    // Inicializar modal de receta
    initializePrescriptionModal();
    
    // Cargar datos periódicamente (cada 30 segundos)
    setInterval(() => {
        loadDoctorData();
    }, 30000);
}

// Cargar datos del doctor desde el backend
async function loadDoctorData() {
    try {
        // Importar Api dinámicamente si está disponible
        const { Api } = await import('./api.js');
        
        const doctorId = currentUser?.userId || 1; // Fallback temporal
        const doctor = await Api.get(`v1/Doctor/${doctorId}`);

        currentDoctorData = doctor;
        updateDoctorHeader(doctor);

        // Cargar datos adicionales del doctor (consultas, agenda, etc.)
        await loadTodayConsultations();
        await loadWeeklySchedule();
        await loadDoctorStats();
        
    } catch (error) {
        console.error('Error al cargar datos del doctor:', error);
        // Si hay error, mantener los valores por defecto del HTML
    }
}

// Cargar consultas de hoy
async function loadTodayConsultations() {
    const consultationsList = document.getElementById('consultations-list');
    if (!consultationsList) return;
    
    try {
        const { Api } = await import('./api.js');
        const doctorId = 1;
        const consultations = await Api.get(`v1/Doctor/${doctorId}/TodayConsultations`);
        
        // Limpiar solo la lista de consultas
        consultationsList.innerHTML = '';
        
        if (consultations && consultations.length > 0) {
            consultations.forEach(consultation => {
                const consultationItem = createConsultationItemElement(consultation);
                consultationsList.appendChild(consultationItem);
            });
        } else {
            // Mostrar mensaje si no hay consultas
            consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No hay consultas programadas para hoy</p>';
        }
        
    } catch (error) {
        console.error('Error al cargar consultas:', error);
        // Si falla el backend, mostrar datos de ejemplo
        consultationsList.innerHTML = '';
        
        
        
        exampleConsultations.forEach(consultation => {
            const consultationItem = createConsultationItemElement(consultation);
            consultationsList.appendChild(consultationItem);
        });
    }
    
    // Reinicializar botones de atención después de cargar las consultas
    setTimeout(() => {
        initializeAttendButtons();
    }, 100);
}

// Cargar agenda semanal
async function loadWeeklySchedule() {
    const weeklySchedule = document.getElementById('weekly-schedule');
    if (!weeklySchedule) return;
    
    try {
        const { Api } = await import('./api.js');
        const doctorId = 1;
        const schedule = await Api.get(`v1/Doctor/${doctorId}/WeeklySchedule`);
        
        // Limpiar solo la agenda semanal
        weeklySchedule.innerHTML = '';
        
        if (schedule && schedule.length > 0) {
            schedule.forEach(day => {
                const scheduleItem = createScheduleItemElement(day);
                weeklySchedule.appendChild(scheduleItem);
            });
        } else {
            // Mostrar mensaje si no hay agenda
            weeklySchedule.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No hay agenda disponible</p>';
        }
        
    } catch (error) {
        console.error('Error al cargar agenda:', error);
        // Si falla el backend, mostrar datos de ejemplo
        weeklySchedule.innerHTML = '';
        
        // Datos de ejemplo
        const exampleSchedule = [
            { abbreviation: 'Lun', dayNumber: '11', count: 8 },
            { abbreviation: 'Mar', dayNumber: '12', count: 6 },
            { abbreviation: 'Mié', dayNumber: '13', count: 7 },
            { abbreviation: 'Jue', dayNumber: '14', count: 9 },
            { abbreviation: 'Vie', dayNumber: '15', count: 5 }
        ];
        
        exampleSchedule.forEach(day => {
            const scheduleItem = createScheduleItemElement(day);
            weeklySchedule.appendChild(scheduleItem);
        });
    }
}

// Cargar estadísticas del doctor
async function loadDoctorStats() {
    try {
        const { Api } = await import('./api.js');
        const doctorId = 1;
        const stats = await Api.get(`v1/Doctor/${doctorId}/Stats`);
        
        if (stats) {
            // Actualizar tarjetas de resumen
            const patientsToday = document.getElementById('patients-today');
            const weeklyAppointments = document.getElementById('weekly-appointments');
            const activeConsultation = document.getElementById('active-consultation');
            const prescriptionsToday = document.getElementById('prescriptions-today');
            
            if (patientsToday && stats.patientsToday !== undefined) {
                patientsToday.textContent = stats.patientsToday;
            }
            if (weeklyAppointments && stats.weeklyAppointments !== undefined) {
                weeklyAppointments.textContent = stats.weeklyAppointments;
            }
            if (activeConsultation && stats.activeConsultation !== undefined) {
                activeConsultation.textContent = stats.activeConsultation;
            }
            if (prescriptionsToday && stats.prescriptionsToday !== undefined) {
                prescriptionsToday.textContent = stats.prescriptionsToday;
            }
        }
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        // Mantener valores por defecto del HTML
    }
}

// Crear elemento de consulta
function createConsultationItemElement(consultation) {
    const item = document.createElement('div');
    item.className = 'consultation-item';
    
    const statusClass = consultation.status === 'waiting' ? 'waiting' : 
                       consultation.status === 'in-progress' ? 'in-progress' : 'pending';
    const statusText = consultation.status === 'waiting' ? 'En espera' :
                      consultation.status === 'in-progress' ? 'En curso' : 'Pendiente';
    
    item.innerHTML = `
        <div class="consultation-icon">
            <i class="fas fa-clock"></i>
        </div>
        <div class="consultation-info">
            <h4>${consultation.patientName || 'Paciente Desconocido'}</h4>
            <p>${consultation.type || 'Sin tipo'}</p>
            <span>${consultation.time || ''}</span>
        </div>
        <div class="consultation-actions">
            <span class="status ${statusClass}">${statusText}</span>
            <button class="btn-attend" data-patient="${consultation.patientName || ''}">
                Atender
            </button>
        </div>
    `;
    
    return item;
}

// Crear elemento de agenda semanal
function createScheduleItemElement(day) {
    const item = document.createElement('div');
    item.className = 'schedule-item';
    
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

// Navegación del sidebar
function initializeSidebarNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    
    // Limpiar event listeners previos para evitar duplicados
    navItems.forEach(item => {
        const newItem = item.cloneNode(true);
        item.parentNode.replaceChild(newItem, item);
    });
    
    // Volver a obtener los elementos después de clonar
    const freshNavItems = document.querySelectorAll('.sidebar-nav .nav-item');
    
    freshNavItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Obtener la sección
            const section = this.getAttribute('data-section');
            setActiveNav(section);
            handleSectionNavigation(section);
        });
    });

    setActiveNav('inicio');
    handleSectionNavigation('inicio');
}

function handleSectionNavigation(section) {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    // Eliminar TODAS las secciones dinámicas anteriores primero (importante hacerlo primero)
    const existingAgendas = dashboardContent.querySelectorAll('.agenda-section');
    existingAgendas.forEach(agenda => {
        agenda.remove();
    });
    
    const existingComingSoon = dashboardContent.querySelectorAll('.coming-soon-section');
    existingComingSoon.forEach(comingSoon => {
        comingSoon.remove();
    });

    const mainDashboard = document.getElementById('mainDashboardSection');
    const profileSection = document.getElementById('doctorProfileSection');

    if (mainDashboard) {
        mainDashboard.style.display = 'none';
    }

    if (profileSection) {
        profileSection.style.display = 'none';
        // Mantener la clase hidden por defecto
        profileSection.classList.add('hidden');
    }

    switch (section) {
        case 'inicio':
            if (mainDashboard) {
                mainDashboard.style.display = '';
            }
            break;
        case 'perfil':
            if (profileSection) {
                updateDoctorProfileSection(currentDoctorData);
                profileSection.classList.remove('hidden');
                profileSection.style.display = '';
                setProfileFormEditable(false);
            }
            break;
        case 'consultas':
        case 'agenda':
        case 'historia':
        case 'recetas':
            showComingSoonSectionDoctor(section);
            break;
        default:
            if (mainDashboard) {
                mainDashboard.style.display = '';
            }
    }
}

function setActiveNav(section) {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        const itemSection = item.getAttribute('data-section');
        item.classList.toggle('active', itemSection === section);
    });
}

// Botones de atención
function initializeAttendButtons() {
    const attendButtons = document.querySelectorAll('.attend-btn');
    
    attendButtons.forEach(button => {
        button.addEventListener('click', function() {
            const patientName = this.getAttribute('data-patient');
            attendConsultation(patientName);
        });
    });
}

function attendConsultation(patientName) {
    // Simular inicio de videollamada
    showNotification(`Iniciando consulta con ${patientName}...`);
    
    // Cambiar estado del botón
    const button = document.querySelector(`[data-patient="${patientName}"]`);
    if (button) {
        button.innerHTML = '<i class="fas fa-video"></i> En consulta';
        button.classList.add('in-consultation');
        button.disabled = true;
    }
    
    // Actualizar contador de consultas activas
    updateActiveConsultations(1);
    
    // Simular finalización de consulta después de 5 segundos
    setTimeout(() => {
        finishConsultation(patientName);
    }, 5000);
}

function finishConsultation(patientName) {
    showNotification(`Consulta con ${patientName} finalizada`);
    
    // Restaurar botón
    const button = document.querySelector(`[data-patient="${patientName}"]`);
    if (button) {
        button.innerHTML = '<i class="fas fa-play"></i> Atender';
        button.classList.remove('in-consultation');
        button.disabled = false;
    }
    
    // Actualizar contador
    updateActiveConsultations(-1);
    updatePrescriptionsToday(1);
}

// Acciones rápidas
function initializeQuickActions() {
    const issuePrescriptionBtn = document.getElementById('issue-prescription-btn');
    const viewPatientsBtn = document.getElementById('view-patients-btn');
    const manageScheduleBtn = document.getElementById('manage-schedule-btn');
    
    if (issuePrescriptionBtn) {
        issuePrescriptionBtn.addEventListener('click', function() {
            openPrescriptionModal();
        });
    }
    
    if (viewPatientsBtn) {
        viewPatientsBtn.addEventListener('click', function() {
            showNotification('Cargando lista de pacientes...');
            // Aquí se cargaría la lista de pacientes
        });
    }
    
    if (manageScheduleBtn) {
        manageScheduleBtn.addEventListener('click', function() {
            showNotification('Abriendo gestor de agenda...');
            // Aquí se abriría el gestor de agenda
        });
    }
}

// Modal de receta
function initializePrescriptionModal() {
    const modal = document.getElementById('prescription-modal');
    const closeModal = document.querySelector('.close-modal');
    const cancelBtn = document.getElementById('cancel-prescription');
    const form = document.getElementById('prescription-form');
    
    if (closeModal) {
        closeModal.addEventListener('click', closePrescriptionModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePrescriptionModal);
    }
    
    if (form) {
        form.addEventListener('submit', handlePrescriptionSubmit);
    }
    
    // Cerrar modal al hacer clic fuera
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closePrescriptionModal();
            }
        });
    }
}

function openPrescriptionModal() {
    const modal = document.getElementById('prescription-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Limpiar formulario
        document.getElementById('prescription-form').reset();
    }
}

function closePrescriptionModal() {
    const modal = document.getElementById('prescription-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function handlePrescriptionSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const prescription = {
        patient: formData.get('patient-name'),
        medication: formData.get('medication'),
        dosage: formData.get('dosage'),
        instructions: formData.get('instructions')
    };
    
    // Simular emisión de receta
    showNotification(`Receta emitida para ${prescription.patient}`);
    
    // Actualizar contador
    updatePrescriptionsToday(1);
    
    // Cerrar modal
    closePrescriptionModal();
    
    // Aquí se enviaría la receta al backend
    console.log('Prescripción emitida:', prescription);
}

// Esta función ya no se usa, los datos se cargan desde el backend
// Se mantiene por compatibilidad pero está deprecated
function startDataSimulation() {
    // Ya no se simula, se carga desde el backend
    loadDoctorData();
}

function updateDashboardData() {
    // Ya no se actualiza manualmente, se carga desde el backend
    loadDoctorData();
}

function updateActiveConsultations(change) {
    const activeConsultation = document.getElementById('active-consultation');
    if (activeConsultation) {
        const currentValue = parseInt(activeConsultation.textContent);
        const newValue = Math.max(0, currentValue + change);
        activeConsultation.textContent = newValue;
    }
}

function updatePrescriptionsToday(change) {
    const prescriptionsToday = document.getElementById('prescriptions-today');
    if (prescriptionsToday) {
        const currentValue = parseInt(prescriptionsToday.textContent);
        const newValue = Math.max(0, currentValue + change);
        prescriptionsToday.textContent = newValue;
    }
}

// Sistema de notificaciones
function showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-info-circle"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Agregar estilos si no existen
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.15);
                padding: 1rem;
                z-index: 1001;
                animation: slideIn 0.3s ease-out;
                max-width: 300px;
            }
            
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                color: #1f2937;
            }
            
            .notification-content i {
                color: #2563eb;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            .notification-info {
                border-left: 4px solid #2563eb;
            }
            
            .notification-success {
                border-left: 4px solid #10b981;
            }
            
            .notification-error {
                border-left: 4px solid #dc2626;
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Funciones para manejar eventos de la agenda semanal
function initializeWeeklySchedule() {
    const scheduleItems = document.querySelectorAll('.schedule-item');
    
    scheduleItems.forEach(item => {
        item.addEventListener('click', function() {
            const day = this.querySelector('span:first-of-type').textContent;
            showNotification(`Abriendo agenda del ${day}`);
        });
    });
}

// Inicializar agenda semanal
document.addEventListener('DOMContentLoaded', () => {
    initializeWeeklySchedule();
});

// Cargar agenda completa del doctor
async function loadDoctorAgenda() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    // Eliminar cualquier sección de agenda existente primero
    const existingAgendas = dashboardContent.querySelectorAll('.agenda-section');
    existingAgendas.forEach(agenda => {
        agenda.remove();
    });
    
    // Crear sección de agenda
    const agendaSection = document.createElement('div');
    agendaSection.className = 'agenda-section';
    
    try {
        const { Api } = await import('./api.js');
        const doctorId = 1; // Esto debería venir del localStorage o del estado de autenticación
        
        // Cargar agenda completa desde el backend
        const agendaData = await Api.get(`v1/Doctor/${doctorId}/Agenda`);
        
        agendaSection.innerHTML = `
            <div class="dashboard-section">
                <div class="section-header">
                    <div>
                        <h3>Agenda Médica</h3>
                        <p>Gestión completa de tu agenda</p>
                    </div>
                    <div class="section-header-actions">
                        <button class="btn btn-primary" id="newAppointmentBtn">
                            <i class="fas fa-calendar-plus"></i>
                            Nuevo Turno
                        </button>
                    </div>
                </div>
                <div class="agenda-view" id="agenda-view">
                    ${createAgendaViewHTML(agendaData)}
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error al cargar agenda del doctor:', error);
        
        // Mostrar agenda con datos por defecto si hay error
        agendaSection.innerHTML = `
            <div class="dashboard-section">
                <div class="section-header">
                    <div>
                        <h3>Agenda Médica</h3>
                        <p>Gestión completa de tu agenda</p>
                    </div>
                    <div class="section-header-actions">
                        <button class="btn btn-primary" id="newAppointmentBtn">
                            <i class="fas fa-calendar-plus"></i>
                            Nuevo Turno
                        </button>
                    </div>
                </div>
                <div class="agenda-view" id="agenda-view">
                    ${createAgendaViewHTML(null)}
                </div>
            </div>
        `;
        
        showNotification('Error al cargar la agenda. Mostrando datos de ejemplo.', 'error');
    }
    
    dashboardContent.appendChild(agendaSection);
    
    // Agregar event listeners
    setTimeout(() => {
        const newAppointmentBtn = document.getElementById('newAppointmentBtn');
        if (newAppointmentBtn) {
            newAppointmentBtn.addEventListener('click', function() {
                showNotification('Funcionalidad de nuevo turno en desarrollo', 'info');
            });
        }
        
        // Event listeners para los días de la agenda
        const dayItems = agendaSection.querySelectorAll('.agenda-day-item');
        dayItems.forEach(item => {
            item.addEventListener('click', function() {
                const date = this.getAttribute('data-date');
                showNotification(`Abriendo agenda del ${date}`, 'info');
            });
        });
    }, 100);
}

// Crear HTML de la vista de agenda
function createAgendaViewHTML(agendaData) {
    // Si no hay datos, mostrar agenda de ejemplo
    if (!agendaData || !agendaData.days || agendaData.days.length === 0) {
        const days = [
            { date: 'Lun 11', appointments: 8 },
            { date: 'Mar 12', appointments: 6 },
            { date: 'Mié 13', appointments: 7 },
            { date: 'Jue 14', appointments: 9 },
            { date: 'Vie 15', appointments: 5 },
            { date: 'Sáb 16', appointments: 3 },
            { date: 'Dom 17', appointments: 0 }
        ];
        
        return `
            <div class="agenda-calendar">
                <div class="agenda-calendar-header">
                    <h4>Próximos 7 días</h4>
                </div>
                <div class="agenda-calendar-grid">
                    ${days.map(day => `
                        <div class="agenda-day-item" data-date="${day.date}">
                            <div class="day-header">
                                <span class="day-name">${day.date}</span>
                                <span class="day-count">${day.appointments} turnos</span>
                            </div>
                            <div class="day-details">
                                <i class="fas fa-chevron-right"></i>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    // Si hay datos del backend, generar HTML con esos datos
    return `
        <div class="agenda-calendar">
            <div class="agenda-calendar-header">
                <h4>Próximos 7 días</h4>
            </div>
            <div class="agenda-calendar-grid">
                ${agendaData.days.map(day => `
                    <div class="agenda-day-item" data-date="${day.date}">
                        <div class="day-header">
                            <span class="day-name">${day.date}</span>
                            <span class="day-count">${day.appointments || 0} turnos</span>
                        </div>
                        <div class="day-details">
                            <i class="fas fa-chevron-right"></i>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// Mostrar sección "En construcción" para otras secciones
function showComingSoonSectionDoctor(section) {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    // Eliminar sección coming soon anterior si existe
    const existingComingSoon = dashboardContent.querySelector('.coming-soon-section');
    if (existingComingSoon) {
        existingComingSoon.remove();
    }
    
    // Crear sección coming soon
    const comingSoonSection = document.createElement('div');
    comingSoonSection.className = 'coming-soon-section';
    
    const sectionConfig = {
        'agenda': {
            name: 'Agenda',
            icon: 'fas fa-calendar-alt',
            message: 'Esta funcionalidad se implementará a futuro',
            description: 'Estamos trabajando para brindarte la mejor experiencia. Pronto podrás gestionar tu agenda médica completa desde esta sección.'
        },
        'consultas': {
            name: 'Consultas de Hoy',
            icon: 'fas fa-list',
            message: 'Esta funcionalidad se implementará a futuro',
            description: 'Estamos trabajando para brindarte la mejor experiencia. Pronto podrás gestionar tus consultas del día desde esta sección.'
        },
        'historia': {
            name: 'Historia Clínica',
            icon: 'fas fa-file-medical',
            message: 'Esta funcionalidad se implementará a futuro',
            description: 'Estamos trabajando para brindarte la mejor experiencia. Pronto podrás acceder al historial clínico completo de tus pacientes desde esta sección.'
        },
        'recetas': {
            name: 'Recetas',
            icon: 'fas fa-prescription',
            message: 'Esta funcionalidad se implementará a futuro',
            description: 'Estamos trabajando para brindarte la mejor experiencia. Pronto podrás gestionar y emitir recetas médicas desde esta sección.'
        },
        'configuracion': {
            name: 'Configuración',
            icon: 'fas fa-cog',
            message: 'Esta funcionalidad se implementará a futuro',
            description: 'Estamos trabajando para brindarte la mejor experiencia. Pronto podrás configurar tu perfil y preferencias desde esta sección.'
        }
    };
    
    const config = sectionConfig[section] || {
        name: section,
        icon: 'fas fa-clock',
        message: 'Esta funcionalidad se implementará a futuro',
        description: 'Estamos trabajando para brindarte la mejor experiencia. Esta funcionalidad estará disponible pronto.'
    };
    
    comingSoonSection.innerHTML = `
        <div class="dashboard-section">
            <div class="coming-soon-content">
                <div class="coming-soon-icon">
                    <i class="${config.icon}"></i>
                </div>
                <h2>${config.name}</h2>
                <p class="coming-soon-message">${config.message}</p>
                <p class="coming-soon-description">${config.description}</p>
                <button class="btn btn-primary" id="comingSoonBackBtn">
                    <i class="fas fa-home"></i>
                    Volver al Inicio
                </button>
            </div>
        </div>
    `;
    
    dashboardContent.appendChild(comingSoonSection);
    
    // Agregar event listener al botón
    setTimeout(() => {
        const backBtn = document.getElementById('comingSoonBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                const consultasBtn = document.querySelector('[data-section="consultas"]');
                if (consultasBtn) {
                    consultasBtn.click();
                }
            });
        }
    }, 100);
}

// Estas funciones ahora están implementadas arriba
// Se mantienen por compatibilidad pero están deprecated
function loadDoctorSchedule() {
    // Ya implementada como loadWeeklySchedule()
    loadWeeklySchedule();
}

function loadPatientHistory(patientId) {
    // Placeholder para cargar historial del paciente
    console.log('Cargando historial del paciente:', patientId);
}

function savePrescription(prescriptionData) {
    // Placeholder para guardar receta en el backend
    console.log('Guardando receta:', prescriptionData);
}

function updateConsultationStatus(consultationId, status) {
    // Placeholder para actualizar estado de consulta
    console.log('Actualizando estado de consulta:', consultationId, status);
}

// Exportar funciones para uso global
window.DoctorPanel = {
    attendConsultation,
    finishConsultation,
    openPrescriptionModal,
    closePrescriptionModal,
    showNotification,
    updateDashboardData
};
