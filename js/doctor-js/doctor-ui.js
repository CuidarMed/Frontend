// ===================================
// DOCTOR UI - Interfaz y Notificaciones
// ===================================

import { 
    doctorState, 
    DEFAULT_AVATAR_URL, 
    getDoctorAvatarUrl, 
    getDoctorDisplayName 
} from './doctor-core.js';

// ===================================
// GESTIÓN DE AVATARES
// ===================================

/**
 * Actualiza todos los avatares del doctor en la UI
 */
export function updateAllDoctorAvatars(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
        console.warn('updateAllDoctorAvatars: imageUrl inválida', imageUrl);
        return;
    }
    
    console.log('🖼️ Actualizando avatares con URL:', imageUrl.substring(0, 100));
    
    // Lista de todos los selectores de avatares del doctor
    const avatarSelectors = [
        '#userMenuAvatar',           // Avatar en el menú de usuario
        '#doctor-avatar-preview',    // Avatar en el preview del perfil
        '#profile-avatar',           // Avatar en el perfil
        '.doctor-avatar',            // Clase genérica para avatares
    ];
    
    avatarSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (element.tagName === 'IMG') {
                element.src = imageUrl;
                element.onerror = () => {
                    console.error('❌ Error cargando imagen:', imageUrl);
                    element.src = DEFAULT_AVATAR_URL;
                };
                console.log('✅ Avatar actualizado:', selector);
            }
        });
    });
}

/**
 * Valida si una URL de imagen es válida
 */
export function isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    if (url === 'null' || url === 'undefined') return false;
    if (url === DEFAULT_AVATAR_URL) return false;
    if (url.includes('icons.veryicon.com/png/o/internet--web/prejudice/user-128.png')) return false;
    
    // Verificar si es data URL (base64)
    if (url.startsWith('data:image/')) return true;
    
    // Verificar si es URL normal
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

// ===================================
// ACTUALIZACIÓN DEL HEADER
// ===================================

/**
 * Actualiza el header con la información del doctor
 */
export function updateDoctorHeader(doctorInfo) {
    console.log('🔄 Actualizando header del doctor', doctorInfo);
    
    const displayName = getDoctorDisplayName(doctorInfo);
    const avatarUrl = getDoctorAvatarUrl();

    console.log('📝 Display name:', displayName);
    console.log('🖼️ Avatar URL:', avatarUrl);

    // Actualizar nombre de bienvenida
    const welcomeNameElement = document.getElementById('welcome-name');
    if (welcomeNameElement) {
        const firstName = doctorInfo?.firstName ?? doctorInfo?.FirstName ?? doctorState.currentUser?.firstName ?? '';
        const lastName = doctorInfo?.lastName ?? doctorInfo?.LastName ?? doctorInfo?.Lastname ?? doctorState.currentUser?.lastName ?? '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
        
        if (fullName) {
            welcomeNameElement.textContent = `Hola, Dr ${fullName}`;
        } else {
            const emailName = doctorState.currentUser?.email?.split('@')[0] || 'Profesional';
            welcomeNameElement.textContent = `Hola, Dr ${emailName}`;
        }
        console.log('✅ Welcome name actualizado:', welcomeNameElement.textContent);
    }

    // Actualizar mensaje de bienvenida
    const welcomeMessageElement = document.getElementById('welcome-message');
    if (welcomeMessageElement && !welcomeMessageElement.dataset.custom) {
        welcomeMessageElement.textContent = 'Panel de gestión médica';
    }

    // Actualizar avatar del menú de usuario
    const userMenuAvatar = document.getElementById('userMenuAvatar');
    if (userMenuAvatar) {
        userMenuAvatar.src = avatarUrl;
        userMenuAvatar.alt = `Foto de ${displayName}`;
        userMenuAvatar.onerror = () => {
            console.error('❌ Error cargando avatar del menú');
            userMenuAvatar.src = DEFAULT_AVATAR_URL;
        };
        console.log('✅ Avatar del menú actualizado');
    }

    // Actualizar nombre del menú de usuario
    const userMenuName = document.getElementById('userMenuName');
    if (userMenuName) {
        userMenuName.textContent = doctorState.currentUser?.firstName ? doctorState.currentUser.firstName : 'Mi cuenta';
        console.log('✅ User menu name actualizado');
    }

    // Actualizar avatar del perfil
    const profileAvatarElement = document.getElementById('profile-avatar');
    if (profileAvatarElement) {
        profileAvatarElement.src = avatarUrl;
        profileAvatarElement.alt = `Foto de perfil de ${displayName}`;
        profileAvatarElement.onerror = () => {
            console.error('❌ Error cargando avatar del perfil');
            profileAvatarElement.src = DEFAULT_AVATAR_URL;
        };
        console.log('✅ Avatar del perfil actualizado');
    }

    // Actualizar sección del perfil si existe
    updateDoctorProfileSection(doctorInfo);
}

