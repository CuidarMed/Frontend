const defaultHostnames = [window.location.hostname || "localhost", "localhost", "127.0.0.1"];

// DirectoryMS: puertos Docker (8081) e IIS Express (5112)
const DIRECTORY_API_BASE_URLS = [
  ...defaultHostnames.flatMap(host => [`http://${host}:8081/api`, `http://${host}:5112/api`])
].filter((value, index, self) => self.indexOf(value) === index);

// AuthMS: puertos Docker (8082) e IIS Express (5093)
const AUTH_API_BASE_URLS = [
  ...defaultHostnames.flatMap(host => [`http://${host}:8082/api`, `http://${host}:5093/api`])
].filter((value, index, self) => self.indexOf(value) === index);

// SchedulingMS: puertos Docker (8083) e IIS Express (34372), Development (5140)
const SCHEDULING_API_BASE_URLS = [
  ...defaultHostnames.flatMap(host => [`http://${host}:8083/api`, `http://${host}:34372/api`, `http://${host}:5140/api`])
].filter((value, index, self) => self.indexOf(value) === index);

// ClinicalMS: puertos Docker (8084) e IIS Express (27124), Development (5073)
const CLINICAL_API_BASE_URLS = [
  ...defaultHostnames.flatMap(host => [`http://${host}:8084/api`, `http://${host}:27124/api`, `http://${host}:5073/api`])
].filter((value, index, self) => self.indexOf(value) === index);

// Hl7Gateway: puerto 5000 (API REST)
const HL7GATEWAY_API_BASE_URLS = [
  ...defaultHostnames.flatMap(host => [`http://${host}:5000/api`, `http://${host}:5000/api`])
].filter((value, index, self) => self.indexOf(value) === index);

let activeDirectoryBaseUrl = null;
let activeAuthBaseUrl = null;
let activeSchedulingBaseUrl = null;
let activeClinicalBaseUrl = null;

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  try {
    const token = localStorage.getItem("token");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn("No se pudo acceder al token almacenado", error);
  }
  return headers;
}

