const defaultHostnames = [window.location.hostname || "localhost", "localhost", "127.0.0.1"];
const defaultPorts = ["8080", "5112"];

const configuredBaseUrl = window.__DIRECTORY_API_BASE_URL__ ||
  (typeof localStorage !== "undefined" ? localStorage.getItem("directoryApiBaseUrl") : null);

const CANDIDATE_BASE_URLS = [configuredBaseUrl]
  .concat(defaultHostnames.flatMap(host => defaultPorts.map(port => `http://${host}:${port}/api`)))
  .filter((value, index, self) => Boolean(value) && self.indexOf(value) === index);

let activeBaseUrl = configuredBaseUrl || null;

async function apiRequest(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: buildHeaders(),
  };

  if (body) options.body = JSON.stringify(body);

  const baseUrlsToTry = activeBaseUrl
    ? [activeBaseUrl, ...CANDIDATE_BASE_URLS.filter(url => url !== activeBaseUrl)]
    : CANDIDATE_BASE_URLS;

  let lastError = null;

  for (const baseUrl of baseUrlsToTry) {
    try {
      const response = await fetch(`${baseUrl}/${endpoint}`, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const error = new Error(errorData.message || "Error en la solicitud");
        error.status = response.status;
        throw error;
      }

      if (!activeBaseUrl || activeBaseUrl !== baseUrl) {
        activeBaseUrl = baseUrl;
        if (typeof localStorage !== "undefined") {
          try {
            localStorage.setItem("directoryApiBaseUrl", baseUrl);
          } catch (storageError) {
            console.warn("No se pudo guardar la URL base seleccionada", storageError);
          }
        }
      }

      if (response.status === 204) {
        return null;
      }

      return response.json();
    } catch (error) {
      lastError = error;
      if (error.status && error.status !== 503) {
        break;
      }
    }
  }

  throw lastError || new Error("No se pudo conectar con el servicio de DirectoryMS");
}

export const Api = {
  get: (endpoint) => apiRequest(endpoint),
  post: (endpoint, data) => apiRequest(endpoint, "POST", data),
  put: (endpoint, data) => apiRequest(endpoint, "PUT", data),
  patch: (endpoint, data) => apiRequest(endpoint, "PATCH", data),
};

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
