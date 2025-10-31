const AUTHMS_BASE_URL = "http://localhost:8081/api/v1";

export async function login(email, password)
{
    const response = await fetch(`${AUTHMS_BASE_URL}/Auth/Login`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email, password})
    });

    if (!response.ok)
    {
        const error = await response.json().catch(() => ({message: "Error desconocido"}));
        throw new Error(error.message || "Error al iniciar sesión");
    }
    return await response.json();
}

export async function registerUser(userData) {
    try {
        const response = await fetch(`${AUTHMS_BASE_URL}/User`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(userData)
        });

        if (!response.ok) {
            let errorMessage = "Error al registrar usuario";
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.Message || errorMessage;
                
                // Si hay errores de validación de FluentValidation
                if (errorData.errors) {
                    const validationErrors = Object.entries(errorData.errors)
                        .map(([field, errors]) => `${field}: ${Array.isArray(errors) ? errors.join(", ") : errors}`)
                        .join("\n");
                    errorMessage = `Errores de validación:\n${validationErrors}`;
                }
            } catch (e) {
                // Si no se puede parsear el JSON, usar el status text
                errorMessage = response.statusText || `Error ${response.status}`;
            }
            
            console.error("Error del servidor:", {
                status: response.status,
                statusText: response.statusText,
                message: errorMessage
            });
            
            throw new Error(errorMessage);
        }
        return await response.json();
    } catch (error) {
        console.error("Error en registerUser:", error);
        throw error;
    }
}