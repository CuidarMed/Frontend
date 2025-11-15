// doctor-main.js
// Módulo principal para inicializar el panel del doctor

import { 
    doctorState,
    loadDoctorContext, 
    loadDoctorData 
} from './doctor-core.js';

import { 
    updateDoctorHeader 
} from './doctor-ui.js';

import { 
    initializeSidebarNavigation, 
    initializeQuickActions 
} from './doctor-navigation.js';

import { 
    initializeConsultationDateFilter,
    loadTodayConsultations,
    loadTodayFullHistory
} from './doctor-appointments.js';

import { 
    initializeProfileEditing 
} from './doctor-profile.js';

import { 
    initializePrescriptionModal 
} from './doctor-prescriptions.js';

/**
 * Inicializa el panel del doctor
 */
export async function initializeDoctorPanel() {
    console.log('🚀 Inicializando panel del doctor...');
    
    try {
        // 1. Cargar contexto del usuario
        await loadDoctorContext();
        
        // 2. Esperar un momento si los datos no están listos
        if (!doctorState.currentUser?.firstName || !doctorState.currentUser?.lastName) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const { state } = await import('../state.js');
            doctorState.currentUser = state.user;
        }
        
        // 3. Cargar datos del doctor
        const doctorData = await loadDoctorData();
        
        // 4. Actualizar header
        updateDoctorHeader(doctorData);
        
        // 5. Inicializar navegación del sidebar
        await initializeSidebarNavigation();
        
        // 6. Inicializar acciones rápidas
        initializeQuickActions();
        
        // 7. Inicializar modal de receta
        initializePrescriptionModal();
        
        // 8. Inicializar funcionalidad de editar perfil
        initializeProfileEditing();
        
        // 9. Inicializar filtro de fecha para historial de consultas
        initializeConsultationDateFilter();
        
        // 10. Cargar datos periódicamente (cada 30 segundos)
        setInterval(async () => {
            await loadDoctorData();
            await loadDoctorStats();
        }, 30000);
        
        // 11. Cargar estadísticas iniciales
        await loadDoctorStats();
        
        console.log('✅ Panel del doctor inicializado correctamente');
        
    } catch (error) {
        console.error('❌ Error en la inicialización del panel del doctor:', error);
        updateDoctorHeader(null);
    }
}

/**
 * Carga las estadísticas del doctor
 */
export async function loadDoctorStats() {
    try {
        const doctorId = doctorState.currentDoctorData?.doctorId;
        if (!doctorId) {
            console.warn('No hay doctorId disponible para cargar estadísticas');
            return;
        }

        const { ApiScheduling } = await import('../api.js');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const todayAppointmentsResponse = await ApiScheduling.get(
            `v1/Appointments?doctorId=${doctorId}&startTime=${today.toISOString()}&endTime=${tomorrow.toISOString()}`
        );
        
        const todayAppointments = todayAppointmentsResponse?.filter(a => {
            const status = a.status || a.Status;
            return status === 'SCHEDULED' || status === 'CONFIRMED' || status === 'IN_PROGRESS';
        }) || [];
        
        const weekAppointments = await ApiScheduling.get(
            `v1/Appointments?doctorId=${doctorId}&startTime=${today.toISOString()}&endTime=${nextWeek.toISOString()}`
        );
        
        // Actualizar tarjetas de resumen
        const patientsToday = document.getElementById('patients-today');
        const weeklyAppointments = document.getElementById('weekly-appointments');
        const activeConsultation = document.getElementById('active-consultation');
        const prescriptionsToday = document.getElementById('prescriptions-today');
        
        if (patientsToday) {
            patientsToday.textContent = todayAppointments?.length || 0;
        }
        
        if (weeklyAppointments) {
            weeklyAppointments.textContent = weekAppointments?.length || 0;
        }
        
        const activeConsultations = todayAppointments.filter(a => (a.status || a.Status) === 'IN_PROGRESS');
        if (activeConsultation) {
            activeConsultation.textContent = activeConsultations.length;
        }
        
        // Cargar prescripciones del día
        try {
            const { ApiClinical } = await import('../api.js');
            const prescriptionsResponse = await ApiClinical.get(`v1/Prescription/doctor/${doctorId}`).catch(() => []);
            const todayPrescriptions = Array.isArray(prescriptionsResponse) ? prescriptionsResponse.filter(p => {
                const prescDate = new Date(p.prescriptionDate || p.PrescriptionDate);
                return prescDate >= today && prescDate < tomorrow;
            }) : [];
            
            if (prescriptionsToday) {
                prescriptionsToday.textContent = todayPrescriptions.length;
            }
        } catch (err) {
            if (prescriptionsToday) {
                prescriptionsToday.textContent = '0';
            }
        }
        
    } catch (error) {
        console.error('Error al cargar estadísticas:', error);
    }
}

// Exportar doctorState
export { doctorState };