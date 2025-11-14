// Funcionalidades específicas del panel médico
const DEFAULT_AVATAR_URL = "https://icons.veryicon.com/png/o/internet--web/prejudice/user-128.png";
let currentUser = null;
let currentDoctorData = null;
let autoRefreshInterval = null;
let currentPrescriptionData = null;

document.addEventListener('DOMContentLoaded', async function() {
    await loadDoctorContext();
    
    // Asegurar que currentUser tenga firstName y lastName antes de continuar
    if (!currentUser?.firstName || !currentUser?.lastName) {
        console.log('Faltan firstName o lastName, esperando a que se carguen...');
        // Dar tiempo para que ensureDoctorProfile termine
        await new Promise(resolve => setTimeout(resolve, 500));
        // Re-cargar desde state por si se actualizó
        const { state } = await import('./state.js');
        currentUser = state.user;
    }
    
    console.log('currentUser final:', currentUser);
    console.log('currentUser.firstName:', currentUser?.firstName);
    console.log('currentUser.lastName:', currentUser?.lastName);
    
    initializeDoctorPanel();
    updateDoctorHeader();
    loadDoctorData(); // Cargar datos del backend
});

async function loadDoctorContext() {
    const { state, loadUserFromStorage } = await import('./state.js');
    loadUserFromStorage();

    currentUser = state.user;
    
    console.log('=== CARGANDO CONTEXTO DEL DOCTOR ===');
    console.log('currentUser desde localStorage:', currentUser);
    console.log('currentUser.firstName:', currentUser?.firstName);
    console.log('currentUser.lastName:', currentUser?.lastName);

    if (!currentUser) {
        window.location.href = 'login.html';
        return;
    }

    await ensureDoctorProfile(state.token);
    
    // Asegurar que currentUser esté actualizado después de ensureDoctorProfile
    const { state: updatedState } = await import('./state.js');
    currentUser = updatedState.user;
    
    console.log('currentUser después de ensureDoctorProfile:', currentUser);
    console.log('currentUser.firstName después:', currentUser?.firstName);
    console.log('currentUser.lastName después:', currentUser?.lastName);
}

async function ensureDoctorProfile(token) {
    const userId = currentUser?.userId;

    if (!token || !userId) {
        console.warn('ensureDoctorProfile: No hay token o userId');
        return;
    }

    console.log('=== SINCRONIZANDO PERFIL DEL DOCTOR ===');
    console.log('currentUser antes:', currentUser);
    console.log('currentUser.firstName:', currentUser?.firstName);
    console.log('currentUser.lastName:', currentUser?.lastName);

    // SIEMPRE intentar cargar datos actualizados desde AuthMS para asegurar que tenemos firstName y lastName
    console.log('Cargando datos completos desde AuthMS...');
    try {
        const { getUserById } = await import('./apis/authms.js');
        const profile = await getUserById(userId, token);
        
        console.log('Profile obtenido de AuthMS:', profile);
        console.log('profile completo:', JSON.stringify(profile, null, 2));
        console.log('profile.firstName:', profile?.firstName ?? profile?.FirstName);
        console.log('profile.lastName:', profile?.lastName ?? profile?.LastName);
        console.log('profile.email:', profile?.email ?? profile?.Email);

        if (profile) {
            // Actualizar currentUser con todos los datos disponibles
            const newFirstName = profile.firstName ?? profile.FirstName ?? currentUser?.firstName ?? '';
            const newLastName = profile.lastName ?? profile.LastName ?? currentUser?.lastName ?? '';
            const newImageUrl = profile.imageUrl ?? profile.ImageUrl ?? currentUser?.imageUrl;
            const newEmail = profile.email ?? profile.Email ?? currentUser?.email;
            const newRole = profile.role ?? profile.Role ?? currentUser?.role;

            currentUser = {
                ...currentUser,
                firstName: newFirstName,
                FirstName: newFirstName,
                lastName: newLastName,
                LastName: newLastName,
                imageUrl: newImageUrl || DEFAULT_AVATAR_URL,
                email: newEmail ?? currentUser?.email,
                role: newRole ?? currentUser?.role,
                userId: currentUser?.userId ?? profile.userId ?? profile.UserId ?? userId,
            };

            console.log('currentUser actualizado:', currentUser);
            console.log('currentUser.firstName después:', currentUser.firstName);
            console.log('currentUser.lastName después:', currentUser.lastName);
            console.log('currentUser.email después:', currentUser.email);

            const { state } = await import('./state.js');
            state.user = currentUser;
            localStorage.setItem('user', JSON.stringify(currentUser));

            updateDoctorHeader();
        } else {
            console.warn('No se obtuvo profile de AuthMS');
        }
    } catch (error) {
        console.error('Error al sincronizar el perfil del profesional:', error);
        console.error('Stack trace:', error.stack);
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
        // Obtener nombre completo del usuario logueado
        // Prioridad: datos del doctor del backend, luego datos del usuario actual
        const firstName = doctorInfo?.firstName ?? doctorInfo?.FirstName ?? currentUser?.firstName ?? '';
        const lastName = doctorInfo?.lastName ?? doctorInfo?.LastName ?? doctorInfo?.Lastname ?? currentUser?.lastName ?? '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
        
        if (fullName) {
            welcomeNameElement.textContent = `Hola, Dr ${fullName}`;
        } else {
            // Si no hay nombre, intentar obtener del email como fallback
            const emailName = currentUser?.email?.split('@')[0] || 'Profesional';
            welcomeNameElement.textContent = `Hola, Dr ${emailName}`;
        }
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

    console.log('=== ACTUALIZANDO PERFIL DEL DOCTOR ===');
    console.log('doctorInfo:', doctorInfo);
    console.log('doctorInfo firstName:', doctorInfo?.firstName ?? doctorInfo?.FirstName);
    console.log('doctorInfo lastName:', doctorInfo?.lastName ?? doctorInfo?.LastName);
    console.log('currentUser:', currentUser);
    console.log('currentUser firstName:', currentUser?.firstName ?? currentUser?.FirstName);
    console.log('currentUser lastName:', currentUser?.lastName ?? currentUser?.LastName);

    const displayName = getDoctorDisplayName(info);
    const avatarUrl = getDoctorAvatarUrl();

    // Actualizar avatar preview
    const avatarPreview = document.getElementById('doctor-avatar-preview');
    if (avatarPreview) {
        avatarPreview.src = avatarUrl;
        avatarPreview.alt = `Foto de ${displayName}`;
        console.log('Avatar actualizado:', avatarUrl);
    }

    // Actualizar campos del formulario
    const profileFirstNameInput = document.getElementById('profileFirstNameInput');
    const profileLastNameInput = document.getElementById('profileLastNameInput');
    const profileEmailInput = document.getElementById('profileEmailInput');
    const profileSpecialtyInput = document.getElementById('profileSpecialtyInput');
    const profileBioInput = document.getElementById('profileBioInput');
    const doctorImageUrlInput = document.getElementById('doctor-image-url-input');

    // Nombre - Priorizar datos del doctor del backend, luego del usuario
    let firstName = '';
    if (info && (info.firstName || info.FirstName)) {
        firstName = info.firstName ?? info.FirstName ?? '';
    } else if (currentUser && (currentUser.firstName || currentUser.FirstName)) {
        firstName = currentUser.firstName ?? currentUser.FirstName ?? '';
    }
    
    if (profileFirstNameInput) {
        profileFirstNameInput.value = firstName;
        console.log('Nombre actualizado:', firstName, '(de doctor:', info?.firstName ?? info?.FirstName, ', de usuario:', currentUser?.firstName ?? currentUser?.FirstName, ')');
    } else {
        console.warn('No se encontró el elemento profileFirstNameInput');
    }

    // Apellido - Priorizar datos del doctor del backend, luego del usuario
    let lastName = '';
    if (info && (info.lastName || info.LastName)) {
        lastName = info.lastName ?? info.LastName ?? '';
    } else if (currentUser && (currentUser.lastName || currentUser.LastName)) {
        lastName = currentUser.lastName ?? currentUser.LastName ?? '';
    }
    
    if (profileLastNameInput) {
        profileLastNameInput.value = lastName;
        console.log('Apellido actualizado:', lastName, '(de doctor:', info?.lastName ?? info?.LastName, ', de usuario:', currentUser?.lastName ?? currentUser?.LastName, ')');
    } else {
        console.warn('No se encontró el elemento profileLastNameInput');
    }

    // Email
    const email = currentUser?.email ?? info.email ?? info.Email ?? '';
    if (profileEmailInput) {
        profileEmailInput.value = email;
        console.log('Email actualizado:', email);
    }

    // Especialidad
    const specialty = info.specialty ?? info.Specialty ?? '';
    if (profileSpecialtyInput) {
        profileSpecialtyInput.value = specialty;
        console.log('Especialidad actualizada:', specialty);
    }

    // Biografía
    const bio = info.biography ?? info.Biography ?? '';
    if (profileBioInput) {
        profileBioInput.value = bio;
        console.log('Biografía actualizada:', bio);
    }

    // URL de imagen
    if (doctorImageUrlInput) {
        const imageUrl = currentUser?.imageUrl ?? avatarUrl;
        doctorImageUrlInput.value = imageUrl && imageUrl !== DEFAULT_AVATAR_URL ? imageUrl : '';
        console.log('URL de imagen actualizada:', imageUrl);
    }

    console.log('=== PERFIL ACTUALIZADO ===');
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
    
    // Inicializar funcionalidad de editar perfil
    initializeProfileEditing();
    
    // Cargar datos periódicamente (cada 30 segundos)
    setInterval(() => {
        loadDoctorData();
    }, 30000);
}

function initializeProfileEditing() {
    const editBtn = document.getElementById('editDoctorProfile');
    const cancelBtn = document.getElementById('cancelProfileEdit');
    const saveBtn = document.getElementById('saveProfile');
    const profileForm = document.getElementById('doctorProfileForm');

    if (editBtn) {
        editBtn.addEventListener('click', function() {
            setProfileFormEditable(true);
            // Actualizar el preview de la imagen con la imagen actual
            const avatarPreview = document.getElementById('doctor-avatar-preview');
            const imageUrlInput = document.getElementById('doctor-image-url-input');
            if (avatarPreview) {
                avatarPreview.src = getDoctorAvatarUrl();
            }
            if (imageUrlInput) {
                imageUrlInput.value = currentUser?.imageUrl || '';
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            setProfileFormEditable(false);
            // Recargar datos originales
            updateDoctorProfileSection(currentDoctorData);
        });
    }

    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
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
                
                // Validar que haya datos mínimos
                if (!firstName || !lastName) {
                    showNotification('El nombre y apellido son obligatorios', 'error');
                    return;
                }
                
                // Obtener el ID del doctor
                const doctorId = currentDoctorData?.doctorId ?? currentDoctorData?.DoctorId;

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
                
                // Importar Api
                const { Api } = await import('./api.js');
                if (!doctorId) {
    showNotification('No se pudo identificar el médico en DirectoryMS', 'error');
    return;
}
                // Guardar en el backend
                await Api.patch(`v1/Doctor/${doctorId}`, payload);

                
                // Actualizar imagen del usuario en AuthMS si se proporcionó
                if (imageUrl) {
                    try {
                        const AUTHMS_BASE_URL = "http://localhost:8081/api/v1";
                        const updateUserResponse = await fetch(`${AUTHMS_BASE_URL}/User/${doctorId}`, {
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
                                ImageUrl: imageUrl,
                            }),
                        });
                        
                        if (updateUserResponse.ok) {
                            console.log('Imagen de usuario actualizada en AuthMS');
                            currentUser.imageUrl = imageUrl;
                        } else {
                            console.warn('No se pudo actualizar la imagen en AuthMS');
                        }
                    } catch (error) {
                        console.error('Error al actualizar imagen en AuthMS:', error);
                    }
                }
                
                // Actualizar los datos locales del usuario
                if (currentUser) {
                    currentUser.firstName = firstName;
                    currentUser.lastName = lastName;
                    if (email) {
                        currentUser.email = email;
                    }
                    
                    // Actualizar en localStorage
                    try {
                        localStorage.setItem('user', JSON.stringify(currentUser));
                        const { state } = await import('./state.js');
                        state.user = currentUser;
                    } catch (storageError) {
                        console.warn('No se pudo actualizar el localStorage', storageError);
                    }
                }
                
                // Recargar datos del doctor desde el backend
                await loadDoctorData();
                
                // Mostrar notificación de éxito
                showNotification('Perfil actualizado correctamente', 'success');
                
                // Desactivar modo edición
                setProfileFormEditable(false);
                
            } catch (error) {
                console.error('Error al guardar el perfil:', error);
                const errorMessage = error.message || 'No se pudo guardar el perfil. Por favor, intenta nuevamente.';
                showNotification(errorMessage, 'error');
            }
        });
    }
    
    // Configurar editor de avatar del doctor
    setupDoctorAvatarEditor();
}

