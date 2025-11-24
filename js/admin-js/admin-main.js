import { state, loadUserFromStorage, logout } from "../state.js";
import { ApiAuth } from "../api.js";

const SPECIALTIES_STORAGE_KEY = "adminSpecialties";

const selectors = {
  dashboardGreeting: "#dashboardGreeting",
  lastSyncLabel: "#lastSyncLabel",
  metricsGrid: "#metricsGrid",
  activityTimeline: "#activityTimeline",
  clearActivityBtn: "#clearActivityBtn",
  alertsList: "#alertsList",
  alertsCounter: "#alertsCounter",
  alertsBadge: "#alertsBadge",
  usersTableBody: "#usersTableBody",
  roleFilter: "#roleFilter",
  searchUsers: "#searchUsers",
  servicesGrid: "#servicesGrid",
  auditTimeline: "#auditTimeline",
  profileName: "#profileName",
  profileEmail: "#profileEmail",
  profilePhone: "#profilePhone",
  profileLocation: "#profileLocation",
  profileLastLogin: "#profileLastLogin",
  profileSessionId: "#profileSessionId",
  profileAvatar: "#profileAvatar",
  profilePermissions: "#profilePermissions",
  userDisplayName: "#userDisplayName",
  userInitials: "#userInitials",
  userDropdown: "#userDropdown",
  userMenuBtn: "#userMenuBtn",
  goToProfileBtn: "#goToProfileBtn",
  logoutBtn: "#logoutBtn",
  refreshDataBtn: "#refreshDataBtn",
  runDiagnosticsBtn: "#runDiagnosticsBtn",
  exportAuditBtn: "#exportAuditBtn",
  editProfileBtn: "#editProfileBtn",
  specialtiesList: "#specialtiesList",
  specialtyCount: "#specialtyCount",
  resetSpecialtiesBtn: "#resetSpecialtiesBtn",
  addSpecialtyForm: "#addSpecialtyForm",
  specialtyName: "#specialtyName",
  specialtyColor: "#specialtyColor",
};

const adminState = {
  activity: [],
  alerts: [],
  metrics: [],
  services: [],
  users: [],
  audits: [],
  specialties: [],
  lastSync: null,
};

const metricIcons = {
  usuarios: "fas fa-users",
  servicios: "fas fa-server",
  auditorias: "fas fa-shield-alt",
  tickets: "fas fa-headset",
};

const statusClasses = {
  ok: "ok",
  warn: "warn",
  down: "down",
};

const defaultSpecialties = () => [
  { id: 1, name: "Cardiología", color: "#dc2626" },
  { id: 2, name: "Pediatría", color: "#16a34a" },
  { id: 3, name: "Neurología", color: "#7c3aed" },
  { id: 4, name: "Dermatología", color: "#f97316" },
];

export async function initializeAdminPanel() {
  loadUserFromStorage();
  const user = state.user;
  const normalizedRole = (user?.role || "").toString().trim().toLowerCase();

  if (!user || normalizedRole !== "admin") {
    const fallback =
      normalizedRole === "doctor"
        ? "doctor.html"
        : normalizedRole === "patient"
        ? "patient.html"
        : "login.html";
    window.location.replace(fallback);
    return;
  }

  bootstrapUserUi(user);
  bindNavigation();
  bindActions();
  hydrateDashboard();
}

function bootstrapUserUi(user) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Administrador";
  const email = user.email || "admin@cuidarmed.com";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  document.title = `Panel Administrativo • ${name}`;

  updateText(selectors.dashboardGreeting, `Hola ${name.split(" ")[0] || "Admin"}, todo está bajo control.`);
  updateText(selectors.userDisplayName, name);
  updateText(selectors.profileName, name);
  updateText(selectors.profileEmail, email);
  updateText(selectors.profilePhone, user.phone ?? "+54 11 0000-0000");
  updateText(selectors.profileLocation, user.location ?? "Oficina central");
  updateText(selectors.profileLastLogin, user.lastLogin ?? "Hace instantes");
  updateText(selectors.profileSessionId, user.sessionId ?? `SID-${Date.now().toString(36).toUpperCase()}`);
  setText(selectors.profileAvatar, initials);
  setText(selectors.userInitials, initials);
}

