import { login } from "../apis/authms.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("loginForm");
    const button = document.querySelector(".login-button");

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;

        if (!email || !password) {
            alert("Por favor, completa todos los campos");
            return;
        }

        // Cambiar texto del botón mientras se procesa
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';
        button.disabled = true;

        try {
            // 🔐 Llamada al backend
            const data = await login(email, password);
            alert("Inicio de sesión exitoso ✅");

            // ✅ Guardar tokens (ya lo hace login())
            // data.accessToken y data.refreshToken ya están guardados

            // 🔄 Redirección según el tipo de usuario o rol (si el backend lo devuelve)
            if (data.userType === "Doctor") {
                window.location.href = "doctor.html";
            } else if (data.userType === "Paciente") {
                window.location.href = "patient.html";
            } else {
                window.location.href = "index.html";
            }

        } catch (error) {
            alert(error.message);
        } finally {
            // Restaurar botón
            button.innerHTML = originalText;
            button.disabled = false;
        }
    });
});
