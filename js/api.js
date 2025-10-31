const API_BASE_URL = "http://localhost:5112/api";

async function apiRequest(endpoint, method = "GET", body = null) {
  const options = {
    method,
    headers: buildHeaders(),
  };

  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${API_BASE_URL}/${endpoint}`, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Error en la solicitud");
  }

  return response.json();
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
