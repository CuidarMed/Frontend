// ============================================
// PATIENT MAIN - ARCHIVO PRINCIPAL
// ============================================

// Imports de módulos core
import { appState, getAuthenticatedUser, setupUserMenu } from './patient-state.js';
import { loadPatientData } from './patient-data.js';

// Imports de módulos compartidos
import { showNotification } from './patient-notifications.js';
import { initializeSidebarNavigation } from './patient-navigation.js';

// Imports de módulos de inicio
import { updateWelcomeBanner, loadPatientStats } from './patient-dashboard.js';
import { loadPatientAppointments } from './patient-appointments.js';
import { loadRecentPatientHistory } from './patient-history-recent.js';

// Imports de módulos de turnos
import { initializeModals } from './patient-appointment-form.js';

// Imports de módulos de prescripciones
import { initializePrescriptionModal } from './patient-prescriptions.js';

import { loadPatientPrescriptions } from './patient-prescriptions-list.js';


/**
 * Carga el contexto del usuario
 */
async function loadUserContext() {
    appState.currentUser = await getAuthenticatedUser();

    if (!appState.currentUser) {
        window.location.href = 'login.html';
        return;
    }
}

/**
 * Inicializa el panel del paciente
 */
async function initializePatientPanel() {
    await loadUserContext();
    
    // Mostrar nombre apenas carga
    updateWelcomeBanner();

    setupUserMenu();
    initializeSidebarNavigation();
    initializeModals();
    initializePrescriptionModal();

    // Carga inicial
    await loadPatientData();
    await loadPatientStats();
    await loadPatientAppointments();
    await loadRecentPatientHistory();
    
    // Cargar recetas recientes (solo si el contenedor existe en el HTML)
    const prescriptionsHomeContainer = document.getElementById('prescriptions-home-list');
    if (prescriptionsHomeContainer) {
        await renderPrescriptionsHome();
    }

    // Auto refresco cada 30s
    if (appState.autoRefreshInterval) {
        clearInterval(appState.autoRefreshInterval);
    }

    appState.autoRefreshInterval = setInterval(async () => {
        await loadPatientData();
        await loadPatientAppointments();
        await loadPatientStats();
        await loadRecentPatientHistory();
        
        // Refrescar recetas en home si existe el contenedor
        const prescriptionsHomeContainer = document.getElementById('prescriptions-home-list');
        if (prescriptionsHomeContainer) {
            await renderPrescriptionsHome();
        }
    }, 30000);
}

// Inicialización cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    await initializePatientPanel();
});

// Exportar para uso global si es necesario
window.PatientPanel = {
    loadPatientData,
    loadPatientStats,
    loadPatientAppointments,
    loadRecentPatientHistory,
};

