// Funcionalidades específicas del panel del paciente
let currentUser = null;
let currentPatient = null;
let autoRefreshInterval = null;
let currentPrescriptionData = null;
let pendingPatientAvatar = null;
const DEFAULT_AVATAR_URL = "https://icons.veryicon.com/png/o/internet--web/prejudice/user-128.png";

function formatDate(value) {
    if (!value) return '';
    let date = value;

    if (typeof value === 'string') {
        // Normalizar string ISO (YYYY-MM-DD o YYYY-MM-DDTHH:mm:ss)
        const normalized = value.replace(/T.*/, '');
        // Crear fecha en formato UTC para evitar problemas de zona horaria
        const [year, month, day] = normalized.split('-');
        if (year && month && day) {
            date = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, parseInt(day)));
        } else {
            date = new Date(normalized);
        }
    }

    if (value instanceof Date) {
        date = value;
    }

    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
        // Si no se pudo parsear, intentar retornar el valor original formateado
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            const [year, month, day] = value.split('-');
            return `${day}/${month}/${year}`;
        }
        return value;
    }

    return date.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function toISODate(displayDate) {
    if (!displayDate) return '';

    // If already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(displayDate)) {
        return displayDate;
    }

    // Attempt to parse dd/mm/yyyy
    const match = displayDate.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (match) {
        const [, day, month, year] = match;
        return `${year}-${month}-${day}`;
    }

    const date = new Date(displayDate);
    if (Number.isNaN(date.getTime())) {
        return '';
    }

    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

document.addEventListener('DOMContentLoaded', async () => {
    await initializePatientPanel();
});

async function initializePatientPanel() {
    await loadUserContext();

    setupUserMenu();
    initializeSidebarNavigation();
    initializeVideoCallButtons();
    initializeScheduleAppointment();
    initializeViewPrescriptionButtons();
    initializeModals();

    updateWelcomeBanner();

    await loadPatientData();
    await loadPatientAppointments();
    await loadPatientHistory();
    await loadPatientStats();

    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    autoRefreshInterval = setInterval(async () => {
        await loadPatientData();
        await loadPatientAppointments();
        await loadPatientStats();
    }, 30000);
}

async function loadUserContext() {
    currentUser = await getAuthenticatedUser();

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    await ensureUserProfile();
}

async function ensureUserProfile() {
    const { state } = await import('./state.js');

    const token = state.token;
    const userId = currentUser?.userId;

    if (!token || !userId) {
        return;
    }

    try {
        const { getUserById } = await import('./apis/authms.js');
        const profile = await getUserById(userId, token);

        if (profile) {
            const newImageUrl = profile.imageUrl ?? profile.ImageUrl ?? currentUser.imageUrl;
            
            // Verificar si la nueva imagen es diferente de la por defecto
            const isDefaultImage = newImageUrl === DEFAULT_AVATAR_URL || 
                                  (newImageUrl && newImageUrl.includes('icons.veryicon.com/png/o/internet--web/prejudice/user-128.png'));
            
            // Si tenemos una imagen nueva que no es la por defecto, o si no teníamos imagen, actualizar
            const shouldUpdateImage = (newImageUrl && !isDefaultImage && newImageUrl.trim() !== '') || 
                                     !currentUser?.imageUrl ||
                                     (currentUser?.imageUrl === DEFAULT_AVATAR_URL || 
                                      (currentUser?.imageUrl && currentUser.imageUrl.includes('icons.veryicon.com/png/o/internet--web/prejudice/user-128.png')));

            const normalizedProfile = {
                firstName: profile.firstName ?? profile.FirstName ?? currentUser.firstName,
                lastName: profile.lastName ?? profile.LastName ?? currentUser.lastName,
                imageUrl: shouldUpdateImage && !isDefaultImage ? newImageUrl : (currentUser.imageUrl || DEFAULT_AVATAR_URL),
                email: profile.email ?? profile.Email ?? currentUser.email,
                role: profile.role ?? profile.Role ?? currentUser.role,
            };

            currentUser = {
                ...currentUser,
                ...normalizedProfile,
            };

            state.user = currentUser;
            localStorage.setItem('user', JSON.stringify(currentUser));

            updateWelcomeBanner();
        }
    } catch (error) {
        console.warn('No se pudo sincronizar el perfil del usuario', error);
    }
}

function getUserAvatarUrl() {
    // Primero verificar si el paciente tiene un avatar
    const patientAvatar = currentPatient?.avatarUrl;
    if (patientAvatar && typeof patientAvatar === 'string' && patientAvatar.trim() && 
        patientAvatar !== 'null' && patientAvatar !== 'undefined' &&
        patientAvatar !== DEFAULT_AVATAR_URL &&
        !patientAvatar.includes('icons.veryicon.com/png/o/internet--web/prejudice/user-128.png')) {
        return patientAvatar;
    }
    
    // Luego verificar si el usuario tiene una imagen personalizada
    const candidate = currentUser?.imageUrl;
    if (candidate && typeof candidate === 'string' && candidate.trim() && 
        candidate !== 'null' && candidate !== 'undefined' &&
        candidate !== DEFAULT_AVATAR_URL &&
        !candidate.includes('icons.veryicon.com/png/o/internet--web/prejudice/user-128.png')) {
        return candidate;
    }
    
    // Si no hay imagen personalizada, usar la por defecto
    return DEFAULT_AVATAR_URL;
}

function getUserDisplayName() {
    if (currentPatient?.name) {
        return currentPatient.name;
    }

    const fullName = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ').trim();

    if (fullName) {
        return fullName;
    }

    return currentUser?.email || 'Paciente';
}

