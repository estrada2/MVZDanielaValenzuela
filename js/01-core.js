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
const uid = () => Math.floor((Date.now() * 1000) + Math.random() * 1000);
const setHidden = (id, hidden = true) => $(id)?.classList.toggle('hidden', hidden);
let usuarioActivo = null;
let workspaceActivoId = null;
let workspaceActivoNombre = 'Workspace personal';
let workspaceSoportado = false;
let realtimeChannel = null;
let syncTimer = null;
let remotePollingTimer = null;
let ultimoRefrescoRemotoAt = 0;
let refrescoRemotoEnCurso = false;
let visibilitySyncRegistrado = false;
let guardandoRemoto = false;
let guardadoPendiente = false;
let sincronizacionParcialPendiente = false;
let ultimoCodigoSyncParcial = '';
let edicionLocalActivaHasta = 0;
const STORAGE_BUCKET = 'vet-files';
const OFFLINE_PENDING_KEY = 'vet_pro_sync_pendiente';
const PENDING_STORES_KEY = 'vet_pro_sync_stores';
const PENDING_RECORDS_KEY = 'vet_pro_sync_records';
const LOCAL_ACTIVE_USER_KEY = 'vet_pro_usuario_activo';
const DEVICE_ID_KEY = 'vet_pro_device_id';
const DELETE_QUEUE_KEY = 'vet_pro_delete_queue';
const estaOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;
function obtenerDeviceId() {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
        id = globalThis.crypto?.randomUUID?.() || `device-${uid()}`;
        localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
}
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
function obtenerStoresPendientes() {
    try {
        const lista = JSON.parse(localStorage.getItem(PENDING_STORES_KEY) || '[]');
        return new Set(Array.isArray(lista) ? lista.filter(nombre => STORE_KEYS[nombre]) : []);
    } catch {
        return new Set();
    }
}
function obtenerRegistrosPendientes() {
    try {
        const data = JSON.parse(localStorage.getItem(PENDING_RECORDS_KEY) || '{}');
        return data && typeof data === 'object' ? data : {};
    } catch {
        return {};
    }
}
function datosStoreActual(nombre) {
    return {
        clientes,
        inventario,
        agenda,
        finanzas,
        serviciosExternos,
        clinicasExternas,
        gastosFinancieros,
        auditLogs
    }[nombre] || [];
}
function detectarIdsModificados(nombre) {
    const anteriores = loadStore(STORE_KEYS[nombre], []);
    const actuales = datosStoreActual(nombre);
    const mapaAnterior = new Map((anteriores || []).map(item => [String(item?.id), JSON.stringify(item)]));
    return (actuales || [])
        .filter(item => item?.id !== undefined && mapaAnterior.get(String(item.id)) !== JSON.stringify(item))
        .map(item => item.id);
}
function marcarRegistrosPendientes(nombre, ids = []) {
    if (!STORE_KEYS[nombre] || !ids.length) return;
    const pendientes = obtenerRegistrosPendientes();
    const actuales = new Set(pendientes[nombre] || []);
    ids.forEach(id => actuales.add(id));
    pendientes[nombre] = Array.from(actuales);
    localStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify(pendientes));
}
function marcarStorePendiente(nombre) {
    if (!STORE_KEYS[nombre]) return;
    const pendientes = obtenerStoresPendientes();
    pendientes.add(nombre);
    localStorage.setItem(PENDING_STORES_KEY, JSON.stringify(Array.from(pendientes)));
    marcarCambiosPendientesOffline(true);
}
function marcarTodosStoresPendientes() {
    localStorage.setItem(PENDING_STORES_KEY, JSON.stringify(Object.keys(STORE_KEYS)));
    localStorage.removeItem(PENDING_RECORDS_KEY);
    marcarCambiosPendientesOffline(true);
}
function limpiarStoresSincronizados(stores) {
    const pendientes = obtenerStoresPendientes();
    (stores || []).forEach(nombre => pendientes.delete(nombre));
    if (pendientes.size) {
        localStorage.setItem(PENDING_STORES_KEY, JSON.stringify(Array.from(pendientes)));
        marcarCambiosPendientesOffline(true);
    } else {
        localStorage.removeItem(PENDING_STORES_KEY);
        marcarCambiosPendientesOffline(false);
    }
    const registros = obtenerRegistrosPendientes();
    (stores || []).forEach(nombre => delete registros[nombre]);
    if (Object.keys(registros).length) localStorage.setItem(PENDING_RECORDS_KEY, JSON.stringify(registros));
    else localStorage.removeItem(PENDING_RECORDS_KEY);
}
function hayCambiosPendientesOffline() {
    try {
        return localStorage.getItem(OFFLINE_PENDING_KEY) === '1';
    } catch {
        return false;
    }
}
function obtenerEliminacionesPendientes() {
    return loadStore(DELETE_QUEUE_KEY, []);
}
function guardarEliminacionesPendientes(lista = []) {
    try {
        if (lista.length) localStorage.setItem(DELETE_QUEUE_KEY, JSON.stringify(lista));
        else localStorage.removeItem(DELETE_QUEUE_KEY);
    } catch (error) {
        console.warn('No se pudo guardar cola de eliminaciones.', error);
    }
}
function registrarEliminacionRemota(tabla, legacyId) {
    if (!tabla || legacyId === undefined || legacyId === null) return;
    const lista = obtenerEliminacionesPendientes();
    const key = `${tabla}:${legacyId}`;
    if (!lista.some(item => item.key === key)) {
        lista.push({ key, tabla, legacyId, fechaISO: new Date().toISOString() });
        guardarEliminacionesPendientes(lista);
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
function combinarConRegistrosPendientes(remoto = [], local = [], idsPendientes = null) {
    const mapa = new Map((remoto || []).map(item => [String(item.id), item]));
    const protegerTodos = !Array.isArray(idsPendientes) || !idsPendientes.length;
    const protegidos = new Set((idsPendientes || []).map(String));
    (local || []).forEach(item => {
        const key = String(item.id);
        if (protegerTodos || protegidos.has(key) || !mapa.has(key)) mapa.set(key, item);
    });
    return Array.from(mapa.values());
}
function combinarClientesPorId(remoto = [], local = []) {
    const clientesRemotos = new Map((remoto || []).map(cliente => [cliente.id, {
        ...cliente,
        mascotas: cliente.mascotas || []
    }]));
    (local || []).forEach(clienteLocal => {
        if (!clientesRemotos.has(clienteLocal.id)) {
            clientesRemotos.set(clienteLocal.id, clienteLocal);
            return;
        }
        const clienteRemoto = clientesRemotos.get(clienteLocal.id);
        const mascotas = new Map((clienteRemoto.mascotas || []).map(mascota => [mascota.id, {
            ...mascota,
            historial: mascota.historial || [],
            estudios: mascota.estudios || [],
            vacunasManuales: mascota.vacunasManuales || []
        }]));
        (clienteLocal.mascotas || []).forEach(mascotaLocal => {
            if (!mascotas.has(mascotaLocal.id)) {
                mascotas.set(mascotaLocal.id, mascotaLocal);
                return;
            }
            const mascotaRemota = mascotas.get(mascotaLocal.id);
            mascotas.set(mascotaLocal.id, {
                ...mascotaRemota,
                historial: combinarPorId(mascotaRemota.historial || [], mascotaLocal.historial || []),
                estudios: combinarPorId(mascotaRemota.estudios || [], mascotaLocal.estudios || []),
                vacunasManuales: combinarPorId(mascotaRemota.vacunasManuales || [], mascotaLocal.vacunasManuales || [])
            });
        });
        clientesRemotos.set(clienteLocal.id, { ...clienteRemoto, mascotas: Array.from(mascotas.values()) });
    });
    return Array.from(clientesRemotos.values());
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
    const protegerLocalesPendientes = hayCambiosPendientesOffline();
    const registrosPendientes = protegerLocalesPendientes ? obtenerRegistrosPendientes() : {};
    clientes = protegerLocalesPendientes
        ? combinarConRegistrosPendientes(data.clientes || [], locales.clientes || [], registrosPendientes.clientes)
        : (data.clientes || []);
    inventario = protegerLocalesPendientes
        ? combinarConRegistrosPendientes(data.inventario || [], locales.inventario || [], registrosPendientes.inventario)
        : (data.inventario || []);
    agenda = protegerLocalesPendientes
        ? combinarConRegistrosPendientes(data.agenda || [], locales.agenda || [], registrosPendientes.agenda)
        : (data.agenda || []);
    finanzas = protegerLocalesPendientes
        ? combinarConRegistrosPendientes(data.finanzas || [], locales.finanzas || [], registrosPendientes.finanzas)
        : (data.finanzas || []);
    movimientosInventario = data.movimientosInventario || [];
    serviciosExternos = protegerLocalesPendientes
        ? combinarConRegistrosPendientes(data.serviciosExternos || [], locales.serviciosExternos || [], registrosPendientes.serviciosExternos)
        : (data.serviciosExternos || []);
    clinicasExternas = protegerLocalesPendientes
        ? combinarConRegistrosPendientes(data.clinicasExternas || [], locales.clinicasExternas || [], registrosPendientes.clinicasExternas)
        : (data.clinicasExternas || []);
    gastosFinancieros = protegerLocalesPendientes
        ? combinarConRegistrosPendientes(data.gastosFinancieros || [], locales.gastosFinancieros || [], registrosPendientes.gastosFinancieros)
        : (data.gastosFinancieros || []);
    auditLogs = data.auditLogs || [];
}
function codigoErrorSync(error, prefijo = 'SYNC') {
    const base = error?.code || error?.status || error?.name || 'UNKNOWN';
    return `${prefijo}-${String(base).toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 18) || 'UNKNOWN'}`;
}
function registrarErrorSync(codigo, error, contexto = '') {
    const detalle = {
        codigo,
        contexto,
        mensaje: error?.message || String(error || 'Error desconocido'),
        supabaseCode: error?.code || '',
        details: error?.details || '',
        hint: error?.hint || '',
        fechaISO: new Date().toISOString()
    };
    try {
        localStorage.setItem('vet_pro_ultimo_error_sync', JSON.stringify(detalle));
    } catch (_) {}
    console.error(`[${codigo}] ${contexto || 'Error de sincronización'}`, error);
    return detalle;
}
function actualizarEstadoSync(texto, error = false) {
    if ($('sync-status')) {
        $('sync-status').innerText = texto;
        $('sync-status').className = error ? 'text-red-300' : '';
    }
    if ($('sync-status-mobile')) {
        $('sync-status-mobile').innerText = texto;
        $('sync-status-mobile').className = `text-sm font-black ${error ? 'text-rose-700' : 'text-slate-900'}`;
    }
}
function actualizarCuentaMovil() {
    if ($('sync-user-mobile')) $('sync-user-mobile').innerText = usuarioActivo?.email || 'Sin sesión activa';
    if ($('sync-workspace-mobile')) $('sync-workspace-mobile').innerText = workspaceActivoNombre || 'Workspace personal';
}
function abrirPanelCuentaMovil() {
    actualizarCuentaMovil();
    $('modal-cuenta-movil')?.classList.remove('hidden');
    renderIcons();
}
function cerrarPanelCuentaMovil() {
    $('modal-cuenta-movil')?.classList.add('hidden');
}
function cargarModoOffline(mensaje = 'Sin conexión. Usando copia local.') {
    const locales = datosLocalesAnteriores();
    if (!tieneDatos(locales)) return false;
    aplicarEstado(locales);
    ocultarLogin();
    usuarioActivo = usuarioActivo || { id: 'offline', email: 'Modo offline' };
    if ($('sync-user')) $('sync-user').innerText = 'Modo offline';
    actualizarCuentaMovil();
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
    localStorage.removeItem(PENDING_STORES_KEY);
    localStorage.removeItem(PENDING_RECORDS_KEY);
    localStorage.removeItem(OFFLINE_PENDING_KEY);
    localStorage.removeItem(DELETE_QUEUE_KEY);
}
function reiniciarEstadoEnMemoria() {
    clientes = [];
    inventario = [];
    agenda = [];
    finanzas = [];
    movimientosInventario = [];
    serviciosExternos = [];
    clinicasExternas = [];
    gastosFinancieros = [];
    auditLogs = [];
}
function prepararCacheParaUsuarioActivo() {
    if (!usuarioActivo?.id || usuarioActivo.id === 'offline') return;
    const usuarioLocal = localStorage.getItem(LOCAL_ACTIVE_USER_KEY);
    if (usuarioLocal && usuarioLocal !== usuarioActivo.id) {
        limpiarDatosLocalesAnteriores();
        reiniciarEstadoEnMemoria();
        marcarCambiosPendientesOffline(false);
    }
    localStorage.setItem(LOCAL_ACTIVE_USER_KEY, usuarioActivo.id);
}
function scopeRemoto() {
    const scope = { user_id: usuarioActivo?.id };
    if (workspaceActivoId) scope.workspace_id = workspaceActivoId;
    return scope;
}
function aplicarFiltroScope(query) {
    return query.eq('user_id', usuarioActivo.id);
}
function filtroRealtimeScope() {
    return `user_id=eq.${usuarioActivo.id}`;
}
async function cargarWorkspaceActivo() {
    workspaceSoportado = false;
    workspaceActivoId = null;
    workspaceActivoNombre = 'Datos independientes por usuario';
    if ($('sync-workspace')) $('sync-workspace').innerText = workspaceActivoNombre;
    actualizarCuentaMovil();
    /*
     * Se carga workspace_id solo para satisfacer RLS/constraints existentes.
     * La app sigue filtrando, escuchando y haciendo upsert por user_id.
     */
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
        actualizarCuentaMovil();
    } catch (error) {
        console.warn('Workspace multiusuario no disponible. Se usará el modo por usuario.', error);
        if ($('sync-workspace')) $('sync-workspace').innerText = 'Datos por usuario';
        workspaceActivoNombre = 'Datos por usuario';
        actualizarCuentaMovil();
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
    let storesPendientes = obtenerStoresPendientes();
    const registrosPendientes = obtenerRegistrosPendientes();
    if (!storesPendientes.size && hayCambiosPendientesOffline()) {
        storesPendientes = new Set(Object.keys(STORE_KEYS));
    }
    sincronizacionParcialPendiente = false;
    ultimoCodigoSyncParcial = '';
    actualizarEstadoSync('Guardando...');
    let error = null;
    try {
        if (modoDatosRemotos === 'normalizado' && typeof guardarEstadoBaseNormalizada === 'function') {
            await guardarEstadoBaseNormalizada(storesPendientes, registrosPendientes);
        } else {
            const resultado = await supabaseClient.from('app_state').upsert({
                ...scopeRemoto(),
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
        const codigo = error.__syncCode || codigoErrorSync(error, 'SYNC-SAVE');
        registrarErrorSync(codigo, error, 'guardarEstadoRemoto');
        marcarCambiosPendientesOffline(true);
        actualizarEstadoSync(`Error ${codigo}`, true);
        return;
    }
    if (sincronizacionParcialPendiente) {
        guardarStoresLocales();
        marcarCambiosPendientesOffline(true);
        actualizarEstadoSync(ultimoCodigoSyncParcial ? `Parcial ${ultimoCodigoSyncParcial}` : 'Sincronizado parcial', true);
    } else {
        guardarStoresLocales();
        if (!guardadoPendiente) limpiarStoresSincronizados(storesPendientes);
        actualizarEstadoSync('Sincronizado');
    }
    if (guardadoPendiente) {
        guardadoPendiente = false;
        programarGuardadoRemoto();
    } else if (typeof procesarRecargaNormalizadaPendiente === 'function') {
        procesarRecargaNormalizadaPendiente();
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
    syncTimer = setTimeout(guardarEstadoRemoto, 1200);
}
function saveStore(nombre) {
    marcarRegistrosPendientes(nombre, detectarIdsModificados(nombre));
    guardarStoreLocal(nombre);
    marcarStorePendiente(nombre);
    programarGuardadoRemoto();
}
function saveAllStores() {
    guardarStoresLocales();
    marcarTodosStoresPendientes();
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
    if (!usuarioActivo || guardandoRemoto || refrescoRemotoEnCurso || document.visibilityState === 'hidden') return;
    if (debePausarAplicacionRemota()) return;
    refrescoRemotoEnCurso = true;
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
        ultimoRefrescoRemotoAt = Date.now();
    } catch (error) {
        console.warn('No se pudo refrescar estado remoto en segundo plano.', error);
    } finally {
        refrescoRemotoEnCurso = false;
    }
}
async function cargarEstadoRemotoActual() {
    if (modoDatosRemotos === 'normalizado' && typeof cargarEstadoBaseNormalizada === 'function') {
        const remoto = await cargarEstadoBaseNormalizada();
        if (!remoto.ok) throw remoto.error;
        return remoto.estado || null;
    }
    const query = supabaseClient.from('app_state').select('data');
    const { data, error } = await aplicarFiltroScope(query).maybeSingle();
    if (error) throw error;
    return data?.data || null;
}
async function sincronizarDispositivoActual() {
    if (!usuarioActivo || usuarioActivo.id === 'offline') {
        alert('Inicia sesión para subir los cambios de este dispositivo.');
        return;
    }
    await guardarEstadoRemoto();
    if (hayCambiosPendientesOffline()) {
        alert('No se pudieron subir todos los cambios. Revisa el código que aparece en Cuenta y Nube.');
        return;
    }
    await refrescarEstadoDesdeRemotoSilencioso();
    actualizarEstadoSync('Sincronizado');
    alert('Cambios sincronizados con Supabase.');
}
async function recargarDesdeSupabaseForzado() {
    if (!usuarioActivo || usuarioActivo.id === 'offline') {
        alert('Inicia sesión para recargar los datos desde Supabase.');
        return;
    }
    if (hayCambiosPendientesOffline()) {
        const continuar = confirm('Este dispositivo tiene cambios pendientes. Si recargas desde Supabase se reemplazará la copia local por lo que esté guardado en la nube. ¿Quieres continuar?');
        if (!continuar) return;
    }
    actualizarEstadoSync('Actualizando...');
    try {
        const estadoRemoto = await cargarEstadoRemotoActual();
        if (!estadoRemoto) {
            actualizarEstadoSync('Sin datos remotos', true);
            alert('No encontré información guardada en Supabase para este usuario.');
            return;
        }
        marcarCambiosPendientesOffline(false);
        aplicarEstado(estadoRemoto);
        guardarStoresLocales();
        if (typeof refrescarInterfaz === 'function') refrescarInterfaz();
        actualizarEstadoSync('Sincronizado');
        alert('Datos recargados desde Supabase.');
    } catch (error) {
        const codigo = codigoErrorSync(error, 'SYNC-LOAD');
        registrarErrorSync(codigo, error, 'recargarDesdeSupabaseForzado');
        actualizarEstadoSync(`Error ${codigo}`, true);
        alert(`No se pudo recargar desde Supabase. Código: ${codigo}`);
    }
}
let sincronizandoFinanzasAlAbrir = false;
async function sincronizarFinanzasAlAbrir() {
    if (sincronizandoFinanzasAlAbrir || estaOffline() || !usuarioActivo || usuarioActivo.id === 'offline') return;
    if (debePausarAplicacionRemota()) return;
    sincronizandoFinanzasAlAbrir = true;
    try {
        actualizarEstadoSync('Actualizando finanzas...');
        if (hayCambiosPendientesOffline()) {
            await guardarEstadoRemoto();
            if (hayCambiosPendientesOffline()) {
                actualizarEstadoSync('Finanzas con cambios pendientes', true);
                return;
            }
        }
        const estadoRemoto = await cargarEstadoRemotoActual();
        if (!estadoRemoto) return;
        marcarCambiosPendientesOffline(false);
        aplicarEstado(estadoRemoto);
        guardarStoresLocales();
        if (typeof renderFinanzas === 'function') renderFinanzas();
        if (typeof renderGananciasConsultas === 'function') renderGananciasConsultas();
        actualizarEstadoSync('Sincronizado');
    } catch (error) {
        const codigo = codigoErrorSync(error, 'SYNC-FIN');
        registrarErrorSync(codigo, error, 'sincronizarFinanzasAlAbrir');
        actualizarEstadoSync(`Error ${codigo}`, true);
    } finally {
        sincronizandoFinanzasAlAbrir = false;
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
            actualizarCuentaMovil();
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
        const codigo = codigoErrorSync(error, 'SYNC-ONLINE');
        registrarErrorSync(codigo, error, 'sincronizarCambiosPendientesOnline');
        actualizarEstadoSync(`Pendiente ${codigo}`, true);
    }
}
function iniciarRefrescoRemotoAutomatico() {
    clearInterval(remotePollingTimer);
    remotePollingTimer = setInterval(refrescarEstadoDesdeRemotoSilencioso, 15 * 60 * 1000);
    if (visibilitySyncRegistrado) return;
    visibilitySyncRegistrado = true;
    document.addEventListener('visibilitychange', () => {
        const refrescoVencido = Date.now() - ultimoRefrescoRemotoAt > 60000;
        if (document.visibilityState === 'visible' && refrescoVencido && !debePausarAplicacionRemota()) {
            refrescarEstadoDesdeRemotoSilencioso();
        }
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
    prepararCacheParaUsuarioActivo();
    ocultarLogin();
    if ($('sync-user')) $('sync-user').innerText = usuarioActivo.email || '';
    actualizarCuentaMovil();
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
    limpiarDatosLocalesAnteriores();
    localStorage.removeItem(LOCAL_ACTIVE_USER_KEY);
    marcarCambiosPendientesOffline(false);
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
    if (tabId === 'finanzas') {
        renderFinanzas();
        if (typeof sincronizarFinanzasAlAbrir === 'function') sincronizarFinanzasAlAbrir();
    }
    if (tabId === 'servicios-externos' && typeof renderServiciosExternos === 'function') renderServiciosExternos();
    if (tabId === 'inventario') renderInventario();
}
function abrirModalResponsivaFlotante() {
    if (!consultaSeleccionada.petId) {
        alert("Por favor, seleccione primero un paciente en la lista de clientes.");
        return;
    }
    $('modal-responsiva').classList.remove('hidden');
    actualizarDisclaimerDinamico();
    setTimeout(() => {
        if (typeof ajustarDimensionesLienzo === "function") {
            ajustarDimensionesLienzo('canvas-firma');
            ajustarDimensionesLienzo('canvas-firma-vet');
        }
        if (typeof cargarResponsivaMascotaEnCanvas === 'function') cargarResponsivaMascotaEnCanvas();
    }, 150);
}
function cerrarModalResponsivaFlotante() {
    $('modal-responsiva').classList.add('hidden');
    actualizarIndicadorFirmaStatus();
}
function actualizarIndicadorFirmaStatus() {
    const indicator = $('badge-firma-status');
    if (!indicator) return;
    const responsivaGuardada = typeof pacienteTieneResponsivaFirmada === 'function' && pacienteTieneResponsivaFirmada();
    if ((firmaDuenoEstablecida && firmaVetEstablecida) || responsivaGuardada) {
        indicator.innerText = responsivaGuardada ? "Responsiva en Expediente" : "Responsiva Firmada";
        indicator.className = "text-xs bg-teal-100 text-teal-800 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider";
    } else {
        indicator.innerText = "Falta Firma Responsiva";
        indicator.className = "text-xs bg-red-100 text-red-700 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider";
    }
}
