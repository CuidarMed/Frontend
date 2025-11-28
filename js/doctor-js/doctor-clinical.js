// doctor-clinical.js - Gestión de historia clínica y pacientes

import { showNotification } from './doctor-ui.js';

let allPatientsList = [];

const STATUS_CONFIG = {
    completed: { label: 'Completada', bg: '#d1fae5', color: '#065f46' },
    signed: { label: 'Firmada', bg: '#dbeafe', color: '#1e40af' },
    default: { label: 'Pendiente', bg: '#fef3c7', color: '#92400e' }
};

const createHTML = {
    loading: (text) => `<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #6b7280;"><i class="fas fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>${text}</p></div>`,
    error: (text) => `<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #ef4444;"><i class="fas fa-exclamation-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i><p>${text}</p></div>`,
    empty: (icon, text) => `<div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #6b7280;"><i class="fas ${icon}" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i><p>${text}</p></div>`,
    card: (title, content, id) => `<div style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem;"><h4 style="margin-top: 0; color: #111827; border-bottom: 2px solid #10b981; padding-bottom: 0.5rem;">${title}</h4><div id="${id}" style="margin-top: 1rem;">${content}</div></div>`,
    infoBlock: (label, text) => `<div style="margin-bottom: 0.75rem;"><strong style="color: #6b7280; display: block; margin-bottom: 0.25rem;">${label}:</strong><p style="color: #111827; margin: 0;">${text}</p></div>`
};

export async function loadClinicalHistoryView() {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;

    dashboardContent.querySelectorAll('.clinical-history-section, .patient-profile-section').forEach(el => el.remove());

    const historySection = document.createElement('div');
    historySection.className = 'dashboard-section clinical-history-section';
    historySection.innerHTML = `
        <div class="section-header">
            <div><h3>Historia Clínica</h3><p>Busca y accede al historial médico de tus pacientes</p></div>
        </div>
        <div class="patient-search-container" style="margin-bottom: 2rem;">
            <div style="position: relative; margin-bottom: 1rem;">
                <i class="fas fa-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #6b7280;"></i>
                <input type="text" id="patient-search-input" placeholder="Buscar paciente por nombre, apellido o DNI..." 
                       style="width: 100%; padding: 0.75rem 1rem 0.75rem 3rem; border: 1px solid #d1d5db; border-radius: 0.5rem; font-size: 1rem;">
            </div>
            <div id="patients-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
                ${createHTML.loading('Cargando pacientes...')}
            </div>
        </div>
    `;
    dashboardContent.appendChild(historySection);

    await loadAllPatients();
    document.getElementById('patient-search-input')?.addEventListener('input', (e) => {
        filterPatients(e.target.value.toLowerCase().trim());
    });
}

async function loadAllPatients() {
    const patientsList = document.getElementById('patients-list');
    if (!patientsList) return;

    try {
        const { Api } = await import('../api.js');
        
        console.log('🔍 Cargando todos los pacientes desde DirectoryMS...');
        
        // Obtener TODOS los pacientes de DirectoryMS, no solo los que tienen turnos con este doctor
        let patientsData = await Api.get('v1/Patient/all');
        patientsData = Array.isArray(patientsData) ? patientsData : (patientsData?.value || [patientsData]).filter(Boolean);

        console.log(`✅ Pacientes obtenidos: ${patientsData.length}`);
        console.log('Pacientes:', patientsData);

        if (!patientsData?.length) {
            patientsList.innerHTML = createHTML.empty('fa-user-slash', 'No hay pacientes registrados');
            allPatientsList = [];
            return;
        }

        // Los datos ya vienen completos de DirectoryMS, solo necesitamos normalizarlos
        const enrichedPatients = patientsData.map((p) => {
            const patientId = p.patientId || p.PatientId;
            if (!patientId) {
                console.warn('⚠️ Paciente sin ID:', p);
                return null;
            }

            return {
                patientId,
                PatientId: patientId,
                name: p.name || p.Name || '',
                Name: p.name || p.Name || '',
                lastName: p.lastName || p.LastName || '',
                LastName: p.lastName || p.LastName || '',
                dni: p.dni || p.Dni || '',
                Dni: p.dni || p.Dni || '',
                ...p
            };
        }).filter(Boolean); // Filtrar nulls

        enrichedPatients.sort((a, b) => {
            const nameA = `${a.name || a.Name || ''} ${a.lastName || a.LastName || ''}`.trim().toLowerCase();
            const nameB = `${b.name || b.Name || ''} ${b.lastName || b.LastName || ''}`.trim().toLowerCase();
            return nameA.localeCompare(nameB);
        });

        allPatientsList = enrichedPatients;
        console.log(`✅ Total de pacientes procesados: ${allPatientsList.length}`);
        renderPatientsList(allPatientsList);
    } catch (error) {
        console.error('❌ Error al cargar pacientes:', error);
        console.error('❌ Detalles del error:', {
            message: error.message,
            stack: error.stack,
            status: error.status,
            statusText: error.statusText
        });
        patientsList.innerHTML = createHTML.error(`Error al cargar los pacientes: ${error.message || 'Error desconocido'}`);
    }
}