function bindNavigation() {
  const links = document.querySelectorAll(".sidebar-link");
  const sections = document.querySelectorAll(".content-view");

  links.forEach((link) => {
    link.addEventListener("click", () => {
      const target = link.dataset.section;
      links.forEach((item) => item.classList.toggle("active", item === link));
      sections.forEach((section) => {
        section.classList.toggle("hidden", section.dataset.section !== target);
      });
    });
  });
}

function bindActions() {
  const dropdown = $(selectors.userDropdown);
  const userBtn = $(selectors.userMenuBtn);
  const profileBtn = $(selectors.goToProfileBtn);
  const logoutBtn = $(selectors.logoutBtn);

  userBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    dropdown?.classList.toggle("open");
    if (dropdown) {
      dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
    }
  });

  document.addEventListener("click", (event) => {
    if (dropdown && !dropdown.contains(event.target) && !userBtn?.contains(event.target)) {
      dropdown.style.display = "none";
      dropdown.classList.remove("open");
    }
  });

  // Notificaciones dropdown
  const notificationsBtn = document.getElementById("openNotificationsBtn");
  const notificationsDropdown = document.getElementById("notificationsDropdown");
  const markAllReadBtn = document.getElementById("markAllReadBtn");

  notificationsBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    notificationsDropdown?.classList.toggle("hidden");
    renderNotifications();
  });

  markAllReadBtn?.addEventListener("click", () => {
    adminState.alerts.forEach((alert) => (alert.read = true));
    renderNotifications();
    updateNotificationsBadge();
  });

  document.addEventListener("click", (event) => {
    if (
      notificationsDropdown &&
      !notificationsDropdown.contains(event.target) &&
      !notificationsBtn?.contains(event.target)
    ) {
      notificationsDropdown.classList.add("hidden");
    }
  });

  profileBtn?.addEventListener("click", () => {
    document.querySelector('[data-section="profile"]')?.classList.remove("hidden");
    document.querySelectorAll(".sidebar-link").forEach((link) => {
      const isProfile = link.dataset.section === "profile";
      link.classList.toggle("active", isProfile);
    });
    document.querySelectorAll(".content-view").forEach((section) => {
      section.classList.toggle("hidden", section.dataset.section !== "profile");
    });
    dropdown?.classList.remove("open");
    if (dropdown) dropdown.style.display = "none";
  });

  logoutBtn?.addEventListener("click", () => {
    logout();
    window.location.replace("index.html");
  });

  $(selectors.refreshDataBtn)?.addEventListener("click", hydrateDashboard);
  $(selectors.clearActivityBtn)?.addEventListener("click", () => {
    adminState.activity = [];
    renderActivity();
  });
  $(selectors.runDiagnosticsBtn)?.addEventListener("click", runDiagnostics);
  $(selectors.exportAuditBtn)?.addEventListener("click", exportAudits);
  $(selectors.editProfileBtn)?.addEventListener("click", () => {
    alert("Próximamente podrás editar tu perfil desde aquí.");
  });
  $(selectors.resetSpecialtiesBtn)?.addEventListener("click", () => {
    adminState.specialties = defaultSpecialties();
    renderSpecialties();
    persistSpecialties();
    pushActivity("Catálogo clínico restaurado a sus valores por defecto.");
  });
  $(selectors.addSpecialtyForm)?.addEventListener("submit", handleSpecialtySubmit);
  $(selectors.usersTableBody)?.addEventListener("click", handleUserAction);

  const roleFilter = $(selectors.roleFilter);
  const searchInput = $(selectors.searchUsers);

  roleFilter?.addEventListener("change", renderUsers);
  searchInput?.addEventListener("input", renderUsers);
}

