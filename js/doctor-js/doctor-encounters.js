// ===================================
// DOCTOR ENCOUNTERS - Encuentros Clínicos (SOAP)
// ===================================

import { 
    doctorState,
    getId,
    getValue,
    formatDate,
    formatTime,
    updateCounter
} from './doctor-core.js';

import { 
    showNotification 
} from './doctor-ui.js';

import {
    updateAppointmentStatus
} from './doctor-js/doctor-appointments.js';

// ===================================
// MODAL DE ENCOUNTER
// ===================================

/**
 * Abre el modal para crear un encounter clínico
 */
export async function openEncounterModal(appointmentId, patientId, patientName) {
    console.log('📋 Abriendo modal de encounter:', { appointmentId, patientId, patientName });
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
                <h3>Consulta con ${patientName}</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <form id="encounter-form">
                    <input type="hidden" id="encounter-appointment-id" value="${appointmentId}">
                    <input type="hidden" id="encounter-patient-id" value="${patientId}">
                    
                    <div class="form-group">
                        <label for="encounter-reasons">Motivo de consulta: *</label>
                        <textarea id="encounter-reasons" name="reasons" rows="2" required 
                                  placeholder="Ej: Dolor de cabeza intenso desde hace 3 días"></textarea>
                    </div>
                    
                    <div class="soap-section" style="background: #f9fafb; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem;">
                        <h4 style="margin-bottom: 1rem; color: #1f2937; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-notes-medical"></i>
                            Notas SOAP
                        </h4>
                        
                        <div class="form-group">
                            <label for="encounter-subjective">
                                <strong>S</strong>ubjetivo (Síntomas del paciente): *
                            </label>
                            <textarea id="encounter-subjective" name="subjective" rows="3" required 
                                      placeholder="Ej: Paciente refiere dolor pulsátil en región temporal derecha, que empeora con luz y ruido..."></textarea>
                            <small style="color: #6b7280;">¿Qué dice el paciente?</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="encounter-objective">
                                <strong>O</strong>bjetivo (Hallazgos físicos): *
                            </label>
                            <textarea id="encounter-objective" name="objective" rows="3" required 
                                      placeholder="Ej: PA: 120/80, FC: 72, Temp: 36.5°C. Examen neurológico sin alteraciones..."></textarea>
                            <small style="color: #6b7280;">¿Qué observas tú?</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="encounter-assessment">
                                <strong>A</strong>ssessment (Diagnóstico): *
                            </label>
                            <textarea id="encounter-assessment" name="assessment" rows="3" required 
                                      placeholder="Ej: Migraña sin aura, episodio agudo"></textarea>
                            <small style="color: #6b7280;">¿Cuál es tu diagnóstico?</small>
                        </div>
                        
                        <div class="form-group">
                            <label for="encounter-plan">
                                <strong>P</strong>lan (Tratamiento): *
                            </label>
                            <textarea id="encounter-plan" name="plan" rows="3" required 
                                      placeholder="Ej: Ibuprofeno 400mg cada 8 horas por 5 días. Reposo en ambiente oscuro. Control en 7 días..."></textarea>
                            <small style="color: #6b7280;">¿Qué vas a hacer?</small>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="encounter-notes">Notas adicionales:</label>
                        <textarea id="encounter-notes" name="notes" rows="2" 
                                  placeholder="Información complementaria (opcional)"></textarea>
                    </div>
                    
                    <div class="form-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: flex-end;">
                        <button type="button" class="btn btn-secondary" id="cancel-encounter">
                            <i class="fas fa-times"></i> Cancelar
                        </button>
                        <button type="button" class="btn btn-success" id="download-hl7-summary-btn" 
                                data-appointment-id="${appointmentId}" data-patient-id="${patientId}" 
                                style="background-color: #28a745; border-color: #28a745; color: white;">
                            <i class="fas fa-file-download"></i> Descargar HL7
                        </button>
                        <button type="button" class="btn btn-info" id="prescribe-btn" 
                                data-patient-id="${patientId}" data-patient-name="${patientName}" 
                                data-appointment-id="${appointmentId}" 
                                style="background-color: #17a2b8; border-color: #17a2b8; color: white;">
                            <i class="fas fa-prescription"></i> Recetar
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save"></i> Guardar Consulta
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners para cerrar
    modal.querySelectorAll('.close-modal, #cancel-encounter').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('❌ Cerrando modal de encounter');
            modal.remove();
            // Restaurar botón si se cancela
            const appointmentId = document.getElementById('encounter-appointment-id')?.value;
            if (appointmentId) {
                const button = document.querySelector(`[data-appointment-id="${appointmentId}"]`);
                if (button) {
                    button.innerHTML = 'Atender';
                    button.classList.remove('in-consultation');
                    button.disabled = false;
                }
            }
            updateCounter('active-consultation', -1);
        });
    });
    
    // Verificar si ya existe un encounter para este appointment
    try {
        const { ApiClinical } = await import('../api.js');
        const existingEncounters = await ApiClinical.get(`v1/Encounter?appointmentId=${appointmentId}`);
        
        if (existingEncounters && existingEncounters.length > 0) {
            showNotification('Esta consulta ya fue atendida anteriormente. No se puede crear otra.', 'warning');
            modal.remove();
            
            // Actualizar el estado del appointment a COMPLETED si no lo está
            try {
                await updateAppointmentStatus(appointmentId, 'COMPLETED', null, true);
            } catch (err) {
                console.warn('⚠️ No se pudo actualizar el estado:', err);
            }
            
            return;
        }
    } catch (err) {
        console.warn('⚠️ No se pudo verificar encounters existentes:', err);
    }
    
    // Event listener para botón de descargar HL7
    setTimeout(() => {
        const downloadHl7Btn = modal.querySelector('#download-hl7-summary-btn');
        if (downloadHl7Btn) {
            downloadHl7Btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const appointmentId = downloadHl7Btn.getAttribute('data-appointment-id');
                const patientId = downloadHl7Btn.getAttribute('data-patient-id');
                
                console.log('📥 Descargando resumen HL7:', { appointmentId, patientId });
                
                try {
                    await downloadHl7Summary(appointmentId, patientId);
                } catch (error) {
                    console.error('❌ Error descargando resumen HL7:', error);
                    showNotification('Error al descargar el resumen HL7', 'error');
                }
            });
        }
    }, 100);
    
    // Event listener para botón de recetar
    setTimeout(() => {
        const prescribeBtn = modal.querySelector('#prescribe-btn');
        if (prescribeBtn) {
            console.log('💊 Configurando botón de recetar');
            
            const newBtn = prescribeBtn.cloneNode(true);
            prescribeBtn.parentNode.replaceChild(newBtn, prescribeBtn);
            
            newBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const appointmentId = newBtn.getAttribute('data-appointment-id');
                const patientId = newBtn.getAttribute('data-patient-id');
                const patientName = newBtn.getAttribute('data-patient-name');
                
                console.log('💊 Abriendo modal de receta:', { patientName, patientId, appointmentId });
                
                // Intentar obtener el encounterId si ya existe la consulta
                let encounterId = null;
                if (appointmentId) {
                    try {
                        const { ApiClinical } = await import('../api.js');
                        const encounters = await ApiClinical.get(`v1/Encounter?appointmentId=${appointmentId}`);
                        if (encounters && Array.isArray(encounters) && encounters.length > 0) {
                            encounterId = encounters[0].encounterId || encounters[0].EncounterId;
                            console.log('📋 Encounter encontrado:', encounterId);
                        }
                    } catch (err) {
                        console.warn('⚠️ No se pudo obtener el encounter:', err);
                    }
                }
                
                // Abrir el modal de receta
                const { openPrescriptionModal } = await import('./doctor-prescriptions.js');
                openPrescriptionModal(patientName, patientId, encounterId, appointmentId);
            });
        }
    }, 100);
    
    // Event listener para el formulario
    let isSaving = false;
    modal.querySelector('#encounter-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Prevenir múltiples envíos
        if (isSaving) {
            return;
        }
        
        isSaving = true;
        const submitButton = modal.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.innerHTML;
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        try {
            await saveEncounter(modal, appointmentId, patientId);
        } catch (error) {
            console.error('❌ Error al guardar:', error);
            // Restaurar botón en caso de error
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
            isSaving = false;
        }
    });
}

