// ===================================
// DOCTOR CORE - Estado y Utilidades
// ===================================

// Constantes
export const DEFAULT_AVATAR_URL = "https://icons.veryicon.com/png/o/internet--web/prejudice/user-128.png";

// Estado global del doctor
export const doctorState = {
    currentUser: null,
    currentDoctorData: null,
    autoRefreshInterval: null,
    currentPrescriptionData: null,
    allPatientsList: []
};

// ===================================
// FUNCIONES DE UTILIDAD
// ===================================

/**
 * Normaliza un objeto para que tenga tanto propiedades camelCase como PascalCase
 */
export function normalizeObject(obj, fields) {
    if (!obj) return obj;
    fields.forEach(field => {
        const camel = field.charAt(0).toLowerCase() + field.slice(1);
        const pascal = field.charAt(0).toUpperCase() + field.slice(1);
        obj[camel] = obj[camel] ?? obj[pascal];
        obj[pascal] = obj[pascal] ?? obj[camel];
    });
    return obj;
}

/**
 * Obtiene un valor de un objeto probando múltiples claves
 */
export function getValue(obj, ...keys) {
    for (const key of keys) {
        if (obj?.[key] !== undefined && obj?.[key] !== null) return obj[key];
    }
    return null;
}

/**
 * Obtiene el ID de un objeto probando múltiples variantes
 */
export function getId(obj, ...keys) {
    return getValue(obj, ...keys) || getValue(obj, ...keys.map(k => k.charAt(0).toUpperCase() + k.slice(1)));
}

/**
 * Formatea una fecha en español
 */
export function formatDate(date, options = {}) {
    if (!date) return 'Fecha no disponible';
    try {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return 'Fecha inválida';
        return d.toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            ...options
        });
    } catch {
        return 'Fecha no disponible';
    }
}

/**
 * Formatea una hora
 */
export function formatTime(date, options = {}) {
    if (!date) return '';
    try {
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime())) return '';
        return d.toLocaleTimeString('es-AR', {
            hour: '2-digit',
            minute: '2-digit',
            ...options
        });
    } catch {
        return '';
    }
}

/**
 * Formatea un TimeSpan a string HH:mm
 */
