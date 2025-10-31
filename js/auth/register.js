import { registerUser } from "../apis/authms.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    const button = document.getElementById("registerButton");
    const roleToggle = document.getElementById("roleToggle");
    const roleInput = document.getElementById("role");
    const profileImageInput = document.getElementById("profileImageInput");
    const profileImagePreview = document.getElementById("profileImagePreview");
    const selectImageBtn = document.getElementById("selectImageBtn");
    const profileImageContainer = document.querySelector(".profile-image-preview");
    
    console.log("se esta ejecutando register.js");
    
    // Obtener las etiquetas del toggle para mostrar feedback visual
    const toggleLabels = document.querySelectorAll(".toggle-label");
    
    // Manejar el toggle switch de rol
    roleToggle.addEventListener("change", (e) => {
        const selectedRole = e.target.checked ? "Doctor" : "Patient";
        roleInput.value = selectedRole;
        console.log("Toggle cambió. Rol seleccionado:", selectedRole);
        console.log("Valor del input hidden:", roleInput.value);
        
        // Feedback visual: actualizar las etiquetas para mostrar el rol seleccionado
        if (toggleLabels.length >= 2) {
            toggleLabels[0].style.fontWeight = selectedRole === "Patient" ? "bold" : "normal";
            toggleLabels[0].style.color = selectedRole === "Patient" ? "#2563eb" : "#374151";
            toggleLabels[1].style.fontWeight = selectedRole === "Doctor" ? "bold" : "normal";
            toggleLabels[1].style.color = selectedRole === "Doctor" ? "#2563eb" : "#374151";
        }
    });

    // Asegurar que el valor inicial esté establecido correctamente
    console.log("Valor inicial del rol:", roleInput.value);
    
    // Establecer el estado visual inicial
    if (toggleLabels.length >= 2) {
        toggleLabels[0].style.fontWeight = "bold";
        toggleLabels[0].style.color = "#2563eb";
        toggleLabels[1].style.fontWeight = "normal";
        toggleLabels[1].style.color = "#374151";
    }
    
    // Manejar la selección de imagen desde el botón
    selectImageBtn.addEventListener("click", () => {
        profileImageInput.click();
    });
    
    // Manejar la selección de imagen desde el preview
    profileImageContainer.addEventListener("click", () => {
        profileImageInput.click();
    });
    
    // Manejar el cambio de archivo de imagen
    profileImageInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validar que sea una imagen
            if (!file.type.startsWith("image/")) {
                alert("Por favor, selecciona un archivo de imagen válido.");
                return;
            }
            
            // Validar el tamaño del archivo (máximo 5MB)
            if (file.size > 5 * 1024 * 1024) {
                alert("La imagen es demasiado grande. Por favor, selecciona una imagen menor a 5MB.");
                return;
            }
            
            // Crear una URL para la preview
            const reader = new FileReader();
            reader.onload = (event) => {
                profileImagePreview.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });
    
    form.addEventListener("submit", async (e) => {
        
        e.preventDefault()
        
        // Obtener la imagen seleccionada y convertirla a base64/data URL
        let imageUrl = "https://icons.veryicon.com/png/o/internet--web/prejudice/user-128.png"; // Valor por defecto
        
        if (profileImageInput.files && profileImageInput.files[0]) {
            const file = profileImageInput.files[0];
            try {
                // Convertir la imagen a base64/data URL
                const reader = new FileReader();
                const imageDataUrl = await new Promise((resolve, reject) => {
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                imageUrl = imageDataUrl;
            } catch (error) {
                console.error("Error al procesar la imagen:", error);
                alert("Error al procesar la imagen. Se usará la imagen predeterminada.");
            }
        }
        
        // Obtener el rol del toggle (asegurarse de que esté actualizado)
        const selectedRole = roleToggle.checked ? "Doctor" : "Patient";
        roleInput.value = selectedRole;
        
        const userData = {
            firstName: document.getElementById("firstName").value.trim(),
            lastName: document.getElementById("lastName").value.trim(),
            email: document.getElementById("email").value.trim(),
            dni: document.getElementById("dni").value.trim(),
            password: document.getElementById("password").value,
            role: selectedRole, // "Patient" o "Doctor" - usar directamente del toggle
            imageUrl: imageUrl // URL de la imagen (base64 o URL por defecto)
        };
        
        // Validar que todos los campos estén completos
        if (!userData.firstName || !userData.lastName || !userData.email || !userData.dni || !userData.password) {
            alert("Por favor, completa todos los campos requeridos.");
            return;
        }
        
        // Validar que el rol sea válido
        if (userData.role !== "Patient" && userData.role !== "Doctor") {
            console.error("Rol inválido:", userData.role);
            alert("Error: Rol inválido. Por favor, intenta nuevamente.");
            return;
        }
        
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';
        try {
            console.log("=== REGISTRO DE USUARIO ===");
            console.log("Rol seleccionado del toggle:", roleToggle.checked ? "Doctor" : "Patient");
            console.log("Rol a enviar:", userData.role);
            console.log("Datos del usuario:", { 
                ...userData, 
                password: "***",
                imageUrl: userData.imageUrl.length > 100 ? userData.imageUrl.substring(0, 100) + "..." : userData.imageUrl
            });
            
            const response = await registerUser(userData);
            console.log("Respuesta del servidor:", response);
            alert(`¡Cuenta creada exitosamente! Tu rol es: ${userData.role}`);
            window.location.href = "login.html";
        } catch (err) {
            console.error("Error al registrar usuario:", err);
            
            // Mostrar mensaje de error más detallado
            let errorMessage = err.message || "Error desconocido al crear la cuenta.";
            
            // Si el error contiene información sobre validación, mostrarla
            if (errorMessage.includes("validación") || errorMessage.includes("validation") || errorMessage.includes("obligatorio") || errorMessage.includes("debe")) {
                // Ya viene formateado del backend
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