// ===================================
// GUARDADO DE ENCOUNTER
// ===================================

/**
 * Guarda un encounter clínico
 */
async function saveEncounter(modal, appointmentId, patientId) {
    try {
        const doctorId = getId(doctorState.currentDoctorData, 'doctorId');
        if (!doctorId) {
            showNotification('No se pudo identificar al médico', 'error');
            return;
        }

        console.log('💾 Guardando encounter...');

        const { ApiClinical } = await import('../api.js');
        const encounterData = {
            PatientId: parseInt(patientId),
            DoctorId: doctorId,
            AppointmentId: parseInt(appointmentId),
            Reasons: document.getElementById('encounter-reasons').value.trim(),
            Subjective: document.getElementById('encounter-subjective').value.trim(),
            Objetive: document.getElementById('encounter-objective').value.trim(),
            Assessment: document.getElementById('encounter-assessment').value.trim(),
            Plan: document.getElementById('encounter-plan').value.trim(),
            Notes: document.getElementById('encounter-notes').value.trim(),
            Status: 'COMPLETED',
            Date: new Date().toISOString()
        };
        
        // Validar que todos los campos requeridos estén completos
        if (!encounterData.Reasons || !encounterData.Subjective || !encounterData.Objetive || 
            !encounterData.Assessment || !encounterData.Plan) {
            showNotification('Por favor completa todos los campos requeridos (S, O, A, P)', 'error');
            return;
        }
        
        console.log('📤 Enviando encounter a ClinicalMS:', encounterData);
        
        let encounter;
        try {
            encounter = await ApiClinical.post(`v1/Encounter?patientId=${patientId}`, encounterData);
            console.log('✅ Encounter creado:', encounter);
        } catch (error) {
            // Si el error es 409 (Conflict) o indica que ya existe
            if (error.status === 409 || (error.message && (error.message.includes('Ya existe') || error.message.includes('ya fue atendida')))) {
                showNotification('Esta consulta ya fue atendida anteriormente. No se puede crear otra.', 'warning');
                modal.remove();
                
                // Actualizar el estado del appointment a COMPLETED
                try {
                    await updateAppointmentStatus(appointmentId, 'COMPLETED', null, true);
                } catch (err) {
                    console.warn('⚠️ No se pudo actualizar el estado:', err);
                }
                
                return;
            }
            throw error;
        }
        
        showNotification('Consulta guardada exitosamente', 'success');
        modal.remove();
        
        // Actualizar estado del appointment a COMPLETED
        try {
            await updateAppointmentStatus(appointmentId, 'COMPLETED', null, true);
            console.log('✅ Estado del appointment actualizado a COMPLETED');
        } catch (err) {
            console.error('❌ Error al actualizar estado del appointment:', err);
            showNotification('Consulta guardada, pero no se pudo actualizar el estado del turno', 'warning');
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

/**
 * Descarga el resumen HL7 de una consulta
 */
async function downloadHl7Summary(appointmentId, patientId) {
    try {
        console.log('📥 Intentando descargar resumen HL7:', { appointmentId, patientId });
        
        const { ApiHl7Gateway } = await import('../api.js');
        
        // Intentar descargar por appointmentId primero
        let endpoint = `v1/Hl7Summary/by-appointment/${appointmentId}`;
        let filename = `resumen-hl7-appointment-${appointmentId}.txt`;
        
        try {
            await ApiHl7Gateway.download(endpoint, filename);
            showNotification('Resumen HL7 descargado exitosamente', 'success');
            console.log('✅ Resumen HL7 descargado por appointmentId');
        } catch (error) {
            // Si falla por appointmentId, intentar por patientId
            console.warn('⚠️ Error descargando por appointmentId, intentando por patientId:', error);
            endpoint = `v1/Hl7Summary/by-patient/${patientId}`;
            filename = `resumen-hl7-patient-${patientId}.txt`;
            
            await ApiHl7Gateway.download(endpoint, filename);
            showNotification('Resumen HL7 descargado exitosamente', 'success');
            console.log('✅ Resumen HL7 descargado por patientId');
        }
    } catch (error) {
        console.error('❌ Error descargando resumen HL7:', error);
        showNotification('No se encontró resumen HL7 para esta consulta', 'warning');
    }
}

// ===================================
// VISUALIZACIÓN DE ENCOUNTERS
// ===================================

/**
 * Muestra los detalles completos de un encounter
 */
export async function viewEncounterDetailsFromDoctor(encounterId) {
    try {
        console.log('👁️ Visualizando encounter:', encounterId);
        
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
            if (patientId) {
                const patient = await Api.get(`v1/Patient/${patientId}`);
                patientName = `${patient.name || patient.Name || ''} ${patient.lastName || patient.LastName || ''}`.trim() || 'Paciente sin nombre';
            }
            if (doctorId) {
                const doctor = await Api.get(`v1/Doctor/${doctorId}`);
                doctorName = `${doctor.firstName || doctor.FirstName || ''} ${doctor.lastName || doctor.LastName || ''}`.trim() || `Dr. ID ${doctorId}`;
            }
        } catch (err) {
            console.warn('⚠️ Error al cargar información de paciente/doctor:', err);
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
        console.error('❌ Error al cargar detalles del encounter:', error);
        showNotification('Error al cargar los detalles de la consulta', 'error');
    }
}

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
    window.viewEncounterDetailsFromDoctor = viewEncounterDetailsFromDoctor;
}

// ===================================
// EXPORTACIONES
// ===================================

export { doctorState };