function fetchWithTimeout(resource, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(resource, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
}

async function apiRequestFirstOk(baseUrls, endpoint, method = "GET", body = null, serviceName = "servicio") {
  const options = { method, headers: buildHeaders() };
  if (body) options.body = JSON.stringify(body);

  let lastError;
  for (const baseUrl of baseUrls) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/${endpoint}`, options, 7000);
      if (!response.ok) {
        let message = "Error en la solicitud";
        let errorDetails = null;
        try { 
          const errorData = await response.json(); 
          message = errorData.message || errorData.title || message;
          errorDetails = errorData.errors || errorData.details || null;
        } catch (_) {}
        
        // Crear error con código de estado para manejo específico
        const error = new Error(message);
        error.status = response.status;
        error.statusText = response.statusText;
        error.details = errorDetails;
        throw error;
      }
      try { 
        return await response.json(); 
      } catch (_) { 
        return { ok: true }; 
      }
    } catch (err) {
      lastError = err;
      // Si es un error de estado (400, 409, etc.), no intentar siguiente URL
      if (err.status && err.status >= 400 && err.status < 500) {
        throw err;
      }
      // intenta siguiente baseUrl solo para errores de conexión
    }
  }
  throw lastError || new Error(`No se pudo contactar al servicio ${serviceName}`);
}

export const Api = {
  // DirectoryMS: probar Docker e IIS Express
  get: (endpoint) => apiRequestFirstOk(DIRECTORY_API_BASE_URLS, endpoint, "GET", null, "DirectoryMS"),
  post: (endpoint, data) => apiRequestFirstOk(DIRECTORY_API_BASE_URLS, endpoint, "POST", data, "DirectoryMS"),
  put: (endpoint, data) => apiRequestFirstOk(DIRECTORY_API_BASE_URLS, endpoint, "PUT", data, "DirectoryMS"),
  patch: (endpoint, data) => apiRequestFirstOk(DIRECTORY_API_BASE_URLS, endpoint, "PATCH", data, "DirectoryMS"),
};

export const ApiAuth = {
  // AuthMS: probar Docker y IIS Express
  get: (endpoint) => apiRequestFirstOk(AUTH_API_BASE_URLS, endpoint, "GET", null, "AuthMS"),
  post: (endpoint, data) => apiRequestFirstOk(AUTH_API_BASE_URLS, endpoint, "POST", data, "AuthMS"),
  put: (endpoint, data) => apiRequestFirstOk(AUTH_API_BASE_URLS, endpoint, "PUT", data, "AuthMS"),
  patch: (endpoint, data) => apiRequestFirstOk(AUTH_API_BASE_URLS, endpoint, "PATCH", data, "AuthMS"),
};

export const ApiScheduling = {
  // SchedulingMS: probar Docker, IIS Express y Development
  get: (endpoint) => apiRequestFirstOk(SCHEDULING_API_BASE_URLS, endpoint, "GET", null, "SchedulingMS"),
  post: (endpoint, data) => apiRequestFirstOk(SCHEDULING_API_BASE_URLS, endpoint, "POST", data, "SchedulingMS"),
  put: (endpoint, data) => apiRequestFirstOk(SCHEDULING_API_BASE_URLS, endpoint, "PUT", data, "SchedulingMS"),
  patch: (endpoint, data) => apiRequestFirstOk(SCHEDULING_API_BASE_URLS, endpoint, "PATCH", data, "SchedulingMS"),
  delete: (endpoint) => apiRequestFirstOk(SCHEDULING_API_BASE_URLS, endpoint, "DELETE", null, "SchedulingMS"),
};

export const ApiClinical = {
  // ClinicalMS: probar Docker, IIS Express y Development
  get: (endpoint) => apiRequestFirstOk(CLINICAL_API_BASE_URLS, endpoint, "GET", null, "ClinicalMS"),
  post: (endpoint, data) => apiRequestFirstOk(CLINICAL_API_BASE_URLS, endpoint, "POST", data, "ClinicalMS"),
  put: (endpoint, data) => apiRequestFirstOk(CLINICAL_API_BASE_URLS, endpoint, "PUT", data, "ClinicalMS"),
  patch: (endpoint, data) => apiRequestFirstOk(CLINICAL_API_BASE_URLS, endpoint, "PATCH", data, "ClinicalMS"),
  delete: (endpoint) => apiRequestFirstOk(CLINICAL_API_BASE_URLS, endpoint, "DELETE", null, "ClinicalMS"),
};

export const ApiHl7Gateway = {
  // Hl7Gateway: API REST para descargar resúmenes
  get: (endpoint) => apiRequestFirstOk(HL7GATEWAY_API_BASE_URLS, endpoint, "GET", null, "Hl7Gateway"),
  post: (endpoint, data) => apiRequestFirstOk(HL7GATEWAY_API_BASE_URLS, endpoint, "POST", data, "Hl7Gateway"),
  download: async (endpoint, filename) => {
    const headers = buildHeaders();
    // Para descargas, no usar JSON
    delete headers["Content-Type"];
    
    for (const baseUrl of HL7GATEWAY_API_BASE_URLS) {
      try {
        const response = await fetchWithTimeout(`${baseUrl}/${endpoint}`, { 
          method: "GET", 
          headers 
        }, 7000);
        
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `resumen-hl7-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        return;
      } catch (err) {
        // Intentar siguiente URL
        continue;
      }
    }
    throw new Error("No se pudo contactar al Hl7Gateway");
  }
};

// Exponer global para scripts no módulo
if (typeof window !== "undefined") {
  window.Api = Api;
  window.ApiAuth = ApiAuth;
  window.ApiScheduling = ApiScheduling;
  window.ApiClinical = ApiClinical;
  window.ApiHl7Gateway = ApiHl7Gateway;
}
