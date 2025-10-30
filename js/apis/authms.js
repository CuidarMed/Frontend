const AUTHMS_BASE_URL = "http://localhost:8081/api/v1";

export async function login(username, password)
{
    const response = await fetch(`${AUTHMS_BASE_URL}/Auth/Login`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({username, password})
    });

    if (!response.ok)
    {
        const error = await response.json().catch(() => ({message: "Error desconocido"}));
        throw new Error(error.message || "Error al iniciar sesión");
    }
    return await response.json();
}

export async function registerUser(userData) {
    const response = await fetch(`${AUTHMS_BASE_URL}/User`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(userData)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Error desconocido" }));
        throw new Error(error.message || "Error al registrar usuario");
    }
    return await response.json();
}