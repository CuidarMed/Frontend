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

            container.appendChild(clone);
        });

    } catch (error) {
        console.error('Error al cargar recetas médicas:', error);
        container.innerHTML = `<p>No se pudieron cargar las recetas.</p>`;
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



// Exportar a window para uso de onclick
window.loadPatientPrescriptions = loadPatientPrescriptions;