// Configurar editor de avatar para el perfil del doctor
function setupDoctorAvatarEditor() {
    const imageUrlInput = document.getElementById('doctor-image-url-input');
    const avatarPreview = document.getElementById('doctor-avatar-preview');
    
    if (!imageUrlInput || !avatarPreview) return;
    
    // Actualizar preview cuando cambie la URL
    imageUrlInput.addEventListener('input', function() {
        const url = imageUrlInput.value.trim();
        if (url) {
            avatarPreview.src = url;
            avatarPreview.onerror = function() {
                // Si falla la carga, usar imagen por defecto
                avatarPreview.src = getDoctorAvatarUrl();
            };
        } else {
            avatarPreview.src = getDoctorAvatarUrl();
        }
    });
}

function setProfileFormEditable(editable) {
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
            if (editable) {
                input.style.cursor = 'text';
            } else {
                input.style.cursor = 'not-allowed';
            }
        }
    });

    if (editBtn) {
        if (editable) {
            editBtn.style.display = 'none';
        } else {
            editBtn.style.display = 'inline-flex';
        }
    }

    if (profileActions) {
        if (editable) {
            profileActions.classList.remove('hidden');
        } else {
            profileActions.classList.add('hidden');
        }
    }
}

// Cargar datos del doctor desde el backend
async function loadDoctorData() {
    try {
        // Importar Api dinámicamente si está disponible
        const { Api } = await import('./api.js');
        
        const userId = currentUser?.userId;
        if (!userId) {
            console.error('No hay userId disponible');
            return;
        }
        
        console.log('=== CARGANDO DATOS DEL DOCTOR ===');
        console.log('userId:', userId);
        console.log('currentUser:', currentUser);
        
        // Intentar obtener doctor por UserId usando el endpoint específico
        let doctor = null;
        try {
            console.log('Intentando obtener doctor por UserId desde DirectoryMS...');
            console.log('userId:', userId);
            doctor = await Api.get(`v1/Doctor/User/${userId}`);
            console.log('✓ Doctor obtenido desde DirectoryMS:', doctor);
            if (doctor) {
                console.log('Doctor data:', {
                    doctorId: doctor.doctorId ?? doctor.DoctorId,
                    firstName: doctor.firstName ?? doctor.FirstName,
                    lastName: doctor.lastName ?? doctor.LastName,
                    specialty: doctor.specialty ?? doctor.Specialty,
                    biography: doctor.biography ?? doctor.Biography,
                    licenseNumber: doctor.licenseNumber ?? doctor.LicenseNumber,
                    userId: doctor.userId ?? doctor.UserId
                });
            }
        } catch (err) {
            console.error('Error al obtener doctor por UserId:', err);
            console.error('Mensaje de error:', err.message);
            // Si el endpoint no existe o falla, intentar obtener todos y buscar
            try {
                console.log('Intentando obtener todos los doctores como fallback...');
                const doctors = await Api.get('v1/Doctor');
                console.log('Lista de doctores recibida:', doctors);
                if (Array.isArray(doctors)) {
                    doctor = doctors.find(d => {
                        const dUserId = d.userId ?? d.UserId;
                        return dUserId === userId;
                    });
                    if (doctor) {
                        console.log('✓ Doctor encontrado en la lista:', doctor);
                    }
                }
            } catch (fallbackErr) {
                console.error('Error en fallback al buscar doctor:', fallbackErr);
            }
        }
        
        // Si aún no se encontró, intentar crearlo en DirectoryMS
        if (!doctor) {
            console.warn('No se encontró doctor en DirectoryMS, intentando crearlo...');
            try {
                // Crear el doctor en DirectoryMS con los datos del usuario
                // Nota: Specialty es obligatoria, pero como no tenemos esa info aquí, usamos "Clinico" como default
                // El usuario deberá actualizar su perfil después
                const createDoctorRequest = {
                    UserId: parseInt(userId),
                    FirstName: currentUser?.firstName ?? currentUser?.FirstName ?? '',
                    LastName: currentUser?.lastName ?? currentUser?.LastName ?? '',
                    LicenseNumber: 'PENDING', // Valor por defecto, se puede actualizar después
                    Biography: null,
                    Specialty: 'Clinico' // Valor por defecto, el usuario puede actualizarlo después
                };
                
                console.log('Creando doctor en DirectoryMS:', createDoctorRequest);
                doctor = await Api.post('v1/Doctor', createDoctorRequest);
                console.log('✓ Doctor creado exitosamente en DirectoryMS:', doctor);
            } catch (createErr) {
                console.error('Error al crear doctor en DirectoryMS:', createErr);
                // Si falla la creación, usar datos del usuario como fallback temporal
                // pero mostrar un mensaje de advertencia
                showNotification('No se pudo crear el perfil de doctor. Algunas funcionalidades pueden estar limitadas.', 'warning');
                doctor = {
                    firstName: currentUser?.firstName ?? currentUser?.FirstName ?? '',
                    FirstName: currentUser?.firstName ?? currentUser?.FirstName ?? '',
                    lastName: currentUser?.lastName ?? currentUser?.LastName ?? '',
                    LastName: currentUser?.lastName ?? currentUser?.LastName ?? '',
                    userId: currentUser?.userId ?? currentUser?.UserId,
                    UserId: currentUser?.userId ?? currentUser?.UserId,
                    specialty: null,
                    Specialty: null,
                    biography: null,
                    Biography: null,
                    licenseNumber: null,
                    LicenseNumber: null
                };
            }
        }

        // Normalizar el objeto doctor para asegurar que tenga tanto camelCase como PascalCase
        if (doctor) {
            doctor.doctorId = doctor.doctorId ?? doctor.DoctorId;
            doctor.DoctorId = doctor.DoctorId ?? doctor.doctorId;
            doctor.firstName = doctor.firstName ?? doctor.FirstName;
            doctor.FirstName = doctor.FirstName ?? doctor.firstName;
            doctor.lastName = doctor.lastName ?? doctor.LastName;
            doctor.LastName = doctor.LastName ?? doctor.lastName;
            doctor.specialty = doctor.specialty ?? doctor.Specialty;
            doctor.Specialty = doctor.Specialty ?? doctor.specialty;
            doctor.biography = doctor.biography ?? doctor.Biography;
            doctor.Biography = doctor.Biography ?? doctor.biography;
            doctor.licenseNumber = doctor.licenseNumber ?? doctor.LicenseNumber;
            doctor.LicenseNumber = doctor.LicenseNumber ?? doctor.licenseNumber;
            doctor.userId = doctor.userId ?? doctor.UserId;
            doctor.UserId = doctor.UserId ?? doctor.userId;
        }
        
        console.log('Doctor final encontrado:', doctor);
        console.log('doctorId normalizado:', doctor?.doctorId ?? doctor?.DoctorId);
        currentDoctorData = doctor;
        updateDoctorHeader(doctor);
        
        // Actualizar la sección de perfil si está visible
        const profileSection = document.getElementById('doctorProfileSection');
        if (profileSection && !profileSection.classList.contains('hidden')) {
            updateDoctorProfileSection(doctor);
        }

        // Cargar datos adicionales del doctor (consultas, agenda, etc.)
        await loadTodayConsultations();
        await loadWeeklySchedule();
        await loadDoctorStats();
        await loadTodayFullHistory();
        
    } catch (error) {
        console.error('Error al cargar datos del doctor:', error);
        console.error('Stack trace:', error.stack);
        // Si hay error, actualizar header con datos del usuario actual
        updateDoctorHeader(null);
        // También actualizar perfil con datos del usuario si está visible
        const profileSection = document.getElementById('doctorProfileSection');
        if (profileSection && !profileSection.classList.contains('hidden')) {
            updateDoctorProfileSection(null);
        }
    }
}

// Cargar consultas de hoy desde SchedulingMS
async function loadTodayConsultations() {
    const consultationsList = document.getElementById('consultations-list');
    if (!consultationsList) return;
    
    try {
        if (!currentDoctorData?.doctorId) {
            console.warn('No hay doctorId disponible para cargar consultas');
            consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudo identificar al médico</p>';
            return;
        }

        const { ApiScheduling } = await import('./api.js');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Buscar turnos SCHEDULED, CONFIRMED e IN_PROGRESS para las consultas de hoy
        const appointments = await ApiScheduling.get(`v1/Appointments?doctorId=${currentDoctorData.doctorId}&startTime=${today.toISOString()}&endTime=${tomorrow.toISOString()}`);
        // Filtrar solo los que están programados o en curso (SCHEDULED, CONFIRMED o IN_PROGRESS)
        const scheduledAppointments = appointments?.filter(a => {
            const status = a.status || a.Status;
            return status === 'SCHEDULED' || status === 'CONFIRMED' || status === 'IN_PROGRESS';
        }) || [];
        
        consultationsList.innerHTML = '';
        
        if (scheduledAppointments && scheduledAppointments.length > 0) {
            // Cargar información de pacientes desde DirectoryMS
            const { Api } = await import('./api.js');
            for (const apt of scheduledAppointments) {
                try {
                    const patientId = apt.patientId || apt.PatientId;
                    const patient = await Api.get(`v1/Patient/${patientId}`);
                    apt.patientName = `${patient.Name || patient.name || ''} ${patient.lastName || patient.LastName || ''}`.trim() || 'Paciente sin nombre';
                } catch (err) {
                    apt.patientName = 'Paciente desconocido';
                }
                const consultationItem = createConsultationItemElement(apt);
                consultationsList.appendChild(consultationItem);
            }
        } else {
            consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No hay consultas programadas para hoy</p>';
        }
        
    } catch (error) {
        console.error('Error al cargar consultas:', error);
        consultationsList.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudieron cargar las consultas del día</p>';
    }
    
    setTimeout(() => {
        initializeAttendButtons();
    }, 100);
}

