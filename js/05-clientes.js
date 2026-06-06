let historialActivo = { ownerId: null, petId: null, filtro: 'todas' };
let fotoIdentificacionCapturada = '';
let streamIdentificacion = null;
let filtroClientesActivo = 'todos';

function fechaConsultaObj(consulta) {
    if (consulta.fechaISO) return new Date(consulta.fechaISO);
    const fecha = new Date(consulta.fecha);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function formatoFechaCorta(fecha) {
    return fecha ? fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sin fecha';
}

function escapeHTML(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[caracter]));
}

function claseBadgePago(estadoPago) {
    if (estadoPago === 'Pagado') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (estadoPago === 'Pendiente') return 'bg-rose-100 text-rose-800 border-rose-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
}

function consultasFiltradasHistorial(historial) {
    const filtro = historialActivo.filtro;
    return historial.filter(consulta => {
        if (filtro === 'consultas') return consulta.tipo !== 'Vacunacion';
        if (filtro === 'vacunas') return consulta.tipo === 'Vacunacion';
        if (filtro === 'seguimiento') return consulta.tipo === 'Seguimiento';
        if (filtro === 'pendientes') return (consulta.estadoPago || 'Pagado') === 'Pendiente';
        return true;
    });
}

function cambiarFiltroHistorial(filtro) {
    historialActivo.filtro = filtro;
    renderHistorialClinicoActivo();
}

function estudiosPaciente(pet) {
    return Array.isArray(pet?.estudios) ? pet.estudios : [];
}

function vacunasManualesPaciente(pet) {
    return Array.isArray(pet?.vacunasManuales) ? pet.vacunasManuales : [];
}

function separarVacunasTexto(texto) {
    return String(texto || '')
        .split(/,|\+|;|\|/)
        .map(item => item.trim())
        .filter(Boolean);
}

function fechaMasUnAnio(fecha) {
    if (!fecha || Number.isNaN(fecha.getTime())) return null;
    const siguiente = new Date(fecha);
    siguiente.setFullYear(siguiente.getFullYear() + 1);
    return siguiente;
}

