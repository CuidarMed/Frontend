// ============================================
// MÓDULO DE PRESCRIPCIONES - PACIENTE
// ============================================

import { ApiClinical } from '../api.js';
import { showNotification } from './patient-notifications.js';

/**
 * Muestra la receta asociada a un encounter
 * @param {number} encounterId
 */
export async function viewPrescription(encounterId) {
    try {
        const modal = document.getElementById('prescription-modal');
        const content = document.getElementById('prescription-content');
        if (!modal || !content) return;

        content.innerHTML = `<div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>Cargando receta...</p>
        </div>`;
        modal.classList.remove('hidden');

        // Llamada al endpoint correcto
        const prescription = await ApiClinical.get(`/v1/Prescription/encounter/${encounterId}`);
        if (!prescription) throw new Error('No se encontró la receta');

        // Cabecera CuidarMed+
        const date = new Date(prescription.createdAt || prescription.CreatedAt || Date.now());
        const dateStr = date.toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });

        content.innerHTML = `
        <div class="prescription-container">
            <div class="prescription-header">
                <div class="prescription-logo">
                    <i class="fas fa-heart"></i>
                    <span>CuidarMed+</span>
                </div>
                <div class="prescription-info">
                    <h4>${prescription.doctorName || 'Dr. Desconocido'}</h4>
                    ${prescription.doctorSpecialty ? `<p class="prescription-specialty">${prescription.doctorSpecialty}</p>` : ''}
                    <p class="prescription-date">Fecha: ${dateStr}</p>
                </div>
            </div>
            <div class="prescription-divider"></div>

            <div class="prescription-section">
                <h5><i class="fas fa-prescription"></i> Medicamento</h5>
                <p>${prescription.medicineName || prescription.MedicineName || ''}</p>
            </div>
            <div class="prescription-section">
                <h5><i class="fas fa-clock"></i> Dosis</h5>
                <p>${prescription.dose || prescription.Dose || ''}</p>
            </div>
            <div class="prescription-section">
                <h5><i class="fas fa-hourglass-half"></i> Horario</h5>
                <p>${prescription.schedule || prescription.Schedule || ''}</p>
            </div>
            <div class="prescription-section">
                <h5><i class="fas fa-calendar-days"></i> Duración</h5>
                <p>${prescription.duration || prescription.Duration || ''}</p>
            </div>
            <div class="prescription-section">
                <h5><i class="fas fa-comment-medical"></i> Observaciones</h5>
                <p>${prescription.comments || prescription.Comments || ''}</p>
            </div>

            <div class="prescription-footer">
                <p class="prescription-signature">
                    <strong>${prescription.doctorName || 'Dr. Desconocido'}</strong><br>
                    Matrícula Profesional
                </p>
            </div>
        </div>
        `;

        // Guardar datos para PDF
        modal.setAttribute('data-prescription', JSON.stringify(prescription));

    } catch (error) {
        console.error('Error al cargar receta:', error);
        const content = document.getElementById('prescription-content');
        if (content) {
            content.innerHTML = `<div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>No se pudo cargar la receta</p>
                <small>${error.message}</small>
            </div>`;
        }
        showNotification('No se pudo cargar la receta', 'error');
    }
}

/** Cierra el modal */
export function closePrescription() {
    const modal = document.getElementById('prescription-modal');
    if (modal) modal.classList.add('hidden');
}

/** Inicializa los botones del modal */
export function initializePrescriptionModal() {
    const modal = document.getElementById('prescription-modal');
    if (!modal) return;

    modal.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', closePrescription));
    const downloadBtn = document.getElementById('download-prescription');
    if (downloadBtn) downloadBtn.addEventListener('click', () => {
        const prescriptionData = JSON.parse(modal.getAttribute('data-prescription') || '{}');
        downloadPrescriptionPDF(prescriptionData);
    });
    modal.addEventListener('click', e => { if (e.target === modal) closePrescription(); });
}

/** Genera PDF de la receta */
function downloadPrescriptionPDF(prescriptionData) {
    if (!prescriptionData) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 20;
    let y = margin;
    const lineHeight = 7;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('CuidarMed+', margin, y); y += 10;

    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text('Receta Médica', margin, y); y += lineHeight * 2;

    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(prescriptionData.doctorName || 'Dr. Desconocido', margin, y); y += lineHeight;
    if (prescriptionData.doctorSpecialty) {
        doc.setFont(undefined, 'normal');
        doc.text(prescriptionData.doctorSpecialty, margin, y); y += lineHeight;
    }
    const date = new Date(prescriptionData.createdAt || prescriptionData.CreatedAt || Date.now());
    doc.text(`Fecha: ${date.toLocaleDateString()}`, margin, y); y += lineHeight*2;

    // Medicamento
    const addSection = (title, content) => {
        if (!content) return;
        doc.setFont(undefined, 'bold'); doc.text(title, margin, y); y += lineHeight;
        doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize(content, pageWidth - 2*margin);
        doc.text(lines, margin, y);
        y += lineHeight * lines.length + 5;
    };

    addSection('Medicamento:', prescriptionData.medicineName || prescriptionData.MedicineName);
    addSection('Dosis:', prescriptionData.dose || prescriptionData.Dose);
    addSection('Horario:', prescriptionData.schedule || prescriptionData.Schedule);
    addSection('Duración:', prescriptionData.duration || prescriptionData.Duration);
    addSection('Observaciones:', prescriptionData.comments || prescriptionData.Comments);

    // Footer
    y += 20;
    doc.line(margin, y, pageWidth - margin, y); y += lineHeight;
    doc.setFont(undefined, 'bold'); doc.text(prescriptionData.doctorName || 'Dr. Desconocido', margin, y); y += lineHeight;
    doc.setFont(undefined, 'normal'); doc.text('Matrícula Profesional', margin, y);

    doc.save(`receta_${date.toISOString().split('T')[0]}.pdf`);
}

// Exportar a window
window.viewPrescription = viewPrescription;
window.closePrescription = closePrescription;
