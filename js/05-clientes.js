function abrirModalHistorial(ownerId, petId) {
    const owner = clientes.find(c => c.id === ownerId);
    const pet = owner?.mascotas.find(m => m.id === petId);
    if (!pet) return;
    if($('historial-subtitulo-paciente')) {
        $('historial-subtitulo-paciente').innerText = `Paciente: ${pet.name} | Dueño: ${owner.owner}`;
    }
    const contenedor = $('historial-contenedor-consultas');
    if(!contenedor) return;
    contenedor.innerHTML = "";
    if (!pet.historial || pet.historial.length === 0) {
        contenedor.innerHTML = `<p class="text-xs text-gray-400 text-center py-8">No hay registros clínicos previos.</p>`;
    } else {
        pet.historial.forEach(h => {
            let detalleHTML = '';
            if (h.tipo === 'Vacunacion') {
                detalleHTML = `
                    <p class="text-xs text-slate-800"><b>Vacunas Aplicadas:</b> ${h.vacunas || 'Ninguna'}</p>
                    <p class="text-xs text-slate-800"><b>Desparasitante:</b> ${h.desparasitante || 'No'}</p>
                `;
            } else {
                detalleHTML = `
                    <p class="text-xs text-slate-800"><b>Motivo:</b> ${h.motivo}</p>
                    <p class="text-xs text-slate-800"><b>Signos Reportados:</b> <span class="italic text-gray-600">"${h.sintomas || 'Asintomático'}"</span></p>
                `;
            }
            const estadoPago = h.estadoPago || 'Pagado';
            const badgePago = estadoPago === 'Pagado'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : estadoPago === 'Pendiente'
                    ? 'bg-rose-100 text-rose-800 border-rose-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200';
            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-2";
            card.innerHTML = `
                <div class="flex justify-between items-center border-b pb-1.5">
                    <span class="text-xs font-bold text-slate-700"><i data-lucide="calendar" class="inline w-3.5 h-3.5 mr-1"></i> ${new Date(h.fecha).toLocaleDateString('es-MX')}</span>
                    <div class="flex items-center gap-2">
                        <button onclick="descargarResponsivaHistorialPDF(${owner.id}, ${pet.id}, ${h.id})" class="bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded-md border border-blue-200 flex items-center gap-1 transition-all">
                            <i data-lucide="download" class="w-3 h-3"></i> PDF
                        </button>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                    <p><b>Peso:</b> ${h.peso} kg</p><p><b>Temp:</b> ${h.temp} °C</p>
                </div>
                ${detalleHTML}
                <p class="text-xs text-slate-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-justify"><b>Receta/Cuidados:</b> ${h.tratamiento}</p>
                <div class="bg-emerald-50 p-3 rounded-lg border border-emerald-200 space-y-1">
                    <div class="flex flex-wrap justify-between items-center gap-2">
                        <p class="text-xs font-bold text-emerald-900">Cobro registrado</p>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgePago}">${estadoPago}</span>
                    </div>
                    <p class="text-xs text-slate-700">${h.servicioCobrado || 'Sin servicio registrado'}</p>
                    <p class="text-xs text-slate-700"><b>Total:</b> $${Number(h.costoTotal || 0).toFixed(2)} · <b>Método:</b> ${h.metodoPago || 'Efectivo'}</p>
                    ${h.notaPago ? `<p class="text-[11px] text-slate-500 italic">${h.notaPago}</p>` : ''}
                </div>
                ${h.insumos?.length ? `<div class="bg-blue-50 p-2 rounded-lg text-[10px] border border-blue-100 text-blue-900"><b>Insumos Extra:</b> ${h.insumos.map(i=>`${i.name} [x${i.qty}]`).join(', ')}</div>` : ''}
                <div class="bg-gray-900 text-gray-300 text-[10px] p-3 rounded-lg font-mono leading-relaxed mt-2">
                    <p class="text-amber-400 font-bold uppercase mb-1 border-b border-gray-700 pb-0.5">[✓] CLAÚSULA GUARDADA (${h.tipo})</p>
                    <p>${h.disclaimer}</p>
                    <div class="flex justify-between items-center pt-2 mt-2 border-t border-gray-800">
                        <img src="${h.firmaDueno}" class="h-8 object-contain mx-auto bg-white rounded px-1"><img src="${h.firmaVet}" class="h-8 object-contain mx-auto bg-white rounded px-1">
                    </div>
                </div>
            `;
            contenedor.appendChild(card);
        });
    }
    $('modal-historial-clinico')?.classList.remove('hidden');
    renderIcons();
}
function cerrarModalHistorial() { $('modal-historial-clinico')?.classList.add('hidden'); }
function renderClientes() {
    const buscadorElem = $('buscador');
    const buscador = buscadorElem ? buscadorElem.value.toLowerCase() : "";
    const lista = $('lista-clientes');
    if(!lista) return;
    lista.innerHTML = "";
    const coincide = valor => String(valor || '').toLowerCase().includes(buscador);
    let filtrados = clientes.filter(c =>
        coincide(c.owner) ||
        coincide(c.phone) ||
        coincide(c.address) ||
        (c.mascotas || []).some(m => coincide(m.name))
    );
    if($('contador-registros')) {
        $('contador-registros').innerText = `${filtrados.length} expedientes`;
    }
    if(filtrados.length === 0) { lista.innerHTML = `<div class="text-center text-gray-400 text-xs py-12">Sin resultados.</div>`; return; }
    filtrados.forEach(c => {
        const mascotasCoincidentes = buscador
            ? (c.mascotas || []).filter(m => coincide(m.name)).map(m => m.name)
            : [];
        const div = document.createElement('div');
        div.className = "p-4 bg-gray-50 rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-gray-100/70 transition-all";
        div.innerHTML = `
            <div class="space-y-1">
                <h4 class="text-sm font-bold text-slate-900">${c.owner}</h4>
                <p class="text-xs text-gray-500">📍 ${c.address} • 📱 ${c.phone}</p>
                <p class="text-[11px] font-bold text-blue-700">${c.mascotas ? c.mascotas.length : 0} mascotas en archivo</p>
                ${mascotasCoincidentes.length ? `<p class="text-[11px] font-semibold text-emerald-700">Mascota encontrada: ${mascotasCoincidentes.join(', ')}</p>` : ''}
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button onclick="verMascotasCliente(${c.id})" class="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-2xs">Mascotas</button>
                <button onclick="abrirModalCliente(${c.id})" class="p-2 border bg-white hover:bg-gray-50 rounded-xl text-gray-600 transition-all shadow-xs" title="Modificar">
                    <i data-lucide="edit-3" class="w-4 h-4"></i>
                </button>
                <button onclick="eliminarClienteDefinitivo(${c.id})" class="p-2 border bg-white hover:bg-red-50 rounded-xl text-red-500 transition-all shadow-xs" title="Eliminar Permanente">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        `;
        lista.appendChild(div);
    });
    renderIcons();
}
function eliminarClienteDefinitivo(id) {
    if(confirm("¿Eliminar expediente y mascotas irreversiblemente?")) {
        clientes = clientes.filter(c => c.id !== id);
        saveStore('clientes');
        renderClientes(); 
        actualizarSelectAgenda();
    }
}
function verMascotasCliente(ownerId) {
    clienteActivoSubpaginaId = ownerId;
    $('directorio-clientes-area')?.classList.add('hidden');
    $('subpagina-mascotas-area')?.classList.remove('hidden');
    const c = clientes.find(item => item.id === ownerId);
    if($('subpagina-cliente-titulo')) $('subpagina-cliente-titulo').innerText = `Mascotas de: ${c.owner}`;
    if($('subpagina-cliente-detalles')) $('subpagina-cliente-detalles').innerText = `📍 Dirección: ${c.address} | Tel: ${c.phone}`;
    $('btn-subpagina-agregar-mascota')?.setAttribute('onclick', `abrirModalMascota(${ownerId})`);
    renderSubpaginaMascotas();
}
function volverAlDirectorioClientes() {
    $('subpagina-mascotas-area')?.classList.add('hidden');
    $('directorio-clientes-area')?.classList.remove('hidden');
    renderClientes();
}
function renderSubpaginaMascotas() {
    const container = $('contenedor-subpagina-mascotas');
    if(!container) return;
    const c = clientes.find(item => item.id === clienteActivoSubpaginaId);
    if(!c) return;
    if(!c.mascotas || c.mascotas.length === 0) {
        container.className = "bg-white p-6 rounded-2xl border flex flex-col justify-center items-center text-center text-gray-400 py-16 w-full col-span-2";
        container.innerHTML = `<i data-lucide="dog" class="w-12 h-12 text-gray-300 mb-2"></i><p class="text-sm font-semibold">Este cliente aún no tiene mascotas vinculadas.</p>`;
        renderIcons();
        return;
    }
    container.className = "bg-white p-6 rounded-2xl border grid grid-cols-1 md:grid-cols-2 gap-4 h-fit";
    container.innerHTML = c.mascotas.map(m => {
        let avatar = m.photo ? 
            `<img src="${m.photo}" class="w-16 h-16 rounded-xl object-cover border border-gray-200 shrink-0">` : 
            `<div class="w-16 h-16 bg-blue-50 text-blue-400 rounded-xl flex items-center justify-center border border-dashed border-blue-200 shrink-0"><i data-lucide="dog" class="w-6 h-6"></i></div>`;
        let totalConsultas = m.historial ? m.historial.length : 0;
        return `
            <section class="border rounded-2xl p-4 bg-slate-50 flex gap-4 shadow-2xs items-start">
                ${avatar}
                <div class="flex-1 space-y-3">
                    <div>
                        <span class="font-bold text-slate-900 text-base block">${m.name}</span>
                        <span class="text-xs text-gray-500 font-medium">${m.species} • ${m.age}</span>
                        ${m.spayed ? `<span class="text-[10px] ml-1 bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">✂️ Esterilizado</span>` : ''}
                    </div>
                    <div class="flex flex-wrap gap-1.5">
                        <button onclick="cargarPacienteAConsulta(${c.id}, ${m.id})" class="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1 hover:bg-slate-800">
                            <i data-lucide="file-text" class="w-3.5 h-3.5"></i> Atender
                        </button>
                        <button onclick="abrirModalHistorial(${c.id}, ${m.id})" class="px-3 py-1.5 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl flex items-center gap-1 hover:bg-amber-600">
                            <i data-lucide="folder-open" class="w-3.5 h-3.5"></i> Expediente (${totalConsultas})
                        </button>
                        <button onclick="abrirModalMascota(${c.id}, ${m.id})" class="text-gray-400 hover:text-amber-600 p-1 bg-white rounded-lg border">
                            <i data-lucide="edit" class="w-4 h-4"></i>
                        </button>
                        <button onclick="eliminarMascotaDefinitiva(${c.id}, ${m.id})" class="text-gray-400 hover:text-red-600 p-1 bg-white rounded-lg border">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </div>
            </section>`;
    }).join('');
    renderIcons();
}
function eliminarMascotaDefinitiva(oId, pId) {
    if(confirm("¿Dar de baja a este paciente?")) {
        clientes.find(c=>c.id===oId).mascotas = clientes.find(c=>c.id===oId).mascotas.filter(m=>m.id!==pId);
        saveStore('clientes'); 
        renderSubpaginaMascotas(); 
        actualizarSelectAgenda();
    }
}
function abrirModalCliente(id = null) {
    $('form-cliente').reset(); 
    $('edit-cliente-id').value = id || '';
    if (id) {
        const c = clientes.find(cl => cl.id === id);
        $('owner').value = c.owner; 
        $('address').value = c.address;
        $('phone').value = c.phone; 
        $('email').value = c.email || '';
        $('titulo-form-cliente').innerHTML = `<i data-lucide="edit" class="text-amber-600 w-5 h-5"></i> Modificar Propietario`;
    } else { 
        $('titulo-form-cliente').innerHTML = `<i data-lucide="user-plus" class="text-blue-600 w-5 h-5"></i> Registrar Propietario`; 
    }
    $('modal-cliente').classList.remove('hidden');
    renderIcons();
}
function cerrarModalCliente() { $('modal-cliente').classList.add('hidden'); }
function validarYPrevenirDuplicado(e) {
    e.preventDefault();
    const id = $('edit-cliente-id').value;
    const ow = $('owner').value; 
    const ph = $('phone').value;
    const ad = $('address').value; 
    const em = $('email').value;
    const f = $('owner-id-file');
    if(!id && clientes.find(c => c.owner.toLowerCase() === ow.toLowerCase() || c.phone === ph)) {
        alert("Ya existe un cliente registrado con este nombre o teléfono."); 
        return;
    }
    if(f && f.files[0]) {
        const r = new FileReader(); 
        r.onload = ev => { finalizarGuardadoCliente(ow, ph, ad, em, ev.target.result, id); }; 
        r.readAsDataURL(f.files[0]);
    } else {
        const exist = clientes.find(c=>c.id===parseInt(id)); 
        finalizarGuardadoCliente(ow, ph, ad, em, exist?.ownerIdFile, id);
    }
}
function finalizarGuardadoCliente(ow, ph, ad, em, b64, id) {
    if(id) {
        clientes = clientes.map(c => c.id===parseInt(id) ? {...c, owner:ow, phone:ph, address:ad, email:em, ownerIdFile:b64||c.ownerIdFile} : c);
    } else {
        clientes.push({ id: Date.now(), owner:ow, phone:ph, address:ad, email:em, ownerIdFile:b64, mascotas: [] });
    }
    saveStore('clientes'); 
    cerrarModalCliente(); 
    renderClientes(); 
    actualizarSelectAgenda();
}
function abrirModalMascota(oId, pId=null) {
    $('form-nueva-mascota').reset(); 
    $('mascota-owner-id').value = oId;
    $('edit-mascota-id').value = pId || '';
    if(pId) {
        const m = clientes.find(c=>c.id===oId).mascotas.find(p=>p.id===pId);
        $('m-name').value = m.name; 
        $('m-species').value = m.species;
        $('m-age').value = m.age; 
        $('m-spayed').checked = m.spayed;
        $('titulo-modal-mascota').innerHTML = `<i data-lucide="edit" class="text-amber-600 w-5 h-5"></i> Editar Paciente`;
    } else {
        $('titulo-modal-mascota').innerHTML = `<i data-lucide="dog" class="text-blue-600 w-5 h-5"></i> Registrar Paciente`;
    }
    $('modal-agregar-mascota').classList.remove('hidden');
    renderIcons();
}
function cerrarModalMascota() { $('modal-agregar-mascota').classList.add('hidden'); }
document.addEventListener('DOMContentLoaded', () => {
    const formMascota = $('form-nueva-mascota');
    if(formMascota) {
        formMascota.onsubmit = function(e) {
            e.preventDefault();
            const oId = parseInt($('mascota-owner-id').value); 
            const pId = $('edit-mascota-id').value;
            const nm = $('m-name').value; 
            const sp = $('m-species').value;
            const ag = $('m-age').value; 
            const spy = $('m-spayed').checked;
            const f = $('m-photo-file');
            if(f && f.files[0]) {
                const r = new FileReader(); 
                r.onload = ev => { salvarMascotaData(oId, pId, nm, sp, ag, spy, ev.target.result); }; 
                r.readAsDataURL(f.files[0]);
            } else {
                const mPrevia = clientes.find(c=>c.id===oId)?.mascotas.find(m=>m.id===parseInt(pId));
                salvarMascotaData(oId, pId, nm, sp, ag, spy, mPrevia?.photo);
            }
        };
    }
});
function salvarMascotaData(oId, pId, nm, sp, ag, spy, b64) {
    clientes = clientes.map(c => {
        if(c.id === oId) {
            if(pId) c.mascotas = c.mascotas.map(m => m.id===parseInt(pId) ? {...m, name:nm, species:sp, age:ag, spayed:spy, photo:b64||m.photo} : m);
            else c.mascotas.push({ id: Date.now(), name:nm, species:sp, age:ag, spayed:spy, photo:b64, historial:[] });
        }
        return c;
    });
    saveStore('clientes'); 
    cerrarModalMascota(); 
    renderSubpaginaMascotas(); 
    actualizarSelectAgenda();
}
