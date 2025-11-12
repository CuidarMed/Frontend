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
    
    // Actualizar el banner inmediatamente con los datos del usuario
    updateWelcomeBanner();

    setupUserMenu();
    initializeSidebarNavigation();
    initializeModals();

    // loadPatientData() actualizará el banner después de cargar los datos del paciente
    await loadPatientData();
    await loadPatientStats();
    await loadPatientAppointments();
    // loadPatientHistory() solo se carga cuando se navega a la sección de historial

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

            // Actualizar el banner después de actualizar el perfil del usuario
            updateWelcomeBanner();
        }
    } catch (error) {
        console.warn('No se pudo sincronizar el perfil del usuario', error);
        // Aún así, intentar actualizar el banner con los datos disponibles
        updateWelcomeBanner();
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
    // Prioridad 1: Nombre completo del paciente (Name + LastName)
    if (currentPatient) {
        const patientFirstName = currentPatient.name ?? currentPatient.firstName ?? '';
        const patientLastName = currentPatient.lastName ?? '';
        const patientFullName = [patientFirstName, patientLastName].filter(Boolean).join(' ').trim();
        
        if (patientFullName) {
            return patientFullName;
        }
    }

    // Prioridad 2: Nombre completo del usuario actual (firstName + lastName)
    const userFirstName = currentUser?.firstName ?? '';
    const userLastName = currentUser?.lastName ?? '';
    const userFullName = [userFirstName, userLastName].filter(Boolean).join(' ').trim();

    if (userFullName) {
        return userFullName;
    }

    // Prioridad 3: Solo el nombre del paciente (sin apellido)
    if (currentPatient?.name) {
        return currentPatient.name;
    }

    // Prioridad 4: Solo el nombre del usuario
    if (currentUser?.firstName) {
        return currentUser.firstName;
    }

    // Último recurso: Email (solo la parte antes del @) o 'Paciente'
    if (currentUser?.email) {
        return currentUser.email.split('@')[0];
    }

    return 'Paciente';
}

