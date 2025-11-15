// ===================================
// DOCTOR PROFILE - Gestión de Perfil
// ===================================

import { 
    doctorState, 
    DEFAULT_AVATAR_URL,
    getDoctorAvatarUrl,
    getId,
    getValue
} from './doctor-core.js';

import { 
    showNotification,
    updateAllDoctorAvatars,
    updateDoctorProfileSection,
    setProfileFormEditable 
} from './doctor-ui.js';

// ===================================
// INICIALIZACIÓN DE EDICIÓN DE PERFIL
// ===================================

/**
 * Inicializa la funcionalidad de edición de perfil
 */
export function initializeProfileEditing() {
    console.log('🔧 Inicializando edición de perfil');
    
    const editBtn = document.getElementById('editDoctorProfile');
    const cancelBtn = document.getElementById('cancelProfileEdit');
    const saveBtn = document.getElementById('saveProfile');
    const profileForm = document.getElementById('doctorProfileForm');

    if (editBtn) {
        editBtn.addEventListener('click', function() {
            console.log('✏️ Modo edición activado');
            setProfileFormEditable(true);
            
            // Actualizar el preview de la imagen con la imagen actual
            const avatarPreview = document.getElementById('doctor-avatar-preview');
            const imageUrlInput = document.getElementById('doctor-image-url-input');
            if (avatarPreview) {
                avatarPreview.src = getDoctorAvatarUrl();
            }
            if (imageUrlInput) {
                imageUrlInput.value = doctorState.currentUser?.imageUrl || '';
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            console.log('❌ Edición cancelada');
            setProfileFormEditable(false);
            // Recargar datos originales
            updateDoctorProfileSection(doctorState.currentDoctorData);
        });
    }

    if (profileForm) {
        profileForm.addEventListener('submit', handleProfileSubmit);
    }
    
    // Configurar editor de avatar del doctor
    setupDoctorAvatarEditor();
}

/**
 * Maneja el envío del formulario de perfil
 */
async function handleProfileSubmit(e) {
    e.preventDefault();
    
    console.log('💾 Guardando perfil...');
    
    try {
        // Obtener valores del formulario
        const firstNameInput = document.getElementById('profileFirstNameInput');
        const lastNameInput = document.getElementById('profileLastNameInput');
        const emailInput = document.getElementById('profileEmailInput');
        const specialtyInput = document.getElementById('profileSpecialtyInput');
        const bioInput = document.getElementById('profileBioInput');
        const imageUrlInput = document.getElementById('doctor-image-url-input');
        
        const firstName = firstNameInput?.value?.trim() || '';
        const lastName = lastNameInput?.value?.trim() || '';
        const email = emailInput?.value?.trim() || '';
        const specialty = specialtyInput?.value?.trim() || '';
        const biography = bioInput?.value?.trim() || '';
        const imageUrl = imageUrlInput?.value?.trim() || null;
        
        console.log('📝 Datos del formulario:', { firstName, lastName, email, specialty, imageUrl: imageUrl?.substring(0, 50) });
        
        // Validar que haya datos mínimos
        if (!firstName || !lastName) {
            showNotification('El nombre y apellido son obligatorios', 'error');
            return;
        }
        
        // Obtener el ID del doctor
        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');

        if (!doctorId) {
            showNotification('No se pudo identificar el usuario. Por favor, recarga la página.', 'error');
            return;
        }
        
        // Construir el payload según la estructura esperada por el backend
        const payload = {
            FirstName: firstName,
            LastName: lastName,
            Specialty: specialty || null,
            Biography: biography || null,
        };
        
        console.log('📤 Enviando a DirectoryMS:', payload);
        
        // Importar Api
        const { Api } = await import('../api.js');
        
        // Guardar en el backend
        await Api.patch(`v1/Doctor/${doctorId}`, payload);
        console.log('✅ Perfil actualizado en DirectoryMS');

        // Actualizar imagen del usuario en AuthMS si se proporcionó
        if (imageUrl) {
            await updateDoctorImage(imageUrl);
        }
        
        // Actualizar los datos locales del usuario
        if (doctorState.currentUser) {
            doctorState.currentUser.firstName = firstName;
            doctorState.currentUser.lastName = lastName;
            if (email) {
                doctorState.currentUser.email = email;
            }
            
            // Actualizar en localStorage
            try {
                localStorage.setItem('user', JSON.stringify(doctorState.currentUser));
                const { state } = await import('../state.js');
                state.user = doctorState.currentUser;
                console.log('✅ Estado actualizado en localStorage');
            } catch (storageError) {
                console.warn('⚠️ No se pudo actualizar el localStorage', storageError);
            }
        }
        
        // Recargar datos del doctor desde el backend
        const { loadDoctorData } = await import('./doctor-core.js');
        await loadDoctorData();
        
        // Mostrar notificación de éxito
        showNotification('Perfil actualizado correctamente', 'success');
        
        // Desactivar modo edición
        setProfileFormEditable(false);
        
    } catch (error) {
        console.error('❌ Error al guardar el perfil:', error);
        const errorMessage = error.message || 'No se pudo guardar el perfil. Por favor, intenta nuevamente.';
        showNotification(errorMessage, 'error');
    }
}

/**
 * Actualiza la imagen del doctor en AuthMS
 */
async function updateDoctorImage(imageUrl) {
    try {
        console.log('🖼️ Actualizando imagen en AuthMS...');
        console.log('📸 Imagen (primeros 100 caracteres):', imageUrl.substring(0, 100));
        
        const { ApiAuth } = await import('../api.js');
        
        // Usar el endpoint de Doctor que no requiere el ID en la URL
        const updatedUser = await ApiAuth.put(`v1/Doctor/profile`, {
            FirstName: doctorState.currentUser.firstName || '',
            LastName: doctorState.currentUser.lastName || '',
            ImageUrl: imageUrl,
        });
        
        console.log('✅ Imagen de usuario actualizada en AuthMS');
        console.log('👤 Usuario actualizado:', updatedUser);
        
        // Actualizar estado del usuario con la respuesta del servidor
        const serverImageUrl = updatedUser?.imageUrl ?? updatedUser?.ImageUrl ?? imageUrl;
        
        doctorState.currentUser = {
            ...doctorState.currentUser,
            imageUrl: serverImageUrl,
        };
        
        const { state } = await import('../state.js');
        state.user = doctorState.currentUser;
        localStorage.setItem('user', JSON.stringify(doctorState.currentUser));
        
        // Actualizar avatar en toda la UI
        updateAllDoctorAvatars(serverImageUrl);
        
        console.log('✅ Imagen guardada y actualizada en localStorage');
        
    } catch (apiError) {
        console.error('❌ Error al actualizar imagen en AuthMS:', apiError);
        console.error('📋 Detalles del error:', {
            message: apiError.message,
            status: apiError.status,
            statusText: apiError.statusText
        });
        
        // Si es un error 401, el token puede haber expirado
        if (apiError.status === 401) {
            showNotification('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.', 'error');
        } else {
            showNotification('Error al guardar la imagen. Por favor, intenta nuevamente.', 'error');
        }
        throw apiError;
    }
}

// ===================================
// EDITOR DE AVATAR
// ===================================

/**
 * Configura el editor de avatar del doctor
 */
export function setupDoctorAvatarEditor() {
    console.log('🎨 Configurando editor de avatar');
    
    const imageUrlInput = document.getElementById('doctor-image-url-input');
    const imageFileInput = document.getElementById('doctor-image-file');
    const selectImageBtn = document.getElementById('doctor-selectImageBtn');
    const avatarPreview = document.getElementById('doctor-avatar-preview');
    
    if (!imageUrlInput || !avatarPreview) {
        console.warn('⚠️ No se encontraron elementos del editor de avatar');
        return;
    }
    
    // Abrir selector de archivos cuando se hace clic en el botón de seleccionar
    if (selectImageBtn && imageFileInput) {
        selectImageBtn.addEventListener('click', function() {
            console.log('📁 Abriendo selector de archivos');
            imageFileInput.click();
        });
    }
    
    // Manejar selección de archivo
    if (imageFileInput) {
        imageFileInput.addEventListener('change', handleImageFileSelect);
    }
    
    // Actualizar preview cuando cambie la URL
    imageUrlInput.addEventListener('input', handleImageUrlInput);
}

/**
 * Maneja la selección de archivo de imagen
 */
async function handleImageFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    console.log('📸 Archivo seleccionado:', file.name, file.type, file.size);
    
    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
        showNotification('Por favor, selecciona un archivo de imagen válido.', 'error');
        return;
    }
    
    // Validar tamaño máximo (5MB antes de comprimir)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
        showNotification('La imagen es demasiado grande. Por favor, selecciona una imagen menor a 5MB.', 'error');
        return;
    }
    
    try {
        showNotification('Comprimiendo imagen...', 'info');
        
        // Comprimir y convertir a base64
        const base64 = await compressImageToBase64(file, 800, 800, 0.8);
        
        console.log('✅ Imagen comprimida, tamaño:', base64.length, 'caracteres');
        
        // Actualizar preview
        const avatarPreview = document.getElementById('doctor-avatar-preview');
        if (avatarPreview) {
            avatarPreview.src = base64;
        }
        
        // Actualizar el input de URL con la data URL
        const imageUrlInput = document.getElementById('doctor-image-url-input');
        if (imageUrlInput) {
            imageUrlInput.value = base64;
            imageUrlInput.style.borderColor = '#10b981';
        }
        
        showNotification('Imagen cargada correctamente', 'success');
    } catch (error) {
        console.error('❌ Error al procesar la imagen:', error);
        showNotification('Error al procesar la imagen. Por favor, intenta nuevamente.', 'error');
    }
}