/**
 * Actualiza la sección del perfil del doctor
 */
export function updateDoctorProfileSection(doctorInfo) {
    const info = doctorInfo || {};
    const profileSection = document.getElementById('doctorProfileSection');
    if (!profileSection) {
        return;
    }

    console.log('=== ACTUALIZANDO PERFIL DEL DOCTOR ===');
    console.log('doctorInfo:', doctorInfo);
    console.log('currentUser:', doctorState.currentUser);

    const displayName = getDoctorDisplayName(info);
    const avatarUrl = getDoctorAvatarUrl();

    // Actualizar avatar preview
    const avatarPreview = document.getElementById('doctor-avatar-preview');
    if (avatarPreview) {
        avatarPreview.src = avatarUrl;
        avatarPreview.alt = `Foto de ${displayName}`;
        avatarPreview.onerror = () => {
            console.error('❌ Error cargando avatar preview');
            avatarPreview.src = DEFAULT_AVATAR_URL;
        };
        console.log('✅ Avatar preview actualizado:', avatarUrl);
    }

    // Actualizar campos del formulario
    const profileFirstNameInput = document.getElementById('profileFirstNameInput');
    const profileLastNameInput = document.getElementById('profileLastNameInput');
    const profileEmailInput = document.getElementById('profileEmailInput');
    const profileSpecialtyInput = document.getElementById('profileSpecialtyInput');
    const profileBioInput = document.getElementById('profileBioInput');
    const doctorImageUrlInput = document.getElementById('doctor-image-url-input');

    // Nombre
    let firstName = '';
    if (info && (info.firstName || info.FirstName)) {
        firstName = info.firstName ?? info.FirstName ?? '';
    } else if (doctorState.currentUser && (doctorState.currentUser.firstName || doctorState.currentUser.FirstName)) {
        firstName = doctorState.currentUser.firstName ?? doctorState.currentUser.FirstName ?? '';
    }
    
    if (profileFirstNameInput) {
        profileFirstNameInput.value = firstName;
        console.log('✅ Nombre actualizado:', firstName);
    }

    // Apellido
    let lastName = '';
    if (info && (info.lastName || info.LastName)) {
        lastName = info.lastName ?? info.LastName ?? '';
    } else if (doctorState.currentUser && (doctorState.currentUser.lastName || doctorState.currentUser.LastName)) {
        lastName = doctorState.currentUser.lastName ?? doctorState.currentUser.LastName ?? '';
    }
    
    if (profileLastNameInput) {
        profileLastNameInput.value = lastName;
        console.log('✅ Apellido actualizado:', lastName);
    }

    // Email
    const email = doctorState.currentUser?.email ?? info.email ?? info.Email ?? '';
    if (profileEmailInput) {
        profileEmailInput.value = email;
        console.log('✅ Email actualizado:', email);
    }

    // Especialidad
    const specialty = info.specialty ?? info.Specialty ?? '';
    if (profileSpecialtyInput) {
        profileSpecialtyInput.value = specialty;
        console.log('✅ Especialidad actualizada:', specialty);
    }

    // Biografía
    const bio = info.biography ?? info.Biography ?? '';
    if (profileBioInput) {
        profileBioInput.value = bio;
        console.log('✅ Biografía actualizada:', bio);
    }

    // URL de imagen
    if (doctorImageUrlInput) {
        const imageUrl = doctorState.currentUser?.imageUrl ?? avatarUrl;
        doctorImageUrlInput.value = imageUrl && imageUrl !== DEFAULT_AVATAR_URL ? imageUrl : '';
        console.log('✅ URL de imagen actualizada:', imageUrl);
    }

    console.log('=== PERFIL ACTUALIZADO ===');
}

