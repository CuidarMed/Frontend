// ============================================
// PATIENT HISTORY RECENT
// ============================================

import { appState, getAuthenticatedUser } from './patient-state.js';
import { normalizePatient } from './patient-utils.js';

/**
 * Carga historial médico reciente (3 últimas consultas para inicio)
 */
export async function loadRecentPatientHistory() {
    const historyList = document.getElementById("history-list-inicio");
    if (!historyList) return;

    try {
        const patientId = appState.currentPatient?.patientId;
        if (!patientId) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-medical"></i>
                    <p>No hay historial médico disponible</p>
                </div>`;
            return;
        }

        const { ApiClinical, Api } = await import('../api.js');

        const now = new Date();
        const from = new Date(now.getFullYear() - 1, 0, 1);

        const response = await ApiClinical.get(
            `v1/Encounter?patientId=${patientId}&from=${from.toISOString()}&to=${now.toISOString()}`
        );

        const encounters = Array.isArray(response) ? response : response?.value || [];

        if (!encounters.length) {
            historyList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-medical"></i>
                    <p>No hay consultas recientes</p>
                </div>`;
            return;
        }

        // Ordenar por fecha descendente y tomar solo 3
        const lastThree = encounters
            .sort((a, b) => new Date(b.date || b.Date) - new Date(a.date || a.Date))
            .slice(0, 3);

        // Obtener info de doctores
        const doctorIds = [...new Set(lastThree.map(e => e.doctorId || e.DoctorId))];
        const doctorsMap = new Map();

        for (const id of doctorIds) {
            try {
                const d = await Api.get(`v1/Doctor/${id}`);
                const fullName = `Dr. ${d.firstName || d.FirstName || ''} ${d.lastName || d.LastName || ''}`.trim();
                doctorsMap.set(id, fullName || `Dr. ${id}`);
            } catch {
                doctorsMap.set(id, `Dr. ${id}`);
            }
        }

        // Renderizar últimas 3 consultas
        historyList.innerHTML = lastThree
            .map(enc => {
                const encounterId = enc.encounterId || enc.EncounterId;
                const appointmentId = enc.appointmentId || enc.AppointmentId || enc.appoinmentId || enc.AppoinmentId;
                const patientId = enc.patientId || enc.PatientId;
                const date = new Date(enc.date || enc.Date);
                const doctorName = doctorsMap.get(enc.doctorId || enc.DoctorId) || 'Dr. Desconocido';
                const assessment = enc.assessment || enc.Assessment || '';
                
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;

                return `
                    <div class="history-compact-card">
                        <div class="history-compact-content">
                            <div class="history-compact-left">
                                <div class="history-compact-date">
                                    <i class="fas fa-calendar-alt"></i>
                                    ${dateStr}
                                    <span class="history-doctor-separator">|</span>
                                    <i class="fas fa-user-md"></i>
                                    ${doctorName}
                                </div>
                                <div class="history-compact-reason"><strong>Diagnóstico: </strong>${assessment}</div>
                            </div>
                        </div>
                        <button class="btn-history-view" onclick="viewPrescription(${encounterId || 'null'}, ${appointmentId || 'null'}, ${patientId || 'null'})">
                            <i class="fas fa-file-prescription"></i>
                            Ver Receta
                        </button>
                    </div>
                `;
            })
            .join("");

    } catch (error) {
        console.error('Error cargando historial médico reciente:', error);
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error cargando historial médico</p>
            </div>`;
    }
}