/**
 * Maneja el cambio en el input de URL de imagen
 */
function handleImageUrlInput(e) {
    const url = e.target.value.trim();
    const avatarPreview = document.getElementById('doctor-avatar-preview');
    const imageUrlInput = e.target;
    
    if (!avatarPreview) return;
    
    if (url) {
        // Validar que sea una URL válida o data URL
        try {
            if (url.startsWith('data:')) {
                // Es una data URL (base64)
                avatarPreview.src = url;
                imageUrlInput.style.borderColor = '#10b981';
                console.log('✅ Data URL válida');
            } else {
                // Es una URL normal
                new URL(url);
                avatarPreview.src = url;
                
                avatarPreview.onerror = function() {
                    // Si falla la carga, usar imagen por defecto
                    avatarPreview.src = getDoctorAvatarUrl();
                    imageUrlInput.style.borderColor = '#ef4444';
                    showNotification('No se pudo cargar la imagen. Verifica la URL.', 'error');
                };
                
                avatarPreview.onload = function() {
                    imageUrlInput.style.borderColor = '#10b981';
                    console.log('✅ Imagen cargada desde URL');
                };
            }
        } catch (error) {
            imageUrlInput.style.borderColor = '#ef4444';
            console.warn('⚠️ URL inválida:', url);
        }
    } else {
        avatarPreview.src = getDoctorAvatarUrl();
        imageUrlInput.style.borderColor = '#e5e7eb';
    }
}

// ===================================
// COMPRESIÓN DE IMÁGENES
// ===================================

/**
 * Comprime una imagen y la convierte a base64
 */
export async function compressImageToBase64(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        console.log('🔄 Comprimiendo imagen:', { maxWidth, maxHeight, quality });
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const img = new Image();
            
            img.onload = function() {
                console.log('📐 Dimensiones originales:', img.width, 'x', img.height);
                
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calcular nuevas dimensiones manteniendo la proporción
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                console.log('📐 Dimensiones finales:', width, 'x', height);
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convertir a base64 con calidad ajustable
                const base64 = canvas.toDataURL('image/jpeg', quality);
                console.log('✅ Imagen comprimida exitosamente');
                resolve(base64);
            };
            
            img.onerror = function(error) {
                console.error('❌ Error al cargar imagen:', error);
                reject(error);
            };
            
            img.src = e.target.result;
        };
        
        reader.onerror = function(error) {
            console.error('❌ Error al leer archivo:', error);
            reject(error);
        };
        
        reader.readAsDataURL(file);
    });
}

// ===================================
// EXPORTACIONES
// ===================================

export { doctorState };