function renderPatientsList(patients) {
    const patientsList = document.getElementById('patients-list');
    if (!patientsList) return;

    if (!patients?.length) {
        patientsList.innerHTML = createHTML.empty('fa-user-slash', 'No hay pacientes registrados');
        return;
    }

    // ================================
    // Filtrar pacientes únicos por ID
    // ================================
    const uniquePatientsMap = new Map();
    patients.forEach(p => {
        const id = p.patientId || p.PatientId;
        if (!uniquePatientsMap.has(id)) {
            uniquePatientsMap.set(id, p);
        }
    });
    const uniquePatients = Array.from(uniquePatientsMap.values());

    // ================================
    // Render
    // ================================
    patientsList.innerHTML = uniquePatients.map(p => {
        const id = p.patientId || p.PatientId;
        const name = `${p.name || p.Name || ''} ${p.lastName || p.LastName || ''}`.trim() || 'Sin nombre';
        const dni = p.dni || p.Dni || 'N/A';
        const initial = (p.name || p.Name || 'P').charAt(0).toUpperCase();

        return `
            <div class="patient-card" data-patient-id="${id}" 
                 style="background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; cursor: pointer; transition: all 0.2s;"
                 onmouseover="this.style.boxShadow='0 4px 6px rgba(0,0,0,0.1)'; this.style.borderColor='#10b981';"
                 onmouseout="this.style.boxShadow='none'; this.style.borderColor='#e5e7eb';">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 50px; height: 50px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: bold;">${initial}</div>
                    <div style="flex: 1;">
                        <h4 style="margin: 0; color: #111827; font-size: 1.1rem; font-weight: 600;">${name}</h4>
                        <p style="margin: 0.25rem 0 0; color: #6b7280; font-size: 0.875rem;"><i class="fas fa-id-card"></i> DNI: ${dni}</p>
                    </div>
                    <i class="fas fa-chevron-right" style="color: #9ca3af;"></i>
                </div>
            </div>
        `;
    }).join('');

    patientsList.querySelectorAll('.patient-card').forEach(card => {
        card.addEventListener('click', function() {
            const id = parseInt(this.dataset.patientId);
            if (id) viewPatientProfile(id);
        });
    });
}


function filterPatients(searchTerm) {
    if (!searchTerm) {
        renderPatientsList(allPatientsList);
        return;
    }

    const filtered = allPatientsList.filter(p => {
        const search = [p.name || p.Name, p.lastName || p.LastName, p.dni || p.Dni].join(' ').toLowerCase();
        return search.includes(searchTerm);
    });

    renderPatientsList(filtered);
}

export async function viewPatientProfile(patientId) {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;

    const historySection = dashboardContent.querySelector('.clinical-history-section');
    if (historySection) historySection.style.display = 'none';
    dashboardContent.querySelector('.patient-profile-section')?.remove();

    const profileSection = document.createElement('div');
    profileSection.className = 'dashboard-section patient-profile-section';
    profileSection.innerHTML = `
        <div class="section-header" style="margin-bottom: 2rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <button id="back-to-patients" class="btn btn-secondary" style="padding: 0.5rem 1rem;"><i class="fas fa-arrow-left"></i> Volver</button>
                <div><h3 id="patient-profile-name">Cargando...</h3><p>Perfil e historial médico del paciente</p></div>
            </div>
        </div>
        <div id="patient-profile-content" style="display: grid; gap: 2rem;">
            <style>@media (min-width: 768px) { #patient-profile-content { grid-template-columns: 1fr 2fr !important; } }</style>
            ${createHTML.card('Información del Paciente', '<p style="color: #6b7280;">Cargando información...</p>', 'patient-info-details')}
            ${createHTML.card('Historial Médico', '<p style="color: #6b7280;">Cargando historial...</p>', 'patient-history-list')}
        </div>
    `;
    dashboardContent.appendChild(profileSection);

    document.getElementById('back-to-patients')?.addEventListener('click', () => {
        profileSection.remove();
        if (historySection) historySection.style.display = '';
    });

    await Promise.all([loadPatientProfileData(patientId), loadPatientHistory(patientId)]);
}

