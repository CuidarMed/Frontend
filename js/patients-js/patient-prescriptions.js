// ============================================
// MÓDULO DE PRESCRIPCIONES - PACIENTE (CORREGIDO)
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
            diagnosis: prescription.diagnosis || 'No especificado',
            medication: prescription.medication || 'No especificado',
            dosage: prescription.dosage || 'No especificada',
            frequency: prescription.frequency || 'No especificada',
            duration: prescription.duration || 'No especificada',
            additionalInstructions: prescription.additionalInstructions || 'Sin instrucciones adicionales',
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
        
        // ✅ CRÍTICO: Re-inicializar event listeners DESPUÉS de abrir el modal
        setTimeout(() => {
            attachModalEventListeners();
        }, 100);
        
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
    console.log('📥 Iniciando descarga de PDF...');
    
    try {
        const modal = document.getElementById('prescription-modal');
        const prescriptionDataStr = modal?.getAttribute('data-prescription');
        
        if (!prescriptionDataStr) {
            throw new Error('No hay datos de prescripción disponibles');
        }
        
        const prescriptionData = JSON.parse(prescriptionDataStr);
        console.log('📄 Datos para PDF:', prescriptionData);
        
        // Verificar que jsPDF esté disponible
        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error('Librería jsPDF no está cargada. Verifica que el script esté en el HTML.');
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
                return;
            }
            
            doc.setFont(undefined, 'bold');
            doc.text(title, margin, y);
            y += lineHeight;
            
            doc.setFont(undefined, 'normal');
            const lines = doc.splitTextToSize(content, pageWidth - 2 * margin);
            doc.text(lines, margin, y);
            y += lineHeight * lines.length + 5;
        };

        // Secciones del contenido
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
 * ✅ NUEVA FUNCIÓN: Vincula event listeners al modal
 * Se llama cada vez que se abre el modal
 */
function attachModalEventListeners() {
    console.log('🔧 Vinculando event listeners del modal...');
    
    const modal = document.getElementById('prescription-modal');
    if (!modal) return;

    // Botón Cerrar (X en header)
    const closeButtons = modal.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
        // Remover listeners previos clonando el botón
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Click en X');
            closePrescription();
        });
    });

    // Botón Cerrar (footer)
    const closeBtn = document.getElementById('close-prescription');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        newCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Click en Cerrar');
            closePrescription();
        });
        console.log('✅ Botón Cerrar vinculado');
    }

    // ✅ Botón Descargar PDF
    const downloadBtn = document.getElementById('download-prescription');
    if (downloadBtn) {
        const newDownloadBtn = downloadBtn.cloneNode(true);
        downloadBtn.parentNode.replaceChild(newDownloadBtn, downloadBtn);
        
        newDownloadBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Click en Descargar PDF');
            downloadPrescriptionPDF();
        });
        console.log('✅ Botón Descargar vinculado');
    } else {
        console.warn('⚠️ Botón download-prescription no encontrado');
    }

    // Click fuera del modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closePrescription();
        }
    });
    
    console.log('✅ Event listeners vinculados correctamente');
}

/**
 * Inicializa el modal de prescripciones (solo al cargar la página)
 */
export function initializePrescriptionModal() {
    console.log('🔧 Inicializando modal de prescripciones...');
    
    const modal = document.getElementById('prescription-modal');
    if (!modal) {
        console.warn('⚠️ Modal de prescripción no encontrado en el DOM');
        return;
    }

    // Evento ESC para cerrar
    const escHandler = (e) => {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closePrescription();
        }
    };
    
    document.removeEventListener('keydown', escHandler);
    document.addEventListener('keydown', escHandler);

    console.log('✅ Modal de prescripciones inicializado');
}

// Exportar a window para uso global
window.viewPrescription = viewPrescription;
window.closePrescription = closePrescription;
window.downloadPrescriptionPDF = downloadPrescriptionPDF;