// ===================================
// SISTEMA DE NOTIFICACIONES
// ===================================

/**
 * Muestra una notificación toast
 */
export function showNotification(message, type = 'info') {
    console.log(`📢 Notificación [${type}]:`, message);
    
    // Determinar el icono según el tipo
    let iconClass = 'fa-info-circle';
    let borderColor = '#10b981';
    
    if (type === 'success') {
        iconClass = 'fa-check-circle';
        borderColor = '#10b981';
    } else if (type === 'error') {
        iconClass = 'fa-exclamation-circle';
        borderColor = '#dc2626';
    } else if (type === 'warning') {
        iconClass = 'fa-exclamation-triangle';
        borderColor = '#f59e0b';
    }
    
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        padding: 1rem;
        z-index: 10001;
        animation: slideIn 0.3s ease-out;
        max-width: 350px;
        border-left: 4px solid ${borderColor};
    `;
    
    notification.innerHTML = `
        <div class="notification-content" style="display: flex; align-items: center; gap: 0.75rem; color: #1f2937;">
            <i class="fas ${iconClass}" style="color: ${borderColor}; font-size: 1.25rem;"></i>
            <span style="flex: 1; font-size: 0.9rem;">${message}</span>
            <button class="close-notification" style="background: none; border: none; color: #6b7280; cursor: pointer; font-size: 1.25rem; padding: 0; line-height: 1;">
                &times;
            </button>
        </div>
    `;
    
    // Agregar estilos de animación si no existen
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
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
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Función para cerrar la notificación
    const closeNotification = () => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    };
    
    // Agregar event listener al botón de cerrar
    const closeBtn = notification.querySelector('.close-notification');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeNotification);
    }
    
    // Agregar al DOM
    document.body.appendChild(notification);
    
    // Remover automáticamente después de 5 segundos
    setTimeout(closeNotification, 5000);
}

// ===================================
// FUNCIONES DE ACTUALIZACIÓN DE UI
// ===================================

/**
 * Establece el modo de edición del formulario de perfil
 */
export function setProfileFormEditable(editable) {
    const firstNameInput = document.getElementById('profileFirstNameInput');
    const lastNameInput = document.getElementById('profileLastNameInput');
    const emailInput = document.getElementById('profileEmailInput');
    const specialtyInput = document.getElementById('profileSpecialtyInput');
    const bioInput = document.getElementById('profileBioInput');
    const editBtn = document.getElementById('editDoctorProfile');
    const profileActions = document.getElementById('profileActions');

    const inputs = [firstNameInput, lastNameInput, emailInput, specialtyInput, bioInput].filter(Boolean);

    inputs.forEach(input => {
        if (input) {
            input.disabled = !editable;
            input.style.cursor = editable ? 'text' : 'not-allowed';
        }
    });

    if (editBtn) {
        editBtn.style.display = editable ? 'none' : 'inline-flex';
    }

    if (profileActions) {
        if (editable) {
            profileActions.classList.remove('hidden');
        } else {
            profileActions.classList.add('hidden');
        }
    }
}

/**
 * Establece la navegación activa
 */
export function setActiveNav(section) {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
        const itemSection = item.getAttribute('data-section');
        item.classList.toggle('active', itemSection === section);
    });
}

// Exportar el estado para acceso desde otros módulos
export { doctorState };