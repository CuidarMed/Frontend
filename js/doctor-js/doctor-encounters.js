// ===================================
// DOCTOR ENCOUNTERS - Encuentros Clínicos (SOAP)
// ===================================

import { doctorState, getId, updateCounter } from './doctor-core.js';
import { showNotification } from './doctor-ui.js';
import { updateAppointmentStatus } from './doctor-appointments.js';

// ===================================
// MODAL DE ENCOUNTER
// ===================================

const createEncounterForm = (appointmentId, patientId, patientName) => `
    <div class="modal-content encounter-modal-content" style="max-width: 1400px; width: 95vw;">
        <div class="modal-header">
            <h3>Consulta con ${patientName}</h3>
            <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body encounter-modal-body">
            <form id="encounter-form" class="encounter-form-layout">
                <input type="hidden" id="encounter-appointment-id" value="${appointmentId}">
                <input type="hidden" id="encounter-patient-id" value="${patientId}">
                
                <!-- Columna izquierda: Formulario -->
                <div class="encounter-form-column">
                    <div class="encounter-form-scrollable">
                        <div class="form-group">
                            <label for="encounter-reasons">Motivo de consulta: *</label>
                            <textarea id="encounter-reasons" rows="2" required placeholder="Ej: Dolor de cabeza intenso desde hace 3 días"></textarea>
                        </div>
                        
                        <div class="soap-section" style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                            <h4 style="margin-bottom: 1rem; color: #1f2937; display: flex; align-items: center; gap: 0.5rem;">
                                <i class="fas fa-notes-medical"></i> Notas SOAP
                            </h4>
                            ${['subjective', 'objective', 'assessment', 'plan'].map((field, i) => {
                                const labels = ['Subjetivo (Síntomas del paciente)', 'Objetivo (Hallazgos físicos)', 'Assessment (Diagnóstico)', 'Plan (Tratamiento)'];
                                const helps = ['¿Qué dice el paciente?', '¿Qué observas tú?', '¿Cuál es tu diagnóstico?', '¿Qué vas a hacer?'];
                                return `
                                    <div class="form-group">
                                        <label for="encounter-${field}"><strong>${field[0].toUpperCase()}</strong>${labels[i].slice(field[0].length)}: *</label>
                                        <textarea id="encounter-${field}" rows="3" required placeholder="..."></textarea>
                                        <small style="color: #6b7280;">${helps[i]}</small>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                        
                        <div class="form-group">
                            <label for="encounter-notes">Notas adicionales:</label>
                            <textarea id="encounter-notes" rows="2" placeholder="Información complementaria (opcional)"></textarea>
                        </div>
                    </div>
                    
                    <div class="form-actions encounter-form-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end; padding-top: 1rem; border-top: 1px solid #e5e7eb; margin-top: auto; background: #ffffff;">
                        <button type="button" class="btn btn-secondary" id="cancel-encounter"><i class="fas fa-times"></i> Cancelar</button>
                        <button type="button" class="btn btn-success" id="download-hl7-summary-btn" data-appointment-id="${appointmentId}" data-patient-id="${patientId}" 
                                style="background-color: #28a745; border-color: #28a745; color: white;">
                            <i class="fas fa-file-download"></i> Descargar HL7
                        </button>
                        <button type="button" class="btn btn-info" id="prescribe-btn" data-patient-id="${patientId}" 
                                data-patient-name="${patientName}" data-appointment-id="${appointmentId}" 
                                style="background-color: #17a2b8; border-color: #17a2b8; color: white;">
                            <i class="fas fa-prescription"></i> Recetar
                        </button>
                        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Guardar Consulta</button>
                    </div>
                </div>
                
                <!-- Columna derecha: Videollamada -->
                <div class="encounter-video-column">
                    <div id="video-call-section" style="padding: 1rem; background: #f0f9ff; border-radius: 0.5rem; border: 1px solid #bae6fd; height: 100%; display: flex; flex-direction: column;">
                        <h4 style="margin-bottom: 0.5rem; color: #0369a1; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-video"></i> Videollamada
                        </h4>
                        <div id="video-call-container" style="flex: 1; min-height: 400px; background: #000; border-radius: 0.5rem; position: relative; display: flex; align-items: center; justify-content: center; color: #fff; margin-bottom: 0.5rem;">
                            <p id="video-loading" style="text-align: center;">Cargando videollamada...</p>
                        </div>
                        <div id="video-controls" style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                            <button type="button" id="toggle-mic" class="btn btn-secondary" style="padding: 0.5rem 1rem;">
                                <i class="fas fa-microphone"></i> Micrófono
                            </button>
                            <button type="button" id="toggle-camera" class="btn btn-secondary" style="padding: 0.5rem 1rem;">
                                <i class="fas fa-video"></i> Cámara
                            </button>
                            <button type="button" id="end-call" class="btn btn-danger" style="padding: 0.5rem 1rem;">
                                <i class="fas fa-phone-slash"></i> Finalizar
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    </div>
`;

const restoreAttendButton = (appointmentId) => {
    const button = document.querySelector(`[data-appointment-id="${appointmentId}"]`);
    if (button) {
        button.innerHTML = 'Atender';
        button.classList.remove('in-consultation');
        button.disabled = false;
    }
};

const setupModalCloseHandlers = (modal, appointmentId) => {
    modal.querySelectorAll('.close-modal, #cancel-encounter').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('❌ Cerrando modal de encounter');
            modal.remove();
            restoreAttendButton(appointmentId);
            updateCounter('active-consultation', -1);
        });
    });
};

const checkExistingEncounter = async (appointmentId, modal) => {
    try {
        const { ApiClinical } = await import('../api.js');
        const existing = await ApiClinical.get(`v1/Encounter?appointmentId=${appointmentId}`);
        
        if (existing && existing.length > 0) {
            showNotification('Esta consulta ya fue atendida anteriormente.', 'warning');
            modal.remove();
            await updateAppointmentStatus(appointmentId, 'COMPLETED', null, true).catch(console.warn);
            return true;
        }
    } catch (err) {
        console.warn('⚠️ No se pudo verificar encounters:', err);
    }
    return false;
};

const setupDownloadHL7Button = (modal) => {
    setTimeout(() => {
        const btn = modal.querySelector('#download-hl7-summary-btn');
        if (btn) {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                try {
                    await downloadHl7Summary(btn.dataset.appointmentId, btn.dataset.patientId);
                } catch (error) {
                    console.error('❌ Error descargando HL7:', error);
                    showNotification('Error al descargar el resumen HL7', 'error');
                }
            });
        }
    }, 100);
};

const setupPrescribeButton = (modal) => {
    setTimeout(() => {
        const btn = modal.querySelector('#prescribe-btn');
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const { appointmentId, patientId, patientName } = newBtn.dataset;
                console.log('💊 Iniciando proceso de receta:', { patientName, patientId, appointmentId });
                
                // ✅ NUEVA LÓGICA: Primero intentar guardar el encounter
                let encounterId = null;
                
                try {
                    const { ApiClinical } = await import('../api.js');
                    
                    // Primero verificar si ya existe un encounter
                    let existingEncounters = [];
                    try {
                        const result = await ApiClinical.get(`v1/Encounter?appointmentId=${appointmentId}`);
                        // Asegurar que sea un array
                        existingEncounters = Array.isArray(result) ? result : (result ? [result] : []);
                    } catch (getError) {
                        // Si es 404 o no hay encounters, continuar para crear uno nuevo
                        if (getError.status === 404 || getError.message?.includes('no tiene encuentros')) {
                            console.log('ℹ️ No se encontró encounter existente, se creará uno nuevo');
                            existingEncounters = [];
                        } else {
                            // Para otros errores, loguear pero continuar
                            console.warn('⚠️ Error al buscar encounter, se intentará crear uno nuevo:', getError);
                            existingEncounters = [];
                        }
                    }
                    
                    if (existingEncounters && existingEncounters.length > 0) {
                        // Ya existe un encounter guardado
                        encounterId = existingEncounters[0].encounterId || existingEncounters[0].EncounterId;
                        console.log('✅ Encounter existente encontrado:', encounterId);
                    } else {
                        // No existe, intentar guardarlo primero
                        console.log('ℹ️ No hay encounter guardado, intentando crear uno...');
                        
                        // Validar que el formulario tenga los datos mínimos
                        const reasonsField = modal.querySelector('#encounter-reasons');
                        const subjectiveField = modal.querySelector('#encounter-subjective');
                        const objectiveField = modal.querySelector('#encounter-objective');
                        const assessmentField = modal.querySelector('#encounter-assessment');
                        const planField = modal.querySelector('#encounter-plan');
                        
                        // Si faltan datos, permitir continuar sin encounterId (el modal de receta lo manejará)
                        if (!reasonsField?.value?.trim() || 
                            !subjectiveField?.value?.trim() || 
                            !objectiveField?.value?.trim() || 
                            !assessmentField?.value?.trim() || 
                            !planField?.value?.trim()) {
                            
                            console.warn('⚠️ Faltan datos en el formulario, se continuará sin encounterId');
                            const { showNotification } = await import('./doctor-ui.js');
                            showNotification('No se encontró una consulta guardada. La receta se guardará sin asociarla a una consulta específica.', 'warning');
                            encounterId = null;
                        } else {
                        
                        // Guardar el encounter primero
                        const { doctorState, getId } = await import('./doctor-core.js');
                        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
                        
                        if (!doctorId) {
                            const { showNotification } = await import('./doctor-ui.js');
                            showNotification('No se pudo identificar al médico. Por favor, recarga la página.', 'error');
                            console.error('❌ No se pudo obtener doctorId:', doctorState.currentDoctorData);
                            return;
                        }
                        
                        console.log('✅ DoctorId obtenido:', doctorId);
                        
                        const encounterData = {
                            PatientId: parseInt(patientId),
                            DoctorId: parseInt(doctorId),
                            AppointmentId: parseInt(appointmentId),
                            Reasons: reasonsField.value.trim(),
                            Subjective: subjectiveField.value.trim(),
                            Objetive: objectiveField.value.trim(),
                            Assessment: assessmentField.value.trim(),
                            Plan: planField.value.trim(),
                            Notes: modal.querySelector('#encounter-notes')?.value?.trim() || '',
                            Status: 'Open', // El validador solo acepta "Open" o "Signed"
                            Date: new Date().toISOString()
                        };
                        
                        console.log('📤 Guardando encounter antes de emitir receta:', encounterData);
                        
                        try {
                            const savedEncounter = await ApiClinical.post(`v1/Encounter?patientId=${patientId}`, encounterData);
                            encounterId = savedEncounter.encounterId || savedEncounter.EncounterId;
                            
                            console.log('✅ Encounter guardado con ID:', encounterId);
                            
                            const { showNotification } = await import('./doctor-ui.js');
                            showNotification('Consulta guardada. Ahora puedes emitir la receta.', 'success');
                            
                        } catch (saveError) {
                            console.error('❌ Error al guardar encounter:', saveError);
                            console.error('   Status:', saveError.status);
                            console.error('   Message:', saveError.message);
                            console.error('   Details:', saveError.details);
                            
                            // Si ya existe (409), intentar obtenerlo de nuevo
                            if (saveError.status === 409) {
                                try {
                                    const retryEncounters = await ApiClinical.get(`v1/Encounter?appointmentId=${appointmentId}`);
                                    if (retryEncounters?.length > 0) {
                                        encounterId = retryEncounters[0].encounterId || retryEncounters[0].EncounterId;
                                        console.log('✅ Encounter ya existía, usando ID:', encounterId);
                                    }
                                } catch (retryError) {
                                    console.error('❌ Error al obtener encounter existente:', retryError);
                                    throw saveError;
                                }
                            } else {
                                // Mostrar detalles del error de validación
                                if (saveError.status === 400 && saveError.details) {
                                    const detailsArray = Object.entries(saveError.details).map(([field, errors]) => {
                                        const errorList = Array.isArray(errors) ? errors.join(', ') : errors;
                                        return `${field}: ${errorList}`;
                                    });
                                    console.error('   Errores de validación:', detailsArray);
                                    throw new Error(`Error de validación: ${detailsArray.join('; ')}`);
                                }
                                throw saveError;
                            }
                        }
                        }
                    }
                    
                } catch (err) {
                    console.error('❌ Error al procesar encounter:', err);
                    
                    // Si el error es que no hay encounters, permitir continuar sin encounterId
                    if (err.message?.includes('no tiene encuentros') || err.status === 404) {
                        console.warn('⚠️ No se encontró encounter, se continuará sin encounterId');
                        encounterId = null;
                    } else {
                        const { showNotification } = await import('./doctor-ui.js');
                        showNotification('Error al preparar la receta. Por favor, intenta nuevamente.', 'error');
                        return;
                    }
                }
                
                // Ahora abrir el modal de receta con el encounterId válido
                console.log('✅ Abriendo modal de receta con encounterId:', encounterId);
                
                const { openPrescriptionModal } = await import('./doctor-prescriptions.js');
                openPrescriptionModal(patientName, patientId, encounterId, appointmentId);
            });
        }
    }, 100);
};

export async function openEncounterModal(appointmentId, patientId, patientName) {
    console.log('📋 Abriendo modal de encounter:', { appointmentId, patientId, patientName });
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = createEncounterForm(appointmentId, patientId, patientName);
    document.body.appendChild(modal);
    
    // ✅ AGREGAR: Guardar doctorId en el formulario para usarlo después
    const { doctorState } = await import('./doctor-core.js');
    const doctorId = doctorState.currentDoctorData?.doctorId;
    if (doctorId) {
        const form = modal.querySelector('#encounter-form');
        if (form) {
            form.dataset.doctorId = doctorId;
        }
    }
    
    setupModalCloseHandlers(modal, appointmentId);
    
    if (await checkExistingEncounter(appointmentId, modal)) return;
    
    setupDownloadHL7Button(modal);
    setupPrescribeButton(modal);
    
    // Inicializar videollamada
    initializeVideoCall(modal, appointmentId, patientId, patientName);
    
    let isSaving = false;
    modal.querySelector('#encounter-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (isSaving) return;
        
        isSaving = true;
        const submitButton = modal.querySelector('button[type="submit"]');
        const originalText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        try {
            await saveEncounter(modal, appointmentId, patientId);
        } catch (error) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
            isSaving = false;
        }
    });
}

// ===================================
// GUARDADO DE ENCOUNTER
// ===================================

async function saveEncounter(modal, appointmentId, patientId) {
    try {
        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
        if (!doctorId) {
            showNotification('No se pudo identificar al médico', 'error');
            return;
        }

        console.log('💾 Guardando encounter...');

        const encounterData = {
            PatientId: parseInt(patientId),
            DoctorId: doctorId,
            AppointmentId: parseInt(appointmentId),
            Reasons: document.getElementById('encounter-reasons').value.trim(),
            Subjective: document.getElementById('encounter-subjective').value.trim(),
            Objetive: document.getElementById('encounter-objective').value.trim(),
            Assessment: document.getElementById('encounter-assessment').value.trim(),
            Plan: document.getElementById('encounter-plan').value.trim(),
            Notes: document.getElementById('encounter-notes').value.trim() || 'Sin notas adicionales',
            Status: 'Open',
            Date: new Date().toISOString()
        };
        
        if (!encounterData.Reasons || !encounterData.Subjective || !encounterData.Objetive || 
            !encounterData.Assessment || !encounterData.Plan) {
            showNotification('Por favor completa todos los campos requeridos (S, O, A, P)', 'error');
            return;
        }
        
        console.log('📤 Enviando encounter a ClinicalMS:', encounterData);
        
        const { ApiClinical } = await import('../api.js');
        
        try {
            await ApiClinical.post(`v1/Encounter?patientId=${patientId}`, encounterData);
            console.log('✅ Encounter creado');
        } catch (error) {
            if (error.status === 409 || error.message?.includes('Ya existe') || error.message?.includes('ya fue atendida')) {
                showNotification('Esta consulta ya fue atendida anteriormente.', 'warning');
                modal.remove();
                await updateAppointmentStatus(appointmentId, 'COMPLETED', null, true).catch(console.warn);
                return;
            }
            throw error;
        }
        
        showNotification('Consulta guardada exitosamente', 'success');
        modal.remove();
        
        try {
            await updateAppointmentStatus(appointmentId, 'COMPLETED', null, true);
            console.log('✅ Estado del appointment actualizado a COMPLETED');
        } catch (err) {
            console.error('❌ Error al actualizar estado:', err);
            const errorMessage = err.message || 'Error desconocido';
            console.error('❌ Detalles del error:', {
                message: errorMessage,
                status: err.status,
                appointmentId: appointmentId
            });
            showNotification(`Consulta guardada, pero no se pudo actualizar el estado del turno: ${errorMessage}`, 'warning');
        }
        
        updateCounter('active-consultation', -1);
        updateCounter('prescriptions-today', 1);
        
    } catch (error) {
        console.error('❌ Error al guardar encounter:', error);
        showNotification(`Error al guardar la consulta: ${error.message || 'Error desconocido'}`, 'error');
        throw error;
    }
}

// ===================================
// DESCARGA DE RESUMEN HL7
// ===================================

async function downloadHl7Summary(appointmentId, patientId) {
    try {
        console.log('📥 Descargando resumen HL7:', { appointmentId, patientId });
        
        const { ApiHl7Gateway } = await import('../api.js');
        
        try {
            await ApiHl7Gateway.download(`v1/Hl7Summary/by-appointment/${appointmentId}`, `resumen-hl7-appointment-${appointmentId}.txt`);
            showNotification('Resumen HL7 descargado exitosamente', 'success');
        } catch (error) {
            console.warn('⚠️ Intentando por patientId:', error);
            await ApiHl7Gateway.download(`v1/Hl7Summary/by-patient/${patientId}`, `resumen-hl7-patient-${patientId}.txt`);
            showNotification('Resumen HL7 descargado exitosamente', 'success');
        }
    } catch (error) {
        console.error('❌ Error descargando HL7:', error);
        showNotification('No se encontró resumen HL7 para esta consulta', 'warning');
    }
}

// ===================================
// VISUALIZACIÓN DE ENCOUNTERS
// ===================================

const getEncounterField = (encounter, ...fields) => fields.map(f => encounter[f]).find(v => v) || '';

const createEncounterDetailsHTML = (encounter, patientName, doctorName) => {
    const date = new Date(getEncounterField(encounter, 'date', 'Date'));
    const status = getEncounterField(encounter, 'status', 'Status') || 'Pendiente';
    const reasons = getEncounterField(encounter, 'reasons', 'Reasons') || 'Sin motivo especificado';
    const subjective = getEncounterField(encounter, 'subjective', 'Subjective') || 'No especificado';
    const objective = getEncounterField(encounter, 'objetive', 'Objetive', 'objective', 'Objective') || 'No especificado';
    const assessment = getEncounterField(encounter, 'assessment', 'Assessment') || 'No especificado';
    const plan = getEncounterField(encounter, 'plan', 'Plan') || 'No especificado';
    const notes = getEncounterField(encounter, 'notes', 'Notes');

    return `
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
                        ${[
                            ['calendar', 'Fecha', date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })],
                            ['clock', 'Hora', date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })],
                            ['user', 'Paciente', patientName],
                            ['user-md', 'Médico', doctorName],
                            ['flag', 'Estado', status]
                        ].map(([icon, label, value]) => `
                            <div class="encounter-info-item">
                                <span class="info-label"><i class="fas fa-${icon}"></i> ${label}:</span>
                                <span class="info-value">${value}</span>
                            </div>
                        `).join('')}
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
                        ${[
                            ['Subjetivo (S)', subjective],
                            ['Objetivo (O)', objective],
                            ['Evaluación (A)', assessment],
                            ['Plan (P)', plan]
                        ].map(([label, text]) => `
                            <div style="margin-bottom: 1rem;">
                                <strong style="color: #6b7280; display: block; margin-bottom: 0.5rem;">${label}:</strong>
                                <p style="color: #111827; margin: 0; white-space: pre-wrap;">${text}</p>
                            </div>
                        `).join('')}
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
};

