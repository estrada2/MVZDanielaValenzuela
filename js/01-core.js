// Core de la app: estado global, persistencia local, Supabase, modo offline y navegación.
// La app guarda primero en localStorage y luego intenta sincronizar con Supabase.
const STORE_KEYS = {
    clientes: 'vet_pro_clientes',
    inventario: 'vet_pro_stock',
    agenda: 'vet_pro_agenda',
    finanzas: 'vet_pro_finanzas',
    serviciosExternos: 'vet_pro_servicios_externos',
    clinicasExternas: 'vet_pro_clinicas_externas',
    gastosFinancieros: 'vet_pro_gastos_financieros',
    auditLogs: 'vet_pro_audit_logs'
};
const $ = id => document.getElementById(id);
const $$ = selector => document.querySelectorAll(selector);
const renderIcons = () => window.lucide?.createIcons();
const uid = () => Date.now();
const setHidden = (id, hidden = true) => $(id)?.classList.toggle('hidden', hidden);
let usuarioActivo = null;
let workspaceActivoId = null;
let workspaceActivoNombre = 'Workspace personal';
let workspaceSoportado = false;
let realtimeChannel = null;
let syncTimer = null;
let remotePollingTimer = null;
let guardandoRemoto = false;
let guardadoPendiente = false;
let sincronizacionParcialPendiente = false;
let edicionLocalActivaHasta = 0;
const STORAGE_BUCKET = 'vet-files';
const OFFLINE_PENDING_KEY = 'vet_pro_sync_pendiente';
const estaOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
function loadStore(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (error) {
        console.warn(`Dato local inválido en ${key}. Se usará el valor inicial.`, error);
        return fallback;
    }
}
function guardarStoreLocal(nombre) {
    if (!STORE_KEYS[nombre]) return;
    const data = {
        clientes,
        inventario,
        agenda,
        finanzas,
        movimientosInventario,
        serviciosExternos,
        clinicasExternas,
        gastosFinancieros,
        auditLogs
    };
    try {
        localStorage.setItem(STORE_KEYS[nombre], JSON.stringify(data[nombre] || []));
    } catch (error) {
        console.warn(`No se pudo guardar copia local de ${nombre}.`, error);
    }
}
function guardarStoresLocales() {
    Object.keys(STORE_KEYS).forEach(guardarStoreLocal);
}
function marcarCambiosPendientesOffline(pendiente = true) {
    try {
        if (pendiente) localStorage.setItem(OFFLINE_PENDING_KEY, '1');
        else localStorage.removeItem(OFFLINE_PENDING_KEY);
    } catch (error) {
        console.warn('No se pudo actualizar estado offline.', error);
    }
}
function hayCambiosPendientesOffline() {
    try {
        return localStorage.getItem(OFFLINE_PENDING_KEY) === '1';
    } catch {
        return false;
    }
}
function combinarPorId(remoto = [], local = []) {
    const mapa = new Map();
    (remoto || []).forEach(item => mapa.set(item.id, item));
    (local || []).forEach(item => {
        if (!mapa.has(item.id)) mapa.set(item.id, item);
    });
    return Array.from(mapa.values());
}
// Mantiene registros creados offline cuando Supabase todavía no los devuelve.
function combinarAgendaExternaLocal(remoto = [], local = []) {
    const mapa = new Map();
    (remoto || []).forEach(item => mapa.set(item.id, item));
    (local || []).forEach(item => {
        const esExterno = (item?.origen || '') === 'Servicio externo' || item?.clinicaId;
        if (esExterno && !mapa.has(item.id)) mapa.set(item.id, item);
    });
    return Array.from(mapa.values());
}
function estadoCompleto() {
    return { clientes, inventario, agenda, finanzas, movimientosInventario, serviciosExternos, clinicasExternas, gastosFinancieros, auditLogs };
}
function aplicarEstado(data = {}) {
    const locales = datosLocalesAnteriores();
    clientes = data.clientes || [];
    inventario = data.inventario || [];
    agenda = combinarAgendaExternaLocal(data.agenda || [], locales.agenda || []);
    finanzas = data.finanzas || [];
    movimientosInventario = data.movimientosInventario || [];
    serviciosExternos = combinarPorId(data.serviciosExternos || [], locales.serviciosExternos || []);
    clinicasExternas = combinarPorId(data.clinicasExternas || [], locales.clinicasExternas || []);
    gastosFinancieros = data.gastosFinancieros || [];
    auditLogs = data.auditLogs || [];
}
function actualizarEstadoSync(texto, error = false) {
    if (!$('sync-status')) return;
    $('sync-status').innerText = texto;
    $('sync-status').className = error ? 'text-red-300' : '';
}
function cargarModoOffline(mensaje = 'Sin conexión. Usando copia local.') {
    const locales = datosLocalesAnteriores();
    if (!tieneDatos(locales)) return false;
    aplicarEstado(locales);
    ocultarLogin();
    usuarioActivo = usuarioActivo || { id: 'offline', email: 'Modo offline' };
    if ($('sync-user')) $('sync-user').innerText = 'Modo offline';
    actualizarEstadoSync(mensaje, true);
    return true;
}
// Protege formularios activos: evita pisar lo que el usuario está escribiendo con datos remotos.
function aplicarEstadoRemoto(estado, detalle = 'Se recibieron cambios de otro dispositivo.') {
    if (debePausarAplicacionRemota()) {
        actualizarEstadoSync('Edición local activa');
        return;
    }
    const agendaFormSnapshot = typeof capturarFormularioAgendaActivo === 'function' ? capturarFormularioAgendaActivo() : null;
    aplicarEstado(estado);
    if (typeof refrescarInterfaz === 'function') refrescarInterfaz();
    if (typeof restaurarFormularioAgendaActivo === 'function') restaurarFormularioAgendaActivo(agendaFormSnapshot);
    actualizarEstadoSync('Sincronizado');
}
function mostrarBannerActualizacion() {
    $('update-banner')?.classList.remove('hidden');
    renderIcons();
}
function debePausarAplicacionRemota() {
    if (Date.now() < edicionLocalActivaHasta) return true;
    const activo = document.activeElement;
    if (!activo || activo === document.body) return false;
    const tag = activo.tagName;
    const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || activo.isContentEditable;
    if (!editable) return false;
    const form = activo.closest('form');
    if (!form) return false;
    return Boolean(form.id);
}
function marcarEdicionLocalActiva(event) {
    const target = event.target;
    if (!target?.closest?.('form')) return;
    if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) && !target.isContentEditable) return;
    edicionLocalActivaHasta = Date.now() + 120000;
}
document.addEventListener('input', marcarEdicionLocalActiva, true);
document.addEventListener('change', marcarEdicionLocalActiva, true);
document.addEventListener('focusin', marcarEdicionLocalActiva, true);
window.addEventListener('vethome-update-ready', mostrarBannerActualizacion);
window.addEventListener('offline', () => {
    marcarCambiosPendientesOffline(true);
    actualizarEstadoSync('Offline · cambios pendientes', true);
});
window.addEventListener('online', () => {
    actualizarEstadoSync('Conectando...');
    sincronizarCambiosPendientesOnline();
});
function limpiarDatosLocalesAnteriores() {
    Object.values(STORE_KEYS).forEach(key => localStorage.removeItem(key));
}
function scopeRemoto() {
    const scope = { user_id: usuarioActivo?.id };
    if (workspaceSoportado && workspaceActivoId) scope.workspace_id = workspaceActivoId;
    return scope;
}
function aplicarFiltroScope(query) {
    if (workspaceSoportado && workspaceActivoId) return query.eq('workspace_id', workspaceActivoId);
    return query.eq('user_id', usuarioActivo.id);
}
function filtroRealtimeScope() {
    if (workspaceSoportado && workspaceActivoId) return `workspace_id=eq.${workspaceActivoId}`;
    return `user_id=eq.${usuarioActivo.id}`;
}
async function cargarWorkspaceActivo() {
    workspaceSoportado = false;
    workspaceActivoId = null;
    workspaceActivoNombre = 'Workspace personal';
    try {
        let { data, error } = await supabaseClient
            .from('app_workspace_members')
            .select('workspace_id, role')
            .eq('user_id', usuarioActivo.id)
            .order('created_at', { ascending: true })
            .limit(1);
        if (error) throw error;
        if (!data?.length) {
            const rpc = await supabaseClient.rpc('ensure_personal_workspace');
            if (rpc.error) throw rpc.error;
            ({ data, error } = await supabaseClient
                .from('app_workspace_members')
                .select('workspace_id, role')
                .eq('user_id', usuarioActivo.id)
                .order('created_at', { ascending: true })
                .limit(1));
            if (error) throw error;
        }
        const membership = data?.[0];
        if (!membership?.workspace_id) return;
        workspaceSoportado = true;
        workspaceActivoId = membership.workspace_id;
        const workspace = await supabaseClient
            .from('app_workspaces')
            .select('nombre')
            .eq('id', workspaceActivoId)
            .maybeSingle();
        workspaceActivoNombre = workspace.data?.nombre || 'VetHome';
        if ($('sync-workspace')) $('sync-workspace').innerText = workspaceActivoNombre;
    } catch (error) {
        console.warn('Workspace multiusuario no disponible. Se usará el modo por usuario.', error);
        if ($('sync-workspace')) $('sync-workspace').innerText = 'Datos por usuario';
    }
}
function dataUrlToBlob(dataUrl) {
    const [metadata, base64] = String(dataUrl || '').split(',');
    const mime = metadata?.match(/data:(.*?);base64/)?.[1] || 'image/jpeg';
    const binary = atob(base64 || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
}
function extensionDesdeMime(mime) {
    if (mime?.includes('pdf')) return 'pdf';
    if (mime?.includes('png')) return 'png';
    if (mime?.includes('webp')) return 'webp';
    return 'jpg';
}
function extensionDesdeArchivo(file) {
    const nombre = file?.name || '';
    const extensionNombre = nombre.includes('.') ? nombre.split('.').pop().toLowerCase() : '';
    if (extensionNombre) return extensionNombre;
    return extensionDesdeMime(file?.type || '');
}
function archivoToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target?.result || '');
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}
async function subirImagenDataUrl(dataUrl, carpeta, nombreBase) {
    if (!usuarioActivo || !dataUrl || !String(dataUrl).startsWith('data:image/')) return dataUrl || '';
    try {
        const blob = dataUrlToBlob(dataUrl);
        const extension = extensionDesdeMime(blob.type);
        const path = `${usuarioActivo.id}/${carpeta}/${nombreBase}-${Date.now()}.${extension}`;
        const { error } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(path, blob, { contentType: blob.type, upsert: true });
        if (error) throw error;
        const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        return data?.publicUrl || dataUrl;
    } catch (error) {
        console.warn('No se pudo subir imagen a Storage. Se conservará en base64.', error);
        return dataUrl;
    }
}
async function subirArchivoStorage(file, carpeta, nombreBase) {
    if (!file) return '';
    if (!usuarioActivo) return archivoToDataUrl(file);
    try {
        const extension = extensionDesdeArchivo(file);
        const path = `${usuarioActivo.id}/${carpeta}/${nombreBase}-${Date.now()}.${extension}`;
        const { error } = await supabaseClient.storage
            .from(STORAGE_BUCKET)
            .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: true });
        if (error) throw error;
        const { data } = supabaseClient.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        return data?.publicUrl || archivoToDataUrl(file);
    } catch (error) {
        console.warn('No se pudo subir archivo a Storage. Se conservará en base64.', error);
        return archivoToDataUrl(file);
    }
}
async function guardarEstadoRemoto() {
    if (!usuarioActivo) return;
    if (estaOffline()) {
        marcarCambiosPendientesOffline(true);
        actualizarEstadoSync('Offline · cambios pendientes', true);
        return;
    }
    if (usuarioActivo.id === 'offline') {
        marcarCambiosPendientesOffline(true);
        actualizarEstadoSync('Pendiente de iniciar sesión', true);
        return;
    }
    if (guardandoRemoto) {
        guardadoPendiente = true;
        return;
    }
    guardandoRemoto = true;
    sincronizacionParcialPendiente = false;
    actualizarEstadoSync('Guardando...');
    let error = null;
    try {
        if (modoDatosRemotos === 'normalizado' && typeof guardarEstadoBaseNormalizada === 'function') {
            await guardarEstadoBaseNormalizada();
        } else {
            const resultado = await supabaseClient.from('app_state').upsert({
                ...scopeRemoto(),
                data: estadoCompleto(),
                updated_at: new Date().toISOString()
            }, { onConflict: workspaceSoportado && workspaceActivoId ? 'workspace_id' : 'user_id' });
            error = resultado.error;
        }
    } catch (err) {
        error = err;
    }
    guardandoRemoto = false;
    if (error) {
        console.error('No se pudo sincronizar con Supabase.', error);
        marcarCambiosPendientesOffline(true);
        actualizarEstadoSync('Error de sincronización', true);
        return;
    }
    if (sincronizacionParcialPendiente) {
        guardarStoresLocales();
        marcarCambiosPendientesOffline(true);
        actualizarEstadoSync('Sincronizado parcial');
    } else {
        limpiarDatosLocalesAnteriores();
        marcarCambiosPendientesOffline(false);
        actualizarEstadoSync('Sincronizado');
    }
    if (guardadoPendiente) {
        guardadoPendiente = false;
        programarGuardadoRemoto();
    }
}
function registrarAuditoria(tabla, accion, resumen, registroId = '') {
    const item = {
        id: uid(),
        fechaISO: new Date().toISOString(),
        usuario: usuarioActivo?.email || 'Usuario local',
        tabla,
        accion,
        resumen,
        registroId
    };
    auditLogs = [item, ...(auditLogs || [])].slice(0, 500);
    try {
        if (usuarioActivo && workspaceSoportado && workspaceActivoId) {
            supabaseClient.from('audit_logs').insert({
                ...scopeRemoto(),
                tabla,
                accion,
                registro_id: String(registroId || ''),
                resumen
            }).then(resultado => {
                if (resultado.error) console.warn('Auditoria remota no disponible.', resultado.error);
            });
        }
    } catch (error) {
        console.warn('No se pudo registrar auditoria remota.', error);
    }
}
function programarGuardadoRemoto() {
    clearTimeout(syncTimer);
    marcarCambiosPendientesOffline(true);
    if (estaOffline()) {
        actualizarEstadoSync('Offline · cambios pendientes', true);
        return;
    }
    syncTimer = setTimeout(guardarEstadoRemoto, 250);
}
function saveStore(nombre) {
    guardarStoreLocal(nombre);
    programarGuardadoRemoto();
}
function saveAllStores() {
    guardarStoresLocales();
    programarGuardadoRemoto();
}
function datosLocalesAnteriores() {
    return {
        clientes: loadStore(STORE_KEYS.clientes, []),
        inventario: loadStore(STORE_KEYS.inventario, []),
        agenda: loadStore(STORE_KEYS.agenda, []),
        finanzas: loadStore(STORE_KEYS.finanzas, []),
        movimientosInventario: [],
        serviciosExternos: loadStore(STORE_KEYS.serviciosExternos, []),
        clinicasExternas: loadStore(STORE_KEYS.clinicasExternas, []),
        gastosFinancieros: loadStore(STORE_KEYS.gastosFinancieros, []),
        auditLogs: loadStore(STORE_KEYS.auditLogs, [])
    };
}
function tieneDatos(data) {
    return Object.values(data).some(lista => Array.isArray(lista) && lista.length);
}
async function refrescarEstadoDesdeRemotoSilencioso() {
    if (estaOffline()) return;
    if (!usuarioActivo || guardandoRemoto || document.visibilityState === 'hidden') return;
    if (debePausarAplicacionRemota()) return;
    try {
        let estadoRemoto = null;
        if (modoDatosRemotos === 'normalizado' && typeof cargarEstadoBaseNormalizada === 'function') {
            const remoto = await cargarEstadoBaseNormalizada();
            if (!remoto.ok) throw remoto.error;
            estadoRemoto = remoto.estado;
        } else {
            let query = supabaseClient
                .from('app_state')
                .select('data');
            const { data, error } = await aplicarFiltroScope(query).maybeSingle();
            if (error) throw error;
            estadoRemoto = data?.data || null;
        }
        if (!estadoRemoto) return;
        aplicarEstadoRemoto(estadoRemoto, 'Se refrescó la información más reciente de Supabase.');
    } catch (error) {
        console.warn('No se pudo refrescar estado remoto en segundo plano.', error);
    }
}
async function sincronizarCambiosPendientesOnline() {
    if (estaOffline()) return;
    try {
        if (!usuarioActivo || usuarioActivo.id === 'offline') {
            const { data: { session } } = await supabaseClient.auth.getSession();
            usuarioActivo = session?.user || null;
            if (!usuarioActivo) {
                actualizarEstadoSync('Online · inicia sesión para sincronizar', true);
                return;
            }
            if ($('sync-user')) $('sync-user').innerText = usuarioActivo.email || '';
            await cargarWorkspaceActivo();
        }
        if (hayCambiosPendientesOffline()) {
            guardarStoresLocales();
            await guardarEstadoRemoto();
        } else {
            await refrescarEstadoDesdeRemotoSilencioso();
        }
        escucharCambiosRemotos();
        iniciarRefrescoRemotoAutomatico();
    } catch (error) {
        console.warn('No se pudo sincronizar al volver online.', error);
        actualizarEstadoSync('Pendiente de sincronizar', true);
    }
}
function iniciarRefrescoRemotoAutomatico() {
    clearInterval(remotePollingTimer);
    remotePollingTimer = setInterval(refrescarEstadoDesdeRemotoSilencioso, 60000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !debePausarAplicacionRemota()) refrescarEstadoDesdeRemotoSilencioso();
    });
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
            filter: filtroRealtimeScope()
        }, payload => {
            if (!payload.new?.data || guardandoRemoto) return;
            if (debePausarAplicacionRemota()) return;
            aplicarEstadoRemoto(payload.new.data);
        })
        .subscribe();
}
async function initRemoteStorage() {
    if (estaOffline() && cargarModoOffline('Offline · usando copia local')) return true;
    let session = null;
    try {
        const resultadoSesion = await supabaseClient.auth.getSession();
        session = resultadoSesion.data?.session || null;
    } catch (error) {
        console.warn('No se pudo obtener sesión. Intentando modo offline.', error);
        if (cargarModoOffline('Sin conexión · usando copia local')) return true;
        mostrarLogin('No se pudo conectar y no hay copia local disponible.');
        return false;
    }
    usuarioActivo = session?.user || null;
    if (!usuarioActivo) {
        mostrarLogin();
        return false;
    }
    ocultarLogin();
    if ($('sync-user')) $('sync-user').innerText = usuarioActivo.email || '';
    try {
        await cargarWorkspaceActivo();
    } catch (error) {
        console.warn('No se pudo cargar workspace. Intentando modo offline.', error);
        if (cargarModoOffline('Sin conexión · usando copia local')) return true;
        mostrarLogin('No se pudo cargar el workspace y no hay copia local disponible.');
        return false;
    }
    actualizarEstadoSync('Cargando...');
    if (typeof cargarEstadoBaseNormalizada === 'function') {
        const normalizado = await cargarEstadoBaseNormalizada();
        if (normalizado.ok) {
            modoDatosRemotos = 'normalizado';
            if (tieneDatos(normalizado.estado)) {
                aplicarEstado(normalizado.estado);
            } else {
                let legacyQuery = supabaseClient
                    .from('app_state')
                    .select('data')
                const { data: estadoLegacy } = await aplicarFiltroScope(legacyQuery).maybeSingle();
                if (estadoLegacy?.data) {
                    aplicarEstado(estadoLegacy.data);
                } else {
                    const anteriores = datosLocalesAnteriores();
                    if (tieneDatos(anteriores)) aplicarEstado(anteriores);
                }
                await guardarEstadoRemoto();
            }
            escucharCambiosRemotos();
            iniciarRefrescoRemotoAutomatico();
            actualizarEstadoSync('Sincronizado');
            return true;
        }
        console.warn('Base normalizada no disponible. Se usará app_state temporalmente.', normalizado.error);
        modoDatosRemotos = 'app_state';
    }
    let query = supabaseClient
        .from('app_state')
        .select('data');
    const { data, error } = await aplicarFiltroScope(query).maybeSingle();
    if (error) {
        console.error('No se pudo cargar app_state.', error);
        if (cargarModoOffline('Sin conexión · usando copia local')) return true;
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
    iniciarRefrescoRemotoAutomatico();
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
let serviciosExternos = loadStore(STORE_KEYS.serviciosExternos, []);
let clinicasExternas = loadStore(STORE_KEYS.clinicasExternas, []);
let gastosFinancieros = loadStore(STORE_KEYS.gastosFinancieros, []);
let auditLogs = loadStore(STORE_KEYS.auditLogs, []);
let consultaSeleccionada = { ownerId: null, petId: null, ownerObj: null, petObj: null };
let clienteActivoSubpaginaId = null;
let firmaDuenoEstablecida = false;
let firmaVetEstablecida = false;
function exportarAICloud() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ clientes, inventario, agenda, finanzas, serviciosExternos, clinicasExternas, gastosFinancieros }));
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
                serviciosExternos = importado.serviciosExternos || serviciosExternos;
                clinicasExternas = importado.clinicasExternas || clinicasExternas;
                gastosFinancieros = importado.gastosFinancieros || gastosFinancieros;
                saveAllStores();
                alert("¡Sincronización iCloud completada exitosamente!");
                location.reload();
            }
        } catch (err) { alert("Error al leer el archivo de respaldo."); }
    };
    lector.readAsText(file);
}
function switchTab(tabId) {
    ['dashboard', 'clientes', 'agenda', 'servicios-externos', 'nueva-consulta', 'inventario', 'finanzas'].forEach(id => {
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
    const titles = { 'dashboard': 'Inicio', 'clientes': 'Clientes y Mascotas', 'agenda': 'Agenda de Visitas', 'servicios-externos': 'Servicios Externos', 'nueva-consulta': 'Nueva Consulta y Responsiva', 'inventario': 'Control de Stock', 'finanzas': 'Finanzas y Servicios' };
    if ($('page-title')) {
        $('page-title').innerText = titles[tabId];
    }
    if (tabId === 'dashboard' && typeof renderDashboard === 'function') renderDashboard();
    if (tabId === 'agenda' && typeof renderHorariosRecomendados === 'function') renderHorariosRecomendados();
    if (tabId === 'finanzas') renderFinanzas();
    if (tabId === 'servicios-externos' && typeof renderServiciosExternos === 'function') renderServiciosExternos();
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