// Cargar agenda semanal desde SchedulingMS
async function loadWeeklySchedule() {
    const weeklySchedule = document.getElementById('weekly-schedule');
    if (!weeklySchedule) return;
    
    try {
        if (!currentDoctorData?.doctorId) {
            console.warn('No hay doctorId disponible para cargar agenda');
            weeklySchedule.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudo identificar al médico</p>';
            return;
        }

        const { ApiScheduling } = await import('./api.js');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const appointments = await ApiScheduling.get(`v1/Appointments?doctorId=${currentDoctorData.doctorId}&startTime=${today.toISOString()}&endTime=${nextWeek.toISOString()}`);
        
        weeklySchedule.innerHTML = '';
        
        if (appointments && appointments.length > 0) {
            // Agrupar por día de la semana
            const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            const appointmentsByDay = {};
            
            appointments.forEach(apt => {
                const date = new Date(apt.startTime || apt.StartTime);
                const dayOfWeek = date.getDay();
                const dayKey = daysOfWeek[dayOfWeek];
                
                if (!appointmentsByDay[dayKey]) {
                    appointmentsByDay[dayKey] = {
                        abbreviation: dayKey,
                        dayNumber: date.getDate().toString(),
                        count: 0
                    };
                }
                appointmentsByDay[dayKey].count++;
            });
            
            // Mostrar los próximos 5 días
            const scheduleItems = [];
            for (let i = 0; i < 5; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() + i);
                const dayKey = daysOfWeek[date.getDay()];
                const dayData = appointmentsByDay[dayKey] || {
                    abbreviation: dayKey,
                    dayNumber: date.getDate().toString(),
                    count: 0
                };
                scheduleItems.push(dayData);
            }
            
            scheduleItems.forEach(day => {
                const scheduleItem = createScheduleItemElement(day);
                weeklySchedule.appendChild(scheduleItem);
            });
        } else {
            weeklySchedule.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No hay agenda disponible</p>';
        }
        
    } catch (error) {
        console.error('Error al cargar agenda:', error);
        weeklySchedule.innerHTML = '<p style="color: #6b7280; padding: 2rem; text-align: center;">No se pudo cargar la agenda</p>';
    }
}
// Consultas históricas del día (todas)
async function loadTodayFullHistory() {
    const container = document.getElementById('navbar-today-history');
    if (!container) return;

    if (!currentDoctorData?.doctorId) {
        container.innerHTML = "<p>No se pudo identificar al médico.</p>";
        return;
    }

    try {
        const { ApiScheduling } = await import('./api.js');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);

        // 🔥 Cargar **todo** del día, no solo programados
        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${currentDoctorData.doctorId}&startTime=${today.toISOString()}&endTime=${tomorrow.toISOString()}`
        );

        if (!appointments || appointments.length === 0) {
            container.innerHTML = "<p>No hay historial del día.</p>";
            return;
        }

        // Cargar nombre de paciente
        const { Api } = await import('./api.js');

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
                isHistory: true // marcador opcional
            });
            container.appendChild(item);
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = "<p>Error cargando historial.</p>";
    }
}
// Cargar estadísticas del doctor desde SchedulingMS
async function loadDoctorStats() {
    try {
        if (!currentDoctorData?.doctorId) {
            console.warn('No hay doctorId disponible para cargar estadísticas');
            return;
        }

        const { ApiScheduling } = await import('./api.js');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        // Cargar turnos de hoy (SCHEDULED, CONFIRMED e IN_PROGRESS)
        const todayAppointmentsResponse = await ApiScheduling.get(`v1/Appointments?doctorId=${currentDoctorData.doctorId}&startTime=${today.toISOString()}&endTime=${tomorrow.toISOString()}`);
        const todayAppointments = todayAppointmentsResponse?.filter(a => {
            const status = a.status || a.Status;
            return status === 'SCHEDULED' || status === 'CONFIRMED' || status === 'IN_PROGRESS';
        }) || [];
        
        // Cargar turnos de la semana
        const weekAppointments = await ApiScheduling.get(`v1/Appointments?doctorId=${currentDoctorData.doctorId}&startTime=${today.toISOString()}&endTime=${nextWeek.toISOString()}`);
        
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
        if (activeConsultation) {
            activeConsultation.textContent = '0'; // Por ahora, se actualiza cuando se atiende una consulta
        }
        if (prescriptionsToday) {
            prescriptionsToday.textContent = '0'; // Por ahora, se actualiza cuando se emite una receta
        }
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        // Mantener valores por defecto del HTML
    }
}

// Crear elemento de consulta
function createConsultationItemElement(appointment) {
    const item = document.createElement('div');
    item.className = 'consultation-item';
    
    const startTime = new Date(appointment.startTime || appointment.StartTime);
    const endTime = new Date(appointment.endTime || appointment.EndTime);
    const status = appointment.status || appointment.Status || 'SCHEDULED';
    const reason = appointment.reason || appointment.Reason || 'Sin motivo';
    const patientName = appointment.patientName || 'Paciente Desconocido';
    const appointmentId = appointment.appointmentId || appointment.AppointmentId;
    
    const statusClass = status === 'SCHEDULED' ? 'pending' :
                       status === 'CONFIRMED' ? 'waiting' : 
                       status === 'IN_PROGRESS' ? 'in-progress' :
                       status === 'COMPLETED' ? 'completed' : 
                       status === 'CANCELLED' ? 'cancelled' :
                       status === 'NO_SHOW' ? 'no-show' : 'pending';
    const statusText = status === 'SCHEDULED' ? 'Programado' :
                      status === 'CONFIRMED' ? 'Confirmado' :
                      status === 'IN_PROGRESS' ? 'En curso' :
                      status === 'COMPLETED' ? 'Completado' : 
                      status === 'CANCELLED' ? 'Cancelado' :
                      status === 'RESCHEDULED' ? 'Reprogramado' :
                      status === 'NO_SHOW' ? 'No asistió' : 'Pendiente';
    
    const timeStr = `${startTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
    
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
            ${status === 'COMPLETED' ? `
                <span style="color: #10b981; font-weight: 600; font-size: 0.875rem;">
                    <i class="fas fa-check-circle"></i> Consulta realizada
                </span>
            ` : (status === 'CONFIRMED' || status === 'SCHEDULED') ? `
                <button class="btn-attend" data-appointment-id="${appointmentId}" data-patient-id="${appointment.patientId || appointment.PatientId}" data-patient-name="${patientName}">
                    Atender
                </button>
            ` : status === 'IN_PROGRESS' ? `
                <button class="btn btn-success btn-sm complete-consultation-btn" data-appointment-id="${appointmentId}" data-patient-id="${appointment.patientId || appointment.PatientId}" data-patient-name="${patientName}">
                    <i class="fas fa-check"></i> Completar
                </button>
                <button class="btn btn-warning btn-sm no-show-consultation-btn" data-appointment-id="${appointmentId}" style="margin-left: 0.5rem;">
                    <i class="fas fa-times"></i> No asistió
                </button>
            ` : ''}
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
        item.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Obtener la sección
            const section = this.getAttribute('data-section');
            console.log('Navegación clickeada:', section);
            setActiveNav(section);
            await handleSectionNavigation(section);
        });
    });

    setActiveNav('inicio');
    handleSectionNavigation('inicio');
}
// ============================
// HISTORIA CLÍNICA DEL DOCTOR
// ============================

