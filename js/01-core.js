const STORE_KEYS = {
    clientes: 'vet_pro_clientes',
    inventario: 'vet_pro_stock',
    agenda: 'vet_pro_agenda',
    finanzas: 'vet_pro_finanzas'
};
const $ = id => document.getElementById(id);
const $$ = selector => document.querySelectorAll(selector);
const renderIcons = () => window.lucide?.createIcons();
const uid = () => Date.now();
const setHidden = (id, hidden = true) => $(id)?.classList.toggle('hidden', hidden);
let usuarioActivo = null;
let realtimeChannel = null;
let syncTimer = null;
let guardandoRemoto = false;
let guardadoPendiente = false;
function loadStore(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (error) {
        console.warn(`Dato local inválido en ${key}. Se usará el valor inicial.`, error);
        return fallback;
    }
}
function estadoCompleto() {
    return { clientes, inventario, agenda, finanzas, movimientosInventario };
}
function aplicarEstado(data = {}) {
    clientes = data.clientes || [];
    inventario = data.inventario || [];
    agenda = data.agenda || [];
    finanzas = data.finanzas || [];
    movimientosInventario = data.movimientosInventario || [];
}
function actualizarEstadoSync(texto, error = false) {
    if (!$('sync-status')) return;
    $('sync-status').innerText = texto;
    $('sync-status').className = error ? 'text-red-300' : '';
}
function limpiarDatosLocalesAnteriores() {
    Object.values(STORE_KEYS).forEach(key => localStorage.removeItem(key));
}
async function guardarEstadoRemoto() {
    if (!usuarioActivo) return;
    if (guardandoRemoto) {
        guardadoPendiente = true;
        return;
    }
    guardandoRemoto = true;
    actualizarEstadoSync('Guardando...');
    let error = null;
    try {
        if (modoDatosRemotos === 'normalizado' && typeof guardarEstadoBaseNormalizada === 'function') {
            await guardarEstadoBaseNormalizada();
        } else {
            const resultado = await supabaseClient.from('app_state').upsert({
                user_id: usuarioActivo.id,
                data: estadoCompleto(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
            error = resultado.error;
        }
    } catch (err) {
        error = err;
    }
    guardandoRemoto = false;
    if (error) {
        console.error('No se pudo sincronizar con Supabase.', error);
        actualizarEstadoSync('Error de sincronización', true);
        return;
    }
    limpiarDatosLocalesAnteriores();
    actualizarEstadoSync('Sincronizado');
    if (guardadoPendiente) {
        guardadoPendiente = false;
        programarGuardadoRemoto();
    }
}
function programarGuardadoRemoto() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(guardarEstadoRemoto, 250);
}
function saveStore(nombre) {
    programarGuardadoRemoto();
}
function saveAllStores() {
    programarGuardadoRemoto();
}
function datosLocalesAnteriores() {
    return {
        clientes: loadStore(STORE_KEYS.clientes, []),
        inventario: loadStore(STORE_KEYS.inventario, []),
        agenda: loadStore(STORE_KEYS.agenda, []),
        finanzas: loadStore(STORE_KEYS.finanzas, []),
        movimientosInventario: []
    };
}
function tieneDatos(data) {
    return Object.values(data).some(lista => Array.isArray(lista) && lista.length);
}
function escucharCambiosRemotos() {
    if (!usuarioActivo) return;
    if (modoDatosRemotos === 'normalizado' && typeof escucharCambiosBaseNormalizada === 'function') {
        escucharCambiosBaseNormalizada();
        return;
    }
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = supabaseClient
        .channel(`app-state-${usuarioActivo.id}`)
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'app_state',
            filter: `user_id=eq.${usuarioActivo.id}`
        }, payload => {
            if (!payload.new?.data || guardandoRemoto) return;
            aplicarEstado(payload.new.data);
            if (typeof refrescarInterfaz === 'function') refrescarInterfaz();
            actualizarEstadoSync('Sincronizado');
        })
        .subscribe();
}
async function initRemoteStorage() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    usuarioActivo = session?.user || null;
    if (!usuarioActivo) {
        mostrarLogin();
        return false;
    }
    ocultarLogin();
    if ($('sync-user')) $('sync-user').innerText = usuarioActivo.email || '';
    actualizarEstadoSync('Cargando...');
    if (typeof cargarEstadoBaseNormalizada === 'function') {
        const normalizado = await cargarEstadoBaseNormalizada();
        if (normalizado.ok) {
            modoDatosRemotos = 'normalizado';
            if (tieneDatos(normalizado.estado)) {
                aplicarEstado(normalizado.estado);
            } else {
                const { data: estadoLegacy } = await supabaseClient
                    .from('app_state')
                    .select('data')
                    .eq('user_id', usuarioActivo.id)
                    .maybeSingle();
                if (estadoLegacy?.data) {
                    aplicarEstado(estadoLegacy.data);
                } else {
                    const anteriores = datosLocalesAnteriores();
                    if (tieneDatos(anteriores)) aplicarEstado(anteriores);
                }
                await guardarEstadoRemoto();
            }
            escucharCambiosRemotos();
            actualizarEstadoSync('Sincronizado');
            return true;
        }
        console.warn('Base normalizada no disponible. Se usará app_state temporalmente.', normalizado.error);
        modoDatosRemotos = 'app_state';
    }
    const { data, error } = await supabaseClient
        .from('app_state')
        .select('data')
        .eq('user_id', usuarioActivo.id)
        .maybeSingle();
    if (error) {
        console.error('No se pudo cargar app_state.', error);
        actualizarEstadoSync('Error de conexión', true);
        alert("No se pudieron cargar tus datos desde Supabase. Revisa las políticas RLS de app_state.");
        return false;
    }
    if (data?.data) {
        aplicarEstado(data.data);
    } else {
        const anteriores = datosLocalesAnteriores();
        if (tieneDatos(anteriores)) aplicarEstado(anteriores);
        await guardarEstadoRemoto();
    }
    escucharCambiosRemotos();
    actualizarEstadoSync('Sincronizado');
    return true;
}
function mostrarLogin(mensaje = '') {
    $('login-overlay')?.classList.remove('hidden');
    if ($('login-error')) {
        $('login-error').innerText = mensaje;
        $('login-error').classList.toggle('hidden', !mensaje);
    }
    renderIcons();
}
function ocultarLogin() {
    $('login-overlay')?.classList.add('hidden');
}
async function iniciarSesion(event) {
    event.preventDefault();
    const boton = $('btn-login');
    if (boton) {
        boton.disabled = true;
        boton.innerText = 'Ingresando...';
    }
    try {
        const { error } = await supabaseClient.auth.signInWithPassword({
            email: $('login-email').value.trim(),
            password: $('login-password').value
        });
        if (error) {
            const mensajes = {
                'Invalid login credentials': 'Correo o contraseña incorrectos.',
                'Email not confirmed': 'Tu correo todavía no está confirmado en Supabase Auth.',
                'User not found': 'No existe un usuario de Auth con ese correo.'
            };
            mostrarLogin(mensajes[error.message] || `No se pudo iniciar sesión: ${error.message}`);
            console.error('Error de inicio de sesión.', error);
            return;
        }
        location.reload();
    } catch (error) {
        mostrarLogin('No se pudo conectar con Supabase. Revisa tu conexión y vuelve a intentar.');
        console.error('No se pudo conectar con Supabase Auth.', error);
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.innerText = 'Ingresar';
        }
    }
}
async function cerrarSesion() {
    await supabaseClient.auth.signOut();
    location.reload();
}
function resetFormState(config) {
    if ($(config.editId)) $(config.editId).value = '';
    $(config.formId)?.reset();
    if ($(config.titleId)) $(config.titleId).innerHTML = config.titleDefault;
    const submit = document.querySelector(config.submitSelector);
    if (submit) submit.innerText = config.submitDefault;
    renderIcons();
}
let clientes = loadStore(STORE_KEYS.clientes, []);
let inventario = loadStore(STORE_KEYS.inventario, [
    { id: 1, name: 'Antibiótico Enrofloxacina 5%', stock: 15, unit: 'Frascos' }
]);
let agenda = loadStore(STORE_KEYS.agenda, []);
let finanzas = loadStore(STORE_KEYS.finanzas, [
    { id: 1, nombre: 'Consulta Inicial a Domicilio', precio: 500 },
    { id: 2, nombre: 'Consulta Seguimiento a Domicilio', precio: 350 },
    { id: 3, nombre: 'Aplicación de Vacuna', precio: 450 }
]);
let movimientosInventario = [];
let consultaSeleccionada = { ownerId: null, petId: null, ownerObj: null, petObj: null };
let clienteActivoSubpaginaId = null;
let firmaDuenoEstablecida = false;
let firmaVetEstablecida = false;
function exportarAICloud() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ clientes, inventario, agenda, finanzas }));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `VetHomePro_iCloudBackup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}
function importarDesdeICloud(event) {
    const file = event.target.files[0];
    if (!file) return;
    const lector = new FileReader();
    lector.onload = function(e) {
        try {
            const importado = JSON.parse(e.target.result);
            if (importado.clientes || importado.inventario) {
                clientes = importado.clientes || clientes;
                inventario = importado.inventario || inventario;
                agenda = importado.agenda || agenda;
                finanzas = importado.finanzas || finanzas;
                saveAllStores();
                alert("¡Sincronización iCloud completada exitosamente!");
                location.reload();
            }
        } catch (err) { alert("Error al leer el archivo de respaldo."); }
    };
    lector.readAsText(file);
}
function switchTab(tabId) {
    ['dashboard', 'clientes', 'agenda', 'nueva-consulta', 'inventario', 'finanzas'].forEach(id => {
        $(`view-${id}`)?.classList.add('hidden');
        $(`nav-${id}`)?.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold');
        $(`nav-${id}`)?.classList.add('text-blue-100', 'font-medium');
        $(`nav-mobile-${id}`)?.classList.remove('text-amber-300');
        $(`nav-mobile-${id}`)?.classList.add('text-blue-200');
    });
    $(`view-${tabId}`)?.classList.remove('hidden');
    $(`nav-${tabId}`)?.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');
    $(`nav-mobile-${tabId}`)?.classList.add('text-amber-300');
    $(`nav-mobile-${tabId}`)?.classList.remove('text-blue-200');
    const titles = { 'dashboard': 'Inicio', 'clientes': 'Clientes y Mascotas', 'agenda': 'Agenda de Visitas', 'nueva-consulta': 'Nueva Consulta y Responsiva', 'inventario': 'Control de Stock', 'finanzas': 'Finanzas y Servicios' };
    if ($('page-title')) {
        $('page-title').innerText = titles[tabId];
    }
    if (tabId === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
    if (tabId === 'finanzas') renderFinanzas();
    if (tabId === 'inventario') renderInventario();
}
function abrirModalResponsivaFlotante() {
    if (!consultaSeleccionada.petId) {
        alert("Por favor, seleccione primero un paciente en la lista de clientes.");
        return;
    }
    $('modal-responsiva').classList.remove('hidden');
    setTimeout(() => {
        if (typeof ajustarDimensionesLienzo === "function") {
            ajustarDimensionesLienzo('canvas-firma');
            ajustarDimensionesLienzo('canvas-firma-vet');
        }
    }, 150);
}
function cerrarModalResponsivaFlotante() {
    $('modal-responsiva').classList.add('hidden');
    actualizarIndicadorFirmaStatus();
}
function actualizarIndicadorFirmaStatus() {
    const indicator = $('badge-firma-status');
    if (!indicator) return;
    if (firmaDuenoEstablecida && firmaVetEstablecida) {
        indicator.innerText = "Responsiva Firmada";
        indicator.className = "text-xs bg-teal-100 text-teal-800 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider";
    } else {
        indicator.innerText = "Falta Firma Responsiva";
        indicator.className = "text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider";
    }
}
