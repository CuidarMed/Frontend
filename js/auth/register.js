import { registerUser } from "../apis/authms.js";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("registerForm");
    const button = document.getElementById("registerButton");
    console.log("se esta ejecutando register.js");
    form.addEventListener("submit", async (e) => {
        
        e.preventDefault()
        const userData = {
            firstName: document.getElementById("firstName").value,
            lastName: document.getElementById("lastName").value,
            email: document.getElementById("email").value,
            dni: document.getElementById("dni").value,
            password: document.getElementById("password").value,
        };
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creando cuenta...';
        try {
            console.log("se está ejecutando después de apretar el boton");
            await registerUser(userData);
            alert("¡Cuenta creada exitosamente!");
            window.location.href = "login.html";
        } catch (err) {
            alert(err.message);
        } finally {
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-user-plus"></i> Crear Cuenta';
        }
    
    });
});