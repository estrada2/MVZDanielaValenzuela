const SUPABASE_URL = "https://otydjeobxzcpobzengsv.supabase.co";

const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90eWRqZW9ieHpjcG9iemVuZ3N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxODUzMzAsImV4cCI6MjA5NTc2MTMzMH0.SINhhycH6250d0zIyasgXO-4chac-80cnZ0vWKeJd5c";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

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
const INDEXED_DB_NAME = 'VetHomeProDB';
const INDEXED_DB_STORE = 'kv';
let indexedDbPromise = null;
function loadStore(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) || fallback;
    } catch (error) {
        console.warn(`Dato local inválido en ${key}. Se usará el valor inicial.`, error);
        return fallback;
    }
}
function openIndexedDb() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (indexedDbPromise) return indexedDbPromise;
    indexedDbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(INDEXED_DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(INDEXED_DB_STORE);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    }).catch(error => {
        console.warn('IndexedDB no disponible. Se continuará con localStorage.', error);
        return null;
    });
    return indexedDbPromise;
}
async function idbSet(key, value) {
    try {
        const db = await openIndexedDb();
        if (!db) return;
        const tx = db.transaction(INDEXED_DB_STORE, 'readwrite');
        tx.objectStore(INDEXED_DB_STORE).put(value, key);
    } catch (error) {
        console.warn('No se pudo guardar en IndexedDB.', error);
    }
}
async function idbGet(key) {
    const db = await openIndexedDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
        const tx = db.transaction(INDEXED_DB_STORE, 'readonly');
        const request = tx.objectStore(INDEXED_DB_STORE).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    }).catch(() => null);
}

function saveStore(nombre) {

 const data = {
   clientes,
   inventario,
   agenda,
   finanzas
 };

 localStorage.setItem(
   STORE_KEYS[nombre],
   JSON.stringify(data[nombre])
 );

 idbSet(
   STORE_KEYS[nombre],
   data[nombre]
 );

 if(nombre==="clientes"){
    guardarClientesSupabase();
 }

}
function saveAllStores() {
    Object.keys(STORE_KEYS).forEach(saveStore);
}
async function initPersistentStorage() {
    for (const nombre of Object.keys(STORE_KEYS)) {
        const key = STORE_KEYS[nombre];
        const localValue = localStorage.getItem(key);
        const idbValue = await idbGet(key);
        if (!localValue && idbValue) {
            if (nombre === 'clientes') clientes = idbValue;
            if (nombre === 'inventario') inventario = idbValue;
            if (nombre === 'agenda') agenda = idbValue;
            if (nombre === 'finanzas') finanzas = idbValue;
            localStorage.setItem(key, JSON.stringify(idbValue));
        } else if (!idbValue) {
            await idbSet(key, { clientes, inventario, agenda, finanzas }[nombre]);
        }
    }
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
    ['clientes', 'agenda', 'nueva-consulta', 'inventario', 'finanzas'].forEach(id => {
        $(`view-${id}`)?.classList.add('hidden');
        $(`nav-${id}`)?.classList.remove('bg-amber-500', 'text-slate-950', 'font-bold');
        $(`nav-${id}`)?.classList.add('text-blue-100', 'font-medium');
    });
    $(`view-${tabId}`)?.classList.remove('hidden');
    $(`nav-${tabId}`)?.classList.add('bg-amber-500', 'text-slate-950', 'font-bold');
    const titles = { 'clientes': 'Clientes y Mascotas', 'agenda': 'Agenda de Visitas', 'nueva-consulta': 'Nueva Consulta y Responsiva', 'inventario': 'Control de Stock', 'finanzas': 'Finanzas y Servicios' };
    if ($('page-title')) {
        $('page-title').innerText = titles[tabId];
    }
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

async function probarConexion() {

 const { data, error } = await supabaseClient
   .from('clientes')
   .select('*');

 console.log(data);

 console.log(error);

}

probarConexion();

async function guardarClientesSupabase() {

 const { error } = await supabaseClient
   .from('clientes')
   .upsert(
      clientes.map(c => ({
         id: c.id,
         nombre: c.nombre,
         telefono: c.telefono || null,
         email: c.email || null
      }))
   );

 if(error){
    console.error(error);
 }else{
    console.log("Clientes sincronizados");
 }

}
async function guardarClientesSupabase() {

 const clientesSinId =
   clientes.map(c => ({

      nombre: c.nombre,

      telefono: c.telefono || null,

      email: c.email || null

   }));


 const { error } = await supabaseClient
   .from('clientes')
   .insert(clientesSinId);


 if(error){

   console.error(error);

 }else{

   console.log("Clientes sincronizados");

 }

}

window.addEventListener(
 "load",
 async ()=>{

   await cargarClientesSupabase();

 }
);