function updateWelcomeBanner() {
    const welcomeNameElement = document.getElementById('welcome-name');
    const welcomeMessageElement = document.getElementById('welcome-message');
    const userMenuAvatar = document.getElementById('userMenuAvatar');
    const userMenuName = document.getElementById('userMenuName');

    const displayName = getUserDisplayName();
    const avatarUrl = getUserAvatarUrl();
    
    console.log("=== ACTUALIZANDO BANNER DE BIENVENIDA ===");
    console.log("displayName:", displayName);
    console.log("currentUser:", currentUser);
    console.log("currentPatient:", currentPatient);

    if (welcomeNameElement) {
        const greeting = displayName ? `Hola, ${displayName}` : 'Hola';
        welcomeNameElement.textContent = greeting;
        console.log("Texto actualizado en welcome-name:", greeting);
    } else {
        console.warn("No se encontró el elemento welcome-name");
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
        console.log("=== PACIENTE OBTENIDO DEL BACKEND ===");
        console.log("Respuesta completa (raw):", JSON.stringify(patientResponse, null, 2));
        console.log("HealthPlan (PascalCase):", patientResponse?.HealthPlan);
        console.log("healthPlan (camelCase):", patientResponse?.healthPlan);
        console.log("MembershipNumber (PascalCase):", patientResponse?.MembershipNumber);
        console.log("membershipNumber (camelCase):", patientResponse?.membershipNumber);
        console.log("Todos los campos:", Object.keys(patientResponse || {}));
        
        currentPatient = normalizePatient(patientResponse);
        console.log("=== PACIENTE NORMALIZADO ===");
        console.log("medicalInsurance:", currentPatient?.medicalInsurance);
        console.log("insuranceNumber:", currentPatient?.insuranceNumber);
        console.log("Datos completos normalizados:", JSON.stringify(currentPatient, null, 2));

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

    // Normalizar HealthPlan - puede venir como healthPlan (camelCase) o HealthPlan (PascalCase)
    let healthPlan = rawPatient.healthPlan ?? rawPatient.HealthPlan ?? '';
    // Si está vacío o es solo espacios, usar null
    healthPlan = healthPlan && healthPlan.trim() ? healthPlan.trim() : '';
    
    // Normalizar MembershipNumber - puede venir como membershipNumber (camelCase) o MembershipNumber (PascalCase)
    let membershipNumber = rawPatient.membershipNumber ?? rawPatient.MembershipNumber ?? '';
    // Si está vacío o es solo espacios, usar null
    membershipNumber = membershipNumber && membershipNumber.trim() ? membershipNumber.trim() : '';

    return {
        patientId: rawPatient.patientId ?? rawPatient.PatientId ?? null,
        name: rawPatient.name ?? rawPatient.firstName ?? rawPatient.Name ?? '',
        lastName: rawPatient.lastName ?? rawPatient.LastName ?? '',
        email: rawPatient.email ?? '',
        address: rawPatient.address ?? rawPatient.adress ?? rawPatient.Adress ?? '',
        dni: (rawPatient.dni ?? rawPatient.Dni ?? '').toString(),
        birthDate: birthDate,
        medicalInsurance: healthPlan,
        insuranceNumber: membershipNumber,
        userId: rawPatient.userId ?? rawPatient.UserId ?? null,
    };
}

function buildProfileData(patient, user) {
    const defaults = {
        patientId: patient?.patientId ?? null,
        name: 'Paciente',
        lastName: '',
        email: user?.email || 'sin-correo@cuidarmed.com',
        address: '',
        birthDate: '',
        medicalInsurance: '',
        insuranceNumber: '',
    };

    return {
        ...defaults,
        ...patient,
        email: patient?.email || defaults.email,
        birthDate: formatDate(patient?.birthDate) || defaults.birthDate,
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
            // Ocultar TODAS las secciones de perfil si existen
            const existingProfilesTurnos = dashboardContent.querySelectorAll('.profile-section');
            existingProfilesTurnos.forEach(profile => {
                profile.remove();
            });
            // Mostrar sección de turnos (se cargará dinámicamente)
            const turnosSection = dashboardContent.querySelector('.dashboard-section');
            if (turnosSection) {
                turnosSection.style.display = '';
            }
            break;
        case 'historial':
            // Ocultar TODAS las secciones de perfil si existen
            const existingProfilesHistorial = dashboardContent.querySelectorAll('.profile-section');
            existingProfilesHistorial.forEach(profile => {
                profile.remove();
            });
            // Ocultar todas las secciones excepto historial
            allSections.forEach(sec => {
                if (sec.classList.contains('history-full-section')) {
                    sec.style.display = '';
                } else if (!sec.classList.contains('profile-section') && !sec.classList.contains('coming-soon-section')) {
                    sec.style.display = 'none';
                }
            });
            
            // Crear o mostrar sección completa de historial
            let historyFullSection = dashboardContent.querySelector('.history-full-section');
            if (!historyFullSection) {
                historyFullSection = document.createElement('div');
                historyFullSection.className = 'dashboard-section history-full-section';
                historyFullSection.innerHTML = `
                    <div class="section-header">
                        <div>
                            <h3>Historial Médico Completo</h3>
                            <p>Todas tus consultas realizadas</p>
                        </div>
                    </div>
                    <div class="history-list" id="history-list-full">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Cargando historial médico...</p>
                        </div>
                    </div>
                `;
                dashboardContent.appendChild(historyFullSection);
            } else {
                historyFullSection.style.display = '';
            }
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
                <div class="info-item">
                    <span class="info-label">Dirección:</span>
                    <span class="info-value" id="profile-address">${patient.address || ''}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Email:</span>
                    <span class="info-value" id="profile-email">${patient.email || ''}</span>
                </div>
            </div>
            
            
            
            <div class="profile-info-group">
                <h4 class="info-group-title">Información Médica</h4>
                <div class="info-item">
                    <span class="info-label">Obra Social:</span>
                    <span class="info-value" id="profile-medicalInsurance">${(patient.medicalInsurance && patient.medicalInsurance.trim()) || (patient.healthPlan && patient.healthPlan.trim()) || 'No especificada'}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Número de Afiliado:</span>
                    <span class="info-value" id="profile-insuranceNumber">${(patient.insuranceNumber && patient.insuranceNumber.trim()) || (patient.membershipNumber && patient.membershipNumber.trim()) || 'No especificado'}</span>
                </div>
            </div>
        </div>
    `;
}

// Crear HTML de edición del perfil
function createProfileEditHTML(patient) {
    const currentAvatarUrl = getUserAvatarUrl();

    return `
        <form id="profileEditForm" class="profile-edit-form">
            <div class="profile-avatar-card" style="margin-bottom: 2rem;">
                <img id="profile-avatar-preview" src="${currentAvatarUrl}" alt="Avatar" class="profile-avatar-img">
                <div class="profile-avatar-meta">
                    <span><strong>Foto de Perfil</strong></span>
                    <div class="profile-avatar-hint">
                        <label for="profile-image-url" style="cursor: pointer; color: #2563eb; text-decoration: underline;">
                            <i class="fas fa-image"></i> Cambiar imagen
                        </label>
                        <input type="url" id="profile-image-url" name="imageUrl" 
                               placeholder="https://ejemplo.com/imagen.jpg" 
                               style="display: none;">
                        <input type="text" id="profile-image-url-input" 
                               placeholder="URL de imagen" 
                               style="margin-top: 0.5rem; width: 100%; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 8px;">
                    </div>
                </div>
            </div>

            <div class="profile-grid">

                <div class="profile-info-group">
                    <h4 class="info-group-title">Información Personal</h4>

                    <div class="form-group">
                        <label for="edit-name">Nombre:</label>
                        <input type="text" id="edit-name" name="Name" value="${patient.name || ''}" required>
                    </div>

                    <div class="form-group">
                        <label for="edit-lastName">Apellido:</label>
                        <input type="text" id="edit-lastName" name="LastName" value="${patient.lastName || ''}" required>
                    </div>

                    <div class="form-group">
                        <label for="edit-dni">DNI:</label>
                        <input type="text" id="edit-dni" name="Dni" value="${patient.dni || ''}" required>
                    </div>

                    <div class="form-group">
                        <label for="edit-birthDate">Fecha de Nacimiento:</label>
                        <input type="date" id="edit-birthDate" name="DateOfBirth" value="${toISODate(patient.birthDate) || ''}" required>
                    </div>

                    <div class="form-group">
                        <label for="edit-address">Dirección:</label>
                        <input type="text" id="edit-address" name="Adress" value="${patient.address || ''}" placeholder="Calle y número">
                    </div>

                    <div class="form-group">
                        <label for="edit-email">Email:</label>
                        <input type="email" id="edit-email" name="Email" value="${patient.email || ''}" disabled>
                    </div>
                </div>

                <div class="profile-info-group">
                    <h4 class="info-group-title">Información Médica</h4>

                    <div class="form-group">
                        <label for="edit-HealthPlan">Obra Social:</label>
                        <input type="text" id="edit-HealthPlan" name="HealthPlan" value="${patient.medicalInsurance || ''}">
                    </div>

                    <div class="form-group">
                        <label for="edit-MembershipNumber">Número de Afiliado:</label>
                        <input type="text" id="edit-MembershipNumber" name="MembershipNumber" value="${patient.insuranceNumber || ''}">
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
        profileContent.innerHTML = createProfileViewHTML(patientData);
        editBtn.innerHTML = '<i class="fas fa-edit"></i> Editar Perfil';
        editBtn.className = 'btn btn-secondary';
        if (profileSection) {
            profileSection.setAttribute('data-patient', JSON.stringify(patientData));
        }
        pendingPatientAvatar = null;
    } 
    else {
        profileContent.innerHTML = createProfileEditHTML(patientData);

        editBtn.innerHTML = '<i class="fas fa-times"></i>';
        editBtn.className = 'btn btn-secondary';
        const form = document.getElementById('profileEditForm');
        const cancelBtn = document.getElementById('cancelEditBtn');

        if (form) {
            form.addEventListener('submit', async function (e) {
                e.preventDefault();
                await saveProfileChanges(form, patientData);
            });
        }

        if (cancelBtn) {
            cancelBtn.addEventListener('click', function () {
                pendingPatientAvatar = null;
                toggleProfileEdit(patientData);
            });
        }
        setupProfileAvatarEditor(patientData);
    }
}

// Configurar editor de avatar para el perfil del paciente
function setupProfileAvatarEditor(patientData) {
    const imageUrlInput = document.getElementById('profile-image-url-input');
    const imageUrlHidden = document.getElementById('profile-image-url');
    const avatarPreview = document.getElementById('profile-avatar-preview');
    
    if (!imageUrlInput || !avatarPreview) return;
    
    // Actualizar preview cuando cambie la URL
    imageUrlInput.addEventListener('input', function() {
        const url = imageUrlInput.value.trim();
        if (url) {
            avatarPreview.src = url;
            avatarPreview.onerror = function() {
                // Si falla la carga, usar imagen por defecto
                avatarPreview.src = getUserAvatarUrl();
            };
            if (imageUrlHidden) {
                imageUrlHidden.value = url;
            }
        } else {
            avatarPreview.src = getUserAvatarUrl();
        }
    });
    
    // Guardar la URL en pendingPatientAvatar cuando cambie
    imageUrlInput.addEventListener('blur', function() {
        const url = imageUrlInput.value.trim();
        if (url) {
            pendingPatientAvatar = url;
        } else {
            pendingPatientAvatar = null;
        }
    });
}


// Guardar cambios del perfil
async function saveProfileChanges(form, originalData) {
    try {
        const formData = new FormData(form);
        const birthDateISO = formData.get('DateOfBirth'); // coincide con el name del input
        const updatedData = {
            name: formData.get('Name'),
            lastName: formData.get('LastName'),
            dni: formData.get('Dni'),
            birthDate: birthDateISO ? birthDateISO.split('T')[0] : '', // YYYY-MM-DD
            address: formData.get('Adress'),
            medicalInsurance: formData.get('HealthPlan'),
            insuranceNumber: formData.get('MembershipNumber'),
        };

        // Preparar payload para el backend
        const apiPayload = {
            Name: updatedData.name,
            LastName: updatedData.lastName,
            Dni: parseInt(updatedData.dni, 10) || 0,
            DateOfBirth: updatedData.birthDate,
            Adress: updatedData.address,
            HealthPlan: updatedData.medicalInsurance,
            MembershipNumber: updatedData.insuranceNumber,
        };

        const { Api } = await import('./api.js');
        const patientId = currentPatient?.patientId;
        if (!patientId) throw new Error('No se pudo identificar al paciente para actualizar.');

        await Api.patch(`v1/Patient/${patientId}`, apiPayload);

        showNotification('Perfil actualizado exitosamente', 'success');

        // Actualizar el estado global
        currentPatient = {
            ...currentPatient,
            ...updatedData,
            patientId,
            avatarUrl: pendingPatientAvatar ?? currentPatient?.avatarUrl ?? getUserAvatarUrl(),
        };

        if (pendingPatientAvatar) {
            // Actualizar imagen del usuario en AuthMS
            try {
                const AUTHMS_BASE_URL = "http://localhost:8081/api/v1";
                const userId = currentUser?.userId;
                if (userId) {
                    const updateUserResponse = await fetch(`${AUTHMS_BASE_URL}/User/${userId}`, {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${localStorage.getItem('token') || ''}`,
                        },
                        body: JSON.stringify({
                            FirstName: currentUser.firstName,
                            LastName: currentUser.lastName,
                            Email: currentUser.email,
                            Dni: currentUser.dni,
                            ImageUrl: pendingPatientAvatar,
                        }),
                    });
                    
                    if (updateUserResponse.ok) {
                        console.log('Imagen de usuario actualizada en AuthMS');
                    } else {
                        console.warn('No se pudo actualizar la imagen en AuthMS');
                    }
                }
            } catch (error) {
                console.error('Error al actualizar imagen en AuthMS:', error);
            }
            
            currentUser = {
                ...currentUser,
                imageUrl: pendingPatientAvatar,
            };
            const { state } = await import('./state.js');
            state.user = currentUser;
            localStorage.setItem('user', JSON.stringify(currentUser));
        }
        pendingPatientAvatar = null;

        // Actualizar el HTML con los nuevos datos
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

// Cargar turnos del paciente desde SchedulingMS
async function loadPatientAppointments() {
    try {
        if (!currentPatient?.patientId) {
            console.warn('No hay patientId disponible para cargar turnos');
            return;
        }

        const { ApiScheduling } = await import('./api.js');
        const appointmentsResponse = await ApiScheduling.get(`v1/Appointments?patientId=${currentPatient.patientId}`);
        
        // El API puede devolver un objeto con 'value' o directamente un array
        const appointments = Array.isArray(appointmentsResponse) ? appointmentsResponse : (appointmentsResponse?.value || appointmentsResponse || []);
        
        console.log('=== CARGANDO TURNOS DEL PACIENTE ===');
        console.log('Appointments recibidos:', appointments);
        
        const appointmentsList = document.getElementById('appointments-list');
        if (!appointmentsList) return;

        if (!appointments || appointments.length === 0) {
            appointmentsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No tienes turnos programados</p>
                </div>
            `;
            return;
        }

        // Ordenar turnos por fecha (más próximos primero)
        appointments.sort((a, b) => {
            const dateA = new Date(a.startTime || a.StartTime);
            const dateB = new Date(b.startTime || b.StartTime);
            return dateA - dateB;
        });

        // Agrupar turnos por fecha
        const appointmentsByDate = {};
        appointments.forEach(apt => {
            const startTime = new Date(apt.startTime || apt.StartTime);
            const dateKey = formatDate(startTime);
            if (!appointmentsByDate[dateKey]) {
                appointmentsByDate[dateKey] = [];
            }
            appointmentsByDate[dateKey].push(apt);
        });

        // Renderizar turnos agrupados por fecha
        appointmentsList.innerHTML = Object.keys(appointmentsByDate).map(dateKey => {
            const dayAppointments = appointmentsByDate[dateKey];
            const firstAppointment = dayAppointments[0];
            const startTime = new Date(firstAppointment.startTime || firstAppointment.StartTime);
            const dayOfWeek = startTime.toLocaleDateString('es-AR', { weekday: 'long' });
            const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
            
            return `
                <div class="appointment-day-group">
                    <div class="appointment-day-header">
                        <div class="appointment-day-icon">
                            <i class="fas fa-calendar-day"></i>
                        </div>
                        <div class="appointment-day-info">
                            <h4>${capitalizedDay}</h4>
                            <p>${dateKey}</p>
                        </div>
                    </div>
                    <div class="appointment-day-cards">
                        ${dayAppointments.map(apt => {
                            const aptStartTime = new Date(apt.startTime || apt.StartTime);
                            const aptEndTime = new Date(apt.endTime || apt.EndTime);
                            const status = apt.status || apt.Status || 'SCHEDULED';
                            const reason = apt.reason || apt.Reason || apt.reasonText || apt.ReasonText || null;
                            const displayReason = reason && reason.trim() ? reason.trim() : 'Sin motivo especificado';
                            const appointmentId = apt.appointmentId || apt.AppointmentId;
                            
                            // Mapear estados a español
                            const statusMap = {
                                'SCHEDULED': 'Programado',
                                'CONFIRMED': 'Confirmado',
                                'CANCELLED': 'Cancelado',
                                'COMPLETED': 'Completado',
                                'RESCHEDULED': 'Reprogramado',
                                'NO_SHOW': 'No asistió',
                                'IN_PROGRESS': 'En curso'
                            };
                            const statusText = statusMap[status] || status;
                            
                            const statusClass = status.toLowerCase() === 'confirmed' ? 'confirmed' : 
                                               status.toLowerCase() === 'cancelled' ? 'cancelled' :
                                               status.toLowerCase() === 'completed' ? 'completed' :
                                               status.toLowerCase() === 'scheduled' ? 'scheduled' : 'pending';
                            
                            const canCancel = status === 'CONFIRMED' || status === 'SCHEDULED';
                            
                            return `
                                <div class="appointment-card ${statusClass}">
                                    <div class="appointment-card-header">
                                        <div class="appointment-time-info">
                                            <div class="appointment-time-icon">
                                                <i class="fas fa-clock"></i>
                                            </div>
                                            <div class="appointment-time-text">
                                                <div class="appointment-time-range">
                                                    ${aptStartTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} - ${aptEndTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="appointment-status-badge status-${statusClass}">
                                            <i class="fas ${statusClass === 'confirmed' ? 'fa-check-circle' : 
                                                              statusClass === 'scheduled' ? 'fa-calendar-check' :
                                                              statusClass === 'cancelled' ? 'fa-times-circle' :
                                                              statusClass === 'completed' ? 'fa-check-double' : 'fa-hourglass-half'}"></i>
                                            <span>${statusText}</span>
                                        </div>
                                    </div>
                                    <div class="appointment-card-body">
                                        <div class="appointment-reason-box">
                                            <i class="fas fa-stethoscope"></i>
                                            <div class="appointment-reason-content">
                                                <strong>Motivo de consulta:</strong>
                                                <p>${displayReason}</p>
                                            </div>
                                        </div>
                                    </div>
                                    ${canCancel ? `
                                    <div class="appointment-card-footer">
                                        <button class="btn btn-danger btn-cancel-appointment" onclick="cancelAppointment(${appointmentId})" title="Cancelar este turno">
                                            <i class="fas fa-times-circle"></i>
                                            <span>Cancelar Turno</span>
                                        </button>
                                    </div>
                                    ` : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');

        // Actualizar contador de turnos confirmados
        const confirmedCount = appointments.filter(a => (a.status || a.Status) === 'CONFIRMED').length;
        const confirmedAppointmentsEl = document.getElementById('confirmed-appointments');
        if (confirmedAppointmentsEl) {
            confirmedAppointmentsEl.textContent = confirmedCount;
        }

    } catch (error) {
        console.error('Error al cargar turnos:', error);
        const appointmentsList = document.getElementById('appointments-list');
        if (appointmentsList) {
            appointmentsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No se pudieron cargar los turnos</p>
                </div>
            `;
        }
    }
}

// Cancelar turno
window.cancelAppointment = async function(appointmentId) {
    if (!confirm('¿Estás seguro de que deseas cancelar este turno?')) {
        return;
    }

    try {
        const { ApiScheduling } = await import('./api.js');
        
        // Cancelar el turno usando el endpoint de cancelar
        await ApiScheduling.patch(`v1/Appointments/${appointmentId}/cancel`, {
            reason: 'Cancelado por el paciente'
        });
        
        showNotification('Turno cancelado exitosamente', 'success');
        
        // Recargar la lista de turnos
        await loadPatientAppointments();
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
};

// Cargar historial médico desde ClinicalMS
async function loadPatientHistory() {
    try {
        if (!currentPatient?.patientId) {
            console.warn('No hay patientId disponible para cargar historial');
            return;
        }

        const { ApiClinical, Api } = await import('./api.js');
        const now = new Date();
        const from = new Date(now.getFullYear() - 1, 0, 1); // Hace un año
        const to = now;

        // Obtener encounters desde ClinicalMS
        const encountersResponse = await ApiClinical.get(`v1/Encounter?patientId=${currentPatient.patientId}&from=${from.toISOString()}&to=${to.toISOString()}`);
        const encounters = Array.isArray(encountersResponse) ? encountersResponse : (encountersResponse?.value || []);
        
        // Esta función ya no se usa en la página de inicio
        // Solo funciona si existe el contenedor (que ya no está en el HTML de inicio)
        const historyList = document.getElementById('history-list');
        if (!historyList) {
            // Si no existe el contenedor, no hacer nada
            return;
        }

        if (!encounters || encounters.length === 0) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-medical" style="font-size: 3rem; color: #9ca3af; margin-bottom: 1rem;"></i>
                    <p style="color: #6b7280; font-size: 1.1rem;">No hay historial médico disponible</p>
                    <p style="color: #9ca3af; font-size: 0.9rem; margin-top: 0.5rem;">Tus consultas aparecerán aquí una vez que sean completadas</p>
                </div>
            `;
            
            // Actualizar contador a 0
            const consultationsYearEl = document.getElementById('consultations-year');
            if (consultationsYearEl) {
                consultationsYearEl.textContent = '0';
            }
            return;
        }

        // Obtener información de doctores únicos
        const doctorIds = [...new Set(encounters.map(e => e.doctorId || e.DoctorId).filter(Boolean))];
        const doctorsMap = new Map();
        
        for (const doctorId of doctorIds) {
            try {
                const doctor = await Api.get(`v1/Doctors/${doctorId}`);
                if (doctor) {
                    const fullName = `${doctor.firstName || doctor.FirstName || ''} ${doctor.lastName || doctor.LastName || ''}`.trim();
                    doctorsMap.set(doctorId, fullName || `Dr. ID ${doctorId}`);
                }
            } catch (err) {
                console.warn(`No se pudo obtener información del doctor ${doctorId}:`, err);
                doctorsMap.set(doctorId, `Dr. ID ${doctorId}`);
            }
        }

        // Ordenar por fecha más reciente
        encounters.sort((a, b) => {
            const dateA = new Date(a.date || a.Date || 0);
            const dateB = new Date(b.date || b.Date || 0);
            return dateB - dateA;
        });

        // Renderizar encounters
        historyList.innerHTML = encounters.map(enc => {
            const encounterId = enc.encounterId || enc.EncounterId;
            const date = new Date(enc.date || enc.Date);
            const doctorId = enc.doctorId || enc.DoctorId;
            const doctorName = doctorsMap.get(doctorId) || 'Dr. Sin nombre';
            const reasons = enc.reasons || enc.Reasons || enc.reason || enc.Reason || 'Sin motivo especificado';
            const status = enc.status || enc.Status || 'Pendiente';
            const statusClass = status.toLowerCase() === 'signed' ? 'signed' : status.toLowerCase() === 'open' ? 'open' : 'pending';
            
            // Obtener resumen de la consulta (primeras palabras del Subjective o Assessment)
            const subjective = enc.subjective || enc.Subjective || enc.subjetive || enc.Subjetive || '';
            const assessment = enc.assessment || enc.Assessment || '';
            const summary = assessment || subjective || reasons;
            const summaryText = summary.length > 100 ? summary.substring(0, 100) + '...' : summary;
            
            return `
                <div class="encounter-card" data-encounter-id="${encounterId}">
                    <div class="encounter-header">
                        <div class="encounter-date-info">
                            <div class="encounter-date-icon">
                                <i class="fas fa-calendar-check"></i>
                            </div>
                            <div class="encounter-date-text">
                                <div class="encounter-date">${formatDate(date)}</div>
                                <div class="encounter-time">${formatTime(date)}</div>
                            </div>
                        </div>
                        <div class="encounter-status-badge status-${statusClass}">
                            <i class="fas ${statusClass === 'signed' ? 'fa-check-circle' : statusClass === 'open' ? 'fa-clock' : 'fa-hourglass-half'}"></i>
                            <span>${status === 'SIGNED' ? 'Completada' : status === 'OPEN' ? 'En curso' : 'Pendiente'}</span>
                        </div>
                    </div>
                    <div class="encounter-body">
                        <div class="encounter-doctor">
                            <i class="fas fa-user-md"></i>
                            <span>${doctorName}</span>
                        </div>
                        <div class="encounter-reason">
                            <strong>Motivo:</strong> ${reasons}
                        </div>
                        ${summary ? `
                        <div class="encounter-summary">
                            <p>${summaryText}</p>
                        </div>
                        ` : ''}
                    </div>
                    <div class="encounter-footer">
                        <button class="btn btn-primary btn-view-details" onclick="viewEncounterDetails(${encounterId})">
                            <i class="fas fa-eye"></i> Ver detalles completos
                        </button>
                    </div>
                </div>
            `;
        }).join('');

        // Actualizar contador de consultas del año
        const consultationsYearEl = document.getElementById('consultations-year');
        if (consultationsYearEl) {
            const thisYear = encounters.filter(e => {
                const encDate = new Date(e.date || e.Date);
                return encDate.getFullYear() === now.getFullYear();
            }).length;
            consultationsYearEl.textContent = thisYear;
        }

    } catch (error) {
        console.error('Error al cargar historial médico:', error);
        const historyList = document.getElementById('history-list');
        if (historyList) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                    <p style="color: #6b7280; font-size: 1.1rem;">No se pudo cargar el historial médico</p>
                    <p style="color: #9ca3af; font-size: 0.9rem; margin-top: 0.5rem;">${error.message || 'Error desconocido'}</p>
                </div>
            `;
        }
    }
}

// Función auxiliar para formatear hora
function formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Ver detalles de encuentro
window.viewEncounterDetails = async function(encounterId) {
    try {
        const { ApiClinical, Api } = await import('./api.js');
        const encounter = await ApiClinical.get(`v1/Encounter/${encounterId}`);
        
        if (!encounter) {
            showNotification('No se encontraron los detalles del encuentro', 'error');
            return;
        }

        // Obtener información del doctor
        let doctorName = 'Dr. Sin nombre';
        let doctorSpecialty = '';
        try {
            const doctorId = encounter.doctorId || encounter.DoctorId;
            if (doctorId) {
                const doctor = await Api.get(`v1/Doctors/${doctorId}`);
                if (doctor) {
                    doctorName = `${doctor.firstName || doctor.FirstName || ''} ${doctor.lastName || doctor.LastName || ''}`.trim() || `Dr. ID ${doctorId}`;
                    doctorSpecialty = doctor.specialty || doctor.Specialty || '';
                }
            }
        } catch (err) {
            console.warn('No se pudo obtener información del doctor:', err);
        }

        const encounterDate = new Date(encounter.date || encounter.Date);
        const status = encounter.status || encounter.Status || 'Pendiente';
        const statusClass = status.toLowerCase() === 'signed' ? 'signed' : status.toLowerCase() === 'open' ? 'open' : 'pending';
        const reasons = encounter.reasons || encounter.Reasons || encounter.reason || encounter.Reason || 'Sin motivo especificado';
        const subjective = encounter.subjective || encounter.Subjective || encounter.subjetive || encounter.Subjetive || 'No especificado';
        const objective = encounter.objetive || encounter.Objetive || encounter.objective || encounter.Objective || 'No especificado';
        const assessment = encounter.assessment || encounter.Assessment || 'No especificado';
        const plan = encounter.plan || encounter.Plan || 'No especificado';
        const notes = encounter.notes || encounter.Notes || '';

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content encounter-modal-content">
                <div class="modal-header">
                    <div>
                        <h3>Detalles de la Consulta</h3>
                        <p class="encounter-modal-subtitle">Consulta médica completa</p>
                    </div>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body encounter-modal-body">
                    <!-- Información general -->
                    <div class="encounter-info-section">
                        <div class="encounter-info-header">
                            <i class="fas fa-info-circle"></i>
                            <h4>Información General</h4>
                        </div>
                        <div class="encounter-info-grid">
                            <div class="encounter-info-item">
                                <span class="info-label"><i class="fas fa-calendar"></i> Fecha:</span>
                                <span class="info-value">${formatDate(encounterDate)}</span>
                            </div>
                            <div class="encounter-info-item">
                                <span class="info-label"><i class="fas fa-clock"></i> Hora:</span>
                                <span class="info-value">${formatTime(encounterDate)}</span>
                            </div>
                            <div class="encounter-info-item">
                                <span class="info-label"><i class="fas fa-user-md"></i> Médico:</span>
                                <span class="info-value">${doctorName}</span>
                            </div>
                            ${doctorSpecialty ? `
                            <div class="encounter-info-item">
                                <span class="info-label"><i class="fas fa-stethoscope"></i> Especialidad:</span>
                                <span class="info-value">${doctorSpecialty}</span>
                            </div>
                            ` : ''}
                            <div class="encounter-info-item">
                                <span class="info-label"><i class="fas fa-tag"></i> Estado:</span>
                                <span class="info-value">
                                    <span class="encounter-status-badge status-${statusClass}">
                                        <i class="fas ${statusClass === 'signed' ? 'fa-check-circle' : statusClass === 'open' ? 'fa-clock' : 'fa-hourglass-half'}"></i>
                                        ${status === 'SIGNED' ? 'Completada' : status === 'OPEN' ? 'En curso' : 'Pendiente'}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Motivo de consulta -->
                    <div class="encounter-soap-section">
                        <div class="encounter-soap-header">
                            <i class="fas fa-comment-medical"></i>
                            <h4>Motivo de Consulta</h4>
                        </div>
                        <div class="encounter-soap-content">
                            <p>${reasons}</p>
                        </div>
                    </div>

                    <!-- SOAP -->
                    <div class="encounter-soap-section">
                        <div class="encounter-soap-header">
                            <i class="fas fa-clipboard-list"></i>
                            <h4>Evaluación Clínica (SOAP)</h4>
                        </div>
                        <div class="soap-grid">
                            <div class="soap-item soap-subjective">
                                <div class="soap-item-header">
                                    <i class="fas fa-user"></i>
                                    <h5>S - Subjetivo</h5>
                                </div>
                                <div class="soap-item-content">
                                    <p>${subjective}</p>
                                </div>
                            </div>
                            <div class="soap-item soap-objective">
                                <div class="soap-item-header">
                                    <i class="fas fa-eye"></i>
                                    <h5>O - Objetivo</h5>
                                </div>
                                <div class="soap-item-content">
                                    <p>${objective}</p>
                                </div>
                            </div>
                            <div class="soap-item soap-assessment">
                                <div class="soap-item-header">
                                    <i class="fas fa-diagnoses"></i>
                                    <h5>A - Evaluación</h5>
                                </div>
                                <div class="soap-item-content">
                                    <p>${assessment}</p>
                                </div>
                            </div>
                            <div class="soap-item soap-plan">
                                <div class="soap-item-header">
                                    <i class="fas fa-tasks"></i>
                                    <h5>P - Plan</h5>
                                </div>
                                <div class="soap-item-content">
                                    <p>${plan}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    ${notes ? `
                    <!-- Notas adicionales -->
                    <div class="encounter-soap-section">
                        <div class="encounter-soap-header">
                            <i class="fas fa-sticky-note"></i>
                            <h4>Notas Adicionales</h4>
                        </div>
                        <div class="encounter-soap-content">
                            <p>${notes}</p>
                        </div>
                    </div>
                    ` : ''}
                </div>
                <div class="modal-footer encounter-modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                        <i class="fas fa-times"></i> Cerrar
                    </button>
                    <button class="btn btn-primary" onclick="downloadEncounterPDF(${encounterId})">
                        <i class="fas fa-download"></i> Descargar PDF
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        modal.classList.remove('hidden');
        
        // Cerrar modal
        const closeBtn = modal.querySelector('.close-modal');
        closeBtn.addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

    } catch (error) {
        console.error('Error al cargar detalles del encuentro:', error);
        showNotification('No se pudieron cargar los detalles de la consulta', 'error');
    }
}

// Función para descargar PDF (placeholder)
window.downloadEncounterPDF = function(encounterId) {
    showNotification('La funcionalidad de descarga de PDF estará disponible pronto', 'info');
}

// Inicializar modales
function initializeModals() {
    // Modal de agendar turno
    const appointmentModal = document.getElementById('appointment-modal');
    const newAppointmentBtn = document.getElementById('newAppointment');
    const cancelAppointmentBtn = document.getElementById('cancel-appointment');
    const appointmentForm = document.getElementById('appointment-form');
    const specialtySelect = document.getElementById('specialty');
    const doctorSelect = document.getElementById('doctor');
    const dateInput = document.getElementById('date');
    const timeSelect = document.getElementById('time');

    if (newAppointmentBtn && appointmentModal) {
        newAppointmentBtn.addEventListener('click', () => {
            appointmentModal.classList.remove('hidden');
            loadDoctorsForAppointment();
            // Limpiar campos dependientes
            if (doctorSelect) doctorSelect.innerHTML = '<option value="">Seleccionar médico</option>';
            if (dateInput) dateInput.value = '';
            if (timeSelect) timeSelect.innerHTML = '<option value="">Seleccionar hora</option>';
            
            // Inicializar calendario vacío siempre al abrir el modal
            const customCalendar = document.getElementById('custom-calendar');
            if (customCalendar) {
                // Remover atributo de inicialización para forzar reinicialización
                customCalendar.removeAttribute('data-initialized');
                // Limpiar contenido previo
                customCalendar.innerHTML = '';
                // Inicializar calendario vacío
                initializeEmptyCalendar();
            }
        });
    }

    // Listener para cuando cambia la especialidad
    if (specialtySelect) {
        specialtySelect.addEventListener('change', async (e) => {
            const selectedSpecialty = e.target.value;
            // Limpiar campos dependientes ANTES de cargar doctores
            if (dateInput) dateInput.value = '';
            if (timeSelect) timeSelect.innerHTML = '<option value="">Seleccionar hora</option>';
            
            // Limpiar selección visual del calendario
            const customCalendar = document.getElementById('custom-calendar');
            if (customCalendar) {
                customCalendar.querySelectorAll('.calendar-day-selected').forEach(el => {
                    el.classList.remove('calendar-day-selected');
                });
            }
            
            if (selectedSpecialty) {
                // Cargar doctores filtrados por especialidad (esto ya limpia el select internamente)
                await loadDoctorsForAppointment(selectedSpecialty);
            } else {
                // Si no hay especialidad seleccionada, cargar todos los doctores
                await loadDoctorsForAppointment(null);
            }
        });
    }

    // Listener para cuando cambia el doctor
    if (doctorSelect) {
        doctorSelect.addEventListener('change', async (e) => {
            const selectedDoctorId = e.target.value;
            if (selectedDoctorId) {
                // Limpiar fecha y hora al cambiar de doctor
                const dateInput = document.getElementById('date');
                const timeSelect = document.getElementById('time');
                if (dateInput) dateInput.value = '';
                if (timeSelect) timeSelect.innerHTML = '<option value="">Seleccionar hora</option>';
                
                // Limpiar selección visual del calendario
                const customCalendar = document.getElementById('custom-calendar');
                if (customCalendar) {
                    customCalendar.querySelectorAll('.calendar-day-selected').forEach(el => {
                        el.classList.remove('calendar-day-selected');
                    });
                }
                
                await loadAvailableDatesAndTimes(parseInt(selectedDoctorId));
            } else {
                if (dateInput) dateInput.value = '';
                if (timeSelect) timeSelect.innerHTML = '<option value="">Seleccionar hora</option>';
            }
        });
    }

    // Listener para cuando cambia la fecha
    if (dateInput) {
        dateInput.addEventListener('change', async (e) => {
            const selectedDate = e.target.value;
            const selectedDoctorId = doctorSelect?.value;
            if (selectedDate && selectedDoctorId) {
                await loadAvailableTimes(parseInt(selectedDoctorId), selectedDate);
            } else {
                if (timeSelect) timeSelect.innerHTML = '<option value="">Seleccionar hora</option>';
            }
        });
    }

    if (cancelAppointmentBtn) {
        cancelAppointmentBtn.addEventListener('click', () => {
            if (appointmentModal) appointmentModal.classList.add('hidden');
        });
    }

    if (appointmentModal) {
        appointmentModal.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                appointmentModal.classList.add('hidden');
            });
        });
    }

    if (appointmentForm) {
        appointmentForm.addEventListener('submit', handleAppointmentSubmit);
    }
}

// Cargar doctores para el formulario de turno
async function loadDoctorsForAppointment(selectedSpecialty = null) {
    try {
        const { Api } = await import('./api.js');
        const response = await Api.get('v1/Doctor');
        
        // El API puede devolver un objeto con 'value' o directamente un array
        const doctors = Array.isArray(response) ? response : (response?.value || response || []);
        
        const doctorSelect = document.getElementById('doctor');
        if (!doctorSelect) return;

        doctorSelect.innerHTML = '<option value="">Seleccionar médico</option>';
        
        if (doctors && doctors.length > 0) {
            // Mapeo de especialidades del frontend al backend
            const specialtyMap = {
                'cardiologia': 'Cardiologo',
                'dermatologia': 'Dermatologo',
                'traumatologia': 'Traumatologo', // Nota: puede que no exista en backend
                'pediatria': 'Pediatra',
                'ginecologia': 'Ginecologo', // Nota: puede que no exista en backend
                'neurologia': 'Neurologo'
            };
            
            const backendSpecialty = selectedSpecialty ? specialtyMap[selectedSpecialty.toLowerCase()] : null;
            
            console.log('=== CARGANDO DOCTORES PARA AGENDAR TURNO ===');
            console.log('Especialidad seleccionada (frontend):', selectedSpecialty);
            console.log('Especialidad mapeada (backend):', backendSpecialty);
            console.log('Total de doctores recibidos:', doctors.length);
            
            let doctorsAdded = 0;
            doctors.forEach(doctor => {
                const doctorId = doctor.doctorId || doctor.DoctorId;
                const doctorSpecialty = doctor.specialty || doctor.Specialty || '';
                const firstName = doctor.firstName || doctor.FirstName || '';
                const lastName = doctor.lastName || doctor.LastName || '';
                
                console.log(`Doctor: ${firstName} ${lastName} (ID: ${doctorId}, Specialty: "${doctorSpecialty}")`);
                
                // Si hay una especialidad seleccionada, filtrar por ella
                if (backendSpecialty) {
                    // Comparar sin importar mayúsculas/minúsculas y espacios
                    const normalizedDoctorSpecialty = (doctorSpecialty || '').trim();
                    const normalizedBackendSpecialty = (backendSpecialty || '').trim();
                    
                    if (normalizedDoctorSpecialty.toLowerCase() !== normalizedBackendSpecialty.toLowerCase()) {
                        console.log(`  → Saltado: especialidad "${doctorSpecialty}" no coincide con "${backendSpecialty}"`);
                        return; // Saltar este doctor
                    }
                }
                
                const option = document.createElement('option');
                option.value = doctorId;
                const specialtyText = doctorSpecialty ? ` - ${doctorSpecialty}` : '';
                option.textContent = `Dr. ${firstName} ${lastName}${specialtyText}`;
                doctorSelect.appendChild(option);
                doctorsAdded++;
                console.log(`  → Agregado al dropdown`);
            });
            
            console.log(`Total de doctores agregados: ${doctorsAdded}`);
            
            if (doctorsAdded === 0 && backendSpecialty) {
                showNotification(`No hay médicos disponibles para la especialidad seleccionada`, 'warning');
            }
        }
    } catch (error) {
        console.error('Error al cargar doctores:', error);
        showNotification('No se pudieron cargar los médicos disponibles', 'error');
    }
}

// Cargar fechas y horarios disponibles para un doctor
async function loadAvailableDatesAndTimes(doctorId) {
    try {
        const { ApiScheduling } = await import('./api.js');
        
        // Obtener disponibilidades del doctor
        const availabilitiesResponse = await ApiScheduling.get(`v1/DoctorAvailability/search?doctorId=${doctorId}`);
        // El API puede devolver un objeto con 'value' o directamente un array
        const availabilities = Array.isArray(availabilitiesResponse) ? availabilitiesResponse : (availabilitiesResponse?.value || availabilitiesResponse || []);
        
        console.log('=== CARGANDO DISPONIBILIDADES PARA DOCTOR ===');
        console.log('DoctorId:', doctorId);
        console.log('Disponibilidades recibidas:', availabilities);
        
        if (!availabilities || availabilities.length === 0) {
            showNotification('Este médico no tiene disponibilidades configuradas', 'warning');
            return;
        }

        // Obtener appointments existentes del doctor para las próximas 4 semanas
        const now = new Date();
        const fourWeeksLater = new Date(now.getTime() + 4 * 7 * 24 * 60 * 60 * 1000);
        
        const appointmentsResponse = await ApiScheduling.get(`v1/Appointments?doctorId=${doctorId}&startTime=${now.toISOString()}&endTime=${fourWeeksLater.toISOString()}`);
        // El API puede devolver un objeto con 'value' o directamente un array
        const appointments = Array.isArray(appointmentsResponse) ? appointmentsResponse : (appointmentsResponse?.value || appointmentsResponse || []);
        
        // Calcular fechas disponibles (próximas 4 semanas)
        const availableDates = calculateAvailableDates(availabilities, appointments || [], now, fourWeeksLater);
        
        // Configurar el input de fecha con min y max
        const dateInput = document.getElementById('date');
        if (dateInput) {
            const minDate = now.toISOString().split('T')[0];
            const maxDate = fourWeeksLater.toISOString().split('T')[0];
            dateInput.min = minDate;
            dateInput.max = maxDate;
            dateInput.value = '';
            
            // Guardar fechas disponibles en un atributo data para usar con CSS
            const availableDatesStr = availableDates.map(d => d.toISOString().split('T')[0]).join(',');
            dateInput.setAttribute('data-available-dates', availableDatesStr);
            dateInput.setAttribute('data-has-availability', 'true');
            
            console.log('Fechas disponibles calculadas:', availableDates.map(d => d.toISOString().split('T')[0]));
            
            // Agregar clase para indicar que hay disponibilidades
            dateInput.classList.add('has-availability');
            
            // Crear un indicador visual de fechas disponibles
            updateDateInputIndicator(dateInput, availableDates);
            
            // Inicializar calendario personalizado
            initializeCustomCalendar(dateInput, availableDates);
        }
        
    } catch (error) {
        console.error('Error al cargar disponibilidades:', error);
        showNotification('No se pudieron cargar las disponibilidades del médico', 'error');
    }
}

// Cargar horarios disponibles para una fecha específica
async function loadAvailableTimes(doctorId, selectedDate) {
    try {
        const { ApiScheduling } = await import('./api.js');
        const timeSelect = document.getElementById('time');
        if (!timeSelect) return;

        timeSelect.innerHTML = '<option value="">Seleccionar hora</option>';

        // Obtener disponibilidades del doctor
        const availabilitiesResponse = await ApiScheduling.get(`v1/DoctorAvailability/search?doctorId=${doctorId}`);
        // El API puede devolver un objeto con 'value' o directamente un array
        const availabilities = Array.isArray(availabilitiesResponse) ? availabilitiesResponse : (availabilitiesResponse?.value || availabilitiesResponse || []);
        
        console.log('=== CARGANDO HORARIOS DISPONIBLES ===');
        console.log('DoctorId:', doctorId);
        console.log('Fecha seleccionada:', selectedDate);
        console.log('Disponibilidades recibidas:', availabilities);
        
        if (!availabilities || availabilities.length === 0) {
            return;
        }

        // Obtener el día de la semana de la fecha seleccionada
        const selectedDateObj = new Date(selectedDate + 'T00:00:00');
        const dayOfWeekJS = selectedDateObj.getDay(); // 0 = Domingo, 1 = Lunes, etc.
        // Mapear a WeekDay enum del backend: Monday=1, Tuesday=2, ..., Sunday=7
        const weekDayMap = { 0: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 }; // JS Sunday=0 -> Backend Sunday=7
        const backendDayOfWeek = weekDayMap[dayOfWeekJS];

        // Filtrar disponibilidades para este día de la semana
        const dayAvailabilities = availabilities.filter(av => {
            const avDay = av.dayOfWeek || av.DayOfWeek;
            // El backend puede devolver el número del enum o el nombre
            return avDay === backendDayOfWeek || 
                   avDay === dayOfWeekJS || 
                   (typeof avDay === 'string' && avDay.toLowerCase() === ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeekJS]?.toLowerCase());
        });

        if (dayAvailabilities.length === 0) {
            timeSelect.innerHTML = '<option value="">No hay disponibilidad este día</option>';
            return;
        }

        // Obtener appointments existentes para esta fecha
        const startOfDay = new Date(selectedDate + 'T00:00:00');
        const endOfDay = new Date(selectedDate + 'T23:59:59');
        
        const appointmentsResponse = await ApiScheduling.get(`v1/Appointments?doctorId=${doctorId}&startTime=${startOfDay.toISOString()}&endTime=${endOfDay.toISOString()}`);
        // El API puede devolver un objeto con 'value' o directamente un array
        const appointments = Array.isArray(appointmentsResponse) ? appointmentsResponse : (appointmentsResponse?.value || appointmentsResponse || []);
        
        console.log('Appointments existentes para esta fecha:', appointments);
        
        // Calcular slots disponibles
        const availableSlots = calculateAvailableTimeSlots(dayAvailabilities, appointments || [], selectedDate);
        
        if (availableSlots.length === 0) {
            timeSelect.innerHTML = '<option value="">No hay horarios disponibles</option>';
            return;
        }

        // Llenar el select con los horarios disponibles
        availableSlots.forEach(slot => {
            const option = document.createElement('option');
            
            // Si el slot es un objeto con información local, usarlo
            if (typeof slot === 'object' && slot.isoString) {
                option.value = slot.isoString;
                const hours = String(slot.localHours).padStart(2, '0');
                const minutes = String(slot.localMinutes).padStart(2, '0');
                option.textContent = `${hours}:${minutes}`;
            } else {
                // Fallback: si es un string ISO, parsearlo
                option.value = slot;
                const slotDate = new Date(slot);
                const hours = String(slotDate.getHours()).padStart(2, '0');
                const minutes = String(slotDate.getMinutes()).padStart(2, '0');
                option.textContent = `${hours}:${minutes}`;
            }
            
            timeSelect.appendChild(option);
        });

    } catch (error) {
        console.error('Error al cargar horarios disponibles:', error);
        showNotification('No se pudieron cargar los horarios disponibles', 'error');
    }
}

// Calcular fechas disponibles basándose en las disponibilidades
function calculateAvailableDates(availabilities, appointments, startDate, endDate) {
    const availableDates = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
        const dayOfWeekJS = currentDate.getDay(); // 0 = Domingo, 1 = Lunes, etc.
        // Mapear a WeekDay enum del backend: Monday=1, Tuesday=2, ..., Sunday=7
        const weekDayMap = { 0: 7, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6 }; // JS Sunday=0 -> Backend Sunday=7
        const backendDayOfWeek = weekDayMap[dayOfWeekJS];
        
        // Verificar si hay disponibilidad para este día
        const hasAvailability = availabilities.some(av => {
            const avDay = av.dayOfWeek || av.DayOfWeek;
            const isActive = av.isActive !== false && av.IsActive !== false;
            // El backend puede devolver el número del enum o el nombre
            return isActive && (
                avDay === backendDayOfWeek || 
                avDay === dayOfWeekJS ||
                (typeof avDay === 'string' && avDay.toLowerCase() === ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeekJS]?.toLowerCase())
            );
        });
        
        if (hasAvailability) {
            availableDates.push(new Date(currentDate));
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return availableDates;
}

// Actualizar indicador visual de fechas disponibles
function updateDateInputIndicator(dateInput, availableDates) {
    // Remover indicador anterior si existe
    const existingIndicator = dateInput.parentElement?.querySelector('.available-dates-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    if (!availableDates || availableDates.length === 0) {
        return;
    }
    
    // Crear un indicador visual
    const indicator = document.createElement('div');
    indicator.className = 'available-dates-indicator';
    indicator.innerHTML = `
        <small style="color: #10b981; font-weight: 600; display: flex; align-items: center; gap: 0.25rem; margin-top: 0.25rem;">
            <i class="fas fa-calendar-check" style="font-size: 0.75rem;"></i>
            <span>${availableDates.length} día${availableDates.length !== 1 ? 's' : ''} disponible${availableDates.length !== 1 ? 's' : ''}</span>
        </small>
    `;
    
    // Insertar después del wrapper del date picker
    const wrapper = dateInput.closest('.custom-date-picker-wrapper') || dateInput.parentElement;
    if (wrapper) {
        wrapper.appendChild(indicator);
    }
}

// Inicializar calendario personalizado
function initializeCustomCalendar(dateInput, availableDates) {
    const customCalendar = document.getElementById('custom-calendar');
    
    if (!customCalendar) {
        return;
    }
    
    // Convertir fechas disponibles a strings YYYY-MM-DD para comparación rápida
    const availableDatesSet = new Set(availableDates.map(d => d.toISOString().split('T')[0]));
    
    // Función para renderizar el calendario
    function renderCalendar(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                          'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        
        let html = `
            <div class="custom-calendar-header">
                <button type="button" class="calendar-nav-btn" data-action="prev">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="calendar-month-year">
                    <span>${monthNames[month]} ${year}</span>
                </div>
                <button type="button" class="calendar-nav-btn" data-action="next">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="custom-calendar-weekdays">
                ${dayNames.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
            </div>
            <div class="custom-calendar-days">
        `;
        
        // Días del mes anterior (grises)
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
        
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            html += `<div class="calendar-day calendar-day-other">${day}</div>`;
        }
        
        // Días del mes actual
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isAvailable = availableDatesSet.has(dateStr);
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            const isSelected = dateInput.value === dateStr;
            
            let dayClass = 'calendar-day';
            if (isAvailable) {
                dayClass += ' calendar-day-available';
            } else {
                dayClass += ' calendar-day-unavailable';
            }
            if (isToday) {
                dayClass += ' calendar-day-today';
            }
            if (isSelected) {
                dayClass += ' calendar-day-selected';
            }
            
            html += `<div class="${dayClass}" data-date="${dateStr}" ${isAvailable ? '' : 'style="cursor: not-allowed; opacity: 0.5;"'}>${day}</div>`;
        }
        
        // Días del mes siguiente (grises)
        const remainingDays = 42 - (startingDayOfWeek + daysInMonth);
        for (let day = 1; day <= remainingDays; day++) {
            html += `<div class="calendar-day calendar-day-other">${day}</div>`;
        }
        
        html += '</div>';
        customCalendar.innerHTML = html;
        customCalendar.setAttribute('data-year', year);
        customCalendar.setAttribute('data-month', month);
        
        // Agregar event listeners
        const navButtons = customCalendar.querySelectorAll('.calendar-nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                let newMonth = parseInt(customCalendar.getAttribute('data-month'));
                let newYear = parseInt(customCalendar.getAttribute('data-year'));
                
                if (action === 'prev') {
                    newMonth--;
                    if (newMonth < 0) {
                        newMonth = 11;
                        newYear--;
                    }
                } else {
                    newMonth++;
                    if (newMonth > 11) {
                        newMonth = 0;
                        newYear++;
                    }
                }
                renderCalendar(newYear, newMonth);
            });
        });
        
        // Agregar event listeners a los días disponibles
        const availableDays = customCalendar.querySelectorAll('.calendar-day-available');
        availableDays.forEach(dayEl => {
            dayEl.addEventListener('click', (e) => {
                e.stopPropagation();
                const selectedDate = dayEl.getAttribute('data-date');
                dateInput.value = selectedDate;
                
                // Actualizar selección visual
                customCalendar.querySelectorAll('.calendar-day-selected').forEach(el => {
                    el.classList.remove('calendar-day-selected');
                });
                dayEl.classList.add('calendar-day-selected');
                
                // Cargar horarios disponibles para la fecha seleccionada
                const doctorId = parseInt(document.getElementById('doctor')?.value);
                if (doctorId) {
                    loadAvailableTimes(doctorId, selectedDate);
                }
            });
        });
    }
    
    // Renderizar calendario inicial
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    renderCalendar(currentYear, currentMonth);
    customCalendar.setAttribute('data-initialized', 'true');
}

// Inicializar calendario vacío (sin días disponibles)
function initializeEmptyCalendar() {
    const customCalendar = document.getElementById('custom-calendar');
    const dateInput = document.getElementById('date');
    
    if (!customCalendar || !dateInput) {
        return;
    }
    
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    
    let html = `
        <div class="custom-calendar-header">
            <button type="button" class="calendar-nav-btn" data-action="prev">
                <i class="fas fa-chevron-left"></i>
            </button>
            <div class="calendar-month-year">
                <span>${monthNames[currentMonth]} ${currentYear}</span>
            </div>
            <button type="button" class="calendar-nav-btn" data-action="next">
                <i class="fas fa-chevron-right"></i>
            </button>
        </div>
        <div class="custom-calendar-weekdays">
            ${dayNames.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
        </div>
        <div class="custom-calendar-days">
    `;
    
    // Días del mes anterior
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
    
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        html += `<div class="calendar-day calendar-day-other">${day}</div>`;
    }
    
    // Días del mes actual (todos no disponibles)
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === new Date().toISOString().split('T')[0];
        let dayClass = 'calendar-day calendar-day-unavailable';
        if (isToday) {
            dayClass += ' calendar-day-today';
        }
        html += `<div class="${dayClass}" style="cursor: not-allowed; opacity: 0.5;">${day}</div>`;
    }
    
    // Días del mes siguiente
    const remainingDays = 42 - (startingDayOfWeek + daysInMonth);
    for (let day = 1; day <= remainingDays; day++) {
        html += `<div class="calendar-day calendar-day-other">${day}</div>`;
    }
    
    html += '</div>';
    customCalendar.innerHTML = html;
    customCalendar.setAttribute('data-year', currentYear);
    customCalendar.setAttribute('data-month', currentMonth);
    customCalendar.setAttribute('data-initialized', 'true');
    
    // Función helper para renderizar calendario vacío
    function renderEmptyCalendar(year, month) {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        let navHtml = `
            <div class="custom-calendar-header">
                <button type="button" class="calendar-nav-btn" data-action="prev">
                    <i class="fas fa-chevron-left"></i>
                </button>
                <div class="calendar-month-year">
                    <span>${monthNames[month]} ${year}</span>
                </div>
                <button type="button" class="calendar-nav-btn" data-action="next">
                    <i class="fas fa-chevron-right"></i>
                </button>
            </div>
            <div class="custom-calendar-weekdays">
                ${dayNames.map(day => `<div class="calendar-weekday">${day}</div>`).join('')}
            </div>
            <div class="custom-calendar-days">
        `;
        
        // Días del mes anterior
        const prevMonth = month === 0 ? 11 : month - 1;
        const prevYear = month === 0 ? year - 1 : year;
        const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
        
        for (let i = startingDayOfWeek - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            navHtml += `<div class="calendar-day calendar-day-other">${day}</div>`;
        }
        
        // Días del mes actual (todos no disponibles)
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === new Date().toISOString().split('T')[0];
            let dayClass = 'calendar-day calendar-day-unavailable';
            if (isToday) {
                dayClass += ' calendar-day-today';
            }
            navHtml += `<div class="${dayClass}" style="cursor: not-allowed; opacity: 0.5;">${day}</div>`;
        }
        
        // Días del mes siguiente
        const remainingDays = 42 - (startingDayOfWeek + daysInMonth);
        for (let day = 1; day <= remainingDays; day++) {
            navHtml += `<div class="calendar-day calendar-day-other">${day}</div>`;
        }
        
        navHtml += '</div>';
        customCalendar.innerHTML = navHtml;
        customCalendar.setAttribute('data-year', year);
        customCalendar.setAttribute('data-month', month);
        
        // Agregar event listeners para navegación
        const newNavButtons = customCalendar.querySelectorAll('.calendar-nav-btn');
        newNavButtons.forEach(newBtn => {
            newBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = newBtn.getAttribute('data-action');
                let newMonth = parseInt(customCalendar.getAttribute('data-month'));
                let newYear = parseInt(customCalendar.getAttribute('data-year'));
                
                if (action === 'prev') {
                    newMonth--;
                    if (newMonth < 0) {
                        newMonth = 11;
                        newYear--;
                    }
                } else {
                    newMonth++;
                    if (newMonth > 11) {
                        newMonth = 0;
                        newYear++;
                    }
                }
                
                renderEmptyCalendar(newYear, newMonth);
            });
        });
    }
    
    // Agregar event listeners para navegación
    const navButtons = customCalendar.querySelectorAll('.calendar-nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = btn.getAttribute('data-action');
            let newMonth = parseInt(customCalendar.getAttribute('data-month'));
            let newYear = parseInt(customCalendar.getAttribute('data-year'));
            
            if (action === 'prev') {
                newMonth--;
                if (newMonth < 0) {
                    newMonth = 11;
                    newYear--;
                }
            } else {
                newMonth++;
                if (newMonth > 11) {
                    newMonth = 0;
                    newYear++;
                }
            }
            
            renderEmptyCalendar(newYear, newMonth);
        });
    });
}

// Calcular slots de tiempo disponibles
function calculateAvailableTimeSlots(availabilities, appointments, selectedDate) {
    const slots = [];
    
    availabilities.forEach(av => {
        const startTime = av.startTime || av.StartTime;
        const endTime = av.endTime || av.EndTime;
        const durationMinutes = av.durationMinutes || av.DurationMinutes || 30;
        
        // Convertir TimeSpan a minutos desde medianoche
        const startMinutes = timeSpanToMinutes(startTime);
        const endMinutes = timeSpanToMinutes(endTime);
        
        // Crear fecha base en hora local (sin conversión a UTC)
        // selectedDate viene como "YYYY-MM-DD", crear fecha local
        const [year, month, day] = selectedDate.split('-').map(Number);
        const baseDate = new Date(year, month - 1, day, 0, 0, 0, 0); // Hora local, no UTC
        
        // Generar slots cada durationMinutes
        for (let minutes = startMinutes; minutes + durationMinutes <= endMinutes; minutes += durationMinutes) {
            // Crear fecha/hora local sumando minutos desde medianoche local
            const slotStartLocal = new Date(baseDate);
            slotStartLocal.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
            
            // Crear fecha de fin del slot
            const slotEndLocal = new Date(slotStartLocal);
            slotEndLocal.setMinutes(slotEndLocal.getMinutes() + durationMinutes);
            
            // Verificar si este slot está ocupado
            const isOccupied = appointments.some(apt => {
                const aptStart = new Date(apt.startTime || apt.StartTime);
                const aptEnd = new Date(apt.endTime || apt.EndTime);
                
                // Verificar solapamiento comparando en hora local
                return (slotStartLocal < aptEnd && slotEndLocal > aptStart);
            });
            
            // Solo agregar slots futuros
            const now = new Date();
            if (!isOccupied && slotStartLocal > now) {
                // Guardar el slot con la hora local correcta
                // El ISO string se usará para enviar al backend, pero la hora mostrada
                // será la hora local que el usuario ve (10:00, 10:30, etc.)
                slots.push({
                    isoString: slotStartLocal.toISOString(),
                    localHours: Math.floor(minutes / 60),
                    localMinutes: minutes % 60,
                    date: slotStartLocal
                });
            }
        }
    });
    
    // Ordenar slots por hora local
    slots.sort((a, b) => {
        if (typeof a === 'object' && typeof b === 'object') {
            const timeA = a.localHours * 60 + a.localMinutes;
            const timeB = b.localHours * 60 + b.localMinutes;
            return timeA - timeB;
        }
        // Fallback para strings ISO
        return a.localeCompare(b);
    });
    
    return slots;
}

// Convertir TimeSpan (formato "HH:mm:ss" o objeto) a minutos desde medianoche
function timeSpanToMinutes(timeSpan) {
    if (typeof timeSpan === 'string') {
        const parts = timeSpan.split(':');
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    // Si es un objeto con horas y minutos
    if (timeSpan.hours !== undefined) {
        return timeSpan.hours * 60 + (timeSpan.minutes || 0);
    }
    return 0;
}

// Manejar envío del formulario de turno
async function handleAppointmentSubmit(e) {
    e.preventDefault();
    
    try {
        const doctorId = parseInt(document.getElementById('doctor').value);
        const date = document.getElementById('date').value;
        const timeValue = document.getElementById('time').value;
        const reason = document.getElementById('reason').value;

        if (!doctorId || !date || !timeValue || !reason) {
            showNotification('Por favor completa todos los campos', 'error');
            return;
        }

        if (!currentPatient?.patientId) {
            showNotification('No se pudo identificar al paciente', 'error');
            return;
        }

        // El timeValue ahora es un ISO string completo (viene de calculateAvailableTimeSlots)
        // Este ISO string ya tiene la hora local correcta convertida a UTC
        let startDateTime = new Date(timeValue);
        
        // Asegurar que estamos usando la hora local correcta
        // El ISO string viene en UTC, pero representa la hora local que el usuario seleccionó
        // Por ejemplo, si el usuario selecciona 10:00 local y está en UTC-3,
        // el ISO string será 13:00 UTC, pero cuando se crea el Date y se muestra,
        // JavaScript lo convierte de vuelta a 10:00 local
        
        // Obtener la duración del slot desde las disponibilidades
        const { ApiScheduling } = await import('./api.js');
        const availabilitiesResponse = await ApiScheduling.get(`v1/DoctorAvailability/search?doctorId=${doctorId}`);
        // El API puede devolver un objeto con 'value' o directamente un array
        const availabilities = Array.isArray(availabilitiesResponse) ? availabilitiesResponse : (availabilitiesResponse?.value || availabilitiesResponse || []);
        const durationMinutes = availabilities && availabilities.length > 0 
            ? (availabilities[0].durationMinutes || availabilities[0].DurationMinutes || 30)
            : 30;
        
        const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
        const appointment = await ApiScheduling.post('v1/Appointments', {
            doctorId: doctorId,
            patientId: currentPatient.patientId,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            reason: reason
            // El status se establece automáticamente como SCHEDULED en el backend
        });

        showNotification('Turno agendado exitosamente', 'success');
        
        const appointmentModal = document.getElementById('appointment-modal');
        if (appointmentModal) {
            appointmentModal.classList.add('hidden');
        }
        
        const appointmentForm = document.getElementById('appointment-form');
        if (appointmentForm) {
            appointmentForm.reset();
        }
        await loadPatientAppointments();
        await loadPatientStats();

    } catch (error) {
        console.error('Error al agendar turno:', error);
        showNotification(`Error al agendar turno: ${error.message || 'Error desconocido'}`, 'error');
    }
}

// Cargar historial completo (para la sección dedicada)
async function loadPatientHistoryFull() {
    const historyListFull = document.getElementById('history-list-full');
    if (!historyListFull) {
        // Si no existe el contenedor, esperar un momento y reintentar
        setTimeout(loadPatientHistoryFull, 100);
        return;
    }
    
    try {
        // Mostrar loading mientras se obtiene el patientId
        historyListFull.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Cargando historial médico...</p>
            </div>
        `;
        
        // Si currentPatient no está cargado, intentar cargarlo primero
        if (!currentPatient?.patientId) {
            console.log('currentPatient no está cargado, intentando cargar datos del paciente...');
            
            // Intentar cargar los datos del paciente
            if (!currentUser) {
                currentUser = await getAuthenticatedUser();
                if (!currentUser) {
                    historyListFull.innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                            <p style="color: #6b7280; font-size: 1.1rem;">No se pudo identificar al usuario</p>
                        </div>
                    `;
                    return;
                }
            }
            
            // Cargar datos del paciente
            try {
                const { Api } = await import('./api.js');
                const patientResponse = await Api.get(`v1/Patient/User/${currentUser.userId}`);
                if (patientResponse) {
                    currentPatient = normalizePatient(patientResponse);
                    console.log('currentPatient cargado:', currentPatient);
                }
            } catch (err) {
                console.error('Error al cargar datos del paciente:', err);
            }
        }
        
        // Obtener patientId: primero de currentPatient, luego de currentUser como fallback
        const patientId = currentPatient?.patientId || currentPatient?.PatientId || currentUser?.userId;
        
        if (!patientId) {
            historyListFull.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                    <p style="color: #6b7280; font-size: 1.1rem;">No se pudo identificar al paciente</p>
                    <p style="color: #9ca3af; font-size: 0.9rem; margin-top: 0.5rem;">Por favor, recarga la página</p>
                </div>
            `;
            return;
        }

        const { ApiClinical, Api } = await import('./api.js');
        const now = new Date();
        const from = new Date(now.getFullYear() - 5, 0, 1); // Últimos 5 años
        const to = now;

        // Obtener encounters desde ClinicalMS usando el patientId obtenido
        console.log('=== CARGANDO HISTORIAL MÉDICO ===');
        console.log('patientId:', patientId);
        console.log('from:', from.toISOString());
        console.log('to:', to.toISOString());
        
        const encountersResponse = await ApiClinical.get(`v1/Encounter?patientId=${patientId}&from=${from.toISOString()}&to=${to.toISOString()}`);
        console.log('Respuesta de ClinicalMS:', encountersResponse);
        
        const encounters = Array.isArray(encountersResponse) ? encountersResponse : (encountersResponse?.value || []);
        console.log('Encounters procesados:', encounters);
        console.log('Cantidad de encounters:', encounters.length);
        
        if (!encounters || encounters.length === 0) {
            historyListFull.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-medical" style="font-size: 3rem; color: #9ca3af; margin-bottom: 1rem;"></i>
                    <p style="color: #6b7280; font-size: 1.1rem;">No hay historial médico disponible</p>
                    <p style="color: #9ca3af; font-size: 0.9rem; margin-top: 0.5rem;">Tus consultas aparecerán aquí una vez que sean completadas</p>
                </div>
            `;
            return;
        }

        // Obtener información de doctores únicos
        const doctorIds = [...new Set(encounters.map(e => e.doctorId || e.DoctorId).filter(Boolean))];
        const doctorsMap = new Map();
        
        for (const doctorId of doctorIds) {
            try {
                const doctor = await Api.get(`v1/Doctors/${doctorId}`);
                if (doctor) {
                    const fullName = `${doctor.firstName || doctor.FirstName || ''} ${doctor.lastName || doctor.LastName || ''}`.trim();
                    doctorsMap.set(doctorId, fullName || `Dr. ID ${doctorId}`);
                }
            } catch (err) {
                console.warn(`No se pudo obtener información del doctor ${doctorId}:`, err);
                doctorsMap.set(doctorId, `Dr. ID ${doctorId}`);
            }
        }

        // Ordenar por fecha más reciente
        encounters.sort((a, b) => {
            const dateA = new Date(a.date || a.Date || 0);
            const dateB = new Date(b.date || b.Date || 0);
            return dateB - dateA;
        });

        // Renderizar encounters
        historyListFull.innerHTML = encounters.map(enc => {
            const encounterId = enc.encounterId || enc.EncounterId;
            const date = new Date(enc.date || enc.Date);
            const doctorId = enc.doctorId || enc.DoctorId;
            const doctorName = doctorsMap.get(doctorId) || 'Dr. Sin nombre';
            const reasons = enc.reasons || enc.Reasons || enc.reason || enc.Reason || 'Sin motivo especificado';
            const status = enc.status || enc.Status || 'Pendiente';
            const statusClass = status.toLowerCase() === 'signed' ? 'signed' : status.toLowerCase() === 'open' ? 'open' : 'pending';
            
            // Obtener resumen de la consulta (primeras palabras del Subjective o Assessment)
            const subjective = enc.subjective || enc.Subjective || enc.subjetive || enc.Subjetive || '';
            const assessment = enc.assessment || enc.Assessment || '';
            const summary = assessment || subjective || reasons;
            const summaryText = summary.length > 100 ? summary.substring(0, 100) + '...' : summary;
            
            return `
                <div class="encounter-card" data-encounter-id="${encounterId}">
                    <div class="encounter-header">
                        <div class="encounter-date-info">
                            <div class="encounter-date-icon">
                                <i class="fas fa-calendar-check"></i>
                            </div>
                            <div class="encounter-date-text">
                                <div class="encounter-date">${formatDate(date)}</div>
                                <div class="encounter-time">${formatTime(date)}</div>
                            </div>
                        </div>
                        <div class="encounter-status-badge status-${statusClass}">
                            <i class="fas ${statusClass === 'signed' ? 'fa-check-circle' : statusClass === 'open' ? 'fa-clock' : 'fa-hourglass-half'}"></i>
                            <span>${status === 'SIGNED' ? 'Completada' : status === 'OPEN' ? 'En curso' : 'Pendiente'}</span>
                        </div>
                    </div>
                    <div class="encounter-body">
                        <div class="encounter-doctor">
                            <i class="fas fa-user-md"></i>
                            <span>${doctorName}</span>
                        </div>
                        <div class="encounter-reason">
                            <strong>Motivo:</strong> ${reasons}
                        </div>
                        ${summary ? `
                        <div class="encounter-summary">
                            <p>${summaryText}</p>
                        </div>
                        ` : ''}
                    </div>
                    <div class="encounter-footer">
                        <button class="btn btn-primary btn-view-details" onclick="viewEncounterDetails(${encounterId})">
                            <i class="fas fa-eye"></i> Ver detalles completos
                        </button>
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error al cargar historial médico completo:', error);
        if (historyListFull) {
            historyListFull.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                    <p style="color: #6b7280; font-size: 1.1rem;">No se pudo cargar el historial médico</p>
                    <p style="color: #9ca3af; font-size: 0.9rem; margin-top: 0.5rem;">${error.message || 'Error desconocido'}</p>
                </div>
            `;
        }
    }
}

// Actualizar handleSectionNavigation para cargar turnos e historial
const originalHandleSectionNavigation = handleSectionNavigation;
handleSectionNavigation = async function(section) {
    originalHandleSectionNavigation(section);
    
    if (section === 'turnos') {
        await loadPatientAppointments();
    } else if (section === 'historial') {
        await loadPatientHistoryFull();
    } else if (section === 'inicio') {
        await loadPatientAppointments();
        // No cargar historial en inicio, solo en la sección dedicada
    }
};

// Exportar funciones para uso global
window.PatientPanel = {
    updateDashboardData,
    loadPatientProfile,
    showComingSoonSection,
    loadPatientAppointments,
    loadPatientHistory
};
image.png