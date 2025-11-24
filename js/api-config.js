/**
 * CONFIGURACIÓN DE URLs DE API
 * 
 * Modifica este archivo para cambiar entre modo local y modo remoto (ngrok)
 */

// ============================================
// MODO: 'local' o 'remote'
// ============================================
const API_MODE = 'local'; // Cambia a 'remote' para usar ngrok

// ============================================
// URLs DE NGROK (solo se usan si API_MODE === 'remote')
// ============================================
// Reemplaza estas URLs con las que te compartió tu compañero/a
const NGROK_BASE_URL = 'https://abc123.ngrok.io'; // URL base de ngrok

// Si cada servicio tiene su propio túnel de ngrok, usa estas:
const NGROK_DIRECTORY = 'https://abc123.ngrok.io';
const NGROK_AUTH = 'https://def456.ngrok.io';
const NGROK_SCHEDULING = 'https://ghi789.ngrok.io';
const NGROK_CLINICAL = 'https://jkl012.ngrok.io';

// ============================================
// CONFIGURACIÓN AUTOMÁTICA
// ============================================
const defaultHostnames = [window.location.hostname || "localhost", "localhost", "127.0.0.1"];

let DIRECTORY_API_BASE_URLS, AUTH_API_BASE_URLS, SCHEDULING_API_BASE_URLS, CLINICAL_API_BASE_URLS, HL7GATEWAY_API_BASE_URLS;

if (API_MODE === 'remote') {
  // Modo remoto: usar ngrok
  DIRECTORY_API_BASE_URLS = [`${NGROK_DIRECTORY}/api`];
  AUTH_API_BASE_URLS = [`${NGROK_AUTH}/api/v1`];
  SCHEDULING_API_BASE_URLS = [`${NGROK_SCHEDULING}/api`];
  CLINICAL_API_BASE_URLS = [`${NGROK_CLINICAL}/api`];
  HL7GATEWAY_API_BASE_URLS = [`${NGROK_BASE_URL}/api`];
  
  console.log('🌐 Modo REMOTO activado - Usando ngrok');
  console.log('📡 URLs configuradas:', {
    DirectoryMS: DIRECTORY_API_BASE_URLS[0],
    AuthMS: AUTH_API_BASE_URLS[0],
    SchedulingMS: SCHEDULING_API_BASE_URLS[0],
    ClinicalMS: CLINICAL_API_BASE_URLS[0]
  });
} else {
  // Modo local: usar localhost
  DIRECTORY_API_BASE_URLS = [
    ...defaultHostnames.flatMap(host => [`http://${host}:8081/api`, `http://${host}:5112/api`])
  ].filter((value, index, self) => self.indexOf(value) === index);

  AUTH_API_BASE_URLS = [
    ...defaultHostnames.flatMap(host => [
      `http://${host}:8082/api/v1`,
    ])
  ].filter((value, index, self) => self.indexOf(value) === index);

  SCHEDULING_API_BASE_URLS = [
    ...defaultHostnames.flatMap(host => [`http://${host}:8083/api`, `http://${host}:34372/api`, `http://${host}:5140/api`])
  ].filter((value, index, self) => self.indexOf(value) === index);

  CLINICAL_API_BASE_URLS = [
    ...defaultHostnames.flatMap(host => [`http://${host}:8084/api`, `http://${host}:27124/api`, `http://${host}:5073/api`])
  ].filter((value, index, self) => self.indexOf(value) === index);

  HL7GATEWAY_API_BASE_URLS = [
    ...defaultHostnames.flatMap(host => [`http://${host}:5000/api`])
  ].filter((value, index, self) => self.indexOf(value) === index);
  
  console.log('🏠 Modo LOCAL activado');
}

// Exportar para uso en api.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DIRECTORY_API_BASE_URLS,
    AUTH_API_BASE_URLS,
    SCHEDULING_API_BASE_URLS,
    CLINICAL_API_BASE_URLS,
    HL7GATEWAY_API_BASE_URLS
  };
}