export async function viewEncounterDetailsFromDoctor(encounterId) {
    try {
        console.log('👁️ Visualizando encounter:', encounterId);
        
        const { ApiClinical, Api } = await import('../api.js');
        const encounter = await ApiClinical.get(`v1/Encounter/${encounterId}`);
        
        if (!encounter) {
            showNotification('No se encontraron los detalles del encuentro', 'error');
            return;
        }

        const patientId = getEncounterField(encounter, 'patientId', 'PatientId');
        const doctorId = getEncounterField(encounter, 'doctorId', 'DoctorId');
        
        let patientName = 'Paciente desconocido';
        let doctorName = 'Dr. Sin nombre';
        
        try {
            if (patientId) {
                const patient = await Api.get(`v1/Patient/${patientId}`);
                patientName = `${getEncounterField(patient, 'name', 'Name')} ${getEncounterField(patient, 'lastName', 'LastName')}`.trim() || 'Paciente sin nombre';
            }
            if (doctorId) {
                const doctor = await Api.get(`v1/Doctor/${doctorId}`);
                doctorName = `${getEncounterField(doctor, 'firstName', 'FirstName')} ${getEncounterField(doctor, 'lastName', 'LastName')}`.trim() || `Dr. ID ${doctorId}`;
            }
        } catch (err) {
            console.warn('⚠️ Error cargando info:', err);
        }

        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = createEncounterDetailsHTML(encounter, patientName, doctorName);
        document.body.appendChild(modal);

        modal.querySelector('.close-modal')?.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => e.target === modal && modal.remove());
        
    } catch (error) {
        console.error('❌ Error al cargar detalles:', error);
        showNotification('Error al cargar los detalles de la consulta', 'error');
    }
}