async function hydrateDashboard() {
  adminState.lastSync = new Date();
  
  // Primero obtener datos base que otras funciones necesitan
  adminState.services = await fetchServices();
  adminState.users = await fetchUsers();
  adminState.audits = await fetchAudits();
  adminState.specialties = await fetchSpecialties();
  
  // Luego calcular métricas y alertas que dependen de los datos anteriores
  adminState.metrics = await fetchMetrics();
  adminState.activity = await fetchActivity();
  adminState.alerts = await fetchAlerts();

  // Renderizar todo
  renderMetrics();
  renderActivity();
  renderAlerts();
  renderServices();
  renderUsers();
  renderAudits();
  renderSpecialties();
  updateText(selectors.lastSyncLabel, `Actualizado ${timeAgo(adminState.lastSync)}`);
}

async function fetchMetrics() {
  // Obtener usuarios activos reales
  let activeUsers = 0;
  try {
    const users = await fetchUsers();
    activeUsers = users.filter((u) => u.isActive !== false).length;
  } catch (error) {
    console.warn("No se pudieron obtener usuarios para métricas:", error);
  }

  // Obtener estado real de servicios
  const services = await fetchServices();
  const operationalServices = services.filter((s) => s.status === "ok").length;
  const totalServices = services.length;
  const servicesStatus =
    operationalServices === totalServices
      ? "Todos operativos"
      : `${operationalServices}/${totalServices} operativos`;

  // Contar eventos de auditoría (actividad reciente)
  const activity = await fetchActivity();
  const recentActivity = activity.filter((a) => {
    // Filtrar actividad de las últimas 24 horas
    const timeStr = a.time || "";
    if (timeStr.includes("min") || timeStr.includes("h")) {
      return true;
    }
    return false;
  }).length;

  return [
    {
      label: "Usuarios activos",
      value: activeUsers,
      trend: `Total: ${activeUsers}`,
      key: "usuarios",
    },
    {
      label: "Servicios monitoreados",
      value: totalServices,
      trend: servicesStatus,
      key: "servicios",
    },
    {
      label: "Eventos auditados",
      value: recentActivity,
      trend: "Últimas 24h",
      key: "auditorias",
    },
    {
      label: "Tickets abiertos",
      value: 0,
      trend: "Sistema de tickets pendiente",
      key: "tickets",
    },
  ];
}

async function fetchActivity() {
  // Usar actividad real almacenada en adminState
  // Si no hay actividad, agregar eventos iniciales basados en acciones reales
  if (adminState.activity.length === 0) {
    // Agregar actividad inicial basada en el estado actual
    const now = new Date();
    
    // Verificar si hay usuarios nuevos recientemente
    try {
      const users = await fetchUsers();
      if (users.length > 0) {
        const recentUsers = users.filter((u) => {
          // Asumir que usuarios creados recientemente (sin lastAccess muy antiguo)
          return !u.lastAccess || u.lastAccess.includes("hoy") || u.lastAccess.includes("min");
        });
        if (recentUsers.length > 0) {
          pushActivity(`${recentUsers.length} usuario(s) activo(s) en el sistema.`);
        }
      }
    } catch (error) {
      console.warn("No se pudo obtener actividad de usuarios:", error);
    }

    // Verificar estado de servicios
    const services = await fetchServices();
    const downServices = services.filter((s) => s.status === "down");
    if (downServices.length > 0) {
      pushActivity(`Advertencia: ${downServices.length} servicio(s) no disponible(s).`);
    } else {
      pushActivity("Todos los servicios están operativos.");
    }
  }

  // Retornar actividad real con timestamps formateados
  return adminState.activity.map((item) => {
    // Si el item ya tiene un timestamp, formatearlo
    if (item.timestamp) {
      const timeAgo = formatTimeAgo(new Date(item.timestamp));
      return { ...item, time: timeAgo };
    }
    // Si no tiene timestamp, usar el que ya tiene o "justo ahora"
    return item;
  });
}

function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "justo ahora";
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours} h`;
  if (diffDays < 7) return `hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;
  return `hace ${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) > 1 ? "s" : ""}`;
}

