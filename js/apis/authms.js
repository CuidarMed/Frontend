// Usar el cliente API centralizado que maneja múltiples puertos
// El puerto correcto es 8082 (Docker) o 5093 (IIS Express)
const AUTHMS_BASE_URLS = [
    "http://localhost:8082/api/v1",
    "http://127.0.0.1:8082/api/v1",
    "http://localhost:5093/api/v1",
    "http://127.0.0.1:5093/api/v1"
];

async function tryFetch(url, options) {
    let lastError = null;
    for (const baseUrl of AUTHMS_BASE_URLS) {
        try {
            const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
            const response = await fetch(fullUrl, { ...options, signal: AbortSignal.timeout(8000) });
            // Si la respuesta es válida (incluso si es un error HTTP), devolverla
            if (response.status !== 0 && response.status !== undefined) {
                return response;
            }
        } catch (err) {
            lastError = err;
            // Continuar con el siguiente URL
            continue;
        }
    }
    throw lastError || new Error("No se pudo conectar a AuthMS. Verifica que el servicio esté corriendo.");
}

export async function login(email, password) {
    console.log('🔐 Intentando login para:', email);
    
    const response = await tryFetch("/Auth/Login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "Error desconocido" }));
        console.error('❌ Error en login:', error);
        throw new Error(error.message || "Error al iniciar sesión");
    }
    
    const result = await response.json();
    console.log('✅ Login exitoso');
    return result;
}

export async function registerUser(userData) {
    try {
        console.log('📝 Registrando usuario:', userData.email);
        
        const response = await tryFetch("/User", {
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
            
            console.error("❌ Error del servidor:", {
                status: response.status,
                statusText: response.statusText,
                message: errorMessage
            });
            
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        console.log('✅ Usuario registrado exitosamente');
        return result;
    } catch (error) {
        console.error("❌ Error en registerUser:", error);
        throw error;
    }
}

export async function getUserById(userId, token) {
    if (!userId) {
        throw new Error("Se requiere un identificador de usuario válido");
    }

    console.log('👤 Obteniendo usuario por ID:', userId);
    console.log('🔑 Token:', token ? `${token.substring(0, 20)}...` : 'NO HAY TOKEN');

    const headers = {
        "Content-Type": "application/json",
    };
    
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await tryFetch(`/User/${userId}`, {
        method: "GET",
        headers: headers,
    });

    console.log('📡 Respuesta de getUserById - Status:', response.status);

    if (response.status === 204) {
        console.log('ℹ️ Usuario no encontrado (204)');
        return null;
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const message = errorData.message || errorData.Message || response.statusText || "No se pudo obtener el perfil";
        
        if (response.status === 401) {
            console.warn('⚠️ Error 401 Unauthorized - Token inválido o expirado');
        } else {
            console.error(`❌ Error ${response.status}:`, message);
        }
        
        throw new Error(message);
    }

    const result = await response.json();
    console.log('✅ Usuario obtenido correctamente');
    return result;
}