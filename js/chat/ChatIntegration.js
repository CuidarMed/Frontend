async function handleAppointmentChatCreation(appointment) {
    // Validamos que el turno este confirmado
    if(appointment.status !== "Confirmed"){
        console.log("Turno no confirmado, chat no disponible.")
        return null
    }

    // Verificamos si ya existe una sala de chat para este turno
    const userId = appointment.currentUserId
    const existingRooms = await getUserChatRooms(userId)

    const existingRoom = existingRooms.find(room => 
        room.appointmentId === appointment.appointmentId
    )

    if(existingRoom){
        // Si existe la devolvemos
        console.log("La sala existe: ", existingRoom)
        return existingRoom
    }

    // Si no existe la creamos
    console.log("Creando nueva sala")
    const newRoom = await createChatRoom(
        appointment.doctorId,
        appointment.patientId,
        appointment.appointmentId
    )

    return newRoom
}

function addChatButtomToAppointment(appointmentCard, appointment, userType, onChatOpen){
    // Solo si el turno esta confirmado
    if(!appointment.status !== "Confirmed") return;

    let actionContainer = appointmentCard.querySelector('.appintment-actions')
    if(!actionContainer){
        actionContainer = document.createElement('div')
        appointmentCard.appendChild(actionContainer)
    }

    // Crear boton con estilo del theme
    const themeColor = userType === 'doctor' ? '#10b981' : '#3b82f6'
    const chatBtn = document.createElement('button')
    chatBtn.innerHTML = `Chat con ${userType === 'doctor' ? 'Paciente' : 'Doctor'}`
    chatBtn.style.background = themeColor;

    // Al hacer click, llama al callback
    chatBtn.onclick = () => onChatOpen(appointment)

    // Agregar al contenedor 
    actionContainer.appendChild(chatBtn)
}

function openChatModal(chatRoom, config){
    // Crear ovevrlay oscuro
    const modal = document.createElement('div')
    modal.id = 'chatModal'
    modal.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
    `

    // Creamos contenedor del chat
    const modalContent = document.createElement('div')
    modalContent.style.cssText = `
        width: 600px;
        heigth: 80vh;
        background: white;
        border-radius: 12px;
    `

    modal.appendChild(modalContent)
    document.body.appendChild(modal)

    // Inicializar chatComponent dentro del contenedor
    const chat = new ChatComponet({
        chatRoomId: chatRoom.chatRoomId,
        currentUserId: config.currentUserId,
        currentUserName: config.currentUserName,
        otherUserName: config.otherUserName,
        theme: config.theme,
        container: modalContent
    })

    // Cerrar al hacer click fuera
    modal.addEventListener('click', (e) => {
        if(e.target === modal)
            closeChat()
    })

    function closeChat(){
        modal.remove()
    }
}