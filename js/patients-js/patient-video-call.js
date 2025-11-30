import { appState } from './patient-state.js';
import { showNotification } from './patient-notifications.js';


export async function openPatientVideoCall(appointmentId, doctorId, doctorName) {
    try {
        console.log('📹 Abriendo videollamada para paciente:', { appointmentId, doctorId, doctorName });
        
        // Verificar que el appointment esté confirmado o en progreso
        const { ApiScheduling } = await import('../api.js');
        const appointment = await ApiScheduling.get(`v1/Appointments/${appointmentId}`);
        
        if (!appointment) {
            showNotification('No se encontró el turno', 'error');
            return;
        }
        
        const status = (appointment.status || appointment.Status || '').toLowerCase();
        if (status !== 'confirmed' && status !== 'in_progress') {
            showNotification('La videollamada solo está disponible para turnos confirmados o en progreso', 'warning');
            return;
        }
        
        // Crear modal
        const modal = createVideoCallModal(appointmentId, doctorName);
        document.body.appendChild(modal);
        
        // Inicializar videollamada
        await initializePatientVideoCall(modal, appointmentId, doctorId);
        
    } catch (error) {
        console.error('❌ Error al abrir videollamada:', error);
        showNotification('Error al abrir la videollamada. Por favor, intenta nuevamente.', 'error');
    }
}