function updateWelcomeBanner() {
    const welcomeNameElement = document.getElementById('welcome-name');
    const welcomeMessageElement = document.getElementById('welcome-message');
    const userMenuAvatar = document.getElementById('userMenuAvatar');
    const userMenuName = document.getElementById('userMenuName');

    const displayName = getUserDisplayName();
    const avatarUrl = getUserAvatarUrl();

    if (welcomeNameElement) {
        welcomeNameElement.textContent = `Hola, ${displayName}`;
    }

    if (welcomeMessageElement && !welcomeMessageElement.dataset.custom) {
        welcomeMessageElement.textContent = 'Aquí está el resumen de tu atención médica';
    }

    if (userMenuAvatar) {
        userMenuAvatar.src = avatarUrl;
        userMenuAvatar.alt = `Foto de ${displayName}`;
    }

    if (userMenuName) {
        userMenuName.textContent = currentUser?.firstName ? currentUser.firstName : 'Mi cuenta';
    }
}

async function getAuthenticatedUser() {
    const { state, loadUserFromStorage } = await import('./state.js');
    loadUserFromStorage();
    return state.user;
}

function setupUserMenu() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            const { logout } = await import('./state.js');
            logout();
            window.location.href = 'login.html';
        });
    }

    updateWelcomeBanner();
}

// Cargar datos del paciente desde el backend
async function loadPatientData() {
    try {
        if (!currentUser) {
            currentUser = await getAuthenticatedUser();
            if (!currentUser) {
                window.location.href = 'login.html';
                return;
            }
        }

        // Siempre cargar el usuario desde AuthMS para obtener la imagen más reciente
        await ensureUserProfile();

        const { Api } = await import('./api.js');
        const patientResponse = await Api.get(`v1/Patient/User/${currentUser.userId}`);
        console.log("Paciente obtenido del backend:", {
            raw: patientResponse,
            dateOfBirth: patientResponse?.dateOfBirth ?? patientResponse?.DateOfBirth,
            birthDate: patientResponse?.birthDate
        });
        currentPatient = normalizePatient(patientResponse);
        console.log("Paciente normalizado:", {
            normalized: currentPatient,
            birthDate: currentPatient?.birthDate
        });

        updateWelcomeBanner();

        const profileSection = document.querySelector('.profile-section');
        if (profileSection && !profileSection.classList.contains('hidden')) {
            loadPatientProfile();
        }

    } catch (error) {
        console.error('Error al cargar datos del paciente:', error);
        showNotification('No pudimos cargar tus datos. Revisa tu conexión e intenta nuevamente.', 'error');
    }
}

// Cargar turnos del paciente
async function loadPatientAppointments() {
    const appointmentsList = document.getElementById('appointments-list');
    if (!appointmentsList) return;

    if (!appointmentsList.dataset.defaultContent) {
        appointmentsList.dataset.defaultContent = appointmentsList.innerHTML;
    }

    try {
        const { Api } = await import('./api.js');
        const patientId = currentPatient?.patientId || currentUser?.userId || 1;
        const appointments = await Api.get(`v1/Patient/${patientId}/Appointments`);

        if (appointments && appointments.length > 0) {
            appointmentsList.innerHTML = '';

            appointments.forEach(appointment => {
                const appointmentCard = createAppointmentCardElement(appointment);
                appointmentsList.appendChild(appointmentCard);
            });

            initializeViewPrescriptionButtons(appointmentsList);
        } else {
            appointmentsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No hay turnos programados</p>';
        }
        
    } catch (error) {
        console.error('Error al cargar turnos:', error);
        if (appointmentsList.dataset.defaultContent) {
            appointmentsList.innerHTML = appointmentsList.dataset.defaultContent;
            initializeViewPrescriptionButtons(appointmentsList);
        }
    }
}

// Cargar historial del paciente
async function loadPatientHistory() {
    try {
        const { Api } = await import('./api.js');
        const patientId = currentPatient?.patientId || currentUser?.userId || 1;
        const history = await Api.get(`v1/Patient/${patientId}/History`);
        
        const historyList = document.getElementById('history-list');
        if (!historyList) return;
        
        // Limpiar solo la lista de historial
        historyList.innerHTML = '';
        
        if (history && history.length > 0) {
            history.forEach(item => {
                const historyItem = createHistoryItemElement(item);
                historyList.appendChild(historyItem);
            });

            initializeViewPrescriptionButtons(historyList);
        } else {
            historyList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No hay historial disponible</p>';
        }
        
    } catch (error) {
        console.error('Error al cargar historial:', error);
        // Mantener HTML por defecto si falla
    }
}

// Cargar estadísticas del paciente
async function loadPatientStats() {
    try {
        const { Api } = await import('./api.js');
        const patientId = currentPatient?.patientId || currentUser?.userId || 1;
        const stats = await Api.get(`v1/Patient/${patientId}/Stats`);
        
        if (stats) {
            // Actualizar tarjetas de resumen
            const confirmedAppointments = document.getElementById('confirmed-appointments');
            const consultationsYear = document.getElementById('consultations-year');
            const activePrescriptions = document.getElementById('active-prescriptions');
            
            if (confirmedAppointments && stats.confirmedAppointments !== undefined) {
                confirmedAppointments.textContent = stats.confirmedAppointments;
            }
            if (consultationsYear && stats.consultationsYear !== undefined) {
                consultationsYear.textContent = stats.consultationsYear;
            }
            if (activePrescriptions && stats.activePrescriptions !== undefined) {
                activePrescriptions.textContent = stats.activePrescriptions;
            }
        }
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        // Mantener valores por defecto del HTML
    }
}