async function loadPatientProfileData(patientId) {
    try {
        const { Api } = await import('../api.js');
        const p = await Api.get(`v1/Patient/${patientId}`);
        if (!p) throw new Error('Paciente no encontrado');

        const name = `${p.name || p.Name || ''} ${p.lastName || p.LastName || ''}`.trim() || 'Sin nombre';
        const age = calculateAge(p.dateOfBirth || p.DateOfBirth);

        document.getElementById('patient-profile-name').textContent = name;
        document.getElementById('patient-info-details').innerHTML = [
            ['DNI', p.dni || p.Dni || 'N/A'],
            ['Edad', `${age} años`],
            ['Dirección', p.adress || p.Adress || 'No especificada'],
            ['Teléfono', p.phone || p.Phone || 'No especificado'],
            ['Obra Social', p.healthPlan || p.HealthPlan || 'No especificado'],
            ['Nº Afiliado', p.membershipNumber || p.MembershipNumber || 'N/A']
        ].map(([label, value]) => `<div style="margin-bottom: 1rem;"><strong style="color: #6b7280; display: block; margin-bottom: 0.25rem;">${label}:</strong><span style="color: #111827;">${value}</span></div>`).join('');
    } catch (error) {
        document.getElementById('patient-info-details').innerHTML = '<p style="color: #ef4444;">Error al cargar información</p>';
    }
}

function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return 'N/A';
    try {
        const birth = new Date(dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    } catch { return 'N/A'; }
}

async function loadPatientHistory(patientId) {
    const historyList = document.getElementById('patient-history-list');
    if (!historyList) return;

    try {
        const { ApiClinical, Api } = await import('../api.js');
        const now = new Date();
        const threeYears = new Date(now.getFullYear() - 3, 0, 1);
        const encounters = await ApiClinical.get(`v1/Encounter?patientId=${patientId}&from=${threeYears.toISOString()}&to=${now.toISOString()}`);
        const list = Array.isArray(encounters) ? encounters : (encounters?.value || []);

        if (!list?.length) {
            historyList.innerHTML = createHTML.empty('fa-file-medical', 'No hay historial médico registrado');
            return;
        }

        const doctorsMap = await loadDoctorsMap(list, Api);

        historyList.innerHTML = list.map(enc => {
            const id = enc.encounterId || enc.EncounterId;
            const date = new Date(enc.date || enc.Date);
            const doctorName = doctorsMap.get(enc.doctorId || enc.DoctorId) || 'Dr. Sin nombre';
            const status = (enc.status || enc.Status || '').toLowerCase();
            const config = STATUS_CONFIG[status] || STATUS_CONFIG.default;

            return `
                <div style="border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1rem; background: #f9fafb;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                                <i class="fas fa-calendar-alt" style="color: #10b981;"></i>
                                <strong style="color: #111827;">${date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.5rem; color: #6b7280;"><i class="fas fa-user-md"></i><span>${doctorName}</span></div>
                        </div>
                        <span style="padding: 0.25rem 0.75rem; border-radius: 0.25rem; font-size: 0.875rem; font-weight: 500; background: ${config.bg}; color: ${config.color};">${config.label}</span>
                    </div>
                    ${createHTML.infoBlock('Motivo de consulta', enc.reasons || enc.Reasons || 'Sin motivo especificado')}
                    ${createHTML.infoBlock('Diagnóstico', enc.assessment || enc.Assessment || 'Sin diagnóstico')}
                    <button onclick="viewEncounterDetailsFromDoctor(${id})" class="btn btn-primary" style="margin-top: 1rem; padding: 0.5rem 1rem; font-size: 0.875rem;"><i class="fas fa-eye"></i> Ver detalles completos</button>
                </div>
            `;
        }).join('');
    } catch (error) {
        historyList.innerHTML = createHTML.error('Error al cargar el historial médico');
    }
}

async function loadDoctorsMap(encounters, Api) {
    const doctorsMap = new Map();
    for (const enc of encounters) {
        const doctorId = enc.doctorId || enc.DoctorId;
        if (doctorId && !doctorsMap.has(doctorId)) {
            try {
                const doctor = await Api.get(`v1/Doctor/${doctorId}`);
                const name = `${doctor.firstName || doctor.FirstName || ''} ${doctor.lastName || doctor.LastName || ''}`.trim();
                doctorsMap.set(doctorId, name || `Dr. ID ${doctorId}`);
            } catch {
                doctorsMap.set(doctorId, `Dr. ID ${doctorId}`);
            }
        }
    }
    return doctorsMap;
}

