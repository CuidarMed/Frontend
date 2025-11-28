// ============================================
// GESTIÓN DE DATOS DEL PACIENTE
// ============================================

import { appState } from './patient-state.js';
import { normalizePatient } from './patient-utils.js';
import { showNotification } from './patient-notifications.js';
import { updateWelcomeBanner } from './patient-dashboard.js';

/**
 * Carga datos del paciente desde el backend
 */
export async function loadPatientData() {
    try {
        if (!appState.currentUser) {
            const { getAuthenticatedUser } = await import('./patient-state.js');
            appState.currentUser = await getAuthenticatedUser();
            if (!appState.currentUser) {
                window.location.href = 'login.html';
                return;
            }
        }

        // RUTA CORREGIDA: api.js está en js/
        const { Api } = await import('../api.js');
        const patientResponse = await Api.get(`v1/Patient/User/${appState.currentUser.userId}`);
        
        console.log("=== PACIENTE OBTENIDO DEL BACKEND ===");
        console.log("Respuesta completa:", patientResponse);
        
        // Validar que la respuesta sea válida
        if (!patientResponse || patientResponse.ok === true || !patientResponse.patientId) {
            console.warn("⚠️ Respuesta inválida o paciente no encontrado:", patientResponse);
            // No actualizar appState.currentPatient si la respuesta es inválida
            return;
        }
        
        appState.currentPatient = normalizePatient(patientResponse);
        
        console.log("=== PACIENTE NORMALIZADO ===");
        console.log("Datos completos:", appState.currentPatient);

        updateWelcomeBanner();

        const profileSection = document.querySelector('.profile-section');
        if (profileSection && !profileSection.classList.contains('hidden')) {
            const { loadPatientProfile } = await import('./patient-profile.js');
            loadPatientProfile();
        }

    } catch (error) {
        console.error('Error al cargar datos del paciente:', error);
        showNotification('No pudimos cargar tus datos. Revisa tu conexión e intenta nuevamente.', 'error');
    }
}