// Crear elemento de tarjeta de turno
function createAppointmentCardElement(appointment) {
    const card = document.createElement('div');
    card.className = 'appointment-card';
    
    const statusClass = appointment.status === 'confirmed' ? 'confirmed' : 'pending';
    const statusText = appointment.status === 'confirmed' ? 'Confirmado' : 'Pendiente';
    const doctorName = appointment.doctorName || appointment.doctor || 'Profesional sin asignar';
    const specialty = appointment.specialty || appointment.reason || 'Consulta general';
    const dateLabel = appointment.date || 'Fecha a confirmar';
    const timeLabel = appointment.time ? ` · ${appointment.time}` : '';
    const locationLabel = appointment.location ? ` · ${appointment.location}` : '';
    const prescriptionKey = appointment.prescriptionId || appointment.prescriptionKey || appointment.date || '';
    const hasPrescription = Boolean(appointment.prescriptionId || appointment.prescriptionKey || appointment.hasPrescription);
    
    card.innerHTML = `
        <div class="appointment-details">
            <div class="appointment-date">${dateLabel}</div>
            <div class="appointment-info">
                <h4>${doctorName}</h4>
                <p>${specialty}</p>
                <span>${dateLabel}${timeLabel}${locationLabel}</span>
            </div>
        </div>
        <div class="appointment-actions">
            <span class="status ${statusClass}">${statusText}</span>
            ${hasPrescription ? `
                <button class="btn btn-secondary btn-view-prescription view-prescription-btn" data-consultation="${prescriptionKey}">
                    <i class="fas fa-file-medical"></i>
                    Ver Receta
                </button>
            ` : ''}
        </div>
    `;
    
    return card;
}

// Crear elemento de historial
function createHistoryItemElement(item) {
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    historyItem.innerHTML = `
        <div class="appointment-icon">
            <i class="fas fa-file-medical"></i>
        </div>
        <div class="history-info">
            <span>${item.date || ''}</span>
            <h4>${item.doctorName || 'Dr. Desconocido'}</h4>
            <p>${item.description || 'Sin descripción'}</p>
        </div>
        <div class="appointment-actions">
            <a href="#" class="btn-view-prescription view-prescription-btn" data-consultation="${item.date || ''}">
                <i class="fas fa-file-medical"></i>
                Ver Receta
            </a>
        </div>
    `;
    
    return historyItem;
}

// Navegación del sidebar
function initializeSidebarNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remover clase active de todos los elementos
            navItems.forEach(navItem => navItem.classList.remove('active'));
            
            // Agregar clase active al elemento clickeado
            this.classList.add('active');
            
            // Obtener la sección
            const section = this.getAttribute('data-section');
            handleSectionNavigation(section);
        });
    });
}

function normalizePatient(rawPatient) {
    if (!rawPatient) return null;

    // Normalizar fecha de nacimiento - puede venir como string ISO o DateOnly
    let birthDate = rawPatient.birthDate ?? rawPatient.dateOfBirth ?? rawPatient.DateOfBirth ?? '';
    if (birthDate) {
        // Si viene como DateOnly de C#, intentar parsearlo
        if (typeof birthDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(birthDate)) {
            birthDate = birthDate.split('T')[0]; // Remover hora si existe
        }
    }

    return {
        patientId: rawPatient.patientId ?? rawPatient.PatientId ?? null,
        name: rawPatient.name ?? rawPatient.firstName ?? rawPatient.Name ?? '',
        lastName: rawPatient.lastName ?? rawPatient.LastName ?? '',
        email: rawPatient.email ?? '',
        phone: rawPatient.phone ?? rawPatient.Phone ?? '',
        dni: (rawPatient.dni ?? rawPatient.Dni ?? '').toString(),
        birthDate: birthDate,
        address: rawPatient.address ?? rawPatient.Address ?? rawPatient.Adress ?? '',
        city: rawPatient.city ?? '',
        postalCode: rawPatient.postalCode ?? '',
        emergencyContact: rawPatient.emergencyContact ?? '',
        emergencyPhone: rawPatient.emergencyPhone ?? '',
        medicalInsurance: rawPatient.medicalInsurance ?? rawPatient.HealthPlan ?? '',
        insuranceNumber: rawPatient.insuranceNumber ?? rawPatient.MembershipNumber ?? '',
        userId: rawPatient.userId ?? rawPatient.UserId ?? null,
        avatarUrl: rawPatient.avatarUrl ?? rawPatient.AvatarUrl ?? rawPatient.imageUrl ?? rawPatient.ImageUrl ?? null,
    };
}

function buildProfileData(patient, user) {
    const defaults = {
        patientId: patient?.patientId ?? null,
        name: 'Paciente',
        lastName: '',
        email: user?.email || 'sin-correo@cuidarmed.com',
        phone: '',
        dni: '',
        birthDate: '',
        address: '',
        city: '',
        postalCode: '',
        emergencyContact: '',
        emergencyPhone: '',
        medicalInsurance: '',
        insuranceNumber: '',
        avatarUrl: patient?.avatarUrl || getUserAvatarUrl(),
    };

    return {
        ...defaults,
        ...patient,
        email: patient?.email || defaults.email,
        birthDate: formatDate(patient?.birthDate) || defaults.birthDate,
        avatarUrl: patient?.avatarUrl || getUserAvatarUrl(),
    };
}

