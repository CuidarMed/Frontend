// ============================================
// NAVEGACIÓN DEL SIDEBAR
// ============================================

/**
 * Inicializa la navegación del sidebar
 */
export function initializeSidebarNavigation() {
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            navItems.forEach(navItem => navItem.classList.remove('active'));
            this.classList.add('active');
            
            const section = this.getAttribute('data-section');
            handleSectionNavigation(section);
        });
    });
}

/**
 * Maneja la navegación entre secciones
 */
export async function handleSectionNavigation(section) {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    // Limpiar vistas previas
    const fullHistory = dashboardContent.querySelectorAll('.history-full-section');
    fullHistory.forEach(h => h.remove());
    
    const allSections = dashboardContent.querySelectorAll('.dashboard-section, .welcome-section, .summary-cards');
    allSections.forEach(sec => {
        if (!sec.classList.contains('profile-section')) {
            sec.style.display = 'none';
        }
    });
    
    const existingProfiles = dashboardContent.querySelectorAll('.profile-section');
    existingProfiles.forEach(profile => profile.remove());
    
    const comingSoon = dashboardContent.querySelector('.coming-soon-section');
    if (comingSoon) comingSoon.remove();
    
    switch(section) {
        case 'inicio':
            allSections.forEach(sec => {
                if (!sec.classList.contains('profile-section') && !sec.classList.contains('coming-soon-section')) {
                    sec.style.display = '';
                }
            });
            // Cargar datos de inicio
            const { loadPatientData } = await import('./patient-data.js');
            const { loadPatientAppointments } = await import('./patient-appointments.js');
            const { loadRecentPatientHistory } = await import('./patient-history.js');
            
            await loadPatientData();
            await loadPatientAppointments();
            await loadRecentPatientHistory();
            break;
            
        case 'perfil':
            const { loadPatientProfile } = await import('./patient-profile.js');
            await loadPatientProfile();
            break;
            
        case 'turnos':
            const turnosSection = dashboardContent.querySelector('.dashboard-section');
            if (turnosSection) {
                turnosSection.style.display = '';
            }
            const { loadPatientAppointments: loadAppointmentsFull } = await import('./patient-appointments.js');
            await loadAppointmentsFull();
            break;
            
        case 'historial':
            allSections.forEach(sec => {
                if (sec.classList.contains('history-full-section')) {
                    sec.style.display = '';
                } else if (!sec.classList.contains('profile-section') && !sec.classList.contains('coming-soon-section')) {
                    sec.style.display = 'none';
                }
            });
            
            let historyFullSection = dashboardContent.querySelector('.history-full-section');
            if (!historyFullSection) {
                historyFullSection = document.createElement('div');
                historyFullSection.className = 'dashboard-section history-full-section';
                historyFullSection.innerHTML = `
                    <div class="section-header">
                        <div>
                            <h3>Historial Médico Completo</h3>
                            <p>Todas tus consultas realizadas</p>
                        </div>
                    </div>
                    <div class="history-list" id="history-list-full">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Cargando historial médico...</p>
                        </div>
                    </div>
                `;
                dashboardContent.appendChild(historyFullSection);
            } else {
                historyFullSection.style.display = '';
            }
            
            const { loadPatientHistoryFull } = await import('./patient-history.js');
            await loadPatientHistoryFull();
            break;
            
        case 'pagos':
            showComingSoonSection('pagos');
            break;
        case 'recetas':
            // Ocultar todas las secciones excepto la de recetas
            allSections.forEach(sec => {
                if (sec.classList.contains('prescriptions-full-section')) {
                    sec.style.display = '';
                } else if (!sec.classList.contains('profile-section') && !sec.classList.contains('coming-soon-section')) {
                    sec.style.display = 'none';
                }
            });
            
            // Crear o mostrar sección de recetas
            let prescriptionsFullSection = dashboardContent.querySelector('.prescriptions-full-section');
            if (!prescriptionsFullSection) {
                prescriptionsFullSection = document.createElement('div');
                prescriptionsFullSection.className = 'dashboard-section prescriptions-full-section';
                prescriptionsFullSection.innerHTML = `
                    <div class="section-header">
                        <div>
                            <h3>Mis Recetas Médicas</h3>
                            <p>Todas tus recetas y prescripciones médicas</p>
                        </div>
                        <div class="section-header-actions">
                            <button class="btn btn-secondary" id="refreshPrescriptions">
                                <i class="fas fa-sync-alt"></i>
                                Actualizar
                            </button>
                        </div>
                    </div>
                    <div class="prescriptions-list" id="prescriptions-list-full">
                        <div class="loading-spinner">
                            <i class="fas fa-spinner fa-spin"></i>
                            <p>Cargando recetas médicas...</p>
                        </div>
                    </div>
                `;
                dashboardContent.appendChild(prescriptionsFullSection);
                
                // Agregar evento al botón de actualizar
                setTimeout(() => {
                    const refreshBtn = document.getElementById('refreshPrescriptions');
                    if (refreshBtn) {
                        refreshBtn.addEventListener('click', async () => {
                            const { loadPatientPrescriptions } = await import('./patient-prescriptions-list.js');
                            await loadPatientPrescriptions();
                        });
                    }
                }, 100);
            } else {
                prescriptionsFullSection.style.display = '';
            }
            
            // Cargar las recetas
            const { loadPatientPrescriptions } = await import('./patient-prescriptions-list.js');
            await loadPatientPrescriptions();
            break;    
            
        default:
            allSections.forEach(sec => {
                if (!sec.classList.contains('profile-section') && !sec.classList.contains('coming-soon-section')) {
                    sec.style.display = '';
                }
            });
    }
}

/**
 * Muestra sección "En construcción"
 */
export function showComingSoonSection(section) {
    const dashboardContent = document.querySelector('.dashboard-content');
    if (!dashboardContent) return;
    
    const existingComingSoon = dashboardContent.querySelector('.coming-soon-section');
    if (existingComingSoon) {
        existingComingSoon.remove();
    }
    
    const comingSoonSection = document.createElement('div');
    comingSoonSection.className = 'coming-soon-section';
    
    const sectionConfig = {
        'pagos': {
            name: 'Pagos',
            icon: 'fas fa-credit-card',
            message: 'Esta funcionalidad se implementará a futuro',
            description: 'Estamos trabajando para brindarte la mejor experiencia. Pronto podrás gestionar tus pagos desde esta sección.'
        }
    };
    
    const config = sectionConfig[section] || {
        name: section,
        icon: 'fas fa-clock',
        message: 'Esta funcionalidad se implementará a futuro',
        description: 'Estamos trabajando para brindarte la mejor experiencia.'
    };
    
    comingSoonSection.innerHTML = `
        <div class="dashboard-section">
            <div class="coming-soon-content">
                <div class="coming-soon-icon">
                    <i class="${config.icon}"></i>
                </div>
                <h2>${config.name}</h2>
                <p class="coming-soon-message">${config.message}</p>
                <p class="coming-soon-description">${config.description}</p>
                <button class="btn btn-primary" id="comingSoonBackBtn">
                    <i class="fas fa-home"></i>
                    Volver al Inicio
                </button>
            </div>
        </div>
    `;
    
    dashboardContent.appendChild(comingSoonSection);
    
    setTimeout(() => {
        const backBtn = document.getElementById('comingSoonBackBtn');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                const inicioBtn = document.querySelector('[data-section="inicio"]');
                if (inicioBtn) {
                    inicioBtn.click();
                }
            });
        }
    }, 100);
}