function createVideoCallModal(appointmentId, doctorName) {
    const modal = document.createElement('div');
    modal.className = 'video-call-modal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
    `;
    
    modal.innerHTML = `
        <div class="video-call-modal-content" style="
            background: white;
            border-radius: 1rem;
            width: 100%;
            max-width: 900px;
            height: 90vh;
            max-height: 700px;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        ">
            <div class="video-call-header" style="
                padding: 1rem 1.5rem;
                background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                color: white;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <div>
                    <h3 style="margin: 0; font-size: 1.25rem; font-weight: 600;">
                        <i class="fas fa-video"></i> Videollamada con ${doctorName}
                    </h3>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.875rem; opacity: 0.9;">
                        Conectando...
                    </p>
                </div>
                <button class="close-video-call" style="
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: white;
                    width: 2.5rem;
                    height: 2.5rem;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.25rem;
                    transition: all 0.2s;
                ">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div id="patient-video-call-container" style="
                flex: 1;
                background: #000;
                position: relative;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                min-height: 400px;
            ">
                <p id="patient-video-loading" style="text-align: center; font-size: 1rem;">
                    <i class="fas fa-spinner fa-spin"></i> Conectando a la videollamada...
                </p>
            </div>
            
            <div id="patient-video-controls" style="
                padding: 1rem 1.5rem;
                background: #f9fafb;
                border-top: 1px solid #e5e7eb;
                display: flex;
                gap: 0.75rem;
                justify-content: center;
                flex-wrap: wrap;
            ">
                <button id="patient-toggle-mic" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 500;
                    transition: all 0.2s;
                ">
                    <i class="fas fa-microphone"></i> Micrófono
                </button>
                <button id="patient-toggle-camera" style="
                    background: #3b82f6;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 500;
                    transition: all 0.2s;
                ">
                    <i class="fas fa-video"></i> Cámara
                </button>
                <button id="patient-end-call" style="
                    background: #ef4444;
                    color: white;
                    border: none;
                    padding: 0.75rem 1.5rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-weight: 500;
                    transition: all 0.2s;
                ">
                    <i class="fas fa-phone-slash"></i> Finalizar
                </button>
            </div>
        </div>
    `;
    
    // Cerrar modal
    const closeBtn = modal.querySelector('.close-video-call');
    const endCallBtn = modal.querySelector('#patient-end-call');
    
    const closeModal = () => {
        if (modal.callFrame) {
            modal.callFrame.leave().catch(() => {});
        }
        modal.remove();
    };
    
    closeBtn?.addEventListener('click', closeModal);
    endCallBtn?.addEventListener('click', closeModal);
    
    // Cerrar al hacer click fuera del modal
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    return modal;
}

async function initializePatientVideoCall(modal, appointmentId, doctorId) {
    try {
        const videoContainer = modal.querySelector('#patient-video-call-container');
        const videoLoading = modal.querySelector('#patient-video-loading');
        
        if (!videoContainer) {
            console.error('❌ Contenedor de video no encontrado');
            return;
        }
        
        // Obtener token del paciente desde el backend
        const { ApiScheduling } = await import('../api.js');
        const patientId = appState.currentPatient?.patientId || appState.currentPatient?.PatientId;
        
        if (!patientId) {
            throw new Error('No se pudo identificar al paciente');
        }
        
        // Obtener la sala (se crea si no existe)
        let roomUrl = null;
        let retries = 3;
        while (retries > 0 && !roomUrl) {
            try {
                const roomResponse = await ApiScheduling.post(`v1/Video/room/${appointmentId}?doctorId=${doctorId}&patientId=${patientId}`, {});
                roomUrl = roomResponse.roomUrl || roomResponse.RoomUrl;
                if (roomUrl) {
                    console.log('✅ URL de sala obtenida:', roomUrl);
                    break;
                }
            } catch (error) {
                retries--;
                if (retries === 0) {
                    console.warn('⚠️ No se pudo obtener la sala después de varios intentos:', error);
                    showNotification('No se pudo conectar a la videollamada. Por favor, intenta nuevamente.', 'error');
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        if (!roomUrl) {
            throw new Error('No se pudo obtener la URL de la sala');
        }
        
        // Obtener token del paciente
        const tokenResponse = await ApiScheduling.get(`v1/Video/token/${appointmentId}?userId=patient-${patientId}&isOwner=false`);
        const token = tokenResponse.token || tokenResponse.Token;
        
        if (!token) {
            throw new Error('No se recibió el token de videollamada');
        }
        
        console.log('✅ Token obtenido para paciente');
        
        // Cargar Daily.co SDK si no está disponible
        if (typeof window.DailyIframe === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@daily-co/daily-js';
            script.onload = () => {
                startPatientVideoCall(videoContainer, roomUrl, token, modal, appointmentId);
            };
            script.onerror = () => {
                showVideoError(videoContainer, 'No se pudo cargar el SDK de videollamada');
            };
            document.head.appendChild(script);
        } else {
            startPatientVideoCall(videoContainer, roomUrl, token, modal, appointmentId);
        }
        
    } catch (error) {
        console.error('❌ Error al inicializar videollamada del paciente:', error);
        
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
        
        const videoContainer = modal.querySelector('#patient-video-call-container');
        if (videoContainer) {
            showVideoError(videoContainer, `Videollamada no disponible: ${errorMessage}`);
        }
    }
}

function startPatientVideoCall(videoContainer, roomUrl, token, modal, appointmentId) {
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
                borderRadius: '0'
            }
        });
        
        // Guardar referencia al callFrame
        modal.callFrame = callFrame;
        
        // Configurar controles
        setupPatientVideoControls(modal, callFrame, appointmentId);
        
        // Unirse a la sala
        callFrame.join({ url: roomUrl, token: token })
            .then(() => {
                console.log('✅ Paciente unido a la videollamada');
                const loading = videoContainer.querySelector('#patient-video-loading');
                if (loading) loading.style.display = 'none';
                
                // Actualizar header
                const headerSubtitle = modal.querySelector('.video-call-header p');
                if (headerSubtitle) {
                    headerSubtitle.textContent = 'Conectado';
                }
            })
            .catch((error) => {
                console.error('❌ Error al unirse a la videollamada:', error);
                
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
            console.log('👋 Paciente salido de la videollamada');
            modal.remove();
        });
        
        callFrame.on('error', (error) => {
            console.error('❌ Error en la videollamada:', error);
            showVideoError(videoContainer, `Error: ${error.message || 'Error desconocido'}`);
        });
        
    } catch (error) {
        console.error('❌ Error al crear videollamada:', error);
        showVideoError(videoContainer, `Error: ${error.message || 'Error desconocido'}`);
    }
}

function setupPatientVideoControls(modal, callFrame, appointmentId) {
    const toggleMic = modal.querySelector('#patient-toggle-mic');
    const toggleCamera = modal.querySelector('#patient-toggle-camera');
    const endCall = modal.querySelector('#patient-end-call');
    
    let micEnabled = true;
    let cameraEnabled = true;
    
    if (toggleMic) {
        toggleMic.addEventListener('click', () => {
            micEnabled = !micEnabled;
            callFrame.setLocalAudio(micEnabled);
            toggleMic.innerHTML = micEnabled 
                ? '<i class="fas fa-microphone"></i> Micrófono'
                : '<i class="fas fa-microphone-slash"></i> Micrófono';
            toggleMic.style.background = micEnabled ? '#3b82f6' : '#6b7280';
        });
    }
    
    if (toggleCamera) {
        toggleCamera.addEventListener('click', () => {
            cameraEnabled = !cameraEnabled;
            callFrame.setLocalVideo(cameraEnabled);
            toggleCamera.innerHTML = cameraEnabled 
                ? '<i class="fas fa-video"></i> Cámara'
                : '<i class="fas fa-video-slash"></i> Cámara';
            toggleCamera.style.background = cameraEnabled ? '#3b82f6' : '#6b7280';
        });
    }
    
    if (endCall) {
        endCall.addEventListener('click', () => {
            callFrame.leave().then(() => {
                modal.remove();
            }).catch(() => {
                modal.remove();
            });
        });
    }
}

function showVideoError(videoContainer, message) {
    if (videoContainer) {
        videoContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: #ef4444;">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                <p style="font-size: 1.125rem; margin: 0;">${message}</p>
            </div>
        `;
    }
}