async function loadDoctorHistory() {
    const listEl = document.getElementById("doctor-history-list");
    if (!listEl) return;

    listEl.innerHTML = `
        <tr><td colspan="5" style="text-align:center; padding:20px;">
            <i class="fas fa-spinner fa-spin"></i> Cargando historial...
        </td></tr>
    `;

    try {
        const doctorId = currentDoctor?.doctorId || currentDoctor?.DoctorId;

        const { ApiClinical, Api } = await import("./api.js");

        const now = new Date();
        const from = new Date(now.getFullYear() - 3, 0, 1);

        const history = await ApiClinical.get(
            `v1/Encounter?doctorId=${doctorId}&from=${from.toISOString()}&to=${now.toISOString()}`
        );

        const encounters = Array.isArray(history) ? history : history?.value || [];

        // Obtener info de pacientes
        const patientIds = [...new Set(encounters.map(x => x.patientId || x.PatientId))];
        const patientsMap = new Map();

        for (const pid of patientIds) {
            try {
                const patient = await Api.get(`v1/Patient/${pid}`);
                patientsMap.set(pid, `${patient.firstName} ${patient.lastName}`);
            } catch {
                patientsMap.set(pid, "Paciente desconocido");
            }
        }

        // Renderizar filas
        listEl.innerHTML = encounters.map(enc => {
            const date = new Date(enc.date || enc.Date);
            const patientId = enc.patientId || enc.PatientId;

            return `
                <tr>
                    <td>${date.toLocaleDateString("es-AR")}</td>
                    <td>${patientsMap.get(patientId)}</td>
                    <td>${enc.diagnosis || enc.Diagnosis || "—"}</td>
                    <td>${enc.treatment || enc.Treatment || "—"}</td>
                    <td>
                        <button class="btn-history-action" onclick="viewEncounterDetails(${enc.encounterId || enc.EncounterId})">
                            <i class="fas fa-eye"></i> Ver
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

    } catch (error) {
        console.error("Error cargando historia clínica:", error);
        listEl.innerHTML = `
            <tr><td colspan="5" style="text-align:center; padding:20px;">
                No se pudo cargar el historial
            </td></tr>
        `;
    }
}
async function loadTodayConsultationsForNav() {
    const list = document.getElementById('consultas-hoy-list');
    if (!list) return;

    try {
        const { ApiScheduling, Api } = await import('./api.js');

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // pedir turnos
        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${currentDoctorData.doctorId}&startTime=${today.toISOString()}&endTime=${tomorrow.toISOString()}`
        );

        list.innerHTML = '';

        if (!appointments || appointments.length === 0) {
            list.innerHTML = `<p style="padding:1rem; text-align:center;">No hay consultas hoy</p>`;
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
async function loadTodayConsultationsView() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;

    // Eliminar pantallas anteriores
    

    // Crear contenedor
    const section = document.createElement('div');
    section.className = 'dashboard-section consultas-section';
    section.innerHTML = `
        <div class="section-header">
            <h3>Consultas de hoy</h3>
            <p>Historial de turnos programados para hoy</p>
        </div>
        <div id="consultas-hoy-list" class="consultations-list">
            <p style="padding:1rem;">Cargando...</p>
        </div>
    `;
    dashboardContent.appendChild(section);

    // Llamar tu función original
    await loadTodayConsultationsForNav();
}
// ------------------------------
// Buscador de historia clínica
// ------------------------------
document.getElementById("historySearchInput")?.addEventListener("input", function () {
    const term = this.value.toLowerCase();
    const rows = document.querySelectorAll("#doctor-history-list tr");

    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? "" : "none";
    });
});
async function handleSectionNavigation(section) {
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
    const existingPatients = dashboardContent.querySelectorAll('.patients-section');
    existingPatients.forEach(patients => {
        patients.remove();
    
    });
    const existingConsultas = dashboardContent.querySelectorAll('.consultas-section');
    existingConsultas.forEach(sec => sec.remove()); 
    

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
                console.log('Navegando a perfil...');
                // Cargar datos del doctor si no están disponibles
                if (!currentDoctorData) {
                    console.log('No hay datos del doctor, cargando...');
                    await loadDoctorData();
                }
                // Actualizar datos del perfil
                updateDoctorProfileSection(currentDoctorData);
                // Mostrar sección de perfil
                profileSection.classList.remove('hidden');
                profileSection.style.display = '';
                setProfileFormEditable(false);
                console.log('Perfil mostrado');
            } else {
                console.error('No se encontró la sección de perfil');
            }
            break;
        case 'consultas':
            loadTodayConsultationsView();
            break;
        case 'historia':
        case 'recetas':
            showComingSoonSectionDoctor(section);
            break;
        case 'agenda':
            await loadAgendaView();
            break;
        case 'pacientes':
            await loadPatientsView();
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
            
            if (appointmentId) {
                // Cambiar estado a IN_PROGRESS antes de abrir el modal
                await updateAppointmentStatus(appointmentId, 'IN_PROGRESS');
                
                if (patientId && patientName) {
                    // Abrir modal de encuentro clínico
                    attendConsultation(appointmentId, patientId, patientName);
                }
            } else {
                // Fallback para compatibilidad con código antiguo
                const oldPatientName = this.getAttribute('data-patient');
                if (oldPatientName) {
                    attendConsultation(null, null, oldPatientName);
                }
            }
        });
    });
    
    // Botones de completar
    const completeButtons = document.querySelectorAll('.complete-appointment-btn');
    completeButtons.forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            const patientId = this.getAttribute('data-patient-id');
            const patientName = this.getAttribute('data-patient-name');
            
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
                await updateAppointmentStatus(appointmentId, 'NO_SHOW', 'Paciente no asistió');
                showNotification('Turno marcado como "No asistió"', 'info');
                // Recargar agenda
                const agendaSection = document.querySelector('.agenda-section');
                if (agendaSection) {
                    await renderAgendaContent(agendaSection);
                }
                // Recargar consultas de hoy
                await loadTodayConsultations();
            }
        });
    });
    
    // Botones de completar consulta (en la vista de consultas de hoy)
    const completeConsultationButtons = document.querySelectorAll('.complete-consultation-btn');
    completeConsultationButtons.forEach(button => {
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        newButton.addEventListener('click', async function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            const patientId = this.getAttribute('data-patient-id');
            const patientName = this.getAttribute('data-patient-name');
            
            if (appointmentId && patientId && patientName) {
                // Abrir modal para completar (crear encounter)
                attendConsultation(appointmentId, patientId, patientName);
            }
        });
    });
}

// Inicializar desplegables de estado
function initializeStatusSelects() {
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
                    await updateAppointmentStatus(appointmentId, newStatus);
                } else {
                    // Revertir selección
                    const appointmentItem = this.closest('.agenda-appointment-item');
                    if (appointmentItem) {
                        // Recargar el item para restaurar el estado anterior
                        const agendaSection = document.querySelector('.agenda-section');
                        if (agendaSection) {
                            await renderAgendaContent(agendaSection);
                        }
                    }
                }
            }
        });
    });
}

// Actualizar estado del appointment
async function updateAppointmentStatus(appointmentId, newStatus, reason = null, silent = false) {
    try {
        const { ApiScheduling } = await import('./api.js');
        
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
        
        // Recargar agenda si está visible
        const agendaSection = document.querySelector('.agenda-section');
        if (agendaSection && agendaSection.style.display !== 'none') {
            await renderAgendaContent(agendaSection);
        }
        
        // También recargar consultas de hoy si están visibles
        const consultationsSection = document.querySelector('.consultations-section');
        if (consultationsSection && consultationsSection.style.display !== 'none') {
            await loadTodayConsultations();
        }
        
        await loadDoctorStats();
        
        // Reinicializar botones después de un breve delay para asegurar que el DOM se actualizó
        setTimeout(() => {
            initializeAttendButtons();
            initializeStatusSelects();
        }, 300);
        
    } catch (error) {
        console.error('Error al actualizar estado del turno:', error);
        if (!silent) {
            showNotification(`Error al actualizar estado: ${error.message || 'Error desconocido'}`, 'error');
        }
        throw error; // Re-lanzar para que el llamador pueda manejarlo
    }
}

// Atender consulta y crear encuentro en ClinicalMS
async function attendConsultation(appointmentId, patientId, patientName) {
    try {
        if (!currentDoctorData?.doctorId) {
            showNotification('No se pudo identificar al médico', 'error');
            return;
        }

        showNotification(`Iniciando consulta con ${patientName}...`, 'info');
        
        // Cambiar estado del botón
        const button = document.querySelector(`[data-appointment-id="${appointmentId}"]`);
        if (button) {
            button.innerHTML = '<i class="fas fa-video"></i> En consulta';
            button.classList.add('in-consultation');
            button.disabled = true;
        }
        
        // Actualizar contador de consultas activas
        updateActiveConsultations(1);
        
        // Abrir modal para crear encuentro clínico
        openEncounterModal(appointmentId, patientId, patientName);
        
    } catch (error) {
        console.error('Error al iniciar consulta:', error);
        showNotification('Error al iniciar la consulta', 'error');
    }
}

// Abrir modal para crear/editar encuentro clínico
async function openEncounterModal(appointmentId, patientId, patientName) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
                <h3>Consulta con ${patientName}</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="encounter-form">
                    <input type="hidden" id="encounter-appointment-id" value="${appointmentId}">
                    <input type="hidden" id="encounter-patient-id" value="${patientId}">
                    
                    <div class="form-group">
                        <label for="encounter-reasons">Motivo de consulta:</label>
                        <textarea id="encounter-reasons" name="reasons" rows="2" required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="encounter-subjective">Subjetivo (S):</label>
                        <textarea id="encounter-subjective" name="subjective" rows="3" placeholder="Síntomas, historia clínica del paciente..." required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="encounter-objective">Objetivo (O):</label>
                        <textarea id="encounter-objective" name="objective" rows="3" placeholder="Hallazgos físicos, signos vitales..." required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="encounter-assessment">Evaluación (A):</label>
                        <textarea id="encounter-assessment" name="assessment" rows="3" placeholder="Diagnóstico, evaluación clínica..." required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="encounter-plan">Plan (P):</label>
                        <textarea id="encounter-plan" name="plan" rows="3" placeholder="Tratamiento, indicaciones, seguimiento..." required></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="encounter-notes">Notas adicionales:</label>
                        <textarea id="encounter-notes" name="notes" rows="2"></textarea>
                    </div>
                    
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" id="cancel-encounter">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Consulta</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelectorAll('.close-modal, #cancel-encounter').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.remove();
            // Restaurar botón si se cancela
            const appointmentId = document.getElementById('encounter-appointment-id')?.value;
            if (appointmentId) {
                const button = document.querySelector(`[data-appointment-id="${appointmentId}"]`);
                if (button) {
                    button.innerHTML = 'Atender';
                    button.classList.remove('in-consultation');
                    button.disabled = false;
                }
            }
            updateActiveConsultations(-1);
        });
    });
    
    // Verificar si ya existe un encounter para este appointment
    try {
        const { ApiClinical } = await import('./api.js');
        const existingEncounters = await ApiClinical.get(`v1/Encounter?appointmentId=${appointmentId}`);
        
        if (existingEncounters && existingEncounters.length > 0) {
            const existingEncounter = Array.isArray(existingEncounters) ? existingEncounters[0] : existingEncounters;
            showNotification('Esta consulta ya fue atendida anteriormente. No se puede crear otra.', 'warning');
            modal.remove();
            
            // Actualizar el estado del appointment a COMPLETED si no lo está
            try {
                await updateAppointmentStatus(appointmentId, 'COMPLETED', null, true);
            } catch (err) {
                console.warn('No se pudo actualizar el estado:', err);
            }
            
            // Recargar vistas
            await loadTodayConsultations();
            const agendaSection = document.querySelector('.agenda-section');
            if (agendaSection && agendaSection.style.display !== 'none') {
                await renderAgendaContent(agendaSection);
            }
            return;
        }
    } catch (err) {
        console.warn('No se pudo verificar encounters existentes:', err);
        // Continuar con el proceso si hay error al verificar
    }
    
    let isSaving = false;
    modal.querySelector('#encounter-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Prevenir múltiples envíos
        if (isSaving) {
            return;
        }
        
        isSaving = true;
        const submitButton = modal.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        try {
            await saveEncounter(modal, appointmentId, patientId);
        } catch (error) {
            console.error('Error al guardar:', error);
            // Restaurar botón en caso de error
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
            isSaving = false;
        }
    });
}

