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
import { initializeChatNotificationsPatient } from '../chat/ChatNotification.js';


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
    // TODO: Implementar renderPrescriptionsHome si es necesario
    // const prescriptionsHomeContainer = document.getElementById('prescriptions-home-list');
    // if (prescriptionsHomeContainer) {
    //     await renderPrescriptionsHome();
    // }

    // Inicializar notificaciones de chat
    await initializeChatNotificationsPatient();
    
    // ✅ CAMBIO: Auto refresco cada 10 segundos (antes era 30)
    if (appState.autoRefreshInterval) {
        clearInterval(appState.autoRefreshInterval);
    }

    appState.autoRefreshInterval = setInterval(async () => {
        console.log('🔄 Auto-refresh ejecutándose...');
        
        await loadPatientData();
        await loadPatientAppointments();
        await loadPatientStats();
        await loadRecentPatientHistory(); // ✅ Esto actualizará las 3 últimas consultas
        
        // Refrescar recetas en home si existe el contenedor
        // TODO: Implementar renderPrescriptionsHome si es necesario
        // const prescriptionsHomeContainer = document.getElementById('prescriptions-home-list');
        // if (prescriptionsHomeContainer) {
        //     await renderPrescriptionsHome();
        // }
        
        console.log('✅ Auto-refresh completado');
    }, 10000); // ✅ 10 segundos en lugar de 30
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