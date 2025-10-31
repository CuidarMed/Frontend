import { registerUser } from "../apis/authms.js";
import { Api } from "../api.js";

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

    const doctorRequiredInputs = [
        document.getElementById("doctorLicense"),
    ];

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

                const payload = {
                    Name: userData.firstName,
                    LastName: userData.lastName,
                    Dni: parseInt(userData.dni, 10) || 0,
                };

                if (patientExtras?.address) payload.Adress = patientExtras.address;
                if (patientExtras?.birthDate) {
                    // Asegurar que la fecha esté en formato ISO (YYYY-MM-DD)
                    let birthDate = patientExtras.birthDate.trim();
                    if (birthDate) {
                        // Remover hora si existe y asegurar formato YYYY-MM-DD
                        birthDate = birthDate.split('T')[0];
                        // Validar formato
                        if (/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
                            payload.DateOfBirth = birthDate;
                            console.log("Enviando fecha de nacimiento al backend:", payload.DateOfBirth);
                        } else {
                            console.error("Formato de fecha inválido:", birthDate);
                        }
                    } else {
                        console.warn("Fecha de nacimiento vacía o inválida");
                    }
                } else {
                    console.warn("No se encontró fecha de nacimiento en patientExtras");
                }
                if (patientExtras?.healthPlan) payload.HealthPlan = patientExtras.healthPlan;
                if (patientExtras?.membershipNumber) payload.MembershipNumber = patientExtras.membershipNumber;

                console.log("Payload para actualizar paciente:", JSON.stringify(payload, null, 2));
                const updateResponse = await Api.patch(`v1/Patient/${patientId}`, payload);
                console.log("Respuesta de actualización:", updateResponse);
                console.log("Paciente actualizado exitosamente");
            } else if (role === "Doctor") {
                const doctors = await Api.get("v1/Doctor");
                const doctor = Array.isArray(doctors)
                    ? doctors.find((d) => (d.userId ?? d.UserId) === userId)
                    : null;

                if (!doctor) {
                    throw new Error("No se pudo encontrar el registro de doctor recién creado en DirectoryMS");
                }

                const doctorId = doctor.doctorId ?? doctor.DoctorId;

                const payload = {
                    FirstName: userData.firstName,
                    LastName: userData.lastName,
                    LicenseNumber: doctorExtras?.licenseNumber || "PENDING",
                    Biography: doctorExtras?.biography || null,
                };

                await Api.patch(`v1/Doctor/${doctorId}`, payload);
            }
        } catch (error) {
            console.warn("No se pudo sincronizar la información adicional en DirectoryMS", error);
        }
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Usar imagen por defecto ya que no hay selector de imagen
        const imageUrl = "https://icons.veryicon.com/png/o/internet--web/prejudice/user-128.png";

        const selectedRole = roleInput.value || "Patient";

        const passwordValue = document.getElementById("password").value;
        const confirmPasswordValue = document.getElementById("confirmPassword").value;
        if (passwordValue !== confirmPasswordValue) {
            alert("Las contraseñas no coinciden.");
            return;
        }

        const userData = {
            firstName: document.getElementById("firstName").value.trim(),
            lastName: document.getElementById("lastName").value.trim(),
            email: document.getElementById("email").value.trim(),
            dni: document.getElementById("dni").value.trim(),
            password: passwordValue,
            role: selectedRole,
            imageUrl,
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
        };

        const doctorExtras = {
            licenseNumber: document.getElementById("doctorLicense")?.value.trim() || "",
            biography: document.getElementById("doctorBiography")?.value.trim() || "",
        };

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
                await syncDirectoryProfile(
                    createdUserId,
                    selectedRole,
                    userData,
                    patientExtras,
                    doctorExtras
                );
                console.log("Perfil sincronizado exitosamente");
            } catch (syncError) {
                console.error("Error al sincronizar perfil (no crítico):", syncError);
                // No lanzamos el error para no bloquear el registro
            }

            alert(`¡Cuenta creada exitosamente! Tu rol es: ${userData.role}`);
            window.location.href = "login.html";
        } catch (err) {
            console.error("Error al registrar usuario:", err);

            let errorMessage = err.message || "Error desconocido al crear la cuenta.";

            if (errorMessage.includes("validación") || errorMessage.includes("validation") || errorMessage.includes("obligatorio") || errorMessage.includes("debe")) {
                alert(`Errores de validación:\n\n${errorMessage}`);
            } else {
                alert(`Error al crear la cuenta:\n\n${errorMessage}\n\nPor favor, verifica que:\n- Tu contraseña tenga al menos 8 caracteres\n- Tu contraseña contenga mayúsculas, minúsculas, números y símbolos (@$!%*?&_)\n- Tu DNI tenga entre 6 y 12 caracteres\n- Todos los campos estén completos`);
            }
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-user-plus"></i> Crear Cuenta';
        }
    });
});