// ============================================
// LISTADO DE RECETAS MÉDICAS - PACIENTE
// ============================================

import { appState } from './patient-state.js';
import { showNotification } from './patient-notifications.js';

/**
 * Carga y renderiza la lista completa de recetas del paciente
 */
export async function loadPatientPrescriptions() {
    // Ocultar sección de inicio
    const homeSection = document.getElementById('inicio');
    if (homeSection) homeSection.style.display = 'none';

    // Mostrar sección de recetas
    const prescriptionsSection = document.getElementById('recetas');
    if (prescriptionsSection) prescriptionsSection.style.display = 'block';

    const container = document.getElementById('prescriptions-list-full');
    if (!container) return;
    

    // Limpiar contenedor antes de cargar
    container.innerHTML = '';

    try {
        const patientId = appState.currentPatient?.patientId;
        if (!patientId) return;

        const { ApiClinical, Api } = await import('../api.js');

        // Traer recetas del paciente
        let prescriptions = await ApiClinical.get(`v1/Prescription/patient/${patientId}`);
        if (!Array.isArray(prescriptions)) prescriptions = prescriptions?.value || [];

        if (!prescriptions.length) {
            container.innerHTML = `<p>No hay recetas disponibles</p>`;
            return;
        }

        // Traer info de doctores únicos
        const doctorIds = [...new Set(prescriptions.map(p => p.doctorId).filter(Boolean))];
        const doctorsMap = new Map();
        for (const doctorId of doctorIds) {
            try {
                const doctor = await Api.get(`v1/Doctor/${doctorId}`);
                doctorsMap.set(doctorId, `${doctor.firstName} ${doctor.lastName}`);
            } catch {
                doctorsMap.set(doctorId, `Dr. ${doctorId}`);
            }
        }

        // Tomar el template
        const template = document.getElementById('template-prescription-card');
        if (!template) return;

        // Iterar recetas y clonar template
        prescriptions.forEach(p => {
            const clone = template.content.cloneNode(true);

            // Llenar datos
            clone.querySelector('.prescription-card-title').textContent = `Consulta #${p.encounterId || '0'}`;
            clone.querySelector('.prescription-diagnosis').textContent = p.diagnosis;
            clone.querySelector('.prescription-medication').textContent = p.medication;
            clone.querySelector('.prescription-dosage').textContent = p.dosage;
            clone.querySelector('.prescription-frequency').textContent = p.frequency;
            clone.querySelector('.prescription-duration').textContent = p.duration;
            clone.querySelector('.prescription-instructions').textContent = p.additionalInstructions;

            const doctorName = doctorsMap.get(p.doctorId) || 'Dr. Desconocido';
            clone.querySelector('.prescription-doctor').textContent = doctorName;

            const dateStr = new Date(p.prescriptionDate || p.createdAt).toLocaleDateString('es-AR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            clone.querySelector('.prescription-date').textContent = dateStr;

            // Botón de descarga PDF: asignamos a esta receta en particular
            const btn = clone.querySelector('.btn-prescription-view');
            btn.addEventListener('click', () => {
                const prescriptionData = { ...p, doctorName };
                downloadPrescriptionPDF(prescriptionData);
            });

            // Botón de descarga HL7: asignamos a esta receta en particular
            const btnHl7 = clone.querySelector('.btn-prescription-hl7');
            if (btnHl7) {
                btnHl7.addEventListener('click', async () => {
                    await downloadHl7Summary(p);
                });
            }

            container.appendChild(clone);
        });

    } catch (error) {
        console.error('Error al cargar recetas médicas:', error);
        container.innerHTML = `<p>No se pudieron cargar las recetas.</p>`;
    }
}

/**
 * Genera el resumen HL7 si no existe
 */
async function generateHl7SummaryIfNeeded(prescription, appointmentId, patientId) {
    try {
        const { ApiHl7Gateway, ApiClinical, Api, ApiScheduling } = await import('../api.js');
        
        // Obtener encounterId
        let encounterId = prescription.encounterId || prescription.EncounterId;
        
        // Si no hay encounterId, intentar obtenerlo del appointment
        if (!encounterId && appointmentId) {
            try {
                const encounters = await ApiClinical.get(`v1/Encounter?appointmentId=${appointmentId}`);
                if (Array.isArray(encounters) && encounters.length > 0) {
                    encounterId = encounters[0].encounterId || encounters[0].EncounterId;
                }
            } catch (err) {
                console.warn('⚠️ No se pudo obtener encounter:', err);
            }
        }
        
        if (!encounterId) {
            throw new Error('No se pudo obtener el encounterId necesario para generar el resumen HL7');
        }
        
        // Obtener datos del encounter
        const encounter = await ApiClinical.get(`v1/Encounter/${encounterId}`);
        const doctorId = encounter.doctorId || encounter.DoctorId;
        
        if (!doctorId) {
            throw new Error('No se pudo obtener el doctorId del encounter');
        }
        
        // Obtener datos del appointment
        let appointment = null;
        if (appointmentId) {
            try {
                appointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`);
            } catch (err) {
                console.warn('⚠️ No se pudo obtener appointment:', err);
            }
        }
        
        // Obtener datos del paciente
        const patient = await Api.get(`v1/Patient/${patientId}`);
        
        // Obtener datos del doctor
        const doctor = await Api.get(`v1/Doctor/${doctorId}`);
        
        // Validar que tengamos appointmentId (requerido por el validador)
        if (!appointmentId || appointmentId <= 0) {
            throw new Error('No se pudo obtener el appointmentId necesario para generar el resumen HL7');
        }
        
        // Construir request para generar el resumen
        const generateRequest = {
            EncounterId: encounterId,
            PatientId: patientId,
            DoctorId: doctorId,
            AppointmentId: appointmentId,
            PatientDni: patient.dni || patient.Dni || null,
            PatientFirstName: patient.name || patient.Name || null,
            PatientLastName: patient.lastName || patient.LastName || null,
            PatientDateOfBirth: patient.dateOfBirth || patient.DateOfBirth ? new Date(patient.dateOfBirth || patient.DateOfBirth).toISOString() : null,
            PatientPhone: patient.phone || patient.Phone || null,
            PatientAddress: patient.address || patient.Address || null,
            DoctorFirstName: doctor.firstName || doctor.FirstName || null,
            DoctorLastName: doctor.lastName || doctor.LastName || null,
            DoctorSpecialty: doctor.specialty || doctor.Specialty || null,
            AppointmentStartTime: appointment?.startTime || appointment?.StartTime ? new Date(appointment.startTime || appointment.StartTime).toISOString() : null,
            AppointmentEndTime: appointment?.endTime || appointment?.EndTime ? new Date(appointment.endTime || appointment.EndTime).toISOString() : null,
            AppointmentReason: appointment?.reason || appointment?.Reason || null,
            EncounterReasons: encounter.reasons || encounter.Reasons || null,
            EncounterAssessment: encounter.assessment || encounter.Assessment || null,
            EncounterDate: encounter.date || encounter.Date ? new Date(encounter.date || encounter.Date).toISOString() : new Date().toISOString()
        };
        
        console.log('📤 Generando resumen HL7:', generateRequest);
        
        // Llamar al endpoint de generación
        await ApiHl7Gateway.post('v1/Hl7Summary/generate', generateRequest);
        
        console.log('✅ Resumen HL7 generado exitosamente');
        
    } catch (error) {
        console.error('❌ Error al generar resumen HL7:', error);
        throw error;
    }
}

async function downloadPrescriptionPDF(prescription) {
    // Usamos jsPDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const lineHeight = 10;
    let y = 20; // altura inicial

    doc.setFontSize(16);
    doc.text(`Receta Médica - Consulta #${prescription.encounterId || '0'}`, 20, y);
    y += lineHeight + 5;

    doc.setFontSize(12);
    doc.text(`Diagnóstico: ${prescription.diagnosis}`, 20, y); y += lineHeight;
    doc.text(`Medicación: ${prescription.medication}`, 20, y); y += lineHeight;
    doc.text(`Dosis: ${prescription.dosage}`, 20, y); y += lineHeight;
    doc.text(`Frecuencia: ${prescription.frequency}`, 20, y); y += lineHeight;
    doc.text(`Duración: ${prescription.duration}`, 20, y); y += lineHeight;
    doc.text(`Instrucciones: ${prescription.additionalInstructions}`, 20, y); y += lineHeight;
    doc.text(`Doctor: ${prescription.doctorName}`, 20, y); y += lineHeight;

    const dateStr = new Date(prescription.prescriptionDate || prescription.createdAt)
        .toLocaleDateString('es-AR', { year:'numeric', month:'long', day:'numeric' });
    doc.text(`Fecha: ${dateStr}`, 20, y);

    // Guardar PDF
    doc.save(`Receta_${prescription.encounterId || '0'}.pdf`);
}

/**
 * Descarga el resumen HL7 para una receta
 */
async function downloadHl7Summary(prescription) {
    try {
        console.log('📥 Descargando resumen HL7 para receta:', prescription);
        
        const { ApiHl7Gateway, ApiClinical } = await import('../api.js');
        const patientId = appState.currentPatient?.patientId;
        
        if (!patientId) {
            showNotification('No se pudo identificar al paciente', 'error');
            return;
        }

        // Intentar obtener appointmentId de la receta o del encounter
        let appointmentId = prescription.appointmentId || prescription.AppointmentId;
        
        // Si no hay appointmentId pero hay encounterId, intentar obtenerlo del encounter
        if (!appointmentId && prescription.encounterId) {
            try {
                const encounter = await ApiClinical.get(`v1/Encounter/${prescription.encounterId}`);
                appointmentId = encounter?.appointmentId || encounter?.AppointmentId;
                console.log('✅ AppointmentId obtenido del encounter:', appointmentId);
            } catch (err) {
                console.warn('⚠️ No se pudo obtener appointmentId del encounter:', err);
            }
        }

        // Intentar descargar por appointmentId si está disponible
        if (appointmentId) {
            try {
                await ApiHl7Gateway.download(
                    `v1/Hl7Summary/by-appointment/${appointmentId}`, 
                    `resumen-hl7-appointment-${appointmentId}.txt`
                );
                showNotification('Resumen HL7 descargado exitosamente', 'success');
                return;
            } catch (error) {
                console.warn('⚠️ No se pudo descargar por appointmentId:', error);
                
                // Si es 404, intentar generar el resumen automáticamente
                if (error.message?.includes('404') || error.message?.includes('No se encontró')) {
                    console.log('🔄 Resumen no existe, intentando generarlo automáticamente...');
                    
                    try {
                        await generateHl7SummaryIfNeeded(prescription, appointmentId, patientId);
                        
                        // Después de generar, intentar descargar nuevamente
                        await ApiHl7Gateway.download(
                            `v1/Hl7Summary/by-appointment/${appointmentId}`, 
                            `resumen-hl7-appointment-${appointmentId}.txt`
                        );
                        showNotification('Resumen HL7 generado y descargado exitosamente', 'success');
                        return;
                    } catch (genError) {
                        console.error('❌ Error al generar resumen HL7:', genError);
                        // Continuar con el flujo normal
                    }
                }
            }
        }

        // Si no hay appointmentId o falló, intentar por patientId
        try {
            await ApiHl7Gateway.download(
                `v1/Hl7Summary/by-patient/${patientId}`, 
                `resumen-hl7-patient-${patientId}.txt`
            );
            showNotification('Resumen HL7 descargado exitosamente', 'success');
        } catch (error) {
            console.error('❌ Error descargando HL7:', error);
            // Mostrar mensaje más específico según el tipo de error
            const errorMessage = error.message || 'Error desconocido';
            if (errorMessage.includes('no está disponible') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
                showNotification('El servicio Hl7Gateway no está disponible. Por favor, verifica que esté corriendo.', 'error');
            } else if (errorMessage.includes('No se encontró')) {
                showNotification('No se encontró resumen HL7 para esta consulta. El resumen se genera automáticamente cuando se completa una consulta.', 'warning');
            } else {
                showNotification(`Error al descargar HL7: ${errorMessage}`, 'error');
            }
        }
    } catch (error) {
        console.error('❌ Error al descargar resumen HL7:', error);
        const errorMessage = error.message || 'Error desconocido';
        if (errorMessage.includes('no está disponible') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
            showNotification('El servicio Hl7Gateway no está disponible. Por favor, verifica que esté corriendo.', 'error');
        } else {
            showNotification(`Error al descargar el resumen HL7: ${errorMessage}`, 'error');
        }
    }
}



// Exportar a window para uso de onclick
window.loadPatientPrescriptions = loadPatientPrescriptions;