function handleSectionNavigation(section) {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    // Ocultar todas las secciones
    const allSections = dashboardContent.querySelectorAll('.dashboard-section, .welcome-section, .summary-cards');
    allSections.forEach(sec => {
        if (!sec.classList.contains('profile-section')) {
            sec.style.display = 'none';
        }
    });
    
    // Eliminar TODAS las secciones de perfil anteriores si existen (usar querySelectorAll para evitar duplicados)
    const existingProfiles = dashboardContent.querySelectorAll('.profile-section');
    existingProfiles.forEach(profile => {
        profile.remove();
    });
    
    switch(section) {
        case 'inicio':
            // Mostrar sección de inicio
            allSections.forEach(sec => {
                if (!sec.classList.contains('profile-section') && !sec.classList.contains('coming-soon-section')) {
                    sec.style.display = '';
                }
            });
            // Ocultar sección coming soon si existe
            const comingSoon = dashboardContent.querySelector('.coming-soon-section');
            if (comingSoon) {
                comingSoon.remove();
            }
            loadPatientData(); // Recargar datos
            break;
        case 'perfil':
            // Ocultar sección coming soon si existe
            const comingSoonProfile = dashboardContent.querySelector('.coming-soon-section');
            if (comingSoonProfile) {
                comingSoonProfile.remove();
            }
            // Cargar y mostrar perfil
            loadPatientProfile();
            break;
        case 'pagos':
            // Ocultar TODAS las secciones de perfil si existen
            const existingProfilesPagos = dashboardContent.querySelectorAll('.profile-section');
            existingProfilesPagos.forEach(profile => {
                profile.remove();
            });
            // Mostrar página de "En construcción"
            showComingSoonSection('pagos');
            break;
        case 'turnos':
        case 'historial':
            // Ocultar TODAS las secciones de perfil si existen
            const existingProfilesTurnos = dashboardContent.querySelectorAll('.profile-section');
            existingProfilesTurnos.forEach(profile => {
                profile.remove();
            });
            // Mostrar página de "En construcción"
            showComingSoonSection(section);
            break;
        default:
            // Mostrar inicio por defecto
            allSections.forEach(sec => {
                if (!sec.classList.contains('profile-section') && !sec.classList.contains('coming-soon-section')) {
                    sec.style.display = '';
                }
            });
            // Ocultar sección coming soon si existe
            const comingSoonDefault2 = dashboardContent.querySelector('.coming-soon-section');
            if (comingSoonDefault2) {
                comingSoonDefault2.remove();
            }
    }
}

// Botones de videollamada
function initializeVideoCallButtons() {
    const videoCallButtons = document.querySelectorAll('.video-call-btn');
    
    videoCallButtons.forEach(button => {
        button.addEventListener('click', function() {
            const doctorName = this.getAttribute('data-doctor');
            startVideoCall(doctorName);
        });
    });
}

function startVideoCall(doctorName) {
    // Simular inicio de videollamada
    showNotification(`Iniciando videollamada con ${doctorName}...`);
    
    // Cambiar estado del botón
    const button = document.querySelector(`[data-doctor="${doctorName}"]`);
    if (button) {
        button.innerHTML = '<i class="fas fa-video"></i> En llamada';
        button.classList.add('in-call');
        button.disabled = true;
    }
    
    // Simular finalización de llamada después de 10 segundos
    setTimeout(() => {
        endVideoCall(doctorName);
    }, 10000);
}

function endVideoCall(doctorName) {
    showNotification(`Videollamada con ${doctorName} finalizada`);
    
    // Restaurar botón
    const button = document.querySelector(`[data-doctor="${doctorName}"]`);
    if (button) {
        button.innerHTML = '<i class="fas fa-video"></i> Videollamada';
        button.classList.remove('in-call');
        button.disabled = false;
    }
}

// Agendar turno
function initializeScheduleAppointment() {
    const scheduleBtn = document.getElementById('schedule-appointment-btn');
    
    if (scheduleBtn) {
        scheduleBtn.addEventListener('click', function() {
            openAppointmentModal();
        });
    }
}

function openAppointmentModal() {
    const modal = document.getElementById('appointment-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Limpiar formulario
        document.getElementById('appointment-form').reset();
        // Cargar médicos según especialidad
        loadDoctorsBySpecialty();
    }
}

