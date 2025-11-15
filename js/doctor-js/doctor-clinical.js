// doctor-clinical.js
// Módulo para gestión de historia clínica y pacientes

import { showNotification } from './doctor-ui.js';
import { getId, formatDate } from './doctor-core.js';

let allPatientsList = [];

/**
 * Carga la vista de historia clínica
 */
export async function loadClinicalHistoryView() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;

    // Eliminar secciones anteriores
    const existingHistory = dashboardContent.querySelectorAll('.clinical-history-section, .patient-profile-section');
    existingHistory.forEach(section => section.remove());

    // Crear sección de buscador de pacientes
    const historySection = document.createElement('div');
    historySection.className = 'dashboard-section clinical-history-section';
    historySection.innerHTML = `
        <div class="section-header">
            <div>
                <h3>Historia Clínica</h3>
                <p>Busca y accede al historial médico de tus pacientes</p>
            </div>
        </div>
        <div class="patient-search-container" style="margin-bottom: 2rem;">
            <div class="search-box" style="position: relative; margin-bottom: 1rem;">
                <i class="fas fa-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #6b7280;"></i>
                <input type="text" 
                       id="patient-search-input" 
                       class="patient-search-input"
                       placeholder="Buscar paciente por nombre, apellido o DNI..."
                       style="width: 100%; padding: 0.75rem 1rem 0.75rem 3rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 1rem;">
            </div>
            <div id="patients-list" class="patients-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-top: 1rem;">
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #6b7280;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <p>Cargando pacientes...</p>
                </div>
            </div>
        </div>
    `;
    dashboardContent.appendChild(historySection);

    // Cargar todos los pacientes
    await loadAllPatients();

    // Inicializar el buscador
    const searchInput = document.getElementById('patient-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase().trim();
            filterPatients(searchTerm);
        });
    }
}

/**
 * Carga todos los pacientes
 */
async function loadAllPatients() {
    const patientsList = document.getElementById('patients-list');
    if (!patientsList) return;

    try {
        const { Api } = await import('../api.js');
        const patients = await Api.get('v1/Patient/all');
        
        allPatientsList = Array.isArray(patients) ? patients : [];
        
        renderPatientsList(allPatientsList);
    } catch (error) {
        console.error('Error al cargar pacientes:', error);
        patientsList.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #ef4444;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Error al cargar los pacientes. Por favor, intenta nuevamente.</p>
            </div>
        `;
    }
}

/**
 * Renderiza la lista de pacientes
 */
function renderPatientsList(patients) {
    const patientsList = document.getElementById('patients-list');
    if (!patientsList) return;

    if (!patients || patients.length === 0) {
        patientsList.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #6b7280;">
                <i class="fas fa-user-slash" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>No hay pacientes registrados</p>
            </div>
        `;
        return;
    }

    patientsList.innerHTML = patients.map(patient => {
        const patientId = patient.patientId || patient.PatientId;
        const name = patient.name || patient.Name || '';
        const lastName = patient.lastName || patient.LastName || '';
        const dni = patient.dni || patient.Dni || '';
        const fullName = `${name} ${lastName}`.trim() || 'Sin nombre';
        
        return `
            <div class="patient-card" 
                 data-patient-id="${patientId}"
                 style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; cursor: pointer; transition: all 0.2s;"
                 onmouseover="this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'; this.style.borderColor='#10b981';"
                 onmouseout="this.style.boxShadow='none'; this.style.borderColor='#e5e7eb';">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 50px; height: 50px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: bold;">
                        ${name.charAt(0).toUpperCase() || 'P'}
                    </div>
                    <div style="flex: 1;">
                        <h4 style="margin: 0; color: #111827; font-size: 1.1rem; font-weight: 600;">${fullName}</h4>
                        <p style="margin: 0.25rem 0 0 0; color: #6b7280; font-size: 0.875rem;">
                            <i class="fas fa-id-card"></i> DNI: ${dni || 'N/A'}
                        </p>
                    </div>
                    <i class="fas fa-chevron-right" style="color: #9ca3af;"></i>
                </div>
            </div>
        `;
    }).join('');

    // Agregar event listeners a las tarjetas
    const patientCards = patientsList.querySelectorAll('.patient-card');
    patientCards.forEach(card => {
        card.addEventListener('click', function() {
            const patientId = this.getAttribute('data-patient-id');
            if (patientId) {
                viewPatientProfile(parseInt(patientId));
            }
        });
    });
}