export async function viewEncounterDetails(encounterId) {
    try {
        const { ApiClinical, Api } = await import('../api.js');
        const enc = await ApiClinical.get(`v1/Encounter/${encounterId}`);
        if (!enc) {
            showNotification('No se encontraron los detalles', 'error');
            return;
        }

        const [patientName, doctorName] = await Promise.all([
            loadPersonName(Api, enc.patientId || enc.PatientId, 'Patient', 'Paciente'),
            loadPersonName(Api, enc.doctorId || enc.DoctorId, 'Doctor', 'Dr.')
        ]);

        const date = new Date(enc.date || enc.Date);
        const modal = createModal('Detalles de la Consulta', 'Consulta médica completa', generateEncounterDetailsHTML(enc, date, patientName, doctorName));
        
        document.body.appendChild(modal);
        modal.querySelector('.close-modal')?.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    } catch (error) {
        showNotification('Error al cargar los detalles', 'error');
    }
}

async function loadPersonName(Api, id, type, prefix) {
    if (!id) return `${prefix} desconocido`;
    try {
        const person = await Api.get(`v1/${type}/${id}`);
        const firstName = person.firstName || person.FirstName || person.name || person.Name || '';
        const lastName = person.lastName || person.LastName || '';
        return `${firstName} ${lastName}`.trim() || `${prefix} sin nombre`;
    } catch {
        return `${prefix} ID ${id}`;
    }
}

function generateEncounterDetailsHTML(enc, date, patientName, doctorName) {
    const info = [
        ['calendar', 'Fecha', date.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })],
        ['clock', 'Hora', date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })],
        ['user', 'Paciente', patientName],
        ['user-md', 'Médico', doctorName],
        ['flag', 'Estado', enc.status || enc.Status || 'Pendiente']
    ];

    const soap = [
        ['Subjetivo (S)', enc.subjective || enc.Subjective || 'No especificado'],
        ['Objetivo (O)', enc.objetive || enc.Objetive || enc.objective || enc.Objective || 'No especificado'],
        ['Evaluación (A)', enc.assessment || enc.Assessment || 'No especificado'],
        ['Plan (P)', enc.plan || enc.Plan || 'No especificado']
    ];

    return `
        <div class="encounter-info-section">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;"><i class="fas fa-info-circle" style="color: #10b981;"></i><h4 style="margin: 0;">Información General</h4></div>
            <div style="display: grid; gap: 0.75rem;">${info.map(([icon, label, value]) => `<div style="display: flex; justify-content: space-between;"><span style="color: #6b7280;"><i class="fas fa-${icon}"></i> ${label}:</span><span style="color: #111827; font-weight: 500;">${value}</span></div>`).join('')}</div>
        </div>
        <div class="encounter-info-section" style="margin-top: 2rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;"><i class="fas fa-stethoscope" style="color: #10b981;"></i><h4 style="margin: 0;">Motivo de Consulta</h4></div>
            <p style="color: #111827;">${enc.reasons || enc.Reasons || 'Sin motivo especificado'}</p>
        </div>
        <div class="encounter-info-section" style="margin-top: 2rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;"><i class="fas fa-file-medical" style="color: #10b981;"></i><h4 style="margin: 0;">Notas SOAP</h4></div>
            ${soap.map(([label, value]) => `<div style="margin-bottom: 1rem;"><strong style="color: #6b7280; display: block; margin-bottom: 0.5rem;">${label}:</strong><p style="color: #111827; margin: 0; white-space: pre-wrap;">${value}</p></div>`).join('')}
        </div>
        ${enc.notes || enc.Notes ? `<div class="encounter-info-section" style="margin-top: 2rem;"><div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;"><i class="fas fa-sticky-note" style="color: #10b981;"></i><h4 style="margin: 0;">Notas Adicionales</h4></div><p style="color: #111827; white-space: pre-wrap;">${enc.notes || enc.Notes}</p></div>` : ''}
    `;
}

function createModal(title, subtitle, body) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 800px; max-height: 90vh; overflow-y: auto;">
            <div class="modal-header"><div><h3>${title}</h3><p style="margin: 0.5rem 0 0; color: #6b7280;">${subtitle}</p></div><button class="close-modal">&times;</button></div>
            <div class="modal-body">${body}</div>
        </div>
    `;
    return modal;
}

window.viewEncounterDetailsFromDoctor = viewEncounterDetails;
export { allPatientsList };