if (typeof window !== 'undefined') {
    window.viewEncounterDetailsFromDoctor = viewEncounterDetailsFromDoctor;
}

// ===================================
// VIDELLAMADA
// ===================================

async function initializeVideoCall(modal, appointmentId, patientId, patientName) {
    try {
        const videoSection = modal.querySelector('#video-call-section');
        const videoContainer = modal.querySelector('#video-call-container');
        const videoLoading = modal.querySelector('#video-loading');
        
        if (!videoSection || !videoContainer) {
            console.warn('⚠️ Sección de videollamada no encontrada');
            return;
        }
        
        // Mostrar la sección
        videoSection.style.display = 'block';
        
        // Intentar obtener token del backend
        try {
            const { ApiScheduling } = await import('../api.js');
            const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
            
            if (!doctorId) {
                throw new Error('No se pudo identificar al médico');
            }
            
            // Crear/obtener sala (la respuesta ya incluye el token)
            const roomResponse = await ApiScheduling.post(`v1/Video/room/${appointmentId}?doctorId=${doctorId}&patientId=${patientId}`, {});
            console.log('✅ Sala de videollamada creada/obtenida:', roomResponse);
            
            // El token viene en la respuesta de crear la sala
            const token = roomResponse.token || roomResponse.Token;
            const roomUrl = roomResponse.roomUrl || roomResponse.RoomUrl;
            const roomName = roomResponse.roomName || roomResponse.RoomName || `appointment-${appointmentId}`;
            
            if (!token) {
                throw new Error('No se recibió el token de videollamada en la respuesta');
            }
            
            if (!roomUrl) {
                throw new Error('No se recibió la URL de la sala en la respuesta');
            }
            
            // Verificar si Daily.co está disponible
            if (typeof window.DailyIframe === 'undefined') {
                // Cargar Daily.co SDK
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/@daily-co/daily-js';
                script.onload = () => {
                    startVideoCall(videoContainer, roomUrl, token, modal, appointmentId);
                };
                script.onerror = () => {
                    showVideoError(videoContainer, 'No se pudo cargar el SDK de videollamada');
                };
                document.head.appendChild(script);
            } else {
                startVideoCall(videoContainer, roomUrl, token, modal, appointmentId);
            }
            
        } catch (error) {
            console.error('❌ Error al inicializar videollamada:', error);
            
            // Mensajes de error más específicos
            let errorMessage = 'Error desconocido';
            if (error.status === 404) {
                errorMessage = 'El servicio de videollamadas no está disponible. Por favor, contacta al administrador.';
            } else if (error.status === 500) {
                errorMessage = 'Error en el servidor de videollamadas. Por favor, intenta más tarde.';
            } else if (error.message) {
                errorMessage = error.message;
            } else if (typeof error === 'string') {
                errorMessage = error;
            }
            
            showVideoError(videoContainer, `Videollamada no disponible: ${errorMessage}`);
        }
        
    } catch (error) {
        console.error('❌ Error en initializeVideoCall:', error);
    }
}

