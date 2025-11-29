// ============================================
// MÓDULO DE PRESCRIPCIONES - PACIENTE
// ============================================

import { ApiClinical, Api } from '../api.js';
import { showNotification } from './patient-notifications.js';

/**
 * Muestra la receta asociada a un encounter
 * @param {number} encounterId
 */
export async function viewPrescription(encounterId) {
    console.log('🔍 Cargando receta para encounter:', encounterId);
    
    try {
        const modal = document.getElementById('prescription-modal');
        const content = document.getElementById('prescription-content');
        
        if (!modal || !content) {
            console.error('❌ Modal o contenedor no encontrado');
            showNotification('Error: Modal no encontrado', 'error');
            return;
        }

        // Mostrar loading
        content.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Cargando receta...</p>
            </div>
        `;
        
        // Mostrar modal
        modal.classList.remove('hidden');
        modal.style.display = 'flex';

        // Llamada al endpoint
        console.log('📡 Llamando a API: v1/Prescription/encounter/' + encounterId);
        const response = await ApiClinical.get(`v1/Prescription/encounter/${encounterId}`);

        console.log('📥 Respuesta cruda:', response);

        if (!Array.isArray(response) || response.length === 0) {
            throw new Error('No se encontró ninguna receta para este encuentro');
        }

        // Tomamos la PRIMER receta del array
        const prescription = response[0];
        console.log('✅ Receta seleccionada:', prescription);


        // Preparar datos según la estructura real de la BD
        const prescriptionData = {
            prescriptionId: prescription.prescriptionId,
            encounterId: prescription.encounterId,
            patientId: prescription.patientId,
            doctorId: prescription.doctorId,
            diagnosis: prescription.diagnosis,
            medication: prescription.medication,
            dosage: prescription.dosage,
            frequency: prescription.frequency,
            duration: prescription.duration,
            additionalInstructions: prescription.additionalInstructions,
            prescriptionDate: prescription.prescriptionDate || prescription.createdAt
        };

        // Obtener información del doctor
        let doctorName = 'Dr. Desconocido';
        let doctorSpecialty = '';
        
        if (prescriptionData.doctorId) {
            try {
                console.log('👨‍⚕️ Cargando información del doctor:', prescriptionData.doctorId);
                const doctor = await Api.get(`v1/Doctor/${prescriptionData.doctorId}`);
                const firstName = doctor.FirstName || doctor.firstName || '';
                const lastName = doctor.LastName || doctor.lastName || '';
                doctorName = `Dr. ${firstName} ${lastName}`.trim();
                doctorSpecialty = doctor.Specialty || doctor.specialty || '';
                console.log('✅ Doctor encontrado:', doctorName);
            } catch (err) {
                console.warn('⚠️ No se pudo cargar info del doctor:', err);
            }
        }

        // Formatear fecha
        const date = new Date(prescriptionData.prescriptionDate);
        const dateStr = date.toLocaleDateString('es-AR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        // Renderizar contenido
        content.innerHTML = `
            <div class="prescription-container">
                <div class="prescription-header">
                    <div class="prescription-logo">
                        <i class="fas fa-heart"></i>
                        <span>CuidarMed+</span>
                    </div>
                    <div class="prescription-info">
                        <h4>${doctorName}</h4>
                        ${doctorSpecialty ? `<p class="prescription-specialty">${doctorSpecialty}</p>` : ''}
                        <p class="prescription-date">Fecha: ${dateStr}</p>
                    </div>
                </div>
                <div class="prescription-divider"></div>

                <div class="prescription-section">
                    <h5><i class="fas fa-stethoscope"></i> Diagnóstico</h5>
                    <p>${prescriptionData.diagnosis}</p>
                </div>

                <div class="prescription-section">
                    <h5><i class="fas fa-prescription"></i> Medicamento</h5>
                    <p>${prescriptionData.medication}</p>
                </div>
                
                <div class="prescription-section">
                    <h5><i class="fas fa-pills"></i> Dosis</h5>
                    <p>${prescriptionData.dosage}</p>
                </div>
                
                <div class="prescription-section">
                    <h5><i class="fas fa-clock"></i> Frecuencia</h5>
                    <p>${prescriptionData.frequency}</p>
                </div>
                
                <div class="prescription-section">
                    <h5><i class="fas fa-calendar-days"></i> Duración</h5>
                    <p>${prescriptionData.duration}</p>
                </div>
                
                <div class="prescription-section">
                    <h5><i class="fas fa-comment-medical"></i> Instrucciones Adicionales</h5>
                    <p>${prescriptionData.additionalInstructions}</p>
                </div>

                <div class="prescription-footer">
                    <p class="prescription-signature">
                        <strong>${doctorName}</strong><br>
                        Matrícula Profesional
                    </p>
                </div>
            </div>
        `;

        // Guardar datos para PDF (incluir nombre del doctor)
        prescriptionData.doctorName = doctorName;
        prescriptionData.doctorSpecialty = doctorSpecialty;
        modal.setAttribute('data-prescription', JSON.stringify(prescriptionData));
        
        console.log('✅ Receta renderizada exitosamente');
        showNotification('Receta cargada correctamente', 'success');

    } catch (error) {
        console.error('❌ Error al cargar receta:', error);
        
        const content = document.getElementById('prescription-content');
        if (content) {
            content.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No se pudo cargar la receta</p>
                    <small>${error.message || 'Error desconocido'}</small>
                    <br><br>
                    <button class="btn btn-secondary" onclick="window.closePrescription()">
                        Cerrar
                    </button>
                </div>
            `;
        }
        
        showNotification('No se pudo cargar la receta', 'error');
    }
}

