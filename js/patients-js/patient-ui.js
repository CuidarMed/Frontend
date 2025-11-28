// ============================================
// GESTIÓN DE UI Y ESTILOS - PACIENTE
// ============================================

/**
 * Mapa de estilos CSS para cada estado de turno
 * Basado en los estilos definidos en patient.css
 */
const STATUS_STYLES = {
    scheduled: {
        backgroundColor: '#fef3c7',
        color: '#f59e0b',
        border: '2px solid #fbbf24'
    },
    confirmed: {
        backgroundColor: '#a7f3d0',
        color: '#059669',
        border: '2px solid #10b981'
    },
    in_progress: {
        backgroundColor: '#d1e6fa',
        color: '#062a5f',
        border: '2px solid #3b82f6'
    },
    cancelled: {
        backgroundColor: '#fee2e2',
        color: '#991b1b',
        border: '2px solid #ef4444'
    },
    completed: {
        backgroundColor: '#E8D5FF',
        color: '#7c3aed',
        border: '2px solid #8b5cf6'
    },
    no_show: {
        backgroundColor: '#d9dadb',
        color: '#4f4f50',
        border: '2px solid #9ca3af'
    },
    rescheduled: {
        backgroundColor: '#f3dbb8',
        color: '#d4830a',
        border: '2px solid #f59e0b'
    },
    pending: {
        backgroundColor: '#fef3c7',
        color: '#f59e0b',
        border: '2px solid #fbbf24'
    }
};

/**
 * Mapeo de estados a íconos
 */
const STATUS_ICONS = {
    scheduled: 'fa-calendar-check',
    confirmed: 'fa-check-circle',
    in_progress: 'fa-spinner fa-pulse',
    cancelled: 'fa-times-circle',
    completed: 'fa-check-double',
    no_show: 'fa-user-slash',
    rescheduled: 'fa-calendar-alt',
    pending: 'fa-clock'
};

/**
 * Aplica estilos correctos a los elementos de estado de turnos
 */
export function applyAppointmentStatusStyles() {
    console.log('🎨 Aplicando estilos de estado a turnos...');
    
    // Seleccionar todos los elementos con clase de estado
    const statusElements = document.querySelectorAll(
        '.appointment-clean-status, .appointment-home-status, [class*="status-"]'
    );
    
    console.log(`📊 Encontrados ${statusElements.length} elementos de estado`);
    
    let appliedCount = 0;
    
    statusElements.forEach((element) => {
        // Obtener las clases del elemento
        const classList = Array.from(element.classList);
        
        // Buscar la clase que contiene el estado
        let statusClass = null;
        for (const className of classList) {
            if (className.startsWith('status-')) {
                statusClass = className;
                break;
            }
        }
        
        if (!statusClass) {
            return;
        }
        
        // Extraer el estado de la clase
        const status = statusClass.replace('status-', '');
        
        // Aplicar estilos según el estado
        if (STATUS_STYLES[status]) {
            applyStatusStyle(element, status);
            appliedCount++;
        }
    });
    
    console.log(`✅ Estilos aplicados a ${appliedCount} elementos`);
}

/**
 * Aplica estilos específicos a un elemento de estado
 */
function applyStatusStyle(element, status) {
    const styles = STATUS_STYLES[status];
    const icon = STATUS_ICONS[status];
    
    if (!styles) {
        console.warn(`⚠️ No hay estilos definidos para el estado: ${status}`);
        return;
    }
    
    // Aplicar estilos CSS
    element.style.backgroundColor = styles.backgroundColor;
    element.style.color = styles.color;
    element.style.border = styles.border;
    
    // Estilos base que siempre se aplican
    element.style.padding = '0.5rem 1rem';
    element.style.borderRadius = '10px';
    element.style.fontSize = '0.875rem';
    element.style.fontWeight = '600';
    element.style.display = 'inline-flex';
    element.style.alignItems = 'center';
    element.style.gap = '0.5rem';
    element.style.transition = 'all 0.3s ease';
    
    // Agregar o actualizar ícono si no existe
    let iconElement = element.querySelector('i');
    if (!iconElement && icon) {
        iconElement = document.createElement('i');
        iconElement.className = `fas ${icon}`;
        iconElement.style.fontSize = '0.813rem';
        element.insertBefore(iconElement, element.firstChild);
    } else if (iconElement && icon) {
        iconElement.className = `fas ${icon}`;
    }
    
    // Agregar clase de animación si el estado cambió
    element.classList.add('status-changed');
    setTimeout(() => {
        element.classList.remove('status-changed');
    }, 500);
}

/**
 * Inicializa el observer de mutaciones para detectar cambios en el DOM
 */
export function initializeUIObserver() {
    console.log('👁️ Inicializando observer de UI...');
    
    // Aplicar estilos iniciales después de un pequeño delay
    setTimeout(() => {
        applyAppointmentStatusStyles();
    }, 300);
    
    // Crear MutationObserver
    const observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        
        mutations.forEach((mutation) => {
            // Detectar si se agregaron nodos
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Verificar si es una tarjeta de turno o contiene una
                        if (
                            node.classList?.contains('appointment-home-card') ||
                            node.classList?.contains('appointment-clean-card') ||
                            node.querySelector?.('.appointment-home-card, .appointment-clean-card') ||
                            Array.from(node.classList || []).some(c => c.includes('status-'))
                        ) {
                            shouldUpdate = true;
                        }
                    }
                });
            }
            
            // Detectar cambios en atributos de clase
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (
                    target.classList?.contains('appointment-clean-status') ||
                    target.classList?.contains('appointment-home-status') ||
                    Array.from(target.classList || []).some(c => c.startsWith('status-'))
                ) {
                    shouldUpdate = true;
                }
            }
        });
        
        if (shouldUpdate) {
            console.log('🔄 Cambios detectados, re-aplicando estilos...');
            // Aplicar estilos con un pequeño delay para asegurar que el DOM esté listo
            setTimeout(() => {
                applyAppointmentStatusStyles();
            }, 50);
        }
    });
    
    // Observar el contenedor principal
    const container = document.querySelector('.dashboard-content') || document.body;
    observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });
    
    console.log('✅ Observer de UI inicializado');
    
    // Re-aplicar estilos al navegar entre secciones
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            setTimeout(() => {
                console.log('🧭 Navegación detectada, re-aplicando estilos...');
                applyAppointmentStatusStyles();
            }, 400);
        });
    });
    
    return observer;
}

/**
 * Fuerza la actualización de estilos (útil después de cargar datos)
 */
export function forceStyleUpdate() {
    console.log('🔨 Forzando actualización de estilos...');
    setTimeout(() => {
        applyAppointmentStatusStyles();
    }, 100);
}

/**
 * Aplica estilos cuando cambia el filtro de estado
 */
export function applyStylesAfterFilterChange() {
    console.log('🎯 Aplicando estilos después de cambio de filtro...');
    setTimeout(() => {
        applyAppointmentStatusStyles();
    }, 200);
}

// Exportar funciones globales
window.applyAppointmentStatusStyles = applyAppointmentStatusStyles;
window.forceStyleUpdate = forceStyleUpdate;
window.applyStylesAfterFilterChange = applyStylesAfterFilterChange;