function startVideoCall(videoContainer, roomUrl, token, modal, appointmentId) {
    try {
        if (typeof window.DailyIframe === 'undefined') {
            showVideoError(videoContainer, 'SDK de Daily.co no disponible');
            return;
        }
        
        const callFrame = window.DailyIframe.createFrame(videoContainer, {
            showLeaveButton: false,
            showFullscreenButton: true,
            iframeStyle: {
                position: 'absolute',
                width: '100%',
                height: '100%',
                border: '0',
                borderRadius: '0.5rem'
            }
        });
        
        // Guardar referencia al callFrame
        modal.callFrame = callFrame;
        
        // Configurar controles
        setupVideoControls(modal, callFrame, appointmentId);
        
        // Unirse a la sala usando la URL completa que viene del backend
        callFrame.join({ url: roomUrl, token: token })
            .then(() => {
                console.log('✅ Unido a la videollamada');
                const loading = videoContainer.querySelector('#video-loading');
                if (loading) loading.style.display = 'none';
            })
            .catch((error) => {
                console.error('❌ Error al unirse a la videollamada:', error);
                
                // Manejar errores específicos de Daily.co
                let errorMessage = 'Error desconocido';
                if (error?.message) {
                    errorMessage = error.message;
                } else if (typeof error === 'string') {
                    errorMessage = error;
                } else if (error?.error?.message) {
                    errorMessage = error.error.message;
                }
                
                showVideoError(videoContainer, `Error al conectar: ${errorMessage}`);
            });
        
        // Manejar eventos
        callFrame.on('left-meeting', () => {
            console.log('👋 Salido de la videollamada');
        });
        
    } catch (error) {
        console.error('❌ Error al crear videollamada:', error);
        showVideoError(videoContainer, `Error: ${error.message || 'Error desconocido'}`);
    }
}