/**
 * Cierra el modal de prescripción
 */
export function closePrescription() {
    console.log('🚪 Cerrando modal de prescripción');
    
    const modal = document.getElementById('prescription-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
        
        // Limpiar contenido
        const content = document.getElementById('prescription-content');
        if (content) {
            content.innerHTML = '';
        }
        
        // Limpiar datos guardados
        modal.removeAttribute('data-prescription');
    }
}

/**
 * Descarga la receta como PDF
 */
export function downloadPrescriptionPDF() {
    console.log('📥 Descargando receta PDF...');
    
    try {
        const modal = document.getElementById('prescription-modal');
        const prescriptionDataStr = modal?.getAttribute('data-prescription');
        
        
        if (!prescriptionDataStr) {
            throw new Error('No hay datos de prescripción disponibles');
        }
        
        const prescriptionData = JSON.parse(prescriptionDataStr);

        
        // Verificar que jsPDF esté disponible
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error('Librería jsPDF no está cargada');
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        const margin = 20;
        let y = margin;
        const lineHeight = 7;
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header - Logo y título
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text('CuidarMed+', margin, y);
        y += 10;

        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        doc.text('Receta Médica', margin, y);
        y += lineHeight * 2;

        // Información del doctor
        doc.setFontSize(11);
        doc.setFont(undefined, 'bold');
        doc.text(prescriptionData.doctorName || 'Dr. Desconocido', margin, y);
        y += lineHeight;
        
        if (prescriptionData.doctorSpecialty) {
            doc.setFont(undefined, 'normal');
            doc.text(prescriptionData.doctorSpecialty, margin, y);
            y += lineHeight;
        }
        
        const date = new Date(prescriptionData.prescriptionDate);
        doc.text(`Fecha: ${date.toLocaleDateString('es-AR')}`, margin, y);
        y += lineHeight * 2;

        // Función helper para agregar secciones
        const addSection = (title, content) => {
            if (!content || content === 'No especificado' || content === 'No especificada' || content === 'Sin instrucciones adicionales') {
                return; // No mostrar secciones sin datos
            }
            
            doc.setFont(undefined, 'bold');
            doc.text(title, margin, y);
            y += lineHeight;
            
            doc.setFont(undefined, 'normal');
            const lines = doc.splitTextToSize(content, pageWidth - 2 * margin);
            doc.text(lines, margin, y);
            y += lineHeight * lines.length + 5;
        };

        // Secciones del contenido (según estructura de la BD)
        addSection('Diagnóstico:', prescriptionData.diagnosis);
        addSection('Medicamento:', prescriptionData.medication);
        addSection('Dosis:', prescriptionData.dosage);
        addSection('Frecuencia:', prescriptionData.frequency);
        addSection('Duración:', prescriptionData.duration);
        addSection('Instrucciones Adicionales:', prescriptionData.additionalInstructions);

        // Footer - Firma
        y += 20;
        doc.line(margin, y, pageWidth - margin, y);
        y += lineHeight;
        
        doc.setFont(undefined, 'bold');
        doc.text(prescriptionData.doctorName || 'Dr. Desconocido', margin, y);
        y += lineHeight;
        
        doc.setFont(undefined, 'normal');
        doc.text('Matrícula Profesional', margin, y);

        // Guardar PDF
        const fileName = `receta_${date.toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
        
        console.log('✅ PDF descargado:', fileName);
        showNotification('Receta descargada exitosamente', 'success');
        
    } catch (error) {
        console.error('❌ Error al descargar PDF:', error);
        showNotification('Error al descargar la receta: ' + error.message, 'error');
    }
}

/**
 * Inicializa el modal de prescripciones y sus eventos
 */
export function initializePrescriptionModal() {
    console.log('🔧 Inicializando modal de prescripciones (delegación)...');

    const modal = document.getElementById('prescription-modal');
    if (!modal) {
        console.warn('⚠️ Modal de prescripción no encontrado en el DOM');
        return;
    }

    // Delegación de clicks dentro del modal
    // Maneja: .close-modal, .btn-close, .btn-cancel, #download-prescription
    modal.addEventListener('click', (e) => {
        const target = /** @type {HTMLElement} */ (e.target);

        // Buscar el botón real si el click fue en un icono o span dentro del botón
        const closestClose = target.closest('.close-modal, .btn-close');
        if (closestClose) {
            e.preventDefault();
            closePrescription();
            return;
        }

        const closestCancel = target.closest('.btn-cancel');
        if (closestCancel) {
            e.preventDefault();
            closePrescription();
            return;
        }

        const closestDownload = target.closest('#download-prescription');
        if (closestDownload) {
            e.preventDefault();
            // Llamamos a la función que genera el PDF
            try {
                downloadPrescriptionPDF();
            } catch (err) {
                console.error('Error al iniciar descarga de PDF:', err);
            }
            return;
        }

        // Cerrar al clickear fuera del contenido (asumiendo que el contenido es .prescription-content)
        if (target === modal) {
            // click en el backdrop
            closePrescription();
        }
    });

    // Cerrar con tecla ESC (una sola vez)
    const escHandler = (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closePrescription();
        }
    };
    // Evitar múltiples listeners al reiniciar: removemos antes y luego añadimos
    document.removeEventListener('keydown', escHandler);
    document.addEventListener('keydown', escHandler);

    console.log('✅ Modal de prescripciones inicializado (delegación activa)');
}

// Exportar a window para uso global
window.viewPrescription = viewPrescription;
window.closePrescription = closePrescription;
window.downloadPrescriptionPDF = downloadPrescriptionPDF;