async function fetchAlerts() {
  const alerts = [];
  const services = await fetchServices();

  // Generar alertas basadas en el estado real de los servicios
  services.forEach((service) => {
    if (service.status === "down") {
      alerts.push({
        level: "danger",
        title: `${service.name} no está disponible`,
        meta: "Ahora",
        read: false,
      });
    } else if (service.status === "warn") {
      const latency = parseInt(service.latency) || 0;
      if (latency > 500) {
        alerts.push({
          level: "danger",
          title: `Latencia crítica en ${service.name}`,
          meta: `${service.latency}`,
          read: false,
        });
      } else {
        alerts.push({
          level: "warn",
          title: `Latencia elevada en ${service.name}`,
          meta: `${service.latency}`,
          read: false,
        });
      }
    }
  });

  // Verificar si hay usuarios bloqueados
  try {
    const users = await fetchUsers();
    const blockedUsers = users.filter((u) => !u.isActive);
    if (blockedUsers.length > 0) {
      alerts.push({
        level: "warn",
        title: `${blockedUsers.length} usuario(s) bloqueado(s)`,
        meta: "Revisar accesos",
        read: false,
      });
    }
  } catch (error) {
    // Silenciar error, no es crítico
  }

  // Si no hay alertas, agregar una de confirmación (esta no se marca como no leída)
  if (alerts.length === 0) {
    alerts.push({
      level: "ok",
      title: "Todos los sistemas operativos",
      meta: "Sin incidencias",
      read: true, // La alerta positiva se marca como leída por defecto
    });
  }

  return alerts;
}

async function fetchServices() {
  const services = [
    {
      name: "AuthMS",
      urls: ["http://127.0.0.1:8082/api/v1", "http://localhost:8082/api/v1"],
      description: "Autenticación y emisión de tokens.",
    },
    {
      name: "DirectoryMS",
      urls: ["http://127.0.0.1:8081/api", "http://localhost:8081/api"],
      description: "Información de usuarios y perfiles.",
    },
    {
      name: "ClinicalMS",
      urls: ["http://127.0.0.1:8084/api", "http://localhost:8084/api"],
      description: "Historias clínicas y documentación médica.",
    },
    {
      name: "SchedulingMS",
      urls: ["http://127.0.0.1:8083/api", "http://localhost:8083/api"],
      description: "Gestión de agendas y turnos.",
    },
  ];

  const results = await Promise.all(
    services.map(async (service) => {
      let status = "down";
      let latency = "N/A";
      let url = service.urls[0];

      // Intentar hacer ping a cada URL hasta encontrar una que responda
      for (const testUrl of service.urls) {
        try {
          const startTime = performance.now();
          const response = await fetch(`${testUrl}/health`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(5000), // Timeout de 5 segundos
          });
          const endTime = performance.now();
          const responseTime = Math.round(endTime - startTime);

          if (response.ok || response.status === 404) {
            // 404 también cuenta como "operativo" (el servicio responde, solo que no tiene /health)
            status = responseTime < 200 ? "ok" : "warn";
            latency = `${responseTime} ms`;
            url = testUrl;
            break;
          }
        } catch (error) {
          // Continuar con la siguiente URL
          continue;
        }
      }

      // Si ninguna URL respondió, intentar un endpoint genérico
      if (status === "down") {
        for (const testUrl of service.urls) {
          try {
            const startTime = performance.now();
            const response = await fetch(testUrl, {
              method: "GET",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(3000), // Timeout más corto para el segundo intento
            });
            const endTime = performance.now();
            const responseTime = Math.round(endTime - startTime);

            if (response.status < 500) {
              // Cualquier respuesta que no sea error del servidor cuenta como "operativo"
              status = responseTime < 200 ? "ok" : "warn";
              latency = `${responseTime} ms`;
              url = testUrl;
              break;
            }
          } catch (error) {
            // Continuar con la siguiente URL
            continue;
          }
        }
      }

      return {
        name: service.name,
        url: url,
        status: status,
        description: service.description,
        latency: latency,
      };
    })
  );

  return results;
}