/**
 * Filtra pacientes por término de búsqueda
 */
function filterPatients(searchTerm) {
    if (!searchTerm) {
        renderPatientsList(allPatientsList);
        return;
    }

    const filtered = allPatientsList.filter(patient => {
        const name = (patient.name || patient.Name || '').toLowerCase();
        const lastName = (patient.lastName || patient.LastName || '').toLowerCase();
        const dni = String(patient.dni || patient.Dni || '').toLowerCase();
        const fullName = `${name} ${lastName}`.trim();
        
        return fullName.includes(searchTerm) || 
               name.includes(searchTerm) || 
               lastName.includes(searchTerm) || 
               dni.includes(searchTerm);
    });

    renderPatientsList(filtered);
}

/**
 * Ver perfil de paciente
 */
export async function viewPatientProfile(patientId) {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;

    // Ocultar el buscador
    const historySection = dashboardContent.querySelector('.clinical-history-section');
    if (historySection) {
        historySection.style.display = 'none';
    }

    // Eliminar perfil anterior si existe
    const existingProfile = dashboardContent.querySelector('.patient-profile-section');
    if (existingProfile) {
        existingProfile.remove();
    }

    // Crear sección de perfil del paciente
    const profileSection = document.createElement('div');
    profileSection.className = 'dashboard-section patient-profile-section';
    profileSection.innerHTML = `
        <div class="section-header" style="margin-bottom: 2rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <button id="back-to-patients" class="btn btn-secondary" style="padding: 0.5rem 1rem;">
                    <i class="fas fa-arrow-left"></i> Volver
                </button>
                <div>
                    <h3 id="patient-profile-name">Cargando...</h3>
                    <p>Perfil e historial médico del paciente</p>
                </div>
            </div>
        </div>
        <div id="patient-profile-content" style="display: grid; grid-template-columns: 1fr; gap: 2rem;">
            <style>
                @media (min-width: 768px) {
                    #patient-profile-content {
                        grid-template-columns: 1fr 2fr !important;
                    }
                }
            </style>
            <div class="patient-info-card" style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem;">
                <h4 style="margin-top: 0; color: #111827; border-bottom: 2px solid #10b981; padding-bottom: 0.5rem;">Información del Paciente</h4>
                <div id="patient-info-details" style="margin-top: 1rem;">
                    <p style="color: #6b7280;">Cargando información...</p>
                </div>
            </div>
            <div class="patient-history-card" style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem;">
                <h4 style="margin-top: 0; color: #111827; border-bottom: 2px solid #10b981; padding-bottom: 0.5rem;">Historial Médico</h4>
                <div id="patient-history-list" style="margin-top: 1rem;">
                    <p style="color: #6b7280;">Cargando historial...</p>
                </div>
            </div>
        </div>
    `;
    dashboardContent.appendChild(profileSection);

    // Event listener para volver
    const backButton = document.getElementById('back-to-patients');
    if (backButton) {
        backButton.addEventListener('click', function() {
            profileSection.remove();
            if (historySection) {
                historySection.style.display = '';
            }
        });
    }

    // Cargar información del paciente
    await loadPatientProfileData(patientId);
    await loadPatientHistory(patientId);
}

/**
 * Carga los datos del perfil del paciente
 */