function closeAppointmentModal() {
    const modal = document.getElementById('appointment-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function loadDoctorsBySpecialty() {
    const specialtySelect = document.getElementById('specialty');
    const doctorSelect = document.getElementById('doctor');
    
    const doctorsBySpecialty = {
        'cardiologia': [
            { value: 'dr-maria-gonzalez', text: 'Dr. María González' },
            { value: 'dr-carlos-rodriguez', text: 'Dr. Carlos Rodríguez' }
        ],
        'dermatologia': [
            { value: 'dr-ana-martinez', text: 'Dra. Ana Martínez' },
            { value: 'dr-juan-lopez', text: 'Dr. Juan López' }
        ],
        'traumatologia': [
            { value: 'dr-pedro-garcia', text: 'Dr. Pedro García' },
            { value: 'dr-laura-fernandez', text: 'Dra. Laura Fernández' }
        ],
        'pediatria': [
            { value: 'dr-carmen-ruiz', text: 'Dra. Carmen Ruiz' },
            { value: 'dr-miguel-torres', text: 'Dr. Miguel Torres' }
        ],
        'ginecologia': [
            { value: 'dr-isabel-morales', text: 'Dra. Isabel Morales' },
            { value: 'dr-antonio-vargas', text: 'Dr. Antonio Vargas' }
        ]
    };
    
    if (specialtySelect && doctorSelect) {
        specialtySelect.addEventListener('change', function() {
            const specialty = this.value;
            doctorSelect.innerHTML = '<option value="">Seleccionar médico</option>';
            
            if (doctorsBySpecialty[specialty]) {
                doctorsBySpecialty[specialty].forEach(doctor => {
                    const option = document.createElement('option');
                    option.value = doctor.value;
                    option.textContent = doctor.text;
                    doctorSelect.appendChild(option);
                });
            }
        });
    }
}

// Ver recetas
function initializeViewPrescriptionButtons(root = document) {
    const viewPrescriptionButtons = root.querySelectorAll('.view-prescription-btn');
    
    viewPrescriptionButtons.forEach(button => {
        if (button.dataset.bound === 'true') return;

        button.addEventListener('click', function(event) {
            if (event) {
                event.preventDefault();
            }
            const consultationDate = this.getAttribute('data-consultation');
            viewPrescription(consultationDate);
        });

        button.dataset.bound = 'true';
    });
}

function viewPrescription(consultationDate) {
    const modal = document.getElementById('prescription-modal');
    const content = document.getElementById('prescription-content');
    
    if (modal && content) {
        // Simular contenido de receta
        const prescriptionData = getPrescriptionData(consultationDate);
        currentPrescriptionData = prescriptionData;
        content.innerHTML = generatePrescriptionHTML(prescriptionData);
        
        modal.classList.remove('hidden');
    }
}

function getPrescriptionData(consultationDate) {
    // Simular datos de receta según la fecha
    const prescriptions = {
        '2025-09-20': {
            doctor: 'Dr. Ana Martinez',
            date: '2025-09-20',
            patient: 'Juan Pérez',
            medications: [
                {
                    name: 'Paracetamol 500mg',
                    dosage: '1 comprimido cada 8 horas',
                    instructions: 'Tomar con alimentos. No exceder 4 comprimidos por día.'
                },
                {
                    name: 'Ibuprofeno 400mg',
                    dosage: '1 comprimido cada 12 horas',
                    instructions: 'Tomar con leche. Suspender si hay molestias gástricas.'
                }
            ]
        },
        '2025-08-15': {
            doctor: 'Dr. Juan López',
            date: '2025-08-15',
            patient: 'Juan Pérez',
            medications: [
                {
                    name: 'Cremas hidratantes',
                    dosage: 'Aplicar 2 veces al día',
                    instructions: 'Aplicar en la zona afectada después del baño.'
                }
            ]
        }
    };
    
    return prescriptions[consultationDate] || {
        doctor: 'Dr. Desconocido',
        date: consultationDate,
        patient: 'Juan Pérez',
        medications: []
    };
}

function generatePrescriptionHTML(data) {
    return `
        <div class="prescription-header">
            <h4>Receta Médica</h4>
            <p>Fecha: ${data.date}</p>
        </div>
        
        <div class="prescription-info">
            <div>
                <p><strong>Médico:</strong> ${data.doctor}</p>
                <p><strong>Paciente:</strong> ${data.patient}</p>
            </div>
            <div>
                <p><strong>Fecha de emisión:</strong> ${data.date}</p>
                <p><strong>Válida por:</strong> 30 días</p>
            </div>
        </div>
        
        <div class="medication-list">
            <h5>Medicamentos:</h5>
            ${data.medications && data.medications.length ? data.medications.map(med => `
                <div class="medication-item">
                    <div class="medication-name">${med.name}</div>
                    <div class="medication-details">Dosis: ${med.dosage}</div>
                    <div class="medication-instructions">Instrucciones: ${med.instructions}</div>
                </div>
            `).join('') : '<p class="no-medications">No se registraron medicamentos para esta consulta.</p>'}
        </div>
    `;
}

function closePrescriptionModal() {
    const modal = document.getElementById('prescription-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    currentPrescriptionData = null;
}

// Inicializar modales
function initializeModals() {
    // Modal de agendar turno
    const appointmentModal = document.getElementById('appointment-modal');
    const closeAppointmentModalBtn = document.querySelector('#appointment-modal .close-modal');
    const cancelAppointment = document.getElementById('cancel-appointment');
    const appointmentForm = document.getElementById('appointment-form');
    
    if (closeAppointmentModalBtn) {
        closeAppointmentModalBtn.addEventListener('click', closeAppointmentModal);
    }
    
    if (cancelAppointment) {
        cancelAppointment.addEventListener('click', closeAppointmentModal);
    }
    
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', handleAppointmentSubmit);
    }
    
    // Modal de receta
    const prescriptionModal = document.getElementById('prescription-modal');
    const closePrescriptionModalBtn = document.querySelector('#prescription-modal .close-modal');
    const closePrescription = document.getElementById('close-prescription');
    const downloadPrescription = document.getElementById('download-prescription');
    
    if (closePrescriptionModalBtn) {
        closePrescriptionModalBtn.addEventListener('click', closePrescriptionModal);
    }
    
    if (closePrescription) {
        closePrescription.addEventListener('click', closePrescriptionModal);
    }
    
    if (downloadPrescription) {
        downloadPrescription.addEventListener('click', function() {
            if (!currentPrescriptionData) {
                showNotification('No hay receta disponible para descargar', 'error');
                return;
            }
            downloadPrescriptionFile(currentPrescriptionData);
        });
    }
    
    // Cerrar modales al hacer clic fuera
    [appointmentModal, prescriptionModal].forEach(modal => {
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === modal) {
                    modal.classList.add('hidden');
                }
            });
        }
    });
}

function handleAppointmentSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const appointment = {
        specialty: formData.get('specialty'),
        doctor: formData.get('doctor'),
        date: formData.get('date'),
        time: formData.get('time'),
        reason: formData.get('reason')
    };
    
    // Simular agendamiento
    showNotification('Turno agendado exitosamente');
    
    // Actualizar contador
    updateConfirmedAppointments(1);
    
    // Cerrar modal
    closeAppointmentModal();
    
    // Aquí se enviaría la cita al backend
    console.log('Turno agendado:', appointment);
}