// Guardar encuentro en ClinicalMS
async function saveEncounter(modal, appointmentId, patientId) {
    try {
        if (!currentDoctorData?.doctorId) {
            showNotification('No se pudo identificar al médico', 'error');
            return;
        }

        const { ApiClinical } = await import('./api.js');
        
        // Preparar datos en el formato que espera el backend (PascalCase)
        const encounterData = {
            PatientId: parseInt(patientId),
            DoctorId: currentDoctorData.doctorId,
            AppointmentId: parseInt(appointmentId),
            Reasons: document.getElementById('encounter-reasons').value.trim(),
            Subjective: document.getElementById('encounter-subjective').value.trim(),
            Objetive: document.getElementById('encounter-objective').value.trim(),
            Assessment: document.getElementById('encounter-assessment').value.trim(),
            Plan: document.getElementById('encounter-plan').value.trim(),
            Notes: document.getElementById('encounter-notes').value.trim(),
            Status: 'COMPLETED',
            Date: new Date().toISOString()
        };
        
        // Validar que todos los campos requeridos estén completos
        if (!encounterData.Reasons || !encounterData.Subjective || !encounterData.Objetive || 
            !encounterData.Assessment || !encounterData.Plan) {
            showNotification('Por favor completa todos los campos requeridos (S, O, A, P)', 'error');
            return;
        }
        
        console.log('Enviando encounter a ClinicalMS:', encounterData);
        
        let encounter;
        try {
            encounter = await ApiClinical.post(`v1/Encounter?patientId=${patientId}`, encounterData);
        } catch (error) {
            // Si el error es 409 (Conflict) o el mensaje indica que ya existe un encounter
            if (error.status === 409 || (error.message && (error.message.includes('Ya existe') || error.message.includes('ya fue atendida')))) {
                showNotification('Esta consulta ya fue atendida anteriormente. No se puede crear otra.', 'warning');
                modal.remove();
                
                // Actualizar el estado del appointment a COMPLETED
                try {
                    await updateAppointmentStatus(appointmentId, 'COMPLETED', null, true);
                } catch (err) {
                    console.warn('No se pudo actualizar el estado:', err);
                }
                
                // Recargar vistas
                await loadTodayConsultations();
                const agendaSection = document.querySelector('.agenda-section');
                if (agendaSection && agendaSection.style.display !== 'none') {
                    await renderAgendaContent(agendaSection);
                }
                return;
            }
            throw error; // Re-lanzar si es otro tipo de error
        }
        
        showNotification('Consulta guardada exitosamente', 'success');
        modal.remove();
        
        // Actualizar estado del appointment a COMPLETED (silent=true para evitar notificación duplicada)
        try {
            await updateAppointmentStatus(appointmentId, 'COMPLETED', null, true);
            console.log('Estado del appointment actualizado a COMPLETED');
        } catch (err) {
            console.error('Error al actualizar estado del appointment:', err);
            showNotification('Consulta guardada, pero no se pudo actualizar el estado del turno', 'warning');
        }
        
        updateActiveConsultations(-1);
        updatePrescriptionsToday(1);
        
    } catch (error) {
        console.error('Error al guardar encuentro:', error);
        showNotification(`Error al guardar la consulta: ${error.message || 'Error desconocido'}`, 'error');
    }
}

function finishConsultation(patientName) {
    // Esta función ya no se usa directamente, se maneja desde saveEncounter
    console.log('finishConsultation obsoleto, usar saveEncounter');
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
            loadPatientsView();
        });
    }
    
    // También el botón del HTML
    const viewPatientsBtn2 = document.getElementById('viewPatients');
    if (viewPatientsBtn2) {
        viewPatientsBtn2.addEventListener('click', function() {
            loadPatientsView();
        });
    }
    
    if (manageScheduleBtn) {
        manageScheduleBtn.addEventListener('click', function() {
            openScheduleManager();
        });
    }
    
    // También el botón del HTML
    const manageScheduleBtn2 = document.getElementById('manageSchedule');
    if (manageScheduleBtn2) {
        manageScheduleBtn2.addEventListener('click', function() {
            openScheduleManager();
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
    // Determinar el icono según el tipo
    let iconClass = 'fa-info-circle';
    if (type === 'success') {
        iconClass = 'fa-check-circle';
    } else if (type === 'error') {
        iconClass = 'fa-exclamation-circle';
    } else if (type === 'warning') {
        iconClass = 'fa-exclamation-triangle';
    }
    
    // Crear elemento de notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${iconClass}"></i>
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
                color: #10b981;
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
                border-left: 4px solid #10b981;
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

// Cargar vista de agenda completa con todos los turnos
async function loadAgendaView() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    // Eliminar secciones anteriores
    const existingAgendas = dashboardContent.querySelectorAll('.agenda-section');
    existingAgendas.forEach(agenda => agenda.remove());
    
    const existingComingSoon = dashboardContent.querySelectorAll('.coming-soon-section');
    existingComingSoon.forEach(comingSoon => comingSoon.remove());
    
    // Ocultar otras secciones
    const mainDashboard = document.getElementById('mainDashboardSection');
    const profileSection = document.getElementById('doctorProfileSection');
    if (mainDashboard) mainDashboard.style.display = 'none';
    if (profileSection) {
        profileSection.style.display = 'none';
        profileSection.classList.add('hidden');
    }
    
    // Crear sección de agenda
    const agendaSection = document.createElement('div');
    agendaSection.className = 'agenda-section';
    
    // Mostrar loading
    agendaSection.innerHTML = `
        <div class="dashboard-section">
            <div class="section-header">
                <div>
                    <h2>Agenda Médica</h2>
                    <p>Gestión completa de tus turnos asignados</p>
                </div>
                <div class="section-header-actions">
                    <button class="btn btn-secondary" id="refreshAgendaBtn">
                        <i class="fas fa-sync-alt"></i> Actualizar
                    </button>
                </div>
            </div>
            <div id="agenda-content" style="padding: 2rem; text-align: center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #2563eb;"></i>
                <p style="margin-top: 1rem; color: #6b7280;">Cargando turnos...</p>
            </div>
        </div>
    `;
    
    dashboardContent.appendChild(agendaSection);
    
    // Agregar event listener al botón de actualizar
    setTimeout(() => {
        const refreshBtn = document.getElementById('refreshAgendaBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await renderAgendaContent(agendaSection);
            });
        }
    }, 100);
    
    // Cargar y renderizar turnos
    await renderAgendaContent(agendaSection);
}