async function fetchUsers() {
  try {
    // Debug: Verificar el token actual
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        console.log("🔍 Token payload:", payload);
        console.log("🔍 Rol en token:", payload.role || payload.Role || payload["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"]);
      } catch (e) {
        console.error("Error al decodificar token:", e);
      }
    }
    
    const data = await ApiAuth.get("User");
    if (!Array.isArray(data)) return [];
    return data.map(mapUserResponse);
  } catch (error) {
    console.error("❌ No se pudieron obtener usuarios reales:", error);
    pushActivity("No se pudo sincronizar el listado de usuarios. Verifica AuthMS.");
    return [];
  }
}

function mapUserResponse(user = {}) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  const role = user.role || "Sin rol";
  const isActive = user.isActive !== false && !isLockedOut(user.lockoutEndDate);

  return {
    id: user.userId,
    name: fullName || user.email || "Sin nombre",
    email: user.email || "-",
    role,
    roleFilter: role.toUpperCase(),
    lastAccess: formatLastAccess(user),
    state: isActive ? "Activo" : "Bloqueado",
    isActive,
  };
}

function isLockedOut(lockoutEndDate) {
  if (!lockoutEndDate) return false;
  const until = new Date(lockoutEndDate);
  return until.getTime() > Date.now();
}

function formatLastAccess(user) {
  if (user.lockoutEndDate) {
    const until = new Date(user.lockoutEndDate);
    return `Bloqueado hasta ${until.toLocaleString()}`;
  }
  return "—";
}

async function fetchAudits() {
  return [
    { action: "Actualizó permisos de usuario", actor: "Marta Ruiz", time: "08:05", detail: "Doctor #450" },
    { action: "Reinicio programado de AuthMS", actor: "Sistema", time: "07:50", detail: "Duración 2 min" },
    { action: "Inició sesión privilegiada", actor: "Leonardo Díaz", time: "07:32", detail: "Admin MFA" },
  ];
}

async function fetchSpecialties() {
  try {
    const { Api } = await import('../api.js');
    const specialties = await Api.get('v1/Specialty');
    
    if (Array.isArray(specialties) && specialties.length > 0) {
      // Mapear la respuesta de la API al formato esperado
      return specialties.map(s => ({
        id: s.specialtyId || s.SpecialtyId,
        name: s.name || s.Name,
        color: s.color || s.Color || '#2563eb'
      }));
    }
    
    // Si no hay especialidades en la BD, usar las por defecto
    const defaults = defaultSpecialties();
    // Guardar las por defecto en la BD
    for (const spec of defaults) {
      try {
        await Api.post('v1/Specialty', { name: spec.name, color: spec.color });
      } catch (e) {
        console.warn('No se pudo guardar especialidad por defecto:', e);
      }
    }
    return defaults;
  } catch (error) {
    console.error('Error al cargar especialidades desde la API:', error);
    // Fallback a localStorage si la API falla
    const stored = loadSpecialtiesFromStorage();
    if (stored?.length) return stored;
    const defaults = defaultSpecialties();
    persistSpecialties(defaults);
    return defaults;
  }
}

function renderMetrics() {
  const container = $(selectors.metricsGrid);
  if (!container) return;
  container.innerHTML = "";
  const template = document.getElementById("metricCardTemplate");

  adminState.metrics.forEach((metric) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".metric-icon i").className = metricIcons[metric.key] || "fas fa-chart-line";
    node.querySelector(".metric-label").textContent = metric.label;
    node.querySelector(".metric-value").textContent = metric.value;
    node.querySelector(".metric-trend").textContent = metric.trend;
    container.appendChild(node);
  });
}

function renderActivity() {
  const list = $(selectors.activityTimeline);
  if (!list) return;
  list.innerHTML = "";
  adminState.activity.forEach((item) => {
    const row = document.createElement("li");
    row.innerHTML = `
      <i class="fas fa-dot-circle"></i>
      <div>
        <p>${item.text}</p>
        <small>${item.time}</small>
      </div>`;
    list.appendChild(row);
  });
}