// Esta función ya no se usa, los datos se cargan desde el backend
// Se mantiene por compatibilidad pero está deprecated
function startDataSimulation() {
    // Ya no se simula, se carga desde el backend
    loadPatientData();
}

function updateDashboardData() {
    // Ya no se actualiza manualmente, se carga desde el backend
    loadPatientData();
}

function updateConfirmedAppointments(change) {
    const confirmedAppointments = document.getElementById('confirmed-appointments');
    if (confirmedAppointments) {
        const currentValue = parseInt(confirmedAppointments.textContent);
        const newValue = Math.max(0, currentValue + change);
        confirmedAppointments.textContent = newValue;
    }
}

function downloadPrescriptionFile(data) {
    const lines = [
        `Receta Médica`,
        `Fecha: ${data.date || 'N/D'}`,
        `Paciente: ${data.patient || 'N/D'}`,
        `Profesional: ${data.doctor || 'N/D'}`,
        ``,
        `Medicamentos:`,
        ...(Array.isArray(data.medications) && data.medications.length > 0
            ? data.medications.map((med, index) => `${index + 1}. ${med.name || 'Medicamento'} - Dosis: ${med.dosage || 'N/D'} - Indicaciones: ${med.instructions || 'N/D'}`)
            : ['Sin medicamentos registrados'])
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receta-${data.date || 'sin-fecha'}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('Receta descargada correctamente', 'success');
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

// Funciones para futuras implementaciones con backend
function loadPatientAppointments() {
    // Placeholder para cargar turnos del paciente
    console.log('Cargando turnos del paciente...');
}

function loadPatientHistory() {
    // Placeholder para cargar historial del paciente
    console.log('Cargando historial del paciente...');
}

function scheduleAppointment(appointmentData) {
    // Placeholder para agendar turno en el backend
    console.log('Agendando turno:', appointmentData);
}

function downloadPrescriptionPDF(prescriptionId) {
    // Placeholder para descargar receta en PDF
    console.log('Descargando receta PDF:', prescriptionId);
}

// Cargar perfil del paciente
async function loadPatientProfile() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    // Eliminar TODAS las secciones de perfil existentes primero (importante para evitar duplicados)
    const existingProfiles = dashboardContent.querySelectorAll('.profile-section');
    existingProfiles.forEach(profile => {
        profile.remove();
    });
    
    if (!currentPatient) {
        await loadPatientData();
    }

    const profileData = buildProfileData(currentPatient, currentUser);

    // Crear sección de perfil (con datos del backend o valores por defecto)
    const profileSection = createProfileSection(profileData);
    dashboardContent.appendChild(profileSection);
}

// Crear sección de perfil
function createProfileSection(profileData) {
    const section = document.createElement('div');
    section.className = 'profile-section';
    
    const data = profileData || buildProfileData(null, currentUser);
    
    section.innerHTML = `
        <div class="dashboard-section">
            <div class="section-header">
                <div>
                    <h3>Mi Perfil</h3>
                    <p>Gestiona tu información personal</p>
                </div>
                <div class="section-header-actions">
                    <button class="btn btn-secondary" id="editProfileBtn">
                        <i class="fas fa-edit"></i>
                        Editar Perfil
                    </button>
                </div>
            </div>
            
            <div class="profile-content" id="profileContent">
                ${createProfileViewHTML(data)}
            </div>
        </div>
    `;
    
    // Guardar datos del perfil en el elemento para poder accederlos después
    section.setAttribute('data-patient', JSON.stringify(data));
    
    // Agregar event listener para el botón de editar
    setTimeout(() => {
        const editBtn = section.querySelector('#editProfileBtn');
        if (editBtn) {
            editBtn.addEventListener('click', function() {
                const savedData = JSON.parse(section.getAttribute('data-patient') || '{}');
                toggleProfileEdit(savedData);
            });
        }
    }, 100);
    
    return section;
}

// Crear HTML de vista del perfil
function createProfileViewHTML(patient) {
    return `
        <div class="profile-grid">
            <div class="profile-avatar-card">
                <img src="${patient.avatarUrl}" alt="Foto de perfil" class="profile-avatar-img" />
                <div class="profile-avatar-name">${patient.name} ${patient.lastName}</div>
                <div class="profile-avatar-meta">
                    <span><strong>DNI:</strong> ${patient.dni || '—'}</span>
                    <span><strong>Fecha de nacimiento:</strong> ${patient.birthDate || '—'}</span>
                </div>
            </div>
            <div class="profile-info-group">
                <h4 class="info-group-title">Información Personal</h4>
                <div class="info-item">
                    <span class="info-label">Nombre:</span>
                    <span class="info-value" id="profile-name">${patient.name || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Apellido:</span>
                    <span class="info-value" id="profile-lastName">${patient.lastName || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">DNI:</span>
                    <span class="info-value" id="profile-dni">${patient.dni || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Fecha de Nacimiento:</span>
                    <span class="info-value" id="profile-birthDate">${patient.birthDate || ''}</span>
                </div>
            </div>
            
            <div class="profile-info-group">
                <h4 class="info-group-title">Información de Contacto</h4>
                <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value" id="profile-email">${patient.email || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Teléfono:</span>
                    <span class="info-value" id="profile-phone">${patient.phone || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Dirección:</span>
                    <span class="info-value" id="profile-address">${patient.address || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Ciudad:</span>
                    <span class="info-value" id="profile-city">${patient.city || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Código Postal:</span>
                    <span class="info-value" id="profile-postalCode">${patient.postalCode || ''}</span>
                </div>
            </div>
            
            <div class="profile-info-group">
                <h4 class="info-group-title">Información Médica</h4>
                <div class="info-item">
                    <span class="info-label">Obra Social:</span>
                    <span class="info-value" id="profile-medicalInsurance">${patient.medicalInsurance || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Número de Obra Social:</span>
                    <span class="info-value" id="profile-insuranceNumber">${patient.insuranceNumber || ''}</span>
                </div>
            </div>
            
            <div class="profile-info-group">
                <h4 class="info-group-title">Contacto de Emergencia</h4>
                <div class="info-item">
                    <span class="info-label">Nombre:</span>
                    <span class="info-value" id="profile-emergencyContact">${patient.emergencyContact || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Teléfono:</span>
                    <span class="info-value" id="profile-emergencyPhone">${patient.emergencyPhone || ''}</span>
                </div>
            </div>
        </div>
    `;
}

// Crear HTML de edición del perfil
function createProfileEditHTML(patient) {
    return `
        <form id="profileEditForm" class="profile-edit-form">
            <div class="profile-grid">
                <div class="profile-avatar-card">
                    <img src="${patient.avatarUrl}" alt="Foto de perfil" class="profile-avatar-img" id="profileAvatarPreview" />
                    <button type="button" class="btn btn-secondary" id="profileAvatarTrigger">
                        <i class="fas fa-camera"></i>
                        Cambiar foto
                    </button>
                    <input type="file" id="profileAvatarInput" accept="image/*" hidden>
                    <p class="profile-avatar-hint">* La foto se actualizará al guardar los cambios.</p>
                </div>
                <div class="profile-info-group">
                    <h4 class="info-group-title">Información Personal</h4>
                    <div class="form-group">
                        <label for="edit-name">Nombre:</label>
                        <input type="text" id="edit-name" name="name" value="${patient.name || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-lastName">Apellido:</label>
                        <input type="text" id="edit-lastName" name="lastName" value="${patient.lastName || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-dni">DNI:</label>
                        <input type="text" id="edit-dni" name="dni" value="${patient.dni || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-birthDate">Fecha de Nacimiento:</label>
                        <input type="date" id="edit-birthDate" name="birthDate" value="${toISODate(patient.birthDate) || ''}" required>
                    </div>
                </div>
                
                <div class="profile-info-group">
                    <h4 class="info-group-title">Información de Contacto</h4>
                    <div class="form-group">
                        <label for="edit-email">Email:</label>
                        <input type="email" id="edit-email" name="email" value="${patient.email || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-phone">Teléfono:</label>
                        <input type="tel" id="edit-phone" name="phone" value="${patient.phone || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-address">Dirección:</label>
                        <input type="text" id="edit-address" name="address" value="${patient.address || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-city">Ciudad:</label>
                        <input type="text" id="edit-city" name="city" value="${patient.city || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-postalCode">Código Postal:</label>
                        <input type="text" id="edit-postalCode" name="postalCode" value="${patient.postalCode || ''}" required>
                    </div>
                </div>
                
                <div class="profile-info-group">
                    <h4 class="info-group-title">Información Médica</h4>
                    <div class="form-group">
                        <label for="edit-medicalInsurance">Obra Social:</label>
                        <input type="text" id="edit-medicalInsurance" name="medicalInsurance" value="${patient.medicalInsurance || ''}">
                    </div>
                    <div class="form-group">
                        <label for="edit-insuranceNumber">Número de Obra Social:</label>
                        <input type="text" id="edit-insuranceNumber" name="insuranceNumber" value="${patient.insuranceNumber || ''}">
                    </div>
                </div>
                
                <div class="profile-info-group">
                    <h4 class="info-group-title">Contacto de Emergencia</h4>
                    <div class="form-group">
                        <label for="edit-emergencyContact">Nombre:</label>
                        <input type="text" id="edit-emergencyContact" name="emergencyContact" value="${patient.emergencyContact || ''}" required>
                    </div>
                    <div class="form-group">
                        <label for="edit-emergencyPhone">Teléfono:</label>
                        <input type="tel" id="edit-emergencyPhone" name="emergencyPhone" value="${patient.emergencyPhone || ''}" required>
                    </div>
                </div>
            </div>
            
            <div class="form-actions" style="margin-top: 2rem; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" id="cancelEditBtn">
                    Cancelar
                </button>
                <button type="submit" class="btn btn-primary">
                    <i class="fas fa-save"></i>
                    Guardar Cambios
                </button>
            </div>
        </form>
    `;
}

// Alternar entre vista y edición del perfil
function toggleProfileEdit(patientData) {
    const profileContent = document.getElementById('profileContent');
    const editBtn = document.getElementById('editProfileBtn');
    const profileSection = document.querySelector('.profile-section');
    
    if (!profileContent || !editBtn) return;
    
    const isEditing = profileContent.querySelector('.profile-edit-form');
    
    if (isEditing) {
        // Cambiar a vista
        profileContent.innerHTML = createProfileViewHTML(patientData);
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Editar Perfil';
        editBtn.className = 'btn btn-secondary';
        
        // Actualizar datos guardados
        if (profileSection) {
            profileSection.setAttribute('data-patient', JSON.stringify(patientData));
        }

        pendingPatientAvatar = null;
        
        editBtn.onclick = function() { toggleProfileEdit(patientData); };
    } else {
        // Cambiar a edición
        profileContent.innerHTML = createProfileEditHTML(patientData);
        editBtn.innerHTML = '<i class="fas fa-times"></i> Cancelar';
        editBtn.className = 'btn btn-secondary';
        
        // Agregar event listeners
        const form = document.getElementById('profileEditForm');
        const cancelBtn = document.getElementById('cancelEditBtn');
        
        if (form) {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                await saveProfileChanges(form, patientData);
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', function() {
                pendingPatientAvatar = null;
                toggleProfileEdit(patientData);
            });
        }
        
        setupProfileAvatarEditor(patientData);
        
        editBtn.onclick = function() { toggleProfileEdit(patientData); };
    }
}