// Renderizar contenido de la agenda
async function renderAgendaContent(agendaSection) {
    const agendaContent = agendaSection.querySelector('#agenda-content');
    if (!agendaContent) return;
    
    try {
        if (!currentDoctorData?.doctorId) {
            // Intentar cargar datos del doctor si no están disponibles
            await loadDoctorData();
            if (!currentDoctorData?.doctorId) {
                agendaContent.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: #dc2626;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p>No se pudo identificar al médico. Por favor, recarga la página.</p>
                    </div>
                `;
                return;
            }
        }
        
        const { ApiScheduling } = await import('./api.js');
        const { Api } = await import('./api.js');
        
        // Obtener todos los turnos del médico (próximos 3 meses)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const threeMonthsLater = new Date(today);
        threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
        
        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${currentDoctorData.doctorId}&startTime=${today.toISOString()}&endTime=${threeMonthsLater.toISOString()}`
        );
        
        // Debug: ver qué está llegando desde la API
        console.log('=== APPOINTMENTS DESDE API ===');
        console.log('Total appointments:', appointments?.length);
        if (appointments && appointments.length > 0) {
            console.log('Primer appointment completo:', JSON.stringify(appointments[0], null, 2));
            console.log('Campos del primer appointment:', Object.keys(appointments[0]));
        }
        
        if (!appointments || appointments.length === 0) {
            agendaContent.innerHTML = `
                <div style="padding: 3rem; text-align: center; color: #6b7280;">
                    <i class="fas fa-calendar-times" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3 style="margin-bottom: 0.5rem;">No hay turnos asignados</h3>
                    <p>No tienes turnos programados en los próximos 3 meses.</p>
                </div>
            `;
            return;
        }
        
        // Cargar información de pacientes para cada turno
        const appointmentsWithPatients = await Promise.all(
            appointments.map(async (apt) => {
                try {
                    const patientId = apt.patientId || apt.PatientId;
                    const patient = await Api.get(`v1/Patient/${patientId}`);
                    return {
                        ...apt,
                        patientName: `${patient.name || patient.Name || ''} ${patient.lastName || patient.LastName || ''}`.trim() || 'Paciente sin nombre',
                        patientDni: patient.dni || patient.Dni || 'N/A'
                    };
                } catch (err) {
                    console.warn(`No se pudo cargar paciente ${apt.patientId || apt.PatientId}:`, err);
                    return {
                        ...apt,
                        patientName: 'Paciente desconocido',
                        patientDni: 'N/A'
                    };
                }
            })
        );
        
        // Agrupar turnos por fecha
        const appointmentsByDate = {};
        appointmentsWithPatients.forEach(apt => {
            // Parsear fecha correctamente usando UTC para evitar problemas de zona horaria
            const startTimeStr = apt.startTime || apt.StartTime;
            const startTime = new Date(startTimeStr);
            
            // Extraer la fecha en UTC para evitar cambios por zona horaria
            const year = startTime.getUTCFullYear();
            const month = String(startTime.getUTCMonth() + 1).padStart(2, '0');
            const day = String(startTime.getUTCDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;
            
            if (!appointmentsByDate[dateKey]) {
                appointmentsByDate[dateKey] = [];
            }
            appointmentsByDate[dateKey].push(apt);
        });
        
        // Ordenar fechas
        const sortedDates = Object.keys(appointmentsByDate).sort();
        
        // Renderizar HTML
        const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        
        let html = `
            <div style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0; color: #1f2937;">Total de turnos: ${appointments.length}</h3>
                    <div style="display: flex; gap: 0.5rem;">
                        <span style="padding: 0.25rem 0.75rem; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 0.875rem;">
                            Programados: ${appointments.filter(a => (a.status || a.Status) === 'SCHEDULED').length}
                        </span>
                        <span style="padding: 0.25rem 0.75rem; background: #d1fae5; color: #059669; border-radius: 4px; font-size: 0.875rem;">
                            Confirmados: ${appointments.filter(a => (a.status || a.Status) === 'CONFIRMED').length}
                        </span>
                        <span style="padding: 0.25rem 0.75rem; background: #dcfce7; color: #166534; border-radius: 4px; font-size: 0.875rem;">
                            Completados: ${appointments.filter(a => (a.status || a.Status) === 'COMPLETED').length}
                        </span>
                        <span style="padding: 0.25rem 0.75rem; background: #fee2e2; color: #991b1b; border-radius: 4px; font-size: 0.875rem;">
                            Cancelados: ${appointments.filter(a => (a.status || a.Status) === 'CANCELLED').length}
                        </span>
                        <span style="padding: 0.25rem 0.75rem; background: #d1fae5; color: #059669; border-radius: 4px; font-size: 0.875rem;">
                            En curso: ${appointments.filter(a => (a.status || a.Status) === 'IN_PROGRESS').length}
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        if (sortedDates.length === 0) {
            html += '<p style="color: #6b7280; text-align: center; padding: 2rem;">No hay turnos para mostrar</p>';
        } else {
            html += '<div class="agenda-days-container">';
            
            sortedDates.forEach(dateKey => {
                // Parsear fecha en UTC para mantener la fecha correcta
                const [year, month, day] = dateKey.split('-').map(Number);
                const date = new Date(Date.UTC(year, month - 1, day));
                const dayName = daysOfWeek[date.getUTCDay()];
                const dayNumber = day; // Usar el día directamente del dateKey
                const monthName = months[month - 1]; // Usar el mes directamente del dateKey
                const dayAppointments = appointmentsByDate[dateKey].sort((a, b) => {
                    const timeA = new Date(a.startTime || a.StartTime);
                    const timeB = new Date(b.startTime || b.StartTime);
                    return timeA - timeB;
                });
                
                html += `
                    <div class="agenda-day-card" style="margin-bottom: 1.5rem; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                        <div class="agenda-day-header" style="background: #f3f4f6; padding: 1rem 1.5rem; border-bottom: 1px solid #e5e7eb;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <h3 style="margin: 0; color: #1f2937; font-size: 1.25rem;">
                                        ${dayName}, ${dayNumber} de ${monthName}
                                    </h3>
                                    <p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.875rem;">
                                        ${dayAppointments.length} ${dayAppointments.length === 1 ? 'turno' : 'turnos'}
                                    </p>
                                </div>
                                <span style="padding: 0.5rem 1rem; background: #10b981; color: white; border-radius: 6px; font-weight: 600;">
                                    ${dayAppointments.length}
                                </span>
                            </div>
                        </div>
                        <div class="agenda-day-appointments" style="padding: 1rem 1.5rem;">
                `;
                
                dayAppointments.forEach(apt => {
                    // Parsear fechas correctamente usando UTC
                    const startTime = new Date(apt.startTime || apt.StartTime);
                    const endTime = new Date(apt.endTime || apt.EndTime);
                    const status = apt.status || apt.Status || 'SCHEDULED';
                    
                    // Formatear hora en zona horaria local para mostrar la hora correcta
                    // Pero usar UTC para la fecha para evitar cambios de día
                    const startHour = String(startTime.getHours()).padStart(2, '0');
                    const startMin = String(startTime.getMinutes()).padStart(2, '0');
                    const endHour = String(endTime.getHours()).padStart(2, '0');
                    const endMin = String(endTime.getMinutes()).padStart(2, '0');
                    const timeStr = `${startHour}:${startMin} - ${endHour}:${endMin}`;
                    
                    // Obtener el motivo de la consulta - verificar múltiples variantes
                    let reason = apt.reason || apt.Reason || apt.reasonText || apt.ReasonText || '';
                    // Si el motivo está vacío o es null/undefined, usar el texto por defecto
                    if (!reason || reason.trim() === '' || reason === 'null' || reason === 'undefined') {
                        reason = 'Sin motivo especificado';
                    }
                    
                    // Debug: mostrar en consola si no hay motivo
                    if (reason === 'Sin motivo especificado') {
                        console.log('Appointment sin motivo:', {
                            appointmentId: apt.appointmentId || apt.AppointmentId,
                            rawReason: apt.reason,
                            rawReasonPascal: apt.Reason,
                            fullApt: apt
                        });
                    }
                    
                    const appointmentId = apt.appointmentId || apt.AppointmentId;
                    
                    let statusBadge = '';
                    let statusColor = '#6b7280';
                    if (status === 'SCHEDULED') {
                        statusBadge = 'Programado';
                        statusColor = '#f59e0b'; // Amarillo/naranja para pendiente de confirmación
                    } else if (status === 'CONFIRMED') {
                        statusBadge = 'Confirmado';
                        statusColor = '#10b981'; // Verde para confirmado
                    } else if (status === 'COMPLETED') {
                        statusBadge = 'Completado';
                        statusColor = '#10b981'; // Verde para completado
                    } else if (status === 'CANCELLED') {
                        statusBadge = 'Cancelado';
                        statusColor = '#dc2626'; // Rojo para cancelado
                    } else if (status === 'RESCHEDULED') {
                        statusBadge = 'Reprogramado';
                        statusColor = '#8b5cf6'; // Púrpura para reprogramado
                    } else if (status === 'NO_SHOW') {
                        statusBadge = 'No asistió';
                        statusColor = '#6b7280'; // Gris para no asistió
                    } else if (status === 'IN_PROGRESS') {
                        statusBadge = 'En curso';
                        statusColor = '#3b82f6'; // Azul más claro para en curso
                    } else {
                        statusBadge = status;
                    }
                    
                    // Determinar qué acciones mostrar según el estado
                    let actionButtons = '';
                    if (status === 'COMPLETED') {
                        // Turno completado - no mostrar botones de acción
                        actionButtons = `
                            <span style="padding: 0.5rem 1rem; font-size: 0.875rem; color: #10b981; font-weight: 600;">
                                <i class="fas fa-check-circle"></i> Consulta realizada
                            </span>
                        `;
                    } else if (status === 'SCHEDULED' || status === 'CONFIRMED') {
                        // Mostrar botón "Atender" que cambia a IN_PROGRESS
                        actionButtons = `
                            <button class="btn btn-primary btn-sm attend-appointment-btn" 
                                    data-appointment-id="${appointmentId}" 
                                    data-patient-id="${apt.patientId || apt.PatientId}" 
                                    data-patient-name="${apt.patientName}"
                                    style="padding: 0.5rem 1rem; font-size: 0.875rem; margin-right: 0.5rem;">
                                <i class="fas fa-video"></i> Atender
                            </button>
                        `;
                    } else if (status === 'IN_PROGRESS') {
                        // Si está en curso, mostrar opciones para completar o marcar como no asistió
                        actionButtons = `
                            <button class="btn btn-success btn-sm complete-appointment-btn" 
                                    data-appointment-id="${appointmentId}" 
                                    data-patient-id="${apt.patientId || apt.PatientId}" 
                                    data-patient-name="${apt.patientName}"
                                    style="padding: 0.5rem 1rem; font-size: 0.875rem; margin-right: 0.5rem;">
                                <i class="fas fa-check"></i> Completar
                            </button>
                            <button class="btn btn-warning btn-sm no-show-appointment-btn" 
                                    data-appointment-id="${appointmentId}" 
                                    style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                                <i class="fas fa-times"></i> No asistió
                            </button>
                        `;
                    } else if (status === 'CANCELLED' || status === 'NO_SHOW') {
                        // Turnos cancelados o no asistidos - no mostrar botones
                        actionButtons = '';
                    }
                    
                    html += `
                        <div class="agenda-appointment-item" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; margin-bottom: 0.75rem; background: #f9fafb; border-radius: 6px; border-left: 4px solid ${statusColor};">
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                                    <div style="font-weight: 600; color: #1f2937; font-size: 1.1rem;">
                                        ${apt.patientName}
                                    </div>
                                    <select class="appointment-status-select" 
                                            data-appointment-id="${appointmentId}"
                                            style="padding: 0.25rem 0.5rem; border: 1px solid #e5e7eb; border-radius: 4px; font-size: 0.75rem; background: white; color: ${statusColor}; font-weight: 600; cursor: pointer;">
                                        <option value="SCHEDULED" ${status === 'SCHEDULED' ? 'selected' : ''}>Programado</option>
                                        <option value="CONFIRMED" ${status === 'CONFIRMED' ? 'selected' : ''}>Confirmado</option>
                                        <option value="IN_PROGRESS" ${status === 'IN_PROGRESS' ? 'selected' : ''}>En curso</option>
                                        <option value="COMPLETED" ${status === 'COMPLETED' ? 'selected' : ''}>Completado</option>
                                        <option value="NO_SHOW" ${status === 'NO_SHOW' ? 'selected' : ''}>No asistió</option>
                                        <option value="CANCELLED" ${status === 'CANCELLED' ? 'selected' : ''}>Cancelado</option>
                                        <option value="RESCHEDULED" ${status === 'RESCHEDULED' ? 'selected' : ''}>Reprogramado</option>
                                    </select>
                                </div>
                                <div style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <i class="fas fa-clock" style="margin-right: 0.5rem;"></i>${timeStr}
                                </div>
                                <div style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.25rem;">
                                    <i class="fas fa-user" style="margin-right: 0.5rem;"></i>DNI: ${apt.patientDni}
                                </div>
                                <div style="color: #6b7280; font-size: 0.875rem;">
                                    <i class="fas fa-stethoscope" style="margin-right: 0.5rem;"></i>${reason}
                                </div>
                            </div>
                            <div style="display: flex; gap: 0.5rem; margin-left: 1rem; align-items: center;">
                                ${actionButtons}
                            </div>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            });
            
            html += '</div>';
        }
        
        agendaContent.innerHTML = html;
        
        // Inicializar botones de atención y desplegables de estado
        setTimeout(() => {
            initializeAttendButtons();
            initializeStatusSelects();
        }, 100);
        
    } catch (error) {
        console.error('Error al cargar agenda:', error);
        agendaContent.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #dc2626;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Error al cargar la agenda: ${error.message || 'Error desconocido'}</p>
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 1rem;">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// Cargar vista de pacientes
async function loadPatientsView() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    // Eliminar secciones anteriores
    const existingSections = dashboardContent.querySelectorAll('.patients-section, .agenda-section, .coming-soon-section');
    existingSections.forEach(section => section.remove());
    
    // Ocultar otras secciones
    const mainDashboard = document.getElementById('mainDashboardSection');
    const profileSection = document.getElementById('doctorProfileSection');
    if (mainDashboard) mainDashboard.style.display = 'none';
    if (profileSection) {
        profileSection.style.display = 'none';
        profileSection.classList.add('hidden');
    }
    
    // Crear sección de pacientes
    const patientsSection = document.createElement('div');
    patientsSection.className = 'patients-section';
    
    // Mostrar loading
    patientsSection.innerHTML = `
        <div class="dashboard-section">
            <div class="section-header">
                <div>
                    <h2>Mis Pacientes</h2>
                    <p>Lista de pacientes con turnos asignados</p>
                </div>
                <div class="section-header-actions">
                    <button class="btn btn-secondary" id="refreshPatientsBtn">
                        <i class="fas fa-sync-alt"></i> Actualizar
                    </button>
                </div>
            </div>
            <div id="patients-content" style="padding: 2rem; text-align: center;">
                <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #2563eb;"></i>
                <p style="margin-top: 1rem; color: #6b7280;">Cargando pacientes...</p>
            </div>
        </div>
    `;
    
    dashboardContent.appendChild(patientsSection);
    
    // Agregar event listener al botón de actualizar
    setTimeout(() => {
        const refreshBtn = document.getElementById('refreshPatientsBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await renderPatientsContent(patientsSection);
            });
        }
    }, 100);
    
    // Cargar y renderizar pacientes
    await renderPatientsContent(patientsSection);
}

