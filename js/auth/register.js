import { registerUser } from "../apis/authms.js";
import { Api } from "../api.js";

const SPECIALTIES_STORAGE_KEY = "adminSpecialties";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    if (!form) return;

    const button = document.getElementById("registerButton");
    const roleInput = document.getElementById("role");
    const roleCards = Array.from(document.querySelectorAll(".role-card"));
    const patientFieldsSection = document.getElementById("patientFields");
    const doctorFieldsSection = document.getElementById("doctorFields");

    const patientFieldInputs = [
        document.getElementById("patientBirthDate"),
        document.getElementById("patientDomicile"),
        document.getElementById("patientHealthPlan"),
        document.getElementById("patientMembershipNumber"),
    ];

    const specialtySelect = document.getElementById("doctorSpecialty");

    const doctorRequiredInputs = [
        document.getElementById("doctorLicense"),
        specialtySelect,
    ];

    function loadSpecialtiesFromStorage() {
        try {
            const raw = localStorage.getItem(SPECIALTIES_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : null;
        } catch (error) {
            console.warn("No se pudieron cargar especialidades del storage:", error);
            return null;
        }
    }

    function getFallbackSpecialties() {
        return [
            { name: "Cardiología", color: "#dc2626" },
            { name: "Pediatría", color: "#16a34a" },
            { name: "Neurología", color: "#7c3aed" },
            { name: "Dermatología", color: "#f97316" },
        ];
    }

    async function populateSpecialties() {
        if (!specialtySelect) return;
        
        try {
            const { Api } = await import('../api.js');
            const specialties = await Api.get('v1/Specialty');
            
            if (Array.isArray(specialties) && specialties.length > 0) {
                specialtySelect.innerHTML = '<option value="">Seleccionar especialidad</option>';
                specialties.forEach((spec) => {
                    const option = document.createElement("option");
                    option.value = spec.name || spec.Name;
                    option.textContent = spec.name || spec.Name;
                    option.style.color = spec.color || spec.Color || "#0f172a";
                    specialtySelect.appendChild(option);
                });
                specialtySelect.disabled = false;
                return;
            }
        } catch (error) {
            console.warn('Error al cargar especialidades desde la API:', error);
        }
        
        // Fallback a localStorage o valores por defecto
        const stored = loadSpecialtiesFromStorage();
        const specialties = stored?.length ? stored : getFallbackSpecialties();
        specialtySelect.innerHTML = '<option value="">Seleccionar especialidad</option>';
        specialties.forEach((spec) => {
            const option = document.createElement("option");
            option.value = spec.name;
            option.textContent = spec.name;
            option.style.color = spec.color || "#0f172a";
            specialtySelect.appendChild(option);
        });
        specialtySelect.disabled = specialties.length === 0;
    }

    function setRequired(inputs, enabled) {
        inputs.filter(Boolean).forEach((input) => {
            if (enabled) {
                input.setAttribute("required", "true");
            } else {
                input.removeAttribute("required");
            }
        });
    }

    function updateRoleSections(selectedRole) {
        const isDoctor = selectedRole === "Doctor";

        if (patientFieldsSection) {
            patientFieldsSection.classList.toggle("hidden", isDoctor);
        }

        if (doctorFieldsSection) {
            doctorFieldsSection.classList.toggle("hidden", !isDoctor);
        }

        setRequired(patientFieldInputs, !isDoctor);
        setRequired(doctorRequiredInputs, isDoctor);
    }

    function updateRoleCards(selectedRole) {
        roleCards.forEach((card) => {
            const isActive = card.dataset.role === selectedRole;
            card.classList.toggle("active", isActive);
            card.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
    }

    function setRole(newRole) {
        const normalizedRole = newRole === "Doctor" ? "Doctor" : "Patient";
        roleInput.value = normalizedRole;
        updateRoleCards(normalizedRole);
        updateRoleSections(normalizedRole);
    }

    roleCards.forEach((card) => {
        card.addEventListener("click", () => setRole(card.dataset.role));
    });

    setRole(roleInput.value || roleCards[0]?.dataset.role || "Patient");
    populateSpecialties();

    // Escuchar cambios en localStorage para actualizar especialidades en tiempo real
    window.addEventListener('storage', (e) => {
        if (e.key === SPECIALTIES_STORAGE_KEY) {
            console.log('🔄 Especialidades actualizadas, recargando...');
            populateSpecialties();
        }
    });

    // También escuchar eventos personalizados (para cambios en la misma ventana)
    window.addEventListener('specialtiesUpdated', () => {
        console.log('🔄 Especialidades actualizadas (evento personalizado), recargando...');
        populateSpecialties();
    });

    async function syncDirectoryProfile(userId, role, userData, patientExtras, doctorExtras) {
        if (!userId) {
            console.warn("syncDirectoryProfile: No hay userId");
            return;
        }

        try {
            if (role === "Patient") {
                const patientResponse = await Api.get(`v1/Patient/User/${userId}`);
                const patientId = patientResponse?.patientId ?? patientResponse?.PatientId;
                if (!patientId) {
                    throw new Error("No se pudo identificar el paciente creado en DirectoryMS");
                }

                // Construir payload con todos los datos del paciente
                const payload = {
                    Name: userData.firstName,
                    LastName: userData.lastName,
                    Dni: parseInt(userData.dni, 10) || 0,
                };

                // Dirección
                if (patientExtras?.address && patientExtras.address.trim()) {
                    payload.Adress = patientExtras.address.trim();
                }
                
                // Teléfono
                if (patientExtras?.phone && patientExtras.phone.trim()) {
                    payload.Phone = patientExtras.phone.trim();
                }
                
                // Fecha de nacimiento - siempre enviarla si está disponible
                if (patientExtras?.birthDate) {
                    let birthDate = patientExtras.birthDate.trim();
                    if (birthDate) {
                        // Remover hora si existe y asegurar formato YYYY-MM-DD
                        birthDate = birthDate.split('T')[0];
                        // Validar formato YYYY-MM-DD
                        if (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
                            // Enviar como string en formato ISO que ASP.NET Core puede convertir a DateOnly
                            payload.DateOfBirth = birthDate;
                            console.log("Enviando fecha de nacimiento al backend:", payload.DateOfBirth);
                        } else {
                            console.error("Formato de fecha inválido:", birthDate);
                        }
                    }
                }
                
                // Obra social - siempre enviarla si está disponible
                if (patientExtras?.healthPlan && patientExtras.healthPlan.trim()) {
                    payload.HealthPlan = patientExtras.healthPlan.trim();
                    console.log("Enviando obra social al backend:", payload.HealthPlan);
                }
                
                // Número de afiliado - siempre enviarlo si está disponible
                const membershipNumber = patientExtras?.membershipNumber?.trim();
                if (membershipNumber) {
                    payload.MembershipNumber = membershipNumber;
                    console.log("Enviando número de afiliado al backend:", payload.MembershipNumber);
                } else {
                    console.warn("Número de afiliado vacío o no disponible:", patientExtras?.membershipNumber);
                }

                console.log("Payload completo para actualizar paciente:", JSON.stringify(payload, null, 2));
                console.log("patientExtras original:", JSON.stringify(patientExtras, null, 2));
                
                const updateResponse = await Api.patch(`v1/Patient/${patientId}`, payload);
                console.log("Respuesta de actualización:", updateResponse);
                
                // Verificar que los datos se actualizaron correctamente
                if (updateResponse) {
                    console.log("Datos actualizados - Obra Social:", updateResponse.HealthPlan || updateResponse.healthPlan);
                    console.log("Datos actualizados - Número Afiliado:", updateResponse.MembershipNumber || updateResponse.membershipNumber);
                }
                
                console.log("Paciente actualizado exitosamente");
            } else if (role === "Doctor") {
                // Intentar obtener el doctor por UserId con retry
                let doctor = null;
                let attempts = 0;
                const maxAttempts = 5;
                
                while (!doctor && attempts < maxAttempts) {
                    try {
                        // Usar el endpoint específico para obtener doctor por UserId
                        doctor = await Api.get(`v1/Doctor/User/${userId}`);
                        
                        if (!doctor && attempts < maxAttempts - 1) {
                            console.log(`Doctor no encontrado, intentando nuevamente... (intento ${attempts + 1}/${maxAttempts})`);
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    } catch (err) {
                        // Si es 404, el doctor aún no existe, intentar de nuevo
                        if (err.message && err.message.includes("404")) {
                            console.log(`Doctor aún no disponible (404), intentando nuevamente... (intento ${attempts + 1}/${maxAttempts})`);
                        } else {
                            console.error(`Error al buscar doctor (intento ${attempts + 1}):`, err);
                        }
                        if (attempts < maxAttempts - 1) {
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                    attempts++;
                }

                if (!doctor) {
                    throw new Error(`No se pudo encontrar el registro de doctor recién creado en DirectoryMS para userId ${userId} después de ${maxAttempts} intentos. Asegúrate de que DirectoryMS esté corriendo.`);
                }

                const doctorId = doctor.doctorId ?? doctor.DoctorId;
                
                if (!doctorId) {
                    throw new Error("No se pudo obtener el ID del doctor");
                }

                const payload = {
                    FirstName: userData.firstName,
                    LastName: userData.lastName,
                    LicenseNumber: (doctorExtras?.licenseNumber && doctorExtras.licenseNumber.trim()) ? doctorExtras.licenseNumber.trim() : "PENDING",
                    Specialty: (doctorExtras?.specialty && doctorExtras.specialty.trim()) ? doctorExtras.specialty.trim() : null,
                    Biography: (doctorExtras?.biography && doctorExtras.biography.trim()) ? doctorExtras.biography.trim() : null,
                    Phone: (doctorExtras?.phone && doctorExtras.phone.trim()) ? doctorExtras.phone.trim() : null,
                };

                console.log("=== ACTUALIZANDO DOCTOR ===");
                console.log("doctorId:", doctorId);
                console.log("Payload para doctor:", JSON.stringify(payload, null, 2));
                console.log("doctorExtras:", JSON.stringify(doctorExtras, null, 2));
                console.log("Specialty capturado:", doctorExtras?.specialty);
                console.log("Specialty en payload:", payload.Specialty);
                console.log("LicenseNumber en payload:", payload.LicenseNumber);
                console.log("Biography en payload:", payload.Biography);

                const updateResponse = await Api.patch(`v1/Doctor/${doctorId}`, payload);
                console.log("Respuesta de actualización:", updateResponse);
                console.log("Doctor actualizado exitosamente");
            }
        } catch (error) {
            console.warn("No se pudo sincronizar la información adicional en DirectoryMS", error);
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const selectedRole = roleInput.value || "Patient";

        const passwordValue = document.getElementById("password").value;
        const confirmPasswordValue = document.getElementById("confirmPassword").value;
        if (passwordValue !== confirmPasswordValue) {
            alert("Las contraseñas no coinciden.");
            return;
        }

        // Construir userData - ImageUrl se envía como null para que el backend use su valor por defecto
        const userData = {
            firstName: document.getElementById("firstName").value.trim(),
            lastName: document.getElementById("lastName").value.trim(),
            email: document.getElementById("email").value.trim(),
            dni: document.getElementById("dni").value.trim(),
            password: passwordValue,
            role: selectedRole,
            imageUrl: null // Enviar explícitamente null para que el backend use el valor por defecto
        };

        if (!userData.firstName || !userData.lastName || !userData.email || !userData.dni || !userData.password) {
            alert("Por favor, completa todos los campos requeridos.");
            return;
        }

        if (userData.role !== "Patient" && userData.role !== "Doctor") {
            alert("Error: Rol inválido. Por favor, intenta nuevamente.");
            return;
        }

        const patientExtras = {
            birthDate: document.getElementById("patientBirthDate")?.value || "",
            address: document.getElementById("patientDomicile")?.value.trim() || "",
            healthPlan: document.getElementById("patientHealthPlan")?.value.trim() || "",
            membershipNumber: document.getElementById("patientMembershipNumber")?.value.trim() || "",
            phone: document.getElementById("phone")?.value.trim() || "",
        };
        
        // Log para debugging
        console.log("=== DATOS CAPTURADOS DEL FORMULARIO ===");
        console.log("patientExtras completo:", JSON.stringify(patientExtras, null, 2));
        console.log("membershipNumber capturado:", patientExtras.membershipNumber);
        console.log("membershipNumber elemento:", document.getElementById("patientMembershipNumber")?.value);
        console.log("healthPlan capturado:", patientExtras.healthPlan);

        const doctorExtras = {
            licenseNumber: document.getElementById("doctorLicense")?.value.trim() || "",
            specialty: document.getElementById("doctorSpecialty")?.value.trim() || "",
            biography: document.getElementById("doctorBiography")?.value.trim() || "",
            phone: document.getElementById("phone")?.value.trim() || "",
        };
        
        // Log para debugging de especialidad
        console.log("=== DOCTOR EXTRAS ===");
        console.log("doctorExtras completo:", JSON.stringify(doctorExtras, null, 2));
        console.log("specialty capturado:", doctorExtras.specialty);
        console.log("specialty elemento:", document.getElementById("doctorSpecialty")?.value);

        if (selectedRole === "Patient") {
            const missingPatientField = patientFieldInputs.find((input) => input && !input.value.trim());
            if (missingPatientField) {
                alert("Por favor, completa toda la información del paciente.");
                return;
            }
        }

        if (selectedRole === "Doctor") {
            const missingLicense = doctorRequiredInputs.find((input) => input && !input.value.trim());
            if (missingLicense) {
                alert("Por favor, completa la matrícula profesional.");
                return;
            }
            
            // Validar que la especialidad esté seleccionada
            const specialtySelect = document.getElementById("doctorSpecialty");
            if (!specialtySelect || !specialtySelect.value || specialtySelect.value.trim() === "") {
                alert("Por favor, selecciona una especialidad.");
                specialtySelect?.focus();
                return;
            }
        }

        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';

        try {
            // Log para debugging
            console.log("=== DATOS DEL REGISTRO ===");
            console.log("Fecha de nacimiento:", patientExtras.birthDate);
            console.log("Role:", selectedRole);
            
            const response = await registerUser(userData);
            const createdUserId = response?.userId ?? response?.UserId;

            if (!createdUserId) {
                throw new Error("No se recibió el ID del usuario creado");
            }

            console.log("Usuario creado con ID:", createdUserId);
            console.log("Respuesta del registro:", response);

            try {
                console.log("Sincronizando perfil en DirectoryMS...");
                // Esperar un poco para asegurar que el doctor se haya creado en DirectoryMS
                if (selectedRole === "Doctor") {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                await syncDirectoryProfile(
                    createdUserId,
                    selectedRole,
                    userData,
                    patientExtras,
                    doctorExtras
                );
                console.log("Perfil sincronizado exitosamente");
            } catch (syncError) {
                console.error("Error al sincronizar perfil:", syncError);
                
                // Determinar el tipo de error para dar un mensaje más específico
                let errorMessage = syncError.message || syncError.toString();
                let userMessage = "Advertencia: Se creó tu cuenta pero no se pudieron guardar algunos datos adicionales.";
                
                if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
                    userMessage += "\n\nEl servicio DirectoryMS no pudo encontrar tu perfil. Asegúrate de que DirectoryMS esté corriendo.";
                } else if (errorMessage.includes("connection") || errorMessage.includes("refused") || errorMessage.includes("ERR_CONNECTION")) {
                    userMessage += "\n\nNo se pudo conectar a DirectoryMS. Verifica que el servicio esté corriendo en Docker o IIS Express.";
                } else if (errorMessage.includes("intentos")) {
                    userMessage += "\n\nDirectoryMS no respondió a tiempo. El servicio puede no estar disponible o puede necesitar reiniciarse.";
                }
                
                userMessage += "\n\nPor favor, actualiza tu perfil después de iniciar sesión para completar la información.";
                userMessage += `\n\nError técnico: ${errorMessage}`;
                
                alert(userMessage);
            }

            alert(`¡Cuenta creada exitosamente! Tu rol es: ${userData.role}`);
            window.location.href = "login.html";
        } catch (err) {
            console.error("Error al registrar usuario:", err);

            let errorMessage = err.message || "Error desconocido al crear la cuenta.";

            // Limpiar y formatear el mensaje de error
            // Remover información técnica innecesaria
            errorMessage = errorMessage
                .replace(/^Error:\s*/i, '')
                .replace(/^Error\s+/i, '')
                .trim();

            // Mostrar solo el mensaje de error específico
            alert(`Error al crear la cuenta:\n\n${errorMessage}`);
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-user-plus"></i> Crear Cuenta';
        }
    });
});