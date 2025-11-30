import { appState } from './patient-state.js';
import { openPatientVideoCall } from './patient-video-call.js';

let pendingVideoCall = null;
let shownAppointments = new Set();

export async function checkVideoCallNotifications() {
    if (pendingVideoCall || document.querySelector('#video-call-incoming-modal') || document.querySelector('#patient-video-call-container')) return;
    
    try {
        const { ApiScheduling, Api } = await import('../api.js');
        const patientId = appState.currentPatient?.patientId;
        if (!patientId) return;
        
        const appointments = await ApiScheduling.get(`v1/Appointments?patientId=${patientId}`).catch(() => []);
        const allApts = Array.isArray(appointments) ? appointments : [];
        const inProgress = allApts.filter(apt => (apt.status || apt.Status) === 'IN_PROGRESS');
        
        for (const apt of inProgress) {
            const aptId = apt.appointmentId || apt.AppointmentId;
            if (shownAppointments.has(aptId)) continue;
            
            // Verificar si hay sala activa (médico en videollamada)
            const activeCheck = await ApiScheduling.get(`v1/Video/room/${aptId}/active`).catch(() => null);
            if (!activeCheck?.hasActiveParticipants) continue;
            
            const doctorId = apt.doctorId || apt.DoctorId;
            const doctor = await Api.get(`v1/Doctor/${doctorId}`).catch(() => null);
            const doctorName = doctor ? `Dr. ${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() : 'Tu médico';
            
            shownAppointments.add(aptId);
            pendingVideoCall = { appointmentId: aptId, doctorId, doctorName };
            showVideoCallModal(aptId, doctorId, doctorName);
            break;
        }
    } catch (err) {
        console.warn('Error verificando videollamadas:', err);
    }
}

function showVideoCallModal(appointmentId, doctorId, doctorName) {
    const modal = document.createElement('div');
    modal.id = 'video-call-incoming-modal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
    modal.innerHTML = `
        <div style="background: white; border-radius: 1rem; padding: 2rem; max-width: 400px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <div style="font-size: 3rem; color: #10b981; margin-bottom: 1rem;"><i class="fas fa-video"></i></div>
            <h3 style="margin: 0 0 1rem 0; color: #111827;">Videollamada entrante</h3>
            <p style="color: #6b7280; margin-bottom: 1.5rem;">${doctorName} quiere iniciar la consulta</p>
            <div style="display: flex; gap: 0.75rem; justify-content: center;">
                <button id="accept-video-call" style="background: #10b981; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-weight: 500;">
                    <i class="fas fa-check"></i> Aceptar
                </button>
                <button id="reject-video-call" style="background: #ef4444; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-weight: 500;">
                    <i class="fas fa-times"></i> Rechazar
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.querySelector('#accept-video-call').onclick = () => {
        shownAppointments.add(appointmentId);
        modal.remove();
        pendingVideoCall = null;
        openPatientVideoCall(appointmentId, doctorId, doctorName);
    };
    
    modal.querySelector('#reject-video-call').onclick = () => {
        shownAppointments.add(appointmentId);
        modal.remove();
        pendingVideoCall = null;
    };
}