// Renderizar contenido de pacientes
async function renderPatientsContent(patientsSection) {
    const patientsContent = patientsSection.querySelector('#patients-content');
    if (!patientsContent) return;
    
    try {
        if (!currentDoctorData?.doctorId) {
            // Intentar cargar datos del doctor si no están disponibles
            await loadDoctorData();
            if (!currentDoctorData?.doctorId) {
                patientsContent.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: #dc2626;">
                        <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                        <p>No se pudo identificar al médico. Por favor, recarga la página.</p>
                    </div>
                `;
                return;
            }
        }
        
        const { ApiScheduling } = await import('./api.js');
        const { Api } = await import('./api.js');
        
        // Obtener todos los turnos del médico (próximos 6 meses para tener más pacientes)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const sixMonthsLater = new Date(today);
        sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
        
        const appointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${currentDoctorData.doctorId}&startTime=${today.toISOString()}&endTime=${sixMonthsLater.toISOString()}`
        );
        
        if (!appointments || appointments.length === 0) {
            patientsContent.innerHTML = `
                <div style="padding: 3rem; text-align: center; color: #6b7280;">
                    <i class="fas fa-user-friends" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3 style="margin-bottom: 0.5rem;">No hay pacientes asignados</h3>
                    <p>No tienes turnos programados con pacientes en los próximos 6 meses.</p>
                </div>
            `;
            return;
        }
        
        // Obtener IDs únicos de pacientes
        const uniquePatientIds = [...new Set(appointments.map(apt => apt.patientId || apt.PatientId))];
        
        // Cargar información de cada paciente
        const patientsWithAppointments = await Promise.all(
            uniquePatientIds.map(async (patientId) => {
                try {
                    const patient = await Api.get(`v1/Patient/${patientId}`);
                    
                    // Contar turnos de este paciente
                    const patientAppointments = appointments.filter(
                        apt => (apt.patientId || apt.PatientId) === patientId
                    );
                    
                    // Obtener el próximo turno (SCHEDULED o CONFIRMED)
                    const upcomingAppointments = patientAppointments
                        .filter(apt => {
                            const status = apt.status || apt.Status;
                            return status === 'SCHEDULED' || status === 'CONFIRMED';
                        })
                        .sort((a, b) => {
                            const timeA = new Date(a.startTime || a.StartTime);
                            const timeB = new Date(b.startTime || b.StartTime);
                            return timeA - timeB;
                        });
                    
                    const nextAppointment = upcomingAppointments.length > 0 ? upcomingAppointments[0] : null;
                    
                    return {
                        patientId: patientId,
                        firstName: patient.Name || patient.name || '',
                        lastName: patient.lastName || patient.LastName || '',
                        dni: patient.dni || patient.Dni || 'N/A',
                        dateOfBirth: patient.dateOfBirth || patient.DateOfBirth || null,
                        address: patient.address || patient.Adress || 'No especificada',
                        healthPlan: patient.healthPlan || patient.HealthPlan || 'No especificada',
                        totalAppointments: patientAppointments.length,
                        nextAppointment: nextAppointment
                    };
                } catch (err) {
                    console.warn(`No se pudo cargar paciente ${patientId}:`, err);
                    return null;
                }
            })
        );
        
        // Filtrar pacientes nulos y ordenar por nombre
        const validPatients = patientsWithAppointments
            .filter(p => p !== null)
            .sort((a, b) => {
                const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
                const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
                return nameA.localeCompare(nameB);
            });
        
        if (validPatients.length === 0) {
            patientsContent.innerHTML = `
                <div style="padding: 3rem; text-align: center; color: #6b7280;">
                    <i class="fas fa-user-friends" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <h3 style="margin-bottom: 0.5rem;">No se pudieron cargar los pacientes</h3>
                    <p>Hubo un error al obtener la información de los pacientes.</p>
                </div>
            `;
            return;
        }
        
        // Renderizar HTML
        let html = `
            <div style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3 style="margin: 0; color: #1f2937;">Total de pacientes: ${validPatients.length}</h3>
                </div>
            </div>
            <div class="patients-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem;">
        `;
        
        validPatients.forEach(patient => {
            const fullName = `${patient.firstName} ${patient.lastName}`.trim() || 'Paciente sin nombre';
            const age = patient.dateOfBirth ? calculateAge(patient.dateOfBirth) : null;
            
            let nextAppointmentHtml = '';
            if (patient.nextAppointment) {
                const nextDate = new Date(patient.nextAppointment.startTime || patient.nextAppointment.StartTime);
                const dateStr = nextDate.toLocaleDateString('es-AR', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                const timeStr = nextDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                nextAppointmentHtml = `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                        <div style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.5rem;">
                            <i class="fas fa-calendar-check" style="margin-right: 0.5rem; color: #10b981;"></i>
                            Próximo turno:
                        </div>
                        <div style="font-weight: 600; color: #1f2937;">
                            ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)} a las ${timeStr}
                        </div>
                    </div>
                `;
            } else {
                nextAppointmentHtml = `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #e5e7eb;">
                        <div style="color: #6b7280; font-size: 0.875rem;">
                            <i class="fas fa-calendar-times" style="margin-right: 0.5rem;"></i>
                            Sin turnos programados
                        </div>
                    </div>
                `;
            }
            
            html += `
                <div class="patient-card" style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1.5rem; transition: box-shadow 0.2s;">
                    <div style="display: flex; align-items: center; margin-bottom: 1rem;">
                        <div style="width: 50px; height: 50px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1.25rem; margin-right: 1rem;">
                            ${fullName.charAt(0).toUpperCase()}
                        </div>
                        <div style="flex: 1;">
                            <h3 style="margin: 0; color: #1f2937; font-size: 1.1rem;">${fullName}</h3>
                            ${age ? `<p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.875rem;">${age} años</p>` : ''}
                        </div>
                    </div>
                    <div style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.5rem;">
                        <i class="fas fa-id-card" style="margin-right: 0.5rem;"></i>
                        DNI: ${patient.dni}
                    </div>
                    <div style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.5rem;">
                        <i class="fas fa-map-marker-alt" style="margin-right: 0.5rem;"></i>
                        ${patient.address}
                    </div>
                    <div style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.5rem;">
                        <i class="fas fa-heartbeat" style="margin-right: 0.5rem;"></i>
                        Obra social: ${patient.healthPlan}
                    </div>
                    <div style="color: #6b7280; font-size: 0.875rem; margin-bottom: 0.5rem;">
                        <i class="fas fa-calendar-alt" style="margin-right: 0.5rem;"></i>
                        Total de turnos: <strong style="color: #10b981;">${patient.totalAppointments}</strong>
                    </div>
                    ${nextAppointmentHtml}
                </div>
            `;
        });
        
        html += '</div>';
        patientsContent.innerHTML = html;
        
        // Agregar hover effect a las tarjetas
        setTimeout(() => {
            const patientCards = patientsSection.querySelectorAll('.patient-card');
            patientCards.forEach(card => {
                card.addEventListener('mouseenter', function() {
                    this.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
                });
                card.addEventListener('mouseleave', function() {
                    this.style.boxShadow = 'none';
                });
            });
        }, 100);
        
    } catch (error) {
        console.error('Error al cargar pacientes:', error);
        patientsContent.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #dc2626;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Error al cargar los pacientes: ${error.message || 'Error desconocido'}</p>
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 1rem;">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
    }
}

// Calcular edad desde fecha de nacimiento
function calculateAge(dateOfBirth) {
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

// ========== GESTIÓN DE DISPONIBILIDAD ==========

// Abrir modal de gestión de agenda
async function openScheduleManager() {
    if (!currentDoctorData?.doctorId) {
        showNotification('No se pudo identificar al médico', 'error');
        return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.id = 'schedule-manager-modal';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 1000px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header">
                <h3>Gestionar Mi Agenda</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="schedule-manager-container">
                    <div class="schedule-actions" style="margin-bottom: 1.5rem;">
                        <button class="btn btn-primary" id="add-availability-btn">
                            <i class="fas fa-plus"></i> Agregar Horario
                        </button>
                    </div>
                    <div id="availability-list" style="margin-top: 1rem;">
                        <div style="text-align: center; padding: 2rem; color: #6b7280;">
                            <i class="fas fa-spinner fa-spin"></i> Cargando disponibilidad...
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.remove();
        });
    });
    
    modal.querySelector('#add-availability-btn').addEventListener('click', () => {
        openAddAvailabilityForm(modal);
    });
    
    await loadDoctorAvailability(modal);
}

// Cargar disponibilidad del médico
async function loadDoctorAvailability(modal) {
    try {
        const doctorId = currentDoctorData?.doctorId || currentDoctorData?.DoctorId;
        if (!doctorId) {
            console.warn('No hay doctorId disponible para cargar disponibilidades');
            console.log('currentDoctorData:', currentDoctorData);
            return;
        }

        console.log('=== CARGANDO DISPONIBILIDADES DEL DOCTOR ===');
        console.log('DoctorId:', doctorId);
        console.log('currentDoctorData:', currentDoctorData);

        const { ApiScheduling } = await import('./api.js');
        const availability = await ApiScheduling.get(`v1/DoctorAvailability/search?doctorId=${doctorId}`);
        console.log('Disponibilidades recibidas:', availability);
        
        const availabilityList = modal.querySelector('#availability-list');
        if (!availabilityList) return;

        if (!availability || availability.length === 0) {
            availabilityList.innerHTML = `
                <div class="empty-state" style="text-align: center; padding: 3rem; color: #6b7280;">
                    <i class="fas fa-calendar-times" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">No tienes horarios configurados</p>
                    <p style="font-size: 0.9rem;">Agrega tu primer horario de disponibilidad para que los pacientes puedan agendar turnos contigo.</p>
                </div>
            `;
            return;
        }

        // Agrupar por día de la semana
        const daysOfWeek = {
            1: 'Lunes',
            2: 'Martes',
            3: 'Miércoles',
            4: 'Jueves',
            5: 'Viernes',
            6: 'Sábado',
            7: 'Domingo'
        };

        const groupedByDay = {};
        availability.forEach(av => {
            // Obtener el día de la semana, puede venir como número o string
            let day = av.dayOfWeek || av.DayOfWeek;
            
            // Si viene como string (nombre del día), convertir a número
            if (typeof day === 'string') {
                const dayNameToNumber = {
                    'Monday': 1, 'Lunes': 1,
                    'Tuesday': 2, 'Martes': 2,
                    'Wednesday': 3, 'Miércoles': 3,
                    'Thursday': 4, 'Jueves': 4,
                    'Friday': 5, 'Viernes': 5,
                    'Saturday': 6, 'Sábado': 6,
                    'Sunday': 7, 'Domingo': 7
                };
                day = dayNameToNumber[day] || parseInt(day) || day;
            }
            
            // Asegurar que sea un número
            day = parseInt(day);
            
            // Validar que el día esté en el rango válido (1-7)
            if (isNaN(day) || day < 1 || day > 7) {
                console.warn('Día de la semana inválido:', av.dayOfWeek || av.DayOfWeek, 'en availability:', av);
                return; // Saltar este availability si el día no es válido
            }
            
            if (!groupedByDay[day]) {
                groupedByDay[day] = [];
            }
            groupedByDay[day].push(av);
        });

        availabilityList.innerHTML = Object.keys(groupedByDay)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .map(day => {
                const dayNum = parseInt(day);
                const dayName = daysOfWeek[dayNum];
                
                // Validar que el nombre del día existe
                if (!dayName) {
                    console.warn(`No se encontró nombre para el día ${dayNum}`);
                    return ''; // Saltar este día si no tiene nombre válido
                }
                
                const slots = groupedByDay[day];
                
                return `
                    <div class="availability-day-group" style="margin-bottom: 1.5rem; padding: 1rem; background: #f9fafb; border-radius: 8px;">
                        <h4 style="margin-bottom: 1rem; color: #1f2937;">
                            <i class="fas fa-calendar-day"></i> ${dayName}
                        </h4>
                        <div class="availability-slots">
                            ${slots.map(slot => createAvailabilitySlotHTML(slot, dayNum, dayName)).join('')}
                        </div>
                    </div>
                `;
            })
            .filter(html => html !== '') // Filtrar días inválidos
            .join('');

        // Agregar event listeners a los botones
        availabilityList.querySelectorAll('.edit-availability-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const availabilityId = this.getAttribute('data-availability-id');
                openEditAvailabilityForm(modal, availabilityId);
            });
        });

        availabilityList.querySelectorAll('.delete-availability-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const availabilityId = this.getAttribute('data-availability-id');
                deleteAvailability(modal, availabilityId);
            });
        });

    } catch (error) {
        console.error('Error al cargar disponibilidad:', error);
        const availabilityList = modal.querySelector('#availability-list');
        if (availabilityList) {
            availabilityList.innerHTML = `
                <div class="error-state" style="text-align: center; padding: 2rem; color: #dc2626;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No se pudo cargar la disponibilidad</p>
                </div>
            `;
        }
    }
}

// Crear HTML de un slot de disponibilidad
function createAvailabilitySlotHTML(slot, dayNum = null, dayName = null) {
    const startTime = formatTimeSpan(slot.startTime || slot.StartTime);
    const endTime = formatTimeSpan(slot.endTime || slot.EndTime);
    const duration = slot.durationMinutes || slot.DurationMinutes || 30;
    const isActive = slot.isActive !== false;
    const availabilityId = slot.availabilityId || slot.AvailabilityId;
    
    // Obtener el día de la semana si no se proporciona
    if (!dayNum || !dayName) {
        const day = slot.dayOfWeek || slot.DayOfWeek;
        const daysOfWeek = {
            1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves',
            5: 'Viernes', 6: 'Sábado', 7: 'Domingo'
        };
        dayNum = parseInt(day);
        dayName = daysOfWeek[dayNum] || `Día ${dayNum}`;
    }

    return `
        <div class="availability-slot" style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; margin-bottom: 0.5rem; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
            <div class="slot-info" style="display: flex; align-items: center; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-lock" style="color: #6b7280; font-size: 0.875rem;"></i>
                    <span style="font-weight: 600; color: #1f2937; font-size: 0.875rem;">${dayName}</span>
                </div>
                <span style="font-weight: 600; color: #1f2937;">${startTime} - ${endTime}</span>
                <span style="color: #6b7280; margin-left: 1rem;">Duración: ${duration} min</span>
                ${!isActive ? '<span style="color: #dc2626; margin-left: 1rem;">(Inactivo)</span>' : ''}
            </div>
            <div class="slot-actions">
                <button class="btn btn-sm btn-secondary edit-availability-btn" data-availability-id="${availabilityId}" style="margin-right: 0.5rem;">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button class="btn btn-sm btn-danger delete-availability-btn" data-availability-id="${availabilityId}">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    `;
}

// Formatear TimeSpan a string HH:mm
function formatTimeSpan(timeSpan) {
    if (!timeSpan) return '00:00';
    if (typeof timeSpan === 'string') {
        // Si viene como "HH:mm:ss" o "HH:mm"
        const parts = timeSpan.split(':');
        return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    // Si viene como objeto con hours y minutes
    const hours = (timeSpan.hours || timeSpan.Hours || 0).toString().padStart(2, '0');
    const minutes = (timeSpan.minutes || timeSpan.Minutes || 0).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Abrir formulario para agregar disponibilidad
function openAddAvailabilityForm(modal) {
    const formModal = document.createElement('div');
    formModal.className = 'modal';
    formModal.style.display = 'flex';
    formModal.style.zIndex = '1001';
    
    formModal.innerHTML = `
        <div class="modal-content" style="max-width: 600px;">
            <div class="modal-header">
                <h3>Agregar Horario de Disponibilidad</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="add-availability-form">
                    <div class="form-group">
                        <label for="av-day">Día de la semana:</label>
                        <select id="av-day" name="dayOfWeek" required>
                            <option value="">Seleccionar día</option>
                            <option value="1">Lunes</option>
                            <option value="2">Martes</option>
                            <option value="3">Miércoles</option>
                            <option value="4">Jueves</option>
                            <option value="5">Viernes</option>
                            <option value="6">Sábado</option>
                            <option value="7">Domingo</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="av-start-time">Hora de inicio:</label>
                        <input type="time" id="av-start-time" name="startTime" required>
                    </div>
                    <div class="form-group">
                        <label for="av-end-time">Hora de fin:</label>
                        <input type="time" id="av-end-time" name="endTime" required>
                    </div>
                    <div class="form-group">
                        <label for="av-duration">Duración de cada turno (minutos):</label>
                        <input type="number" id="av-duration" name="durationMinutes" min="15" max="480" value="30" required>
                        <small style="color: #6b7280;">Entre 15 y 480 minutos</small>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary close-modal">Cancelar</button>
                        <button type="submit" class="btn btn-primary">Guardar Horario</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(formModal);
    
    formModal.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            formModal.remove();
        });
    });
    
    formModal.querySelector('#add-availability-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAvailability(formModal, modal, null);
    });
}