function renderAlerts() {
  const list = $(selectors.alertsList);
  const template = document.getElementById("alertItemTemplate");
  if (!list || !template) return;
  list.innerHTML = "";

  adminState.alerts.forEach((alert) => {
    // Asegurar que las alertas tengan la propiedad "read"
    if (alert.read === undefined) {
      alert.read = false;
    }
    
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".alert-icon").classList.add(alert.level || "warn");
    node.querySelector(".alert-title").textContent = alert.title;
    node.querySelector(".alert-meta").textContent = alert.meta;
    list.appendChild(node);
  });

  updateText(selectors.alertsCounter, adminState.alerts.length);
  updateNotificationsBadge();
  renderNotifications();
}

function renderNotifications() {
  const notificationsList = document.getElementById("notificationsList");
  if (!notificationsList) return;

  const unreadAlerts = adminState.alerts.filter((alert) => !alert.read);

  if (unreadAlerts.length === 0) {
    notificationsList.innerHTML = '<p class="no-notifications">No hay notificaciones nuevas</p>';
    return;
  }

  notificationsList.innerHTML = "";

  unreadAlerts.forEach((alert) => {
    const item = document.createElement("div");
    item.className = `notification-item unread ${alert.level || "warn"}`;
    item.innerHTML = `
      <div class="notification-item-title">${alert.title}</div>
      <div class="notification-item-meta">${alert.meta}</div>
    `;
    item.addEventListener("click", () => {
      alert.read = true;
      renderNotifications();
      updateNotificationsBadge();
    });
    notificationsList.appendChild(item);
  });
}

function updateNotificationsBadge() {
  const unreadCount = adminState.alerts.filter((alert) => !alert.read).length;
  updateText(selectors.alertsBadge, unreadCount);
  
  // Ocultar el badge si no hay notificaciones
  const badge = $(selectors.alertsBadge);
  if (badge) {
    badge.style.display = unreadCount > 0 ? "block" : "none";
  }
}

function renderServices() {
  const grid = $(selectors.servicesGrid);
  const template = document.getElementById("serviceCardTemplate");
  if (!grid || !template) return;
  grid.innerHTML = "";

  adminState.services.forEach((service) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = service.name;
    node.querySelector(".service-url").textContent = service.url;
    node.querySelector(".service-description").textContent = service.description;
    node.querySelector(".latency-label").textContent = `Latencia: ${service.latency}`;

    const status = node.querySelector(".status-pill");
    status.textContent = service.status === "ok" ? "Operativo" : service.status === "warn" ? "Inestable" : "Caído";
    status.classList.add(statusClasses[service.status] || statusClasses.warn);
    
    // Agregar event listener al botón "Ver logs"
    const logsBtn = node.querySelector(".ghost-btn");
    if (logsBtn) {
      logsBtn.addEventListener("click", () => showServiceLogs(service));
    }
    
    grid.appendChild(node);

    const sidebarCard = document.querySelector(`#status${service.name.replace("MS", "")}`);
    if (sidebarCard) {
      sidebarCard.classList.remove(...Object.values(statusClasses));
      sidebarCard.classList.add(statusClasses[service.status] || statusClasses.warn);
      sidebarCard.querySelector("span").textContent = status.textContent;
    }
  });
}