function setupVideoControls(modal, callFrame, appointmentId) {
    const toggleMic = modal.querySelector('#toggle-mic');
    const toggleCamera = modal.querySelector('#toggle-camera');
    const endCall = modal.querySelector('#end-call');
    
    let micEnabled = true;
    let cameraEnabled = true;
    
    if (toggleMic) {
        toggleMic.addEventListener('click', () => {
            micEnabled = !micEnabled;
            callFrame.setLocalAudio(micEnabled);
            toggleMic.innerHTML = micEnabled 
                ? '<i class="fas fa-microphone"></i> Micrófono'
                : '<i class="fas fa-microphone-slash"></i> Micrófono';
            toggleMic.classList.toggle('btn-danger', !micEnabled);
        });
    }
    
    if (toggleCamera) {
        toggleCamera.addEventListener('click', () => {
            cameraEnabled = !cameraEnabled;
            callFrame.setLocalVideo(cameraEnabled);
            toggleCamera.innerHTML = cameraEnabled
                ? '<i class="fas fa-video"></i> Cámara'
                : '<i class="fas fa-video-slash"></i> Cámara';
            toggleCamera.classList.toggle('btn-danger', !cameraEnabled);
        });
    }
    
    if (endCall) {
        endCall.addEventListener('click', () => {
            if (callFrame) {
                callFrame.leave();
            }
        });
    }
}

function showVideoError(videoContainer, message) {
    if (videoContainer) {
        videoContainer.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: #fff;">
                <i class="fas fa-exclamation-triangle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>${message}</p>
            </div>
        `;
    }
}

export { doctorState };