// Abrir formulario para editar disponibilidad
async function openEditAvailabilityForm(modal, availabilityId) {
    try {
        const { ApiScheduling } = await import('./api.js');
        const availability = await ApiScheduling.get(`v1/DoctorAvailability/${availabilityId}`);
        
        if (!availability) {
            showNotification('No se encontró el horario', 'error');
            return;
        }

        const formModal = document.createElement('div');
        formModal.className = 'modal';
        formModal.style.display = 'flex';
        formModal.style.zIndex = '1001';
        
        const startTime = formatTimeSpan(availability.startTime || availability.StartTime);
        const endTime = formatTimeSpan(availability.endTime || availability.EndTime);
        const dayOfWeek = availability.dayOfWeek || availability.DayOfWeek;
        const duration = availability.durationMinutes || availability.DurationMinutes;

        formModal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Editar Horario de Disponibilidad</h3>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="edit-availability-form">
                        <div class="form-group">
                            <label for="av-day-edit">Día de la semana:</label>
                            <select id="av-day-edit" name="dayOfWeek" required>
                                <option value="1" ${dayOfWeek === 1 ? 'selected' : ''}>Lunes</option>
                                <option value="2" ${dayOfWeek === 2 ? 'selected' : ''}>Martes</option>
                                <option value="3" ${dayOfWeek === 3 ? 'selected' : ''}>Miércoles</option>
                                <option value="4" ${dayOfWeek === 4 ? 'selected' : ''}>Jueves</option>
                                <option value="5" ${dayOfWeek === 5 ? 'selected' : ''}>Viernes</option>
                                <option value="6" ${dayOfWeek === 6 ? 'selected' : ''}>Sábado</option>
                                <option value="7" ${dayOfWeek === 7 ? 'selected' : ''}>Domingo</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="av-start-time-edit">Hora de inicio:</label>
                            <input type="time" id="av-start-time-edit" name="startTime" value="${startTime}" required>
                        </div>
                        <div class="form-group">
                            <label for="av-end-time-edit">Hora de fin:</label>
                            <input type="time" id="av-end-time-edit" name="endTime" value="${endTime}" required>
                        </div>
                        <div class="form-group">
                            <label for="av-duration-edit">Duración de cada turno (minutos):</label>
                            <input type="number" id="av-duration-edit" name="durationMinutes" min="15" max="480" value="${duration}" required>
                            <small style="color: #6b7280;">Entre 15 y 480 minutos</small>
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn btn-secondary close-modal">Cancelar</button>
                            <button type="submit" class="btn btn-primary">Guardar Cambios</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(formModal);
        
        formModal.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                formModal.remove();
            });
        });
        
        formModal.querySelector('#edit-availability-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await saveAvailability(formModal, modal, availabilityId);
        });
    } catch (error) {
        console.error('Error al cargar horario para editar:', error);
        showNotification('No se pudo cargar el horario', 'error');
    }
}

// Guardar disponibilidad (crear o actualizar)
async function saveAvailability(formModal, scheduleModal, availabilityId) {
    try {
        const doctorId = currentDoctorData?.doctorId || currentDoctorData?.DoctorId;
        if (!doctorId) {
            console.error('currentDoctorData:', currentDoctorData);
            showNotification('No se pudo identificar al médico', 'error');
            return;
        }

        console.log('=== GUARDANDO DISPONIBILIDAD ===');
        console.log('DoctorId a usar:', doctorId);
        console.log('currentDoctorData completo:', currentDoctorData);

        const form = formModal.querySelector('form');
        const formData = new FormData(form);
        
        const dayOfWeek = parseInt(formData.get('dayOfWeek'));
        const startTimeStr = formData.get('startTime');
        const endTimeStr = formData.get('endTime');
        const durationMinutes = parseInt(formData.get('durationMinutes'));

        // Convertir hora string (HH:mm) a TimeSpan
        const [startHours, startMinutes] = startTimeStr.split(':').map(Number);
        const [endHours, endMinutes] = endTimeStr.split(':').map(Number);

        const availabilityData = {
            dayOfWeek: dayOfWeek,
            startTime: `${startHours.toString().padStart(2, '0')}:${startMinutes.toString().padStart(2, '0')}:00`,
            endTime: `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}:00`,
            durationMinutes: durationMinutes
        };

        console.log('Datos de disponibilidad a enviar:', availabilityData);

        const { ApiScheduling } = await import('./api.js');
        
        if (availabilityId) {
            // Actualizar
            console.log('Actualizando disponibilidad ID:', availabilityId);
            await ApiScheduling.patch(`v1/DoctorAvailability/${availabilityId}`, availabilityData);
            showNotification('Horario actualizado exitosamente', 'success');
        } else {
            // Crear
            console.log('Creando nueva disponibilidad para DoctorId:', doctorId);
            const result = await ApiScheduling.post(`v1/DoctorAvailability/${doctorId}`, availabilityData);
            console.log('Disponibilidad creada exitosamente:', result);
            showNotification('Horario agregado exitosamente', 'success');
        }

        formModal.remove();
        await loadDoctorAvailability(scheduleModal);
        
    } catch (error) {
        console.error('Error al guardar disponibilidad:', error);
        console.error('currentDoctorData en el momento del error:', currentDoctorData);
        showNotification(`Error al guardar horario: ${error.message || 'Error desconocido'}`, 'error');
    }
}

// Eliminar disponibilidad
async function deleteAvailability(modal, availabilityId) {
    if (!confirm('¿Estás seguro de que deseas eliminar este horario?')) {
        return;
    }

    try {
        const { ApiScheduling } = await import('./api.js');
        await ApiScheduling.delete(`v1/DoctorAvailability/${availabilityId}`);
        
        showNotification('Horario eliminado exitosamente', 'success');
        await loadDoctorAvailability(modal);
    } catch (error) {
        console.error('Error al eliminar disponibilidad:', error);
        showNotification('No se pudo eliminar el horario', 'error');
    }
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