export function formatTimeSpan(timeSpan) {
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
 * Calcula la edad desde una fecha de nacimiento
 */
export function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    
    let birthDate;
    if (typeof dateOfBirth === 'string') {
        birthDate = new Date(dateOfBirth);
    } else if (dateOfBirth.year && dateOfBirth.month && dateOfBirth.day) {
        birthDate = new Date(dateOfBirth.year, dateOfBirth.month - 1, dateOfBirth.day);
    } else {
        return null;
    }
    
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    
    return age;
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
// GESTIÓN DE USUARIO Y AUTENTICACIÓN
// ===================================

/**
 * Carga el contexto del doctor desde el estado de autenticación
 */
export async function loadDoctorContext() {
    console.log('🔐 Cargando contexto del doctor...');
    
    try {
        const { state, loadUserFromStorage } = await import('../state.js');
        loadUserFromStorage();
        doctorState.currentUser = state.user;
        
        if (!doctorState.currentUser) {
            console.warn('⚠️ No hay usuario autenticado, redirigiendo a login');
            window.location.href = 'login.html';
            return;
        }
        
        console.log('✅ Usuario cargado:', doctorState.currentUser.email);
        
        // Intentar sincronizar el perfil, pero no fallar si hay error
        try {
            await ensureDoctorProfile(state.token);
            const { state: updatedState } = await import('../state.js');
            doctorState.currentUser = updatedState.user;
            console.log('✅ Perfil sincronizado correctamente');
        } catch (profileError) {
            console.warn('⚠️ No se pudo sincronizar el perfil, continuando con datos locales:', profileError.message);
            // Continuar con los datos que ya tenemos en localStorage
        }
    } catch (error) {
        console.error('❌ Error crítico al cargar contexto:', error);
        window.location.href = 'login.html';
    }
}

/**
 * Asegura que el perfil del doctor esté sincronizado
 */
export async function ensureDoctorProfile(token) {
    const userId = doctorState.currentUser?.userId;
    
    // Si no hay token o userId, salir silenciosamente
    if (!token || !userId) {
        console.warn('⚠️ No se puede sincronizar perfil: falta token o userId');
        return;
    }
    
    try {
        console.log('🔄 Sincronizando perfil del usuario...');
        
        const { getUserById } = await import('../apis/authms.js');
        const profile = await getUserById(userId, token);
        
        if (!profile) {
            console.warn('⚠️ No se recibió perfil del servidor');
            return;
        }
        
        console.log('📥 Perfil recibido del servidor');
        
        const newFirstName = getValue(profile, 'firstName', 'FirstName') ?? doctorState.currentUser?.firstName ?? '';
        const newLastName = getValue(profile, 'lastName', 'LastName') ?? doctorState.currentUser?.lastName ?? '';
        const newImageUrl = getValue(profile, 'imageUrl', 'ImageUrl') ?? doctorState.currentUser?.imageUrl;
        const newEmail = getValue(profile, 'email', 'Email') ?? doctorState.currentUser?.email;
        const newRole = getValue(profile, 'role', 'Role') ?? doctorState.currentUser?.role;
        
        const isDefaultImage = !newImageUrl || newImageUrl === DEFAULT_AVATAR_URL || 
                              newImageUrl.includes('icons.veryicon.com/png/o/internet--web/prejudice/user-128.png');
        
        const finalImageUrl = (newImageUrl && !isDefaultImage && newImageUrl.trim() !== '') 
            ? newImageUrl 
            : (doctorState.currentUser?.imageUrl && doctorState.currentUser.imageUrl !== DEFAULT_AVATAR_URL && 
               !doctorState.currentUser.imageUrl.includes('icons.veryicon.com/png/o/internet--web/prejudice/user-128.png'))
                ? doctorState.currentUser.imageUrl
                : DEFAULT_AVATAR_URL;
        
        doctorState.currentUser = {
            ...doctorState.currentUser,
            firstName: newFirstName,
            FirstName: newFirstName,
            lastName: newLastName,
            LastName: newLastName,
            imageUrl: finalImageUrl,
            email: newEmail ?? doctorState.currentUser?.email,
            role: newRole ?? doctorState.currentUser?.role,
            userId: doctorState.currentUser?.userId ?? getValue(profile, 'userId', 'UserId') ?? userId,
        };
        
        const { state } = await import('../state.js');
        state.user = doctorState.currentUser;
        
        try {
            localStorage.setItem('user', JSON.stringify(doctorState.currentUser));
            console.log('💾 Perfil actualizado en localStorage');
        } catch (storageError) {
            console.warn('⚠️ No se pudo guardar en localStorage:', storageError);
        }
        
        if (finalImageUrl && finalImageUrl !== DEFAULT_AVATAR_URL) {
            try {
                const { updateAllDoctorAvatars } = await import('./doctor-ui.js');
                updateAllDoctorAvatars(finalImageUrl);
                console.log('🖼️ Avatares actualizados en la UI');
            } catch (uiError) {
                console.warn('⚠️ No se pudieron actualizar avatares:', uiError);
            }
        }
    } catch (error) {
        // Si el error es 401 (Unauthorized), el token puede haber expirado
        if (error.message?.includes('Unauthorized') || error.status === 401) {
            console.warn('⚠️ Token expirado o inválido, usando datos locales');
            // No redirigir a login, solo usar los datos que ya tenemos
        } else {
            console.warn('⚠️ Error al sincronizar perfil:', error.message);
        }
        // No lanzar el error, continuar con los datos locales
    }
}

/**
 * Obtiene la URL del avatar del doctor
 */
export function getDoctorAvatarUrl() {
    const candidate = doctorState.currentUser?.imageUrl;
    if (candidate && typeof candidate === 'string' && candidate.trim() && 
        candidate !== 'null' && candidate !== 'undefined' &&
        candidate !== DEFAULT_AVATAR_URL &&
        !candidate.includes('icons.veryicon.com/png/o/internet--web/prejudice/user-128.png')) {
        return candidate;
    }
    return DEFAULT_AVATAR_URL;
}

/**
 * Obtiene el nombre completo del doctor para mostrar
 */
export function getDoctorDisplayName(doctorInfo) {
    const info = doctorInfo || {};
    const doctorFirstName = info.firstName ?? info.FirstName ?? doctorState.currentUser?.firstName;
    const doctorLastName = info.lastName ?? info.LastName ?? doctorState.currentUser?.lastName;
    const fullName = [doctorFirstName, doctorLastName].filter(Boolean).join(' ').trim();

    if (fullName) {
        return fullName;
    }

    return doctorState.currentUser?.email || 'Profesional';
}

/**
 * Carga los datos del doctor desde el backend
 */
export async function loadDoctorData() {
    try {
        console.log('📋 Cargando datos del doctor...');
        
        const { Api } = await import('../api.js');
        
        const userId = doctorState.currentUser?.userId;
        if (!userId) {
            console.error('❌ No hay userId disponible');
            return null;
        }
        
        let doctor = null;
        
        // Intentar obtener doctor por UserId
        try {
            console.log('🔍 Buscando doctor por UserId:', userId);
            doctor = await Api.get(`v1/Doctor/User/${userId}`);
            console.log('✅ Doctor encontrado por UserId');
        } catch (err) {
            console.warn('⚠️ No se encontró doctor por UserId, buscando en lista completa...');
            
            try {
                const doctors = await Api.get('v1/Doctor');
                if (Array.isArray(doctors)) {
                    doctor = doctors.find(d => (d.userId ?? d.UserId) === userId);
                    if (doctor) {
                        console.log('✅ Doctor encontrado en lista completa');
                    }
                }
            } catch (fallbackErr) {
                console.warn('⚠️ Error en búsqueda fallback:', fallbackErr.message);
            }
        }
        
        // Si no se encuentra, crear el doctor
        if (!doctor) {
            console.log('🆕 Doctor no encontrado, creando nuevo perfil...');
            
            try {
                const createDoctorRequest = {
                    UserId: parseInt(userId),
                    FirstName: doctorState.currentUser?.firstName ?? doctorState.currentUser?.FirstName ?? '',
                    LastName: doctorState.currentUser?.lastName ?? doctorState.currentUser?.LastName ?? '',
                    LicenseNumber: 'PENDING',
                    Biography: null,
                    Specialty: 'Clinico'
                };
                
                console.log('📤 Enviando solicitud de creación:', createDoctorRequest);
                doctor = await Api.post('v1/Doctor', createDoctorRequest);
                console.log('✅ Doctor creado exitosamente');
            } catch (createErr) {
                console.error('❌ Error al crear doctor:', createErr.message);
                
                // Mostrar notificación al usuario
                try {
                    const { showNotification } = await import('./doctor-ui.js');
                    showNotification('No se pudo crear el perfil de doctor. Algunas funcionalidades pueden estar limitadas.', 'warning');
                } catch (notifErr) {
                    console.warn('⚠️ No se pudo mostrar notificación');
                }
                
                // Crear objeto doctor temporal con los datos del usuario
                doctor = {
                    firstName: doctorState.currentUser?.firstName ?? doctorState.currentUser?.FirstName ?? '',
                    FirstName: doctorState.currentUser?.firstName ?? doctorState.currentUser?.FirstName ?? '',
                    lastName: doctorState.currentUser?.lastName ?? doctorState.currentUser?.LastName ?? '',
                    LastName: doctorState.currentUser?.lastName ?? doctorState.currentUser?.LastName ?? '',
                    userId: doctorState.currentUser?.userId ?? doctorState.currentUser?.UserId,
                    UserId: doctorState.currentUser?.userId ?? doctorState.currentUser?.UserId,
                    specialty: null,
                    Specialty: null,
                    biography: null,
                    Biography: null,
                    licenseNumber: null,
                    LicenseNumber: null
                };
            }
        }

        // Normalizar objeto doctor
        if (doctor) {
            normalizeObject(doctor, ['doctorId', 'firstName', 'lastName', 'specialty', 'biography', 'licenseNumber', 'userId']);
        }
        
        doctorState.currentDoctorData = doctor;
        
        // Guardar en state global
        try {
            const { state } = await import('../state.js');
            state.doctorData = doctor;
        } catch (stateErr) {
            console.warn('⚠️ No se pudo actualizar state global');
        }
        
        console.log('✅ Datos del doctor cargados:', doctor?.doctorId || 'sin ID');
        return doctor;
        
    } catch (error) {
        console.error('❌ Error al cargar datos del doctor:', error);
        return null;
    }
}