const AUTHMS_BASE_URL = "http://localhost:8081/api/v1";

export async function login(email, password) {
    const response = await fetch(`${AUTHMS_BASE_URL}/Auth/Login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Error al iniciar sesión");
    }

    // Guardar tokens
    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);

    return data;
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