// Guardar cambios del perfil
async function saveProfileChanges(form, originalData) {
    try {
        const formData = new FormData(form);
        const birthDateISO = formData.get('birthDate');
        const updatedData = {
            name: formData.get('name'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            dni: formData.get('dni'),
            birthDate: formatDate(birthDateISO),
            address: formData.get('address'),
            city: formData.get('city'),
            postalCode: formData.get('postalCode'),
            medicalInsurance: formData.get('medicalInsurance'),
            insuranceNumber: formData.get('insuranceNumber'),
            emergencyContact: formData.get('emergencyContact'),
            emergencyPhone: formData.get('emergencyPhone')
        };
        
        // Preparar payload para el backend con nombres correctos
        const apiPayload = {
            Name: updatedData.name,
            LastName: updatedData.lastName,
            Dni: parseInt(updatedData.dni, 10) || 0,
            Adress: updatedData.address,
            DateOfBirth: birthDateISO ? birthDateISO.split('T')[0] : null, // Asegurar formato YYYY-MM-DD
            HealthPlan: updatedData.medicalInsurance,
            MembershipNumber: updatedData.insuranceNumber,
        };

        // Enviar al backend (usar PUT para actualizar)
        const { Api } = await import('./api.js');
        const patientId = currentPatient?.patientId;

        // Log para debugging
        console.log("Actualizando perfil del paciente:", {
            patientId,
            birthDateISO,
            DateOfBirth: apiPayload.DateOfBirth,
            payload: apiPayload
        });

        if (!patientId) {
            throw new Error('No se pudo identificar al paciente para actualizar.');
        }

        await Api.patch(`v1/Patient/${patientId}`, apiPayload);
        
        showNotification('Perfil actualizado exitosamente', 'success');
        
        const updatedPatientState = {
            ...currentPatient,
            ...updatedData,
            patientId,
            avatarUrl: pendingPatientAvatar ?? currentPatient?.avatarUrl ?? getUserAvatarUrl(),
        };

        currentPatient = updatedPatientState;

        if (pendingPatientAvatar) {
            currentUser = {
                ...currentUser,
                imageUrl: pendingPatientAvatar,
            };
            const { state } = await import('./state.js');
            state.user = currentUser;
            localStorage.setItem('user', JSON.stringify(currentUser));
        }

        pendingPatientAvatar = null;

        const profileSection = document.querySelector('.profile-section');
        if (profileSection) {
            profileSection.setAttribute('data-patient', JSON.stringify(currentPatient));
        }

        toggleProfileEdit(currentPatient);
        updateWelcomeBanner();
        
    } catch (error) {
        console.error('Error al guardar perfil:', error);
        showNotification('Error al guardar los cambios. Por favor intenta nuevamente.', 'error');
    }
}

// Mostrar sección "En construcción"
function showComingSoonSection(section) {
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
        'pagos': {
            name: 'Pagos',
            icon: 'fas fa-credit-card',
            message: 'Esta funcionalidad se implementará a futuro',
            description: 'Estamos trabajando para brindarte la mejor experiencia. Pronto podrás gestionar tus pagos de manera fácil y segura desde esta plataforma.'
        },
        'turnos': {
            name: 'Mis Turnos',
            icon: 'fas fa-calendar-alt',
            message: 'Esta funcionalidad se implementará a futuro',
            description: 'Estamos trabajando para brindarte la mejor experiencia. Pronto podrás gestionar todos tus turnos médicos desde esta sección.'
        },
        'historial': {
            name: 'Historial Médico',
            icon: 'fas fa-file-medical',
            message: 'Esta funcionalidad se implementará a futuro',
            description: 'Estamos trabajando para brindarte la mejor experiencia. Pronto podrás acceder a todo tu historial médico completo desde esta sección.'
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
                const inicioBtn = document.querySelector('[data-section="inicio"]');
                if (inicioBtn) {
                    inicioBtn.click();
                }
            });
        }
    }, 100);
}

function setupProfileAvatarEditor(patientData) {
    pendingPatientAvatar = null;

    const trigger = document.getElementById('profileAvatarTrigger');
    const input = document.getElementById('profileAvatarInput');
    const preview = document.getElementById('profileAvatarPreview');

    const currentAvatar = patientData?.avatarUrl || getUserAvatarUrl();
    if (preview) {
        preview.src = currentAvatar;
    }

    if (!trigger || !input || !preview) {
        return;
    }

    trigger.addEventListener('click', (event) => {
        event.preventDefault();
        input.click();
    });

    input.addEventListener('change', (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        if (!file.type.startsWith('image/')) {
            showNotification('Seleccioná un archivo de imagen válido.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            pendingPatientAvatar = reader.result;
            preview.src = pendingPatientAvatar;
        };
        reader.onerror = () => {
            showNotification('No pudimos leer la imagen seleccionada.', 'error');
        };
        reader.readAsDataURL(file);
    });
}

// Exportar funciones para uso global
window.PatientPanel = {
    startVideoCall,
    endVideoCall,
    openAppointmentModal,
    closeAppointmentModal,
    viewPrescription,
    closePrescriptionModal,
    showNotification,
    updateDashboardData,
    loadPatientProfile,
    showComingSoonSection
};