function fechaDesdeInputLocal(valor) {
    if (!valor) return null;
    const fecha = new Date(`${valor}T12:00:00`);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function fechaInputDesdeFecha(fecha) {
    if (!fecha || Number.isNaN(fecha.getTime())) return '';
    return fecha.toISOString().slice(0, 10);
}

function estadoRefuerzoVacuna(fechaRefuerzo) {
    if (!fechaRefuerzo) return { label: 'Sin fecha', className: 'bg-slate-100 text-slate-600 border-slate-200' };
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const dias = Math.ceil((fechaRefuerzo.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    if (dias < 0) return { label: 'Refuerzo vencido', className: 'bg-rose-100 text-rose-700 border-rose-200' };
    if (dias <= 45) return { label: 'Próximo refuerzo', className: 'bg-amber-100 text-amber-700 border-amber-200' };
    return { label: 'Vigente', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
}

function vacunasPacienteDesdeHistorial(pet) {
    const vacunasConsulta = (pet?.historial || [])
        .filter(consulta => consulta.tipo === 'Vacunacion' && consulta.vacunas)
        .flatMap(consulta => {
            const fechaAplicacion = fechaConsultaObj(consulta);
            return separarVacunasTexto(consulta.vacunas).map(nombre => ({
                id: `${consulta.id}-${nombre}`,
                consultaId: consulta.id,
                nombre,
                fechaAplicacion,
                fechaRefuerzo: fechaMasUnAnio(fechaAplicacion),
                desparasitante: consulta.desparasitante || '',
                nota: consulta.motivo || 'Vacunación / profilaxis',
                origen: 'Consulta'
            }));
        });
    const vacunasManuales = vacunasManualesPaciente(pet).map(vacuna => {
        const fechaAplicacion = fechaDesdeInputLocal(vacuna.fecha) || new Date(vacuna.fechaISO || '');
        const fechaRefuerzo = fechaDesdeInputLocal(vacuna.fechaRefuerzo) || fechaMasUnAnio(fechaAplicacion);
        return {
            ...vacuna,
            nombre: vacuna.nombre || 'Vacuna manual',
            fechaAplicacion,
            fechaRefuerzo,
            origen: 'Manual'
        };
    });
    return [...vacunasConsulta, ...vacunasManuales]
        .sort((a, b) => (b.fechaAplicacion?.getTime() || 0) - (a.fechaAplicacion?.getTime() || 0));
}

function renderVacunasYRefuerzos(owner, pet) {
    const vacunas = vacunasPacienteDesdeHistorial(pet);
    if (!vacunas.length) {
        return `
            <section class="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
                <div class="flex items-center justify-between gap-3">
                    <div>
                        <p class="text-[10px] font-bold uppercase text-slate-400">Vacunas y refuerzos</p>
                        <h4 class="text-base font-black text-slate-900">Sin vacunas registradas</h4>
                    </div>
                    <button type="button" onclick="abrirModalVacunaManual(${owner.id}, ${pet.id})" class="bg-blue-50 text-blue-700 border border-blue-100 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1">
                        <i data-lucide="syringe" class="w-4 h-4"></i> Agregar manual
                    </button>
                </div>
                <p class="text-xs text-slate-500 mt-2">Puedes guardar una consulta de vacunación o capturar manualmente vacunas aplicadas fuera de la app.</p>
            </section>
        `;
    }
    return `
        <section class="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <p class="text-[10px] font-bold uppercase text-slate-400">Vacunas y refuerzos</p>
                    <h4 class="text-base font-black text-slate-900">Control anual de vacunas</h4>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-full">${vacunas.length} registro${vacunas.length === 1 ? '' : 's'}</span>
                    <button type="button" onclick="abrirModalVacunaManual(${owner.id}, ${pet.id})" class="bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
                        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Manual
                    </button>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                ${vacunas.map(vacuna => {
                    const estado = estadoRefuerzoVacuna(vacuna.fechaRefuerzo);
                    return `
                        <article class="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-start gap-3">
                            <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0">
                                <i data-lucide="syringe" class="w-5 h-5"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-black text-slate-900">${escapeHTML(vacuna.nombre)}</p>
                                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${estado.className}">${estado.label}</span>
                                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${vacuna.origen === 'Manual' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-white text-slate-500 border-slate-200'}">${vacuna.origen}</span>
                                        </div>
                                    </div>
                                    ${vacuna.origen === 'Manual' ? `
                                        <div class="flex items-center gap-1 shrink-0">
                                            <button type="button" onclick="abrirModalVacunaManual(${owner.id}, ${pet.id}, ${vacuna.id})" class="p-1 rounded-lg bg-white border text-slate-500 hover:text-amber-600" title="Editar vacuna">
                                                <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                                            </button>
                                            <button type="button" onclick="eliminarVacunaManual(${owner.id}, ${pet.id}, ${vacuna.id})" class="p-1 rounded-lg bg-white border text-slate-500 hover:text-rose-600" title="Eliminar vacuna">
                                                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                                            </button>
                                        </div>
                                    ` : ''}
                                </div>
                                <p class="text-[11px] text-slate-500 mt-1"><b>Aplicada:</b> ${formatoFechaCorta(vacuna.fechaAplicacion)}</p>
                                <p class="text-[11px] text-slate-500"><b>Refuerzo anual:</b> ${formatoFechaCorta(vacuna.fechaRefuerzo)}</p>
                                ${vacuna.desparasitante && vacuna.desparasitante !== 'No' ? `<p class="text-[10px] text-slate-400 mt-1">Desparasitante: ${escapeHTML(vacuna.desparasitante)}</p>` : ''}
                                ${vacuna.lote || vacuna.laboratorio ? `<p class="text-[10px] text-slate-400 mt-1">Lote/Lab: ${escapeHTML([vacuna.lote, vacuna.laboratorio].filter(Boolean).join(' · '))}</p>` : ''}
                                ${vacuna.nota ? `<p class="text-[10px] text-slate-500 mt-1 line-clamp-2">${escapeHTML(vacuna.nota)}</p>` : ''}
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        </section>
    `;
}

function abrirModalVacunaManual(ownerId, petId, vacunaId = '') {
    const owner = clientes.find(c => c.id === ownerId);
    const pet = owner?.mascotas.find(m => m.id === petId);
    if (!owner || !pet) return;
    const vacuna = vacunasManualesPaciente(pet).find(item => item.id === vacunaId);
    $('form-vacuna-manual')?.reset();
    if ($('vacuna-manual-owner-id')) $('vacuna-manual-owner-id').value = ownerId;
    if ($('vacuna-manual-pet-id')) $('vacuna-manual-pet-id').value = petId;
    if ($('vacuna-manual-id')) $('vacuna-manual-id').value = vacunaId || '';
    if ($('vacuna-manual-label')) $('vacuna-manual-label').innerText = `${pet.name} | ${owner.owner}`;
    if ($('titulo-vacuna-manual')) {
        $('titulo-vacuna-manual').innerHTML = `<i data-lucide="syringe" class="w-5 h-5 text-blue-600"></i> ${vacuna ? 'Editar vacuna manual' : 'Agregar vacuna manual'}`;
    }
    if ($('vacuna-manual-nombre')) $('vacuna-manual-nombre').value = vacuna?.nombre || '';
    if ($('vacuna-manual-fecha')) $('vacuna-manual-fecha').value = vacuna?.fecha || (typeof fechaLocalISO === 'function' ? fechaLocalISO() : new Date().toISOString().slice(0, 10));
    if ($('vacuna-manual-refuerzo')) {
        const fechaAplicacion = fechaDesdeInputLocal(vacuna?.fecha || $('vacuna-manual-fecha')?.value);
        $('vacuna-manual-refuerzo').value = vacuna?.fechaRefuerzo || fechaInputDesdeFecha(fechaMasUnAnio(fechaAplicacion));
    }
    if ($('vacuna-manual-lote')) $('vacuna-manual-lote').value = vacuna?.lote || '';
    if ($('vacuna-manual-laboratorio')) $('vacuna-manual-laboratorio').value = vacuna?.laboratorio || '';
    if ($('vacuna-manual-desparasitante')) $('vacuna-manual-desparasitante').value = vacuna?.desparasitante || '';
    if ($('vacuna-manual-nota')) $('vacuna-manual-nota').value = vacuna?.nota || '';
    setHidden('modal-vacuna-manual', false);
    renderIcons();
}

function cerrarModalVacunaManual() {
    setHidden('modal-vacuna-manual', true);
}

function actualizarRefuerzoVacunaManual() {
    const fecha = fechaDesdeInputLocal($('vacuna-manual-fecha')?.value);
    if ($('vacuna-manual-refuerzo')) {
        $('vacuna-manual-refuerzo').value = fechaInputDesdeFecha(fechaMasUnAnio(fecha));
    }
}

function guardarVacunaManual(event) {
    event.preventDefault();
    const ownerId = parseInt($('vacuna-manual-owner-id')?.value || 0);
    const petId = parseInt($('vacuna-manual-pet-id')?.value || 0);
    const vacunaId = parseInt($('vacuna-manual-id')?.value || 0);
    const owner = clientes.find(c => c.id === ownerId);
    const pet = owner?.mascotas.find(m => m.id === petId);
    if (!owner || !pet) return;
    const fecha = $('vacuna-manual-fecha')?.value || '';
    const fechaRefuerzo = $('vacuna-manual-refuerzo')?.value || fechaInputDesdeFecha(fechaMasUnAnio(fechaDesdeInputLocal(fecha)));
    const registro = {
        id: vacunaId || uid(),
        nombre: $('vacuna-manual-nombre')?.value.trim() || 'Vacuna manual',
        fecha,
        fechaRefuerzo,
        lote: $('vacuna-manual-lote')?.value.trim() || '',
        laboratorio: $('vacuna-manual-laboratorio')?.value.trim() || '',
        desparasitante: $('vacuna-manual-desparasitante')?.value.trim() || '',
        nota: $('vacuna-manual-nota')?.value.trim() || '',
        fechaISO: new Date().toISOString()
    };
    pet.vacunasManuales = vacunasManualesPaciente(pet);
    if (vacunaId) {
        pet.vacunasManuales = pet.vacunasManuales.map(vacuna => vacuna.id === vacunaId ? registro : vacuna);
    } else {
        pet.vacunasManuales.unshift(registro);
    }
    saveStore('clientes');
    cerrarModalVacunaManual();
    renderHistorialClinicoActivo();
}

function eliminarVacunaManual(ownerId, petId, vacunaId) {
    if (!confirm('¿Eliminar esta vacuna manual del expediente?')) return;
    const owner = clientes.find(c => c.id === ownerId);
    const pet = owner?.mascotas.find(m => m.id === petId);
    if (!pet) return;
    pet.vacunasManuales = vacunasManualesPaciente(pet).filter(vacuna => vacuna.id !== vacunaId);
    saveStore('clientes');
    renderHistorialClinicoActivo();
}

function archivoEsPDF(file) {
    return file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
}

function fechaEstudioTexto(estudio) {
    if (estudio.fecha) return estudio.fecha;
    if (!estudio.fechaISO) return 'Sin fecha';
    const fecha = new Date(estudio.fechaISO);
    return Number.isNaN(fecha.getTime()) ? 'Sin fecha' : formatoFechaCorta(fecha);
}

function renderEstudiosClinicos(owner, pet) {
    const estudios = estudiosPaciente(pet)
        .slice()
        .sort((a, b) => new Date(b.fechaISO || b.fecha || 0).getTime() - new Date(a.fechaISO || a.fecha || 0).getTime());
    return `
        <section class="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <p class="text-[10px] font-bold uppercase text-slate-400">Archivos clínicos</p>
                    <h4 class="text-base font-black text-slate-900">Estudios y resultados</h4>
                </div>
                <button type="button" onclick="abrirModalEstudioClinico(${owner.id}, ${pet.id})" class="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center justify-center gap-1">
                    <i data-lucide="file-plus-2" class="w-4 h-4"></i> Adjuntar PDF
                </button>
            </div>
            ${estudios.length ? `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    ${estudios.map(estudio => `
                        <article class="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-start gap-3">
                            <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 border border-rose-100 flex items-center justify-center shrink-0">
                                <i data-lucide="file-text" class="w-5 h-5"></i>
                            </div>
                            <div class="min-w-0 flex-1">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <p class="text-sm font-black text-slate-900 truncate">${escapeHTML(estudio.nombre || 'Estudio clínico')}</p>
                                        <p class="text-[11px] font-bold text-blue-700">${escapeHTML(estudio.tipo || 'Resultado')} · ${escapeHTML(fechaEstudioTexto(estudio))}</p>
                                    </div>
                                    <button type="button" onclick="eliminarEstudioClinico(${owner.id}, ${pet.id}, ${estudio.id})" class="text-slate-400 hover:text-rose-600 p-1 shrink-0" title="Eliminar">
                                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                                    </button>
                                </div>
                                ${estudio.notas ? `<p class="text-xs text-slate-500 mt-1 line-clamp-2">${escapeHTML(estudio.notas)}</p>` : ''}
                                <div class="flex items-center justify-between gap-2 mt-2">
                                    <p class="text-[10px] text-slate-400 truncate">${escapeHTML(estudio.archivoNombre || 'PDF')}</p>
                                    <a href="${estudio.archivoUrl}" target="_blank" rel="noopener" class="bg-white hover:bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shrink-0">
                                        <i data-lucide="external-link" class="w-3.5 h-3.5"></i> Abrir
                                    </a>
                                </div>
                            </div>
                        </article>
                    `).join('')}
                </div>
            ` : `<div class="border border-dashed border-slate-200 rounded-xl p-5 text-center text-xs text-slate-400">Aún no hay análisis, ultrasonidos o resultados adjuntos para este paciente.</div>`}
        </section>
    `;
}

function abrirModalEstudioClinico(ownerId, petId) {
    const owner = clientes.find(c => c.id === ownerId);
    const pet = owner?.mascotas.find(m => m.id === petId);
    if (!owner || !pet) return;
    $('form-estudio-clinico')?.reset();
    if ($('estudio-owner-id')) $('estudio-owner-id').value = ownerId;
    if ($('estudio-pet-id')) $('estudio-pet-id').value = petId;
    if ($('estudio-fecha')) $('estudio-fecha').value = typeof fechaLocalISO === 'function' ? fechaLocalISO() : new Date().toISOString().slice(0, 10);
    if ($('estudio-paciente-label')) $('estudio-paciente-label').innerText = `${pet.name} | ${owner.owner}`;
    setHidden('modal-estudio-clinico', false);
    renderIcons();
}

function cerrarModalEstudioClinico() {
    setHidden('modal-estudio-clinico', true);
}

async function guardarEstudioClinico(event) {
    event.preventDefault();
    const ownerId = parseInt($('estudio-owner-id')?.value || 0);
    const petId = parseInt($('estudio-pet-id')?.value || 0);
    const owner = clientes.find(c => c.id === ownerId);
    const pet = owner?.mascotas.find(m => m.id === petId);
    const file = $('estudio-archivo')?.files?.[0];
    if (!owner || !pet) return;
    if (!archivoEsPDF(file)) {
        alert('Selecciona un archivo PDF válido.');
        return;
    }
    const boton = $('btn-guardar-estudio');
    if (boton) {
        boton.disabled = true;
        boton.innerText = 'Guardando...';
    }
    try {
        const estudioId = uid();
        const archivoUrl = typeof subirArchivoStorage === 'function'
            ? await subirArchivoStorage(file, 'estudios', `paciente-${petId}-estudio-${estudioId}`)
            : await archivoToDataUrl(file);
        pet.estudios = estudiosPaciente(pet);
        pet.estudios.unshift({
            id: estudioId,
            tipo: $('estudio-tipo')?.value || 'Estudio clínico',
            nombre: $('estudio-nombre')?.value.trim() || file.name,
            fecha: $('estudio-fecha')?.value || '',
            fechaISO: new Date().toISOString(),
            notas: $('estudio-notas')?.value.trim() || '',
            archivoNombre: file.name,
            archivoUrl
        });
        saveStore('clientes');
        cerrarModalEstudioClinico();
        renderHistorialClinicoActivo();
    } finally {
        if (boton) {
            boton.disabled = false;
            boton.innerHTML = '<i data-lucide="upload-cloud" class="w-4 h-4"></i> Guardar estudio';
            renderIcons();
        }
    }
}

function eliminarEstudioClinico(ownerId, petId, estudioId) {
    if (!confirm('¿Eliminar este estudio del expediente?')) return;
    const owner = clientes.find(c => c.id === ownerId);
    const pet = owner?.mascotas.find(m => m.id === petId);
    if (!pet) return;
    pet.estudios = estudiosPaciente(pet).filter(estudio => estudio.id !== estudioId);
    saveStore('clientes');
    renderHistorialClinicoActivo();
}

function proximaCitaMascota(petId) {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return agenda
        .filter(cita => cita.petId === petId && !['Atendida', 'Cancelada'].includes(cita.estado || 'Programada'))
        .map(cita => ({ ...cita, fechaObj: new Date(`${cita.fecha}T${cita.hora || '00:00'}`) }))
        .filter(cita => !Number.isNaN(cita.fechaObj.getTime()) && cita.fechaObj >= hoy)
        .sort((a, b) => a.fechaObj - b.fechaObj)[0];
}

function renderBotonesFiltroHistorial(historial) {
    const totalPendientes = historial.filter(h => (h.estadoPago || 'Pagado') === 'Pendiente').length;
    const filtros = [
        { id: 'todas', label: `Todas (${historial.length})` },
        { id: 'consultas', label: 'Consultas' },
        { id: 'vacunas', label: 'Vacunas' },
        { id: 'seguimiento', label: 'Seguimiento' },
        { id: 'pendientes', label: `Pendientes (${totalPendientes})` }
    ];
    return filtros.map(filtro => {
        const activo = historialActivo.filtro === filtro.id;
        return `<button type="button" onclick="cambiarFiltroHistorial('${filtro.id}')" class="px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${activo ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">${filtro.label}</button>`;
    }).join('');
}

function renderCardConsultaHistorial(owner, pet, consulta) {
    const fechaObj = fechaConsultaObj(consulta);
    const estadoPago = consulta.estadoPago || 'Pagado';
    const badgePago = claseBadgePago(estadoPago);
    const esVacuna = consulta.tipo === 'Vacunacion';
    const tituloClinico = esVacuna
        ? `Vacunas: ${consulta.vacunas || 'Ninguna especificada'}`
        : (consulta.motivo || consulta.sintomas || 'Consulta sin motivo registrado');
    const detalleHTML = esVacuna
        ? `
            <p class="text-xs text-slate-800"><b>Vacunas aplicadas:</b> ${consulta.vacunas || 'Ninguna'}</p>
            <p class="text-xs text-slate-800"><b>Desparasitante:</b> ${consulta.desparasitante || 'No'}</p>
        `
        : `
            <p class="text-xs text-slate-800"><b>Motivo:</b> ${consulta.motivo || 'Sin motivo registrado'}</p>
            <p class="text-xs text-slate-800"><b>Signos reportados:</b> <span class="italic text-gray-600">"${consulta.sintomas || 'Asintomático'}"</span></p>
        `;
    return `
        <details class="group bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
            <summary class="list-none cursor-pointer p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-50">
                <div class="flex items-start gap-3">
                    <div class="w-10 h-10 rounded-xl ${esVacuna ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'} flex items-center justify-center shrink-0 border">
                        <i data-lucide="${esVacuna ? 'syringe' : 'stethoscope'}" class="w-5 h-5"></i>
                    </div>
                    <div>
                        <div class="flex flex-wrap items-center gap-2">
                            <p class="text-sm font-black text-slate-900">${consulta.tipo || 'Consulta'}</p>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgePago}">${estadoPago}</span>
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5">${formatoFechaCorta(fechaObj)} · ${tituloClinico}</p>
                    </div>
                </div>
                <div class="flex items-center justify-between lg:justify-end gap-4">
                    <div class="text-right">
                        <p class="text-[10px] uppercase font-bold text-slate-400">Cobro</p>
                        <p class="text-sm font-black ${estadoPago === 'Pagado' ? 'text-emerald-700' : 'text-rose-700'}">$${Number(consulta.costoTotal || 0).toFixed(2)}</p>
                    </div>
                    <i data-lucide="chevron-down" class="w-4 h-4 text-slate-400 group-open:rotate-180 transition-transform"></i>
                </div>
            </summary>
            <div class="px-4 pb-4 space-y-3 border-t border-gray-100">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg mt-3">
                    <p><b>Peso:</b> ${consulta.peso || '--'} kg</p>
                    <p><b>Temp:</b> ${consulta.temp || '--'} °C</p>
                    <p><b>Método:</b> ${consulta.metodoPago || 'Efectivo'}</p>
                    <p><b>Servicio:</b> ${consulta.servicioCobrado || 'Sin servicio'}</p>
                </div>
                ${detalleHTML}
                <p class="text-xs text-slate-900 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-justify"><b>Receta/Cuidados:</b> ${consulta.tratamiento || 'Sin indicaciones registradas'}</p>
                ${consulta.notasRapidas ? `
                    <div class="bg-indigo-50 p-3 rounded-lg border border-indigo-200 space-y-2">
                        <p class="text-xs font-bold text-indigo-900">Notas rápidas de consulta</p>
                        <img src="${consulta.notasRapidas}" class="w-full max-h-64 object-contain bg-white rounded-lg border border-indigo-100">
                    </div>
                ` : ''}
                ${consulta.insumos?.length ? `<div class="bg-blue-50 p-2 rounded-lg text-[10px] border border-blue-100 text-blue-900"><b>Insumos:</b> ${consulta.insumos.map(i=>`${i.name} [x${i.qty}]`).join(', ')}</div>` : ''}
                <details class="bg-slate-950 text-slate-300 text-[10px] p-3 rounded-lg font-mono leading-relaxed">
                    <summary class="cursor-pointer text-amber-400 font-bold uppercase">Ver responsiva firmada y firmas</summary>
                    <p class="mt-2">${consulta.disclaimer || 'Sin cláusula registrada.'}</p>
                    <div class="flex justify-between items-center pt-2 mt-2 border-t border-slate-800">
                        <img src="${consulta.firmaDueno}" class="h-9 object-contain mx-auto bg-white rounded px-1">
                        <img src="${consulta.firmaVet}" class="h-9 object-contain mx-auto bg-white rounded px-1">
                    </div>
                </details>
                <div class="flex flex-wrap gap-2 justify-end">
                    ${estadoPago === 'Pendiente' ? `<button type="button" onclick="marcarConsultaPagada(${owner.id}, ${pet.id}, ${consulta.id})" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-bold px-3 py-2 rounded-lg border border-emerald-200 flex items-center gap-1 transition-all"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Marcar pagado</button>` : ''}
                    <button type="button" onclick="abrirModalEditarConsulta(${owner.id}, ${pet.id}, ${consulta.id})" class="bg-amber-50 hover:bg-amber-100 text-amber-700 text-[10px] font-bold px-3 py-2 rounded-lg border border-amber-200 flex items-center gap-1 transition-all">
                        <i data-lucide="file-pen-line" class="w-3.5 h-3.5"></i> Editar
                    </button>
                    <button type="button" onclick="eliminarConsultaHistorial(${owner.id}, ${pet.id}, ${consulta.id})" class="bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold px-3 py-2 rounded-lg border border-rose-200 flex items-center gap-1 transition-all">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Borrar
                    </button>
                    <button onclick="descargarResponsivaHistorialPDF(${owner.id}, ${pet.id}, ${consulta.id})" class="bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold px-3 py-2 rounded-lg border border-blue-200 flex items-center gap-1 transition-all">
                        <i data-lucide="download" class="w-3.5 h-3.5"></i> Descargar PDF
                    </button>
                </div>
            </div>
        </details>
    `;
}

function renderHistorialClinicoActivo() {
    const owner = clientes.find(c => c.id === historialActivo.ownerId);
    const pet = owner?.mascotas.find(m => m.id === historialActivo.petId);
    if (!owner || !pet) return;
    if($('historial-subtitulo-paciente')) {
        $('historial-subtitulo-paciente').innerText = `${pet.name} | ${owner.owner}`;
    }
    const contenedor = $('historial-contenedor-consultas');
    if(!contenedor) return;
    const historial = [...(pet.historial || [])].sort((a, b) => (fechaConsultaObj(b)?.getTime() || 0) - (fechaConsultaObj(a)?.getTime() || 0));
    const estudios = estudiosPaciente(pet);
    const filtradas = consultasFiltradasHistorial(historial);
    const ultimaConsulta = historial[0];
    const ultimaVacuna = historial.find(h => h.tipo === 'Vacunacion' && h.vacunas);
    const pendientes = historial.filter(h => (h.estadoPago || 'Pagado') === 'Pendiente');
    const montoPendiente = pendientes.reduce((acc, h) => acc + (parseFloat(h.costoTotal) || 0), 0);
    const proxima = proximaCitaMascota(pet.id);
    const avatar = pet.photo
        ? `<img src="${pet.photo}" class="w-16 h-16 rounded-xl object-cover border border-slate-200">`
        : `<div class="w-16 h-16 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100"><i data-lucide="paw-print" class="w-7 h-7"></i></div>`;
    contenedor.innerHTML = `
        <section class="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    ${avatar}
                    <div>
                        <h4 class="text-xl font-black text-slate-900">${pet.name}</h4>
                        <p class="text-xs text-slate-500">${pet.species || 'Especie sin registrar'} · ${pet.age || 'Edad sin registrar'} · Dueño: ${owner.owner}</p>
                        <p class="text-[11px] text-slate-400">${owner.phone || 'Sin teléfono'} · ${owner.address || 'Sin dirección'}</p>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 justify-end">
                    <button onclick="cerrarModalHistorial(); cargarPacienteAConsulta(${owner.id}, ${pet.id})" class="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1">
                        <i data-lucide="stethoscope" class="w-4 h-4"></i> Nueva consulta
                    </button>
                    <button onclick="prepararAgendaDesdeExpediente(${owner.id}, ${pet.id})" class="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3 py-2 rounded-xl border border-blue-100 flex items-center gap-1">
                        <i data-lucide="calendar-plus" class="w-4 h-4"></i> Agendar
                    </button>
                    <button type="button" onclick="abrirModalEstudioClinico(${owner.id}, ${pet.id})" class="bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 flex items-center gap-1">
                        <i data-lucide="file-plus-2" class="w-4 h-4"></i> Adjuntar estudio
                    </button>
                </div>
            </div>
        </section>
        <section class="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <div class="bg-white border rounded-xl p-3">
                <p class="text-[10px] font-bold uppercase text-slate-400">Consultas</p>
                <p class="text-xl font-black text-slate-900">${historial.length}</p>
            </div>
            <div class="bg-white border rounded-xl p-3">
                <p class="text-[10px] font-bold uppercase text-slate-400">Estudios</p>
                <p class="text-xl font-black text-slate-900">${estudios.length}</p>
            </div>
            <div class="bg-white border rounded-xl p-3">
                <p class="text-[10px] font-bold uppercase text-slate-400">Último peso</p>
                <p class="text-xl font-black text-slate-900">${ultimaConsulta?.peso || '--'} <span class="text-xs font-bold text-slate-400">kg</span></p>
            </div>
            <div class="bg-white border rounded-xl p-3">
                <p class="text-[10px] font-bold uppercase text-slate-400">Última visita</p>
                <p class="text-sm font-black text-slate-900">${formatoFechaCorta(fechaConsultaObj(ultimaConsulta || {}))}</p>
            </div>
            <div class="bg-white border rounded-xl p-3">
                <p class="text-[10px] font-bold uppercase text-slate-400">Próxima cita</p>
                <p class="text-sm font-black text-slate-900">${proxima ? `${proxima.fecha} · ${proxima.hora}` : 'Sin cita'}</p>
            </div>
            <div class="bg-white border rounded-xl p-3 ${montoPendiente ? 'border-rose-200 bg-rose-50' : ''}">
                <p class="text-[10px] font-bold uppercase ${montoPendiente ? 'text-rose-600' : 'text-slate-400'}">Pendiente</p>
                <p class="text-xl font-black ${montoPendiente ? 'text-rose-700' : 'text-slate-900'}">$${montoPendiente.toFixed(2)}</p>
            </div>
        </section>
        ${ultimaVacuna ? `<section class="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-900"><b>Últimas vacunas:</b> ${ultimaVacuna.vacunas} · ${formatoFechaCorta(fechaConsultaObj(ultimaVacuna))}</section>` : ''}
        ${renderVacunasYRefuerzos(owner, pet)}
        ${renderEstudiosClinicos(owner, pet)}
        <section class="flex flex-wrap gap-2">
            ${renderBotonesFiltroHistorial(historial)}
        </section>
        <section class="space-y-3">
            ${filtradas.length
                ? filtradas.map(consulta => renderCardConsultaHistorial(owner, pet, consulta)).join('')
                : `<div class="bg-white border rounded-xl p-8 text-center text-xs text-gray-400">No hay registros para este filtro.</div>`
            }
        </section>
    `;
    renderIcons();
}

function abrirModalHistorial(ownerId, petId) {
    const owner = clientes.find(c => c.id === ownerId);
    const pet = owner?.mascotas.find(m => m.id === petId);
    if (!pet) return;
    historialActivo = { ownerId, petId, filtro: 'todas' };
    renderHistorialClinicoActivo();
    $('modal-historial-clinico')?.classList.remove('hidden');
    renderIcons();
}
function cerrarModalHistorial() { $('modal-historial-clinico')?.classList.add('hidden'); }
function buscarConsultaHistorial(ownerId, petId, consultaId) {
    const owner = clientes.find(c => c.id === ownerId);
    const pet = owner?.mascotas.find(m => m.id === petId);
    const consulta = pet?.historial?.find(h => h.id === consultaId);
    return { owner, pet, consulta };
}
function abrirModalEditarConsulta(ownerId, petId, consultaId) {
    const { owner, pet, consulta } = buscarConsultaHistorial(ownerId, petId, consultaId);
    if (!owner || !pet || !consulta) return;
    $('editar-consulta-owner-id').value = ownerId;
    $('editar-consulta-pet-id').value = petId;
    $('editar-consulta-id').value = consultaId;
    $('editar-consulta-label').innerText = `${pet.name} | ${owner.owner}`;
    $('editar-consulta-tipo').value = consulta.tipo || 'Inicial';
    $('editar-consulta-peso').value = consulta.peso || '';
    $('editar-consulta-temp').value = consulta.temp || '';
    $('editar-consulta-motivo').value = consulta.motivo || '';
    $('editar-consulta-vacunas').value = consulta.vacunas || '';
    $('editar-consulta-desparasitante').value = consulta.desparasitante || '';
    $('editar-consulta-sintomas').value = consulta.sintomas || '';
    $('editar-consulta-tratamiento').value = consulta.tratamiento || '';
    $('editar-consulta-servicio').value = consulta.servicioCobrado || '';
    $('editar-consulta-total').value = consulta.costoTotal || 0;
    $('editar-consulta-metodo').value = consulta.metodoPago || 'Efectivo';
    $('editar-consulta-estado').value = consulta.estadoPago || 'Pagado';
    $('editar-consulta-nota-pago').value = consulta.notaPago || '';
    setHidden('modal-editar-consulta', false);
    renderIcons();
}
function cerrarModalEditarConsulta() {
    setHidden('modal-editar-consulta', true);
}
function guardarEdicionConsulta(event) {
    event.preventDefault();
    const ownerId = parseInt($('editar-consulta-owner-id')?.value || 0);
    const petId = parseInt($('editar-consulta-pet-id')?.value || 0);
    const consultaId = parseInt($('editar-consulta-id')?.value || 0);
    const { consulta } = buscarConsultaHistorial(ownerId, petId, consultaId);
    if (!consulta) return;
    consulta.tipo = $('editar-consulta-tipo')?.value || consulta.tipo;
    consulta.peso = $('editar-consulta-peso')?.value || '--';
    consulta.temp = $('editar-consulta-temp')?.value || '--';
    consulta.motivo = $('editar-consulta-motivo')?.value || '';
    consulta.vacunas = $('editar-consulta-vacunas')?.value || null;
    consulta.desparasitante = $('editar-consulta-desparasitante')?.value || null;
    consulta.sintomas = $('editar-consulta-sintomas')?.value || '';
    consulta.tratamiento = $('editar-consulta-tratamiento')?.value || '';
    consulta.servicioCobrado = $('editar-consulta-servicio')?.value || 'Sin servicio registrado';
    consulta.costoTotal = parseFloat($('editar-consulta-total')?.value || 0);
    consulta.metodoPago = $('editar-consulta-metodo')?.value || 'Efectivo';
    consulta.estadoPago = $('editar-consulta-estado')?.value || 'Pagado';
    consulta.notaPago = $('editar-consulta-nota-pago')?.value || '';
    consulta.editadoEn = new Date().toISOString();
    saveStore('clientes');
    cerrarModalEditarConsulta();
    renderHistorialClinicoActivo();
    if (typeof renderGananciasConsultas === 'function') renderGananciasConsultas();
    if (typeof renderDashboard === 'function') renderDashboard();
}
function eliminarConsultaHistorial(ownerId, petId, consultaId) {
    if (!confirm('¿Borrar esta consulta del expediente? Esta acción también la quitará de finanzas.')) return;
    const { pet } = buscarConsultaHistorial(ownerId, petId, consultaId);
    if (!pet) return;
    pet.historial = (pet.historial || []).filter(consulta => consulta.id !== consultaId);
    saveStore('clientes');
    renderHistorialClinicoActivo();
    if (typeof renderGananciasConsultas === 'function') renderGananciasConsultas();
    if (typeof renderDashboard === 'function') renderDashboard();
}
function prepararAgendaDesdeExpediente(ownerId, petId) {
    const owner = clientes.find(c => c.id === ownerId);
    const pet = owner?.mascotas.find(m => m.id === petId);
    if (!owner || !pet) return;
    cerrarModalHistorial();
    switchTab('agenda');
    actualizarSelectAgenda();
    if ($('agenda-cliente-select')) $('agenda-cliente-select').value = `${ownerId}|${petId}`;
    if ($('agenda-direccion')) $('agenda-direccion').value = owner.address || '';
    if ($('agenda-notes')) $('agenda-notes').value = `Seguimiento de ${pet.name}`;
}
function telefonoLimpio(telefono) {
    return String(telefono || '').replace(/\D/g, '');
}
function tienePagoPendienteCliente(cliente) {
    return (cliente.mascotas || []).some(mascota => (mascota.historial || []).some(con => (con.estadoPago || 'Pagado') === 'Pendiente'));
}
function tieneProximaCitaCliente(cliente) {
    const hoy = typeof fechaLocalISO === 'function' ? fechaLocalISO() : new Date().toISOString().slice(0, 10);
    return agenda.some(cita => (cita.clienteId || cita.ownerId) === cliente.id && cita.fecha >= hoy && !['Atendida', 'Cancelada'].includes(cita.estado || 'Programada'));
}
function ultimaVisitaCliente(cliente) {
    const visitas = (cliente.mascotas || []).flatMap(mascota => (mascota.historial || []).map(con => fechaConsultaObj(con)).filter(Boolean));
    if (!visitas.length) return null;
    return visitas.sort((a, b) => b - a)[0];
}
function filtrarClientes(filtro) {
    filtroClientesActivo = filtro;
    renderClientes();
}
function renderClientes() {
    const buscadorElem = $('buscador');
    const buscador = buscadorElem ? buscadorElem.value.toLowerCase() : "";
    const lista = $('lista-clientes');
    if(!lista) return;
    lista.innerHTML = "";
    const coincide = valor => String(valor || '').toLowerCase().includes(buscador);
    let filtrados = clientes
        .filter(c =>
            coincide(c.owner) ||
            coincide(c.phone) ||
            coincide(c.address) ||
            (c.mascotas || []).some(m => coincide(m.name))
        )
        .filter(c => {
            if (filtroClientesActivo === 'con-id') return !!c.ownerIdFile;
            if (filtroClientesActivo === 'sin-id') return !c.ownerIdFile;
            if (filtroClientesActivo === 'pendientes') return tienePagoPendienteCliente(c);
            if (filtroClientesActivo === 'proxima-cita') return tieneProximaCitaCliente(c);
            return true;
        });
    if($('contador-registros')) {
        $('contador-registros').innerText = `${filtrados.length} expedientes`;
    }
    if(filtrados.length === 0) {
        lista.innerHTML = `
            <div class="text-center text-gray-400 text-xs py-12 border border-dashed rounded-2xl bg-slate-50">
                <i data-lucide="search-x" class="w-10 h-10 mx-auto text-gray-300 mb-2"></i>
                <p class="font-bold text-slate-500">Sin expedientes encontrados</p>
                <p class="text-[11px] mt-1">Prueba buscar por dueño, mascota, teléfono o dirección.</p>
            </div>`;
        renderIcons();
        return;
    }
    filtrados.forEach(c => {
        const mascotasCoincidentes = buscador
            ? (c.mascotas || []).filter(m => coincide(m.name)).map(m => m.name)
            : [];
        const ultimaVisita = ultimaVisitaCliente(c);
        const pagosPendientes = tienePagoPendienteCliente(c);
        const proximaCita = tieneProximaCitaCliente(c);
        const tel = telefonoLimpio(c.phone);
        const div = document.createElement('div');
        div.className = "p-4 bg-white rounded-xl border border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-blue-200 hover:shadow-xs transition-all";
        div.innerHTML = `
            <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                    <h4 class="text-sm font-bold text-slate-900">${c.owner}</h4>
                    ${c.ownerIdFile ? `<button type="button" onclick="abrirVisorID('${c.ownerIdFile}')" class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1"><i data-lucide="badge-check" class="w-3 h-3"></i> ID verificado</button>` : `<span class="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">ID pendiente</span>`}
                </div>
                <p class="text-xs text-gray-500">📍 ${c.address} • 📱 ${c.phone}</p>
                <div class="flex flex-wrap gap-1.5">
                    <span class="text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">${c.mascotas ? c.mascotas.length : 0} mascotas</span>
                    <span class="text-[11px] font-bold text-slate-600 bg-slate-50 border px-2 py-0.5 rounded-full">Última visita: ${ultimaVisita ? formatoFechaCorta(ultimaVisita) : 'Sin visitas'}</span>
                    ${pagosPendientes ? `<span class="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">Pago pendiente</span>` : ''}
                    ${proximaCita ? `<span class="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">Próxima cita</span>` : ''}
                </div>
                ${c.ownerNotes ? `<p class="text-[11px] text-slate-500 italic">Nota: ${c.ownerNotes}</p>` : ''}
                ${mascotasCoincidentes.length ? `<p class="text-[11px] font-semibold text-emerald-700">Mascota encontrada: ${mascotasCoincidentes.join(', ')}</p>` : ''}
            </div>
            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                ${tel ? `<a href="tel:${tel}" class="p-2 border bg-white hover:bg-blue-50 rounded-xl text-blue-600 transition-all shadow-xs" title="Llamar"><i data-lucide="phone" class="w-4 h-4"></i></a>` : ''}
                ${tel ? `<a href="https://wa.me/52${tel}" target="_blank" rel="noopener" class="p-2 border bg-white hover:bg-emerald-50 rounded-xl text-emerald-600 transition-all shadow-xs" title="WhatsApp"><i data-lucide="message-circle" class="w-4 h-4"></i></a>` : ''}
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
    fotoIdentificacionCapturada = '';
    actualizarPreviewIdentificacion('');
    $('edit-cliente-id').value = id || '';
    if (id) {
        const c = clientes.find(cl => cl.id === id);
        $('owner').value = c.owner; 
        $('address').value = c.address;
        $('phone').value = c.phone; 
        $('email').value = c.email || '';
        if ($('owner-notes')) $('owner-notes').value = c.ownerNotes || '';
        if (c.ownerIdFile) actualizarPreviewIdentificacion(c.ownerIdFile);
        $('titulo-form-cliente').innerHTML = `<i data-lucide="edit" class="text-amber-600 w-5 h-5"></i> Modificar Propietario`;
    } else { 
        $('titulo-form-cliente').innerHTML = `<i data-lucide="user-plus" class="text-blue-600 w-5 h-5"></i> Registrar Propietario`; 
    }
    $('modal-cliente').classList.remove('hidden');
    renderIcons();
}
function cerrarModalCliente() { $('modal-cliente').classList.add('hidden'); }
function actualizarPreviewIdentificacion(src) {
    const preview = $('owner-id-preview');
    const img = $('owner-id-preview-img');
    if (!preview || !img) return;
    preview.classList.toggle('hidden', !src);
    if (src) img.src = src;
}
function actualizarPreviewIdentificacionArchivo(file) {
    if (!file) {
        actualizarPreviewIdentificacion('');
        return;
    }
    if (!archivoEsImagenIdentificacion(file)) {
        alert("La identificación debe ser una fotografía o imagen válida: JPG, PNG, HEIC o WebP. No se aceptan PDF u otros archivos.");
        $('owner-id-file').value = "";
        actualizarPreviewIdentificacion('');
        return;
    }
    const reader = new FileReader();
    reader.onload = ev => actualizarPreviewIdentificacion(ev.target.result);
    reader.readAsDataURL(file);
}
function archivoEsImagenIdentificacion(file) {
    if (!file) return true;
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    const extensionesPermitidas = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    const extension = String(file.name || '').split('.').pop().toLowerCase();
    return tiposPermitidos.includes(file.type) || extensionesPermitidas.includes(extension);
}
async function abrirCamaraIdentificacion() {
    if (!navigator.mediaDevices?.getUserMedia) {
        alert("Este navegador no permite abrir la cámara desde la app. Usa el botón de archivo para tomar o seleccionar la foto.");
        return;
    }
    $('modal-captura-id')?.classList.remove('hidden');
    try {
        streamIdentificacion = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        const video = $('video-captura-id');
        if (video) video.srcObject = streamIdentificacion;
    } catch (error) {
        console.error('No se pudo abrir la cámara para identificación.', error);
        alert("No se pudo abrir la cámara. Revisa permisos del navegador o usa el selector de archivo.");
        cerrarCamaraIdentificacion();
    }
    renderIcons();
}
function cerrarCamaraIdentificacion() {
    if (streamIdentificacion) {
        streamIdentificacion.getTracks().forEach(track => track.stop());
        streamIdentificacion = null;
    }
    const video = $('video-captura-id');
    if (video) video.srcObject = null;
    $('modal-captura-id')?.classList.add('hidden');
}
function capturarIdentificacionGuiada() {
    const video = $('video-captura-id');
    const canvas = $('canvas-captura-id');
    if (!video || !canvas || !video.videoWidth) {
        alert("La cámara todavía no está lista.");
        return;
    }
    const aspect = 1.58;
    let cropWidth = video.videoWidth * 0.84;
    let cropHeight = cropWidth / aspect;
    if (cropHeight > video.videoHeight * 0.72) {
        cropHeight = video.videoHeight * 0.72;
        cropWidth = cropHeight * aspect;
    }
    const sx = (video.videoWidth - cropWidth) / 2;
    const sy = (video.videoHeight - cropHeight) / 2;
    canvas.width = 1000;
    canvas.height = Math.round(1000 / aspect);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
    fotoIdentificacionCapturada = canvas.toDataURL('image/jpeg', 0.9);
    if ($('owner-id-file')) $('owner-id-file').value = '';
    actualizarPreviewIdentificacion(fotoIdentificacionCapturada);
    cerrarCamaraIdentificacion();
}
function validarYPrevenirDuplicado(e) {
    e.preventDefault();
    const id = $('edit-cliente-id').value;
    const ow = $('owner').value; 
    const ph = $('phone').value;
    const ad = $('address').value; 
    const em = $('email').value;
    const notes = $('owner-notes')?.value || '';
    const f = $('owner-id-file');
    if(!id && clientes.find(c => c.owner.toLowerCase() === ow.toLowerCase() || c.phone === ph)) {
        alert("Ya existe un cliente registrado con este nombre o teléfono."); 
        return;
    }
    if (fotoIdentificacionCapturada) {
        finalizarGuardadoCliente(ow, ph, ad, em, fotoIdentificacionCapturada, notes, id);
    } else if(f && f.files[0]) {
        if (!archivoEsImagenIdentificacion(f.files[0])) {
            alert("La identificación debe ser una fotografía o imagen válida: JPG, PNG, HEIC o WebP. No se aceptan PDF u otros archivos.");
            f.value = "";
            return;
        }
        const r = new FileReader(); 
        r.onload = ev => { finalizarGuardadoCliente(ow, ph, ad, em, ev.target.result, notes, id); }; 
        r.readAsDataURL(f.files[0]);
    } else {
        const exist = clientes.find(c=>c.id===parseInt(id)); 
        finalizarGuardadoCliente(ow, ph, ad, em, exist?.ownerIdFile, notes, id);
    }
}
async function finalizarGuardadoCliente(ow, ph, ad, em, b64, notes, id) {
    if (b64?.startsWith('data:image/') && typeof subirImagenDataUrl === 'function') {
        b64 = await subirImagenDataUrl(b64, 'identificaciones', `propietario-${id || Date.now()}`);
    }
    if(id) {
        clientes = clientes.map(c => c.id===parseInt(id) ? {...c, owner:ow, phone:ph, address:ad, email:em, ownerNotes: notes, ownerIdFile:b64||c.ownerIdFile} : c);
    } else {
        clientes.push({ id: Date.now(), owner:ow, phone:ph, address:ad, email:em, ownerNotes: notes, ownerIdFile:b64, mascotas: [] });
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
            if(pId) c.mascotas = c.mascotas.map(m => m.id===parseInt(pId) ? {...m, name:nm, species:sp, age:ag, spayed:spy, photo:b64||m.photo, estudios: estudiosPaciente(m), vacunasManuales: vacunasManualesPaciente(m)} : m);
            else c.mascotas.push({ id: Date.now(), name:nm, species:sp, age:ag, spayed:spy, photo:b64, estudios:[], vacunasManuales:[], historial:[] });
        }
        return c;
    });
    saveStore('clientes'); 
    cerrarModalMascota(); 
    renderSubpaginaMascotas(); 
    actualizarSelectAgenda();
}