async function showServiceLogs(service) {
  const modal = document.getElementById("logsModal");
  const modalTitle = document.getElementById("logsModalTitle");
  const logsContent = document.getElementById("logsContent");
  const closeBtn = document.getElementById("closeLogsModal");

  if (!modal || !modalTitle || !logsContent) return;

  modalTitle.textContent = `Logs de ${service.name}`;
  logsContent.innerHTML = "<p>Cargando logs...</p>";
  modal.classList.remove("hidden");

  // Cerrar modal al hacer click en el botón X
  closeBtn?.addEventListener("click", () => {
    modal.classList.add("hidden");
  });

  // Cerrar modal al hacer click fuera del contenido
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.classList.add("hidden");
    }
  });

  // Intentar obtener logs del servicio
  try {
    let logs = `=== Información del servicio ===\n`;
    logs += `Nombre: ${service.name}\n`;
    logs += `URL: ${service.url}\n`;
    logs += `Estado: ${service.status === "ok" ? "Operativo" : service.status === "warn" ? "Inestable" : "Caído"}\n`;
    logs += `Latencia: ${service.latency}\n`;
    logs += `Descripción: ${service.description}\n\n`;

    logs += `=== Última verificación ===\n`;
    logs += `Fecha: ${new Date().toLocaleString("es-AR")}\n\n`;

    // Intentar obtener información adicional del servicio
    try {
      const startTime = performance.now();
      const response = await fetch(`${service.url}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(3000),
      });
      const endTime = performance.now();
      const responseTime = Math.round(endTime - startTime);

      logs += `=== Health Check ===\n`;
      logs += `Status: ${response.status} ${response.statusText}\n`;
      logs += `Tiempo de respuesta: ${responseTime} ms\n`;

      if (response.ok) {
        try {
          const data = await response.json();
          logs += `Respuesta: ${JSON.stringify(data, null, 2)}\n`;
        } catch (e) {
          logs += `Respuesta: (no JSON)\n`;
        }
      }
    } catch (error) {
      logs += `=== Health Check ===\n`;
      logs += `Error: No se pudo conectar al servicio\n`;
      logs += `Detalle: ${error.message}\n`;
    }

    logs += `\n=== Nota ===\n`;
    logs += `Los logs detallados del contenedor Docker se pueden obtener ejecutando:\n`;
    logs += `docker logs <nombre_del_contenedor>\n`;

    logsContent.textContent = logs;
  } catch (error) {
    logsContent.innerHTML = `<p style="color: var(--danger);">Error al cargar logs: ${error.message}</p>`;
  }
}

function renderUsers() {
  const tbody = $(selectors.usersTableBody);
  if (!tbody) return;
  const roleFilter = $(selectors.roleFilter)?.value || "ALL";
  const search = ($(selectors.searchUsers)?.value || "").toLowerCase();

  const filtered = adminState.users.filter((user) => {
    const matchesRole = roleFilter === "ALL" || user.roleFilter === roleFilter;
    const matchesSearch =
      user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search);
    return matchesRole && matchesSearch;
  });

  tbody.innerHTML = "";
  filtered.forEach((user) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td><span class="role-pill">${user.role}</span></td>
      <td>${user.lastAccess}</td>
      <td><span class="state-pill ${user.state === "Activo" ? "active" : "blocked"}">${user.state}</span></td>
      <td class="actions-cell">
        <button class="ghost-btn ${user.state === "Activo" ? "danger" : ""}" data-action="deactivate" data-email="${user.email}">
          ${user.state === "Activo" ? "Bloquear" : "Reactivar"}
        </button>
        <button class="ghost-btn" data-action="remove" data-email="${user.email}">Eliminar</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

function renderSpecialties() {
  const container = $(selectors.specialtiesList);
  if (!container) return;
  container.innerHTML = "";
  adminState.specialties.forEach((spec) => {
    const chip = document.createElement("div");
    chip.className = "specialty-chip";
    chip.style.borderColor = spec.color;
    chip.innerHTML = `
      <span class="color-dot" style="background:${spec.color};"></span>
      <span class="chip-name" style="color:${spec.color};">${spec.name}</span>
      <button title="Quitar" data-id="${spec.id}"><i class="fas fa-times"></i></button>
    `;
    chip.querySelector("button").addEventListener("click", () => removeSpecialty(spec.id));
    container.appendChild(chip);
  });
  updateText(selectors.specialtyCount, adminState.specialties.length);
  persistSpecialties();
}

function renderAudits() {
  const list = $(selectors.auditTimeline);
  if (!list) return;
  list.innerHTML = "";
  adminState.audits.forEach((audit) => {
    const row = document.createElement("li");
    row.innerHTML = `
      <i class="fas fa-clipboard-check"></i>
      <div>
        <p>${audit.action}</p>
        <small>${audit.actor} · ${audit.time} · ${audit.detail}</small>
      </div>`;
    list.appendChild(row);
  });
}

function runDiagnostics() {
  alert("Diagnóstico iniciado. Recibirás un reporte en tu correo.");
}

function exportAudits() {
  alert("Se exportará un CSV con los últimos 7 días de auditoría.");
}

async function handleSpecialtySubmit(event) {
  event.preventDefault();
  const name = $(selectors.specialtyName)?.value.trim();
  const color = $(selectors.specialtyColor)?.value || "#2563eb";

  if (!name) return;

  try {
    const { Api } = await import('../api.js');
    const response = await Api.post('v1/Specialty', { name, color });
    
    // Agregar a adminState con el ID de la respuesta
    adminState.specialties.push({
      id: response.specialtyId || response.SpecialtyId || Date.now(),
      name: response.name || response.Name || name,
      color: response.color || response.Color || color,
    });

    event.target.reset();
    renderSpecialties();
    pushActivity(`Se agregó la especialidad ${name}.`);
    
    // Disparar evento para actualizar otras pestañas
    persistSpecialties();
  } catch (error) {
    console.error('Error al crear especialidad:', error);
    alert('No se pudo crear la especialidad. Verifica que DirectoryMS esté corriendo.');
  }
}

async function removeSpecialty(id) {
  const spec = adminState.specialties.find((item) => item.id === id);
  if (!spec) return;

  try {
    const { Api } = await import('../api.js');
    await Api.delete(`v1/Specialty/${id}`);
    
    adminState.specialties = adminState.specialties.filter((item) => item.id !== id);
    renderSpecialties();
    pushActivity(`Se quitó la especialidad ${spec.name}.`);
    
    // Disparar evento para actualizar otras pestañas
    persistSpecialties();
  } catch (error) {
    console.error('Error al eliminar especialidad:', error);
    alert('No se pudo eliminar la especialidad. Verifica que DirectoryMS esté corriendo.');
  }
}

function handleUserAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const email = button.dataset.email;
  const user = adminState.users.find((item) => item.email === email);
  if (!user) return;

  if (action === "deactivate") {
    user.state = user.state === "Activo" ? "Bloqueado" : "Activo";
    pushActivity(`${user.name} pasó a estado ${user.state}.`);
  } else if (action === "remove") {
    adminState.users = adminState.users.filter((item) => item.email !== email);
    pushActivity(`${user.name} fue eliminado del sistema.`);
  }
  renderUsers();
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "hace unos segundos";
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} minutos`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} horas`;
  return `hace ${Math.floor(seconds / 86400)} días`;
}

function pushActivity(text) {
  const timestamp = new Date().toISOString();
  adminState.activity.unshift({ text, time: "justo ahora", timestamp });
  adminState.activity = adminState.activity.slice(0, 15);
  renderActivity();
}

function loadSpecialtiesFromStorage() {
  try {
    const raw = localStorage.getItem(SPECIALTIES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    console.warn("No se pudo leer specialties del storage:", error);
    return null;
  }
}

function persistSpecialties(forcedValue) {
  try {
    const value = forcedValue ?? adminState.specialties;
    localStorage.setItem(SPECIALTIES_STORAGE_KEY, JSON.stringify(value));
    // Disparar evento personalizado para que otras pestañas/ventanas se actualicen
    window.dispatchEvent(new CustomEvent('specialtiesUpdated'));
    console.log('✅ Especialidades guardadas y evento disparado');
  } catch (error) {
    console.warn("No se pudo guardar specialties en storage:", error);
  }
}

function updateText(selector, text) {
  const node = $(selector);
  if (node) node.textContent = text;
}

function setText(selector, text) {
  const node = $(selector);
  if (node) node.textContent = text;
}

function $(selector) {
  return document.querySelector(selector);
}

document.addEventListener("DOMContentLoaded", initializeAdminPanel);

