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

// Exportar funciones para uso global
window.PatientPanel = {
    updateDashboardData,
    loadPatientProfile,
    showComingSoonSection
};