async function loadPatientProfileData(patientId) {
    try {
        const { Api } = await import('../api.js');
        const patient = await Api.get(`v1/Patient/${patientId}`);
        
        if (!patient) {
            throw new Error('Paciente no encontrado');
        }

        const name = patient.name || patient.Name || '';
        const lastName = patient.lastName || patient.LastName || '';
        const fullName = `${name} ${lastName}`.trim() || 'Sin nombre';
        const dni = patient.dni || patient.Dni || 'N/A';
        const address = patient.adress || patient.Adress || 'No especificada';
        const phone = patient.phone || patient.Phone || 'No especificado';
        const dateOfBirth = patient.dateOfBirth || patient.DateOfBirth;
        const healthPlan = patient.healthPlan || patient.HealthPlan || 'No especificado';
        const membershipNumber = patient.membershipNumber || patient.MembershipNumber || 'N/A';

        // Actualizar nombre en el header
        const profileName = document.getElementById('patient-profile-name');
        if (profileName) {
            profileName.textContent = fullName;
        }

        // Calcular edad si hay fecha de nacimiento
        let age = 'N/A';
        if (dateOfBirth) {
            try {
                const birthDate = new Date(dateOfBirth);
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                    age--;
                }
            } catch (e) {
                console.warn('Error calculando edad:', e);
            }
        }

        // Renderizar información
        const infoDetails = document.getElementById('patient-info-details');
        if (infoDetails) {
            infoDetails.innerHTML = `
                <div style="margin-bottom: 1rem;">
                    <strong style="color: #6b7280; display: block; margin-bottom: 0.25rem;">DNI:</strong>
                    <span style="color: #111827;">${dni}</span>
                </div>
                <div style="margin-bottom: 1rem;">
                    <strong style="color: #6b7280; display: block; margin-bottom: 0.25rem;">Edad:</strong>
                    <span style="color: #111827;">${age} años</span>
                </div>
                <div style="margin-bottom: 1rem;">
                    <strong style="color: #6b7280; display: block; margin-bottom: 0.25rem;">Dirección:</strong>
                    <span style="color: #111827;">${address}</span>
                </div>
                <div style="margin-bottom: 1rem;">
                    <strong style="color: #6b7280; display: block; margin-bottom: 0.25rem;">Teléfono:</strong>
                    <span style="color: #111827;">${phone}</span>
                </div>
                <div style="margin-bottom: 1rem;">
                    <strong style="color: #6b7280; display: block; margin-bottom: 0.25rem;">Obra Social:</strong>
                    <span style="color: #111827;">${healthPlan}</span>
                </div>
                <div>
                    <strong style="color: #6b7280; display: block; margin-bottom: 0.25rem;">Número de Afiliado:</strong>
                    <span style="color: #111827;">${membershipNumber}</span>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error al cargar perfil del paciente:', error);
        const infoDetails = document.getElementById('patient-info-details');
        if (infoDetails) {
            infoDetails.innerHTML = `
                <p style="color: #ef4444;">Error al cargar la información del paciente</p>
            `;
        }
    }
}

/**
 * Carga el historial del paciente
 */
async function loadPatientHistory(patientId) {
    const historyList = document.getElementById('patient-history-list');
    if (!historyList) return;

    try {
        const { ApiClinical } = await import('../api.js');
        
        // Obtener encounters del paciente
        const now = new Date();
        const threeYearsAgo = new Date(now.getFullYear() - 3, 0, 1);
        const encounters = await ApiClinical.get(
            `v1/Encounter?patientId=${patientId}&from=${threeYearsAgo.toISOString()}&to=${now.toISOString()}`
        );

        const encountersList = Array.isArray(encounters) ? encounters : (encounters?.value || []);

        if (!encountersList || encountersList.length === 0) {
            historyList.innerHTML = `
                <p style="color: #6b7280; text-align: center; padding: 2rem;">
                    <i class="fas fa-file-medical" style="font-size: 2rem; margin-bottom: 1rem; display: block; color: #d1d5db;"></i>
                    No hay historial médico registrado para este paciente
                </p>
            `;
            return;
        }

        // Obtener información de los doctores
        const { Api } = await import('../api.js');
        const doctorsMap = new Map();
        
        for (const enc of encountersList) {
            const doctorId = enc.doctorId || enc.DoctorId;
            if (doctorId && !doctorsMap.has(doctorId)) {
                try {
                    const doctor = await Api.get(`v1/Doctor/${doctorId}`);
                    if (doctor) {
                        const doctorName = `${doctor.firstName || doctor.FirstName || ''} ${doctor.lastName || doctor.LastName || ''}`.trim();
                        doctorsMap.set(doctorId, doctorName || `Dr. ID ${doctorId}`);
                    }
                } catch (err) {
                    console.warn(`No se pudo cargar doctor ${doctorId}:`, err);
                    doctorsMap.set(doctorId, `Dr. ID ${doctorId}`);
                }
            }
        }

        // Renderizar historial
        historyList.innerHTML = encountersList.map(enc => {
            const encounterId = enc.encounterId || enc.EncounterId;
            const date = new Date(enc.date || enc.Date);
            const doctorId = enc.doctorId || enc.DoctorId;
            const doctorName = doctorsMap.get(doctorId) || 'Dr. Sin nombre';
            const reasons = enc.reasons || enc.Reasons || 'Sin motivo especificado';
            const assessment = enc.assessment || enc.Assessment || 'Sin diagnóstico';
            const status = (enc.status || enc.Status || '').toLowerCase();

            return `
                <div class="history-item" style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1rem; background: #f9fafb;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i class="fas fa-calendar-alt" style="color: #10b981;"></i>
                                <strong style="color: #111827;">${date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; color: #6b7280;">
                                <i class="fas fa-user-md"></i>
                                <span>${doctorName}</span>
                            </div>
                        </div>
                        <span class="status-badge" style="padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.875rem; font-weight: 500; 
                            background: ${status === 'completed' ? '#d1fae5' : status === 'signed' ? '#dbeafe' : '#fef3c7'}; 
                            color: ${status === 'completed' ? '#065f46' : status === 'signed' ? '#1e40af' : '#92400e'};">
                            ${status === 'completed' ? 'Completada' : status === 'signed' ? 'Firmada' : 'Pendiente'}
                        </span>
                    </div>
                    <div style="margin-bottom: 0.75rem;">
                        <strong style="color: #6b7280; display: block; margin-bottom: 0.25rem;">Motivo de consulta:</strong>
                        <p style="color: #111827; margin: 0;">${reasons}</p>
                    </div>
                    <div>
                        <strong style="color: #6b7280; display: block; margin-bottom: 0.25rem;">Diagnóstico:</strong>
                        <p style="color: #111827; margin: 0;">${assessment}</p>
                    </div>
                    <button onclick="viewEncounterDetailsFromDoctor(${encounterId})" 
                            class="btn btn-primary" 
                            style="margin-top: 1rem; padding: 0.5rem 1rem; font-size: 0.875rem;">
                        <i class="fas fa-eye"></i> Ver detalles completos
                    </button>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error al cargar historial del paciente:', error);
        historyList.innerHTML = `
            <p style="color: #ef4444; text-align: center; padding: 2rem;">
                <i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
                Error al cargar el historial médico
            </p>
        `;
    }
}

/**
 * Ver detalles de un encounter
 */
export async function viewEncounterDetails(encounterId) {
    try {
        const { ApiClinical, Api } = await import('../api.js');
        const encounter = await ApiClinical.get(`v1/Encounter/${encounterId}`);
        
        if (!encounter) {
            showNotification('No se encontraron los detalles del encuentro', 'error');
            return;
        }

        // Obtener información del paciente y doctor
        const patientId = encounter.patientId || encounter.PatientId;
        const doctorId = encounter.doctorId || encounter.DoctorId;
        
        let patientName = 'Paciente desconocido';
        let doctorName = 'Dr. Sin nombre';
        
        try {
            const { Api: ApiDir } = await import('../api.js');
            if (patientId) {
                const patient = await ApiDir.get(`v1/Patient/${patientId}`);
                patientName = `${patient.name || patient.Name || ''} ${patient.lastName || patient.LastName || ''}`.trim() || 'Paciente sin nombre';
            }
            if (doctorId) {
                const doctor = await ApiDir.get(`v1/Doctor/${doctorId}`);
                doctorName = `${doctor.firstName || doctor.FirstName || ''} ${doctor.lastName || doctor.LastName || ''}`.trim() || `Dr. ID ${doctorId}`;
            }
        } catch (err) {
            console.warn('Error al cargar información de paciente/doctor:', err);
        }

        const encounterDate = new Date(encounter.date || encounter.Date);
        const status = encounter.status || encounter.Status || 'Pendiente';
        const reasons = encounter.reasons || encounter.Reasons || 'Sin motivo especificado';
        const subjective = encounter.subjective || encounter.Subjective || 'No especificado';
        const objective = encounter.objetive || encounter.Objetive || encounter.objective || encounter.Objective || 'No especificado';
        const assessment = encounter.assessment || encounter.Assessment || 'No especificado';
        const plan = encounter.plan || encounter.Plan || 'No especificado';
        const notes = encounter.notes || encounter.Notes || '';

        // Crear modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
                <div class="modal-header">
                    <div>
                        <h3>Detalles de la Consulta</h3>
                        <p class="encounter-modal-subtitle">Consulta médica completa</p>
                    </div>
                    <button class="close-modal">&times;</button>
                </div>
                <div class="modal-body encounter-modal-body">
                    <div class="encounter-info-section">
                        <div class="encounter-info-header">
                            <i class="fas fa-info-circle"></i>
                            <h4>Información General</h4>
                        </div>
                        <div class="encounter-info-grid">
                            <div class="encounter-info-item">
                                <span class="info-label"><i class="fas fa-calendar"></i> Fecha:</span>
                                <span class="info-value">${encounterDate.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            </div>
                            <div class="encounter-info-item">
                                <span class="info-label"><i class="fas fa-clock"></i> Hora:</span>
                                <span class="info-value">${encounterDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div class="encounter-info-item">
                                <span class="info-label"><i class="fas fa-user"></i> Paciente:</span>
                                <span class="info-value">${patientName}</span>
                            </div>
                            <div class="encounter-info-item">
                                <span class="info-label"><i class="fas fa-user-md"></i> Médico:</span>
                                <span class="info-value">${doctorName}</span>
                            </div>
                            <div class="encounter-info-item">
                                <span class="info-label"><i class="fas fa-flag"></i> Estado:</span>
                                <span class="info-value">${status}</span>
                            </div>
                        </div>
                    </div>
                    <div class="encounter-info-section" style="margin-top: 2rem;">
                        <div class="encounter-info-header">
                            <i class="fas fa-stethoscope"></i>
                            <h4>Motivo de Consulta</h4>
                        </div>
                        <p style="color: #111827; margin-top: 1rem;">${reasons}</p>
                    </div>
                    <div class="encounter-info-section" style="margin-top: 2rem;">
                        <div class="encounter-info-header">
                            <i class="fas fa-file-medical"></i>
                            <h4>Notas SOAP</h4>
                        </div>
                        <div style="margin-top: 1rem;">
                            <div style="margin-bottom: 1rem;">
                                <strong style="color: #6b7280; display: block; margin-bottom: 0.5rem;">Subjetivo (S):</strong>
                                <p style="color: #111827; margin: 0; white-space: pre-wrap;">${subjective}</p>
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <strong style="color: #6b7280; display: block; margin-bottom: 0.5rem;">Objetivo (O):</strong>
                                <p style="color: #111827; margin: 0; white-space: pre-wrap;">${objective}</p>
                            </div>
                            <div style="margin-bottom: 1rem;">
                                <strong style="color: #6b7280; display: block; margin-bottom: 0.5rem;">Evaluación (A):</strong>
                                <p style="color: #111827; margin: 0; white-space: pre-wrap;">${assessment}</p>
                            </div>
                            <div>
                                <strong style="color: #6b7280; display: block; margin-bottom: 0.5rem;">Plan (P):</strong>
                                <p style="color: #111827; margin: 0; white-space: pre-wrap;">${plan}</p>
                            </div>
                        </div>
                    </div>
                    ${notes ? `
                    <div class="encounter-info-section" style="margin-top: 2rem;">
                        <div class="encounter-info-header">
                            <i class="fas fa-sticky-note"></i>
                            <h4>Notas Adicionales</h4>
                        </div>
                        <p style="color: #111827; margin-top: 1rem; white-space: pre-wrap;">${notes}</p>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Cerrar modal
        modal.querySelector('.close-modal')?.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    } catch (error) {
        console.error('Error al cargar detalles del encounter:', error);
        showNotification('Error al cargar los detalles de la consulta', 'error');
    }
}

// Función global para compatibilidad
window.viewEncounterDetailsFromDoctor = viewEncounterDetails;

export { allPatientsList };