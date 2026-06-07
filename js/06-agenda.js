// Agenda: búsqueda de pacientes, calendario mensual, reagenda y recordatorios.
// Este archivo se usa desde handlers inline del HTML, por eso las funciones quedan en scope global.
function actualizarSelectAgenda() {
    const sel = $('agenda-cliente-select'); 
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Vincular Propietario --</option>';
    clientes.forEach(c => {
        if(c.mascotas && c.mascotas.length > 0) {
            c.mascotas.forEach(m => {
                const label = `${c.owner} (${m.name})`;
                sel.innerHTML += `<option value="${c.id}|${m.id}">${label}</option>`;
            });
        } else {
            const label = `${c.owner} (Sin mascotas)`;
            sel.innerHTML += `<option value="${c.id}|">${label}</option>`;
        }
    });
}
function seleccionarClienteAgendaPorBusqueda() {
    const texto = $('agenda-cliente-buscar')?.value.trim() || '';
    const select = $('agenda-cliente-select');
    if (!select) return;
    const normalizado = texto.toLowerCase();
    const opciones = Array.from(select.options).filter(opt => opt.value);
    const opcion = opciones.find(opt => opt.textContent.toLowerCase() === normalizado)
        || opciones.find(opt => opt.textContent.toLowerCase().replace(/\s*\(sin mascotas\)\s*$/, '') === normalizado);
    select.value = opcion?.value || '';
    if (opcion) {
        autocompletarDireccionAgenda();
        if ($('agenda-cliente-status')) $('agenda-cliente-status').textContent = 'Propietario encontrado en expedientes.';
        $('agenda-cliente-status')?.classList.remove('text-amber-600');
        $('agenda-cliente-status')?.classList.add('text-emerald-600');
    } else {
        if ($('agenda-cliente-status')) $('agenda-cliente-status').textContent = texto ? 'No existe todavía. Al guardar se pedirá confirmación para crear el propietario.' : 'Elige un propietario o mascota. Si no existe, se pedirá confirmación al guardar.';
        $('agenda-cliente-status')?.classList.remove('text-emerald-600');
        $('agenda-cliente-status')?.classList.add('text-amber-600');
    }
    renderSugerenciasAgendaCliente();
}
function opcionesAgendaClienteFiltradas() {
    const select = $('agenda-cliente-select');
    const texto = $('agenda-cliente-buscar')?.value.trim().toLowerCase() || '';
    if (!select) return [];
    const opciones = Array.from(select.options).filter(opt => opt.value);
    const filtradas = texto
        ? opciones.filter(opt => opt.textContent.toLowerCase().includes(texto))
        : opciones;
    return filtradas.slice(0, 8);
}
function renderSugerenciasAgendaCliente() {
    const contenedor = $('agenda-cliente-sugerencias');
    if (!contenedor) return;
    const opciones = opcionesAgendaClienteFiltradas();
    const texto = $('agenda-cliente-buscar')?.value.trim() || '';
    if (!opciones.length && !texto) {
        contenedor.classList.add('hidden');
        contenedor.innerHTML = '';
        return;
    }
    if (!opciones.length) {
        contenedor.classList.remove('hidden');
        contenedor.innerHTML = `<div class="agenda-suggestion-empty">No hay coincidencias. Se pedirá confirmación al guardar.</div>`;
        return;
    }
    contenedor.classList.remove('hidden');
    contenedor.innerHTML = opciones.map(opt => `
        <button type="button" onclick="seleccionarSugerenciaAgendaCliente('${opt.value}')" class="agenda-suggestion-item">
            <span>${opt.textContent}</span>
        </button>
    `).join('');
}
function seleccionarSugerenciaAgendaCliente(valor) {
    const select = $('agenda-cliente-select');
    const input = $('agenda-cliente-buscar');
    if (!select || !input) return;
    select.value = valor;
    input.value = select.selectedOptions?.[0]?.textContent || '';
    $('agenda-cliente-sugerencias')?.classList.add('hidden');
    if ($('agenda-cliente-status')) $('agenda-cliente-status').textContent = 'Propietario encontrado en expedientes.';
    $('agenda-cliente-status')?.classList.remove('text-amber-600');
    $('agenda-cliente-status')?.classList.add('text-emerald-600');
    autocompletarDireccionAgenda();
}
function sincronizarBusquedaClienteAgenda() {
    const select = $('agenda-cliente-select');
    const input = $('agenda-cliente-buscar');
    if (!select || !input) return;
    input.value = select.selectedOptions?.[0]?.textContent || '';
}
function autocompletarDireccionAgenda() {
    const selectVal = $('agenda-cliente-select').value;
    if(!selectVal) {
        $('agenda-clinica-detalle')?.classList.add('hidden');
        return;
    }
    if (selectVal.startsWith('clinic|')) {
        const clinica = typeof clinicaExternaPorId === 'function' ? clinicaExternaPorId(selectVal.split('|')[1]) : null;
        $('agenda-clinica-detalle')?.classList.remove('hidden');
        if ($('agenda-direccion')) $('agenda-direccion').value = clinica?.direccion || '';
        if ($('agenda-clinica-servicio')) $('agenda-clinica-servicio').value = '';
        if ($('agenda-clinica-costo')) $('agenda-clinica-costo').value = '';
        renderIcons();
        return;
    }
    $('agenda-clinica-detalle')?.classList.add('hidden');
    if ($('agenda-clinica-servicio')) $('agenda-clinica-servicio').value = '';
    if ($('agenda-clinica-costo')) $('agenda-clinica-costo').value = '';
    const ownerId = parseInt(selectVal.split('|')[0]);
    const tgt = clientes.find(c => c.id === ownerId);
    if(tgt) $('agenda-direccion').value = tgt.address;
}
function crearPropietarioDesdeAgenda(nombre) {
    const limpio = String(nombre || '').trim();
    if (!limpio) return null;
    const existente = clientes.find(c => String(c.owner || '').toLowerCase() === limpio.toLowerCase());
    if (existente) return existente;
    const nuevo = {
        id: uid(),
        owner: limpio,
        phone: '',
        address: $('agenda-direccion')?.value.trim() || '',
        email: '',
        ownerNotes: 'Creado desde agenda',
        ownerIdFile: '',
        mascotas: []
    };
    clientes = [nuevo, ...clientes];
    registrarAuditoria('clientes', 'Crear', `Propietario creado desde agenda: ${limpio}`, nuevo.id);
    saveStore('clientes');
    actualizarSelectAgenda();
    if ($('agenda-cliente-select')) $('agenda-cliente-select').value = `${nuevo.id}|`;
    if ($('agenda-cliente-buscar')) $('agenda-cliente-buscar').value = nuevo.owner;
    return nuevo;
}
function sincronizarServicioExternoDesdeAgenda(cita, clinica, servicio, total) {
    if (!cita || !clinica) return;
    const existente = (serviciosExternos || []).find(item => item.agendaId === cita.id);
    const item = {
        id: existente?.id || uid(),
        fecha: cita.fecha,
        hora: cita.hora,
        fechaISO: existente?.fechaISO || new Date(`${cita.fecha}T12:00:00`).toISOString(),
        clienteNombre: clinica.nombre || cita.clienteNombre || 'Servicio externo',
        servicioCobrado: servicio || cita.notas || 'Servicio externo',
        direccion: cita.direccion || clinica.direccion || '',
        agendaId: cita.id,
        total: parseFloat(total || 0),
        metodoPago: existente?.metodoPago || 'Efectivo',
        estadoPago: existente?.estadoPago || 'Pendiente',
        notaPago: existente?.notaPago || '',
        abonos: existente?.abonos || [],
        clinicaId: clinica.id,
        tipo: 'Servicio externo'
    };
    serviciosExternos = existente
        ? serviciosExternos.map(servicioExterno => servicioExterno.id === item.id ? item : servicioExterno)
        : [item, ...(serviciosExternos || [])];
    saveStore('serviciosExternos');
    if (typeof renderServiciosExternos === 'function') renderServiciosExternos();
    if (typeof renderGananciasConsultas === 'function') renderGananciasConsultas();
}
let filtroAgendaActivo = 'todas';
let modoAgendaActivo = 'calendario';
let fechaAgendaSeleccionada = fechaLocalISO();
let detalleAgendaVisible = false;
let citaActivaId = null;
function capturarFormularioAgendaActivo() {
    const form = $('form-agenda');
    if (!form) return null;
    const tieneDatos = ['edit-agenda-id', 'agenda-fecha', 'agenda-hora', 'agenda-cliente-select', 'agenda-direccion', 'agenda-notes', 'agenda-clinica-servicio', 'agenda-clinica-costo']
        .some(id => String($(id)?.value || '').trim());
    if (!tieneDatos) return null;
    return {
        editId: $('edit-agenda-id')?.value || '',
        fecha: $('agenda-fecha')?.value || '',
        hora: $('agenda-hora')?.value || '',
        cliente: $('agenda-cliente-select')?.value || '',
        clienteBusqueda: $('agenda-cliente-buscar')?.value || '',
        direccion: $('agenda-direccion')?.value || '',
        notas: $('agenda-notes')?.value || '',
        clinicaServicio: $('agenda-clinica-servicio')?.value || '',
        clinicaCosto: $('agenda-clinica-costo')?.value || ''
    };
}
function restaurarFormularioAgendaActivo(snapshot) {
    if (!snapshot || !$('form-agenda')) return;
    if ($('edit-agenda-id')) $('edit-agenda-id').value = snapshot.editId;
    if ($('agenda-fecha')) $('agenda-fecha').value = snapshot.fecha;
    if ($('agenda-hora')) $('agenda-hora').value = snapshot.hora;
    if ($('agenda-cliente-select')) $('agenda-cliente-select').value = snapshot.cliente;
    if ($('agenda-cliente-buscar')) $('agenda-cliente-buscar').value = snapshot.clienteBusqueda;
    if ($('agenda-direccion')) $('agenda-direccion').value = snapshot.direccion;
    if ($('agenda-notes')) $('agenda-notes').value = snapshot.notas;
    if ($('agenda-clinica-servicio')) $('agenda-clinica-servicio').value = snapshot.clinicaServicio;
    if ($('agenda-clinica-costo')) $('agenda-clinica-costo').value = snapshot.clinicaCosto;
    if (snapshot.cliente?.startsWith('clinic|')) $('agenda-clinica-detalle')?.classList.remove('hidden');
    if (snapshot.editId && $('btn-cancelar-agenda')) {
        $('titulo-form-agenda').innerHTML = `<i data-lucide="calendar-range" class="text-amber-600 w-5 h-5"></i> Reagendar Visita`;
        $('btn-guardar-agenda').innerText = "Actualizar Cita";
        $('btn-cancelar-agenda').classList.remove('hidden');
    }
    renderHorariosRecomendados();
    renderIcons();
}
function fechaLocalISO(fecha = new Date()) {
    const offset = fecha.getTimezoneOffset() * 60000;
    return new Date(fecha.getTime() - offset).toISOString().split('T')[0];
}
function normalizarFechaCita(cita) {
    const valor = cita?.fecha || cita?.date || '';
    if (!valor) return '';
    const fechaTexto = String(valor).match(/^(\d{4}-\d{2}-\d{2})/);
    if (fechaTexto) return fechaTexto[1];
    const fecha = new Date(valor);
    if (!Number.isNaN(fecha.getTime())) return fechaLocalISO(fecha);
    return String(valor).slice(0, 10);
}
function horaCita(cita) {
    const valor = cita?.hora || cita?.time || '';
    if (!valor) return '--:--';
    return String(valor).slice(0, 5);
}
function fechaHoraCita(cita) {
    const fecha = normalizarFechaCita(cita);
    const hora = horaCita(cita);
    return new Date(`${fecha}T${hora === '--:--' ? '00:00' : hora}`);
}
function minutosAHora(minutos) {
    const h = String(Math.floor(minutos / 60)).padStart(2, '0');
    const m = String(minutos % 60).padStart(2, '0');
    return `${h}:${m}`;
}
function conflictoHorarioAgenda(fecha, hora, editId = '') {
    const nuevaFecha = new Date(`${fecha}T${hora}`);
    if (Number.isNaN(nuevaFecha.getTime())) return null;
    const idEditando = editId ? parseInt(editId) : null;
    return agenda.find(cita => {
        if (idEditando && cita.id === idEditando) return false;
        if (!['Programada', 'Confirmada'].includes(cita.estado || 'Programada')) return false;
        const fechaExistente = fechaHoraCita(cita);
        if (Number.isNaN(fechaExistente.getTime())) return false;
        const diferenciaMinutos = Math.abs(nuevaFecha.getTime() - fechaExistente.getTime()) / (1000 * 60);
        return diferenciaMinutos < 45;
    }) || null;
}
function seleccionarHoraRecomendada(hora) {
    if ($('agenda-hora')) $('agenda-hora').value = hora;
    renderHorariosRecomendados();
}
function horariosDisponiblesAgenda(fecha, editId = '') {
    if (!fecha) return [];
    const inicio = 9 * 60;
    const fin = 20 * 60;
    const ahora = new Date();
    const hoy = fechaLocalISO(ahora);
    const horarios = [];
    for (let minuto = inicio; minuto <= fin; minuto += 15) {
        const hora = minutosAHora(minuto);
        const fechaHora = new Date(`${fecha}T${hora}`);
        if (fecha === hoy && fechaHora < ahora) continue;
        if (!conflictoHorarioAgenda(fecha, hora, editId)) horarios.push(hora);
    }
    return horarios;
}
function renderHorariosRecomendados() {
    const contenedor = $('agenda-horarios-recomendados');
    if (!contenedor) return;
    const fecha = $('agenda-fecha')?.value || '';
    const horaActual = $('agenda-hora')?.value || '';
    const editId = $('edit-agenda-id')?.value || '';
    if (!fecha) {
        contenedor.innerHTML = `<span class="text-[11px] text-slate-400">Selecciona una fecha para ver horas libres.</span>`;
        return;
    }
    const disponibles = horariosDisponiblesAgenda(fecha, editId);
    const recomendados = horaActual
        ? disponibles
            .map(hora => ({ hora, distancia: Math.abs(new Date(`${fecha}T${hora}`) - new Date(`${fecha}T${horaActual}`)) }))
            .sort((a, b) => a.distancia - b.distancia)
            .slice(0, 12)
            .map(item => item.hora)
            .sort()
        : disponibles.slice(0, 12);
    if (!recomendados.length) {
        contenedor.innerHTML = `<span class="text-[11px] text-rose-500 font-semibold">No hay horarios libres ese día con separación de 45 min.</span>`;
        return;
    }
    contenedor.innerHTML = recomendados.map(hora => `
        <button type="button" onclick="seleccionarHoraRecomendada('${hora}')" class="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${hora === horaActual ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:text-blue-700'}">
            ${hora}
        </button>
    `).join('');
}
function fechaCitaCompacta(cita) {
    const fecha = fechaHoraCita(cita);
    if (Number.isNaN(fecha.getTime())) return normalizarFechaCita(cita) || '';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
}
function citasAgendaFiltradas() {
    const hoy = fechaLocalISO();
    const finSemana = new Date();
    finSemana.setDate(finSemana.getDate() + 7);
    const limiteSemana = fechaLocalISO(finSemana);
    return agenda.filter(cita => {
        const estado = cita.estado || 'Programada';
        const fecha = normalizarFechaCita(cita);
        if (filtroAgendaActivo === 'hoy') return fecha === hoy;
        if (filtroAgendaActivo === 'semana') return fecha >= hoy && fecha <= limiteSemana;
        if (filtroAgendaActivo === 'pendientes') return ['Programada', 'Confirmada'].includes(estado);
        return true;
    });
}
function filtrarAgenda(filtro) {
    filtroAgendaActivo = filtro;
    if ($('filtro-agenda-select')) $('filtro-agenda-select').value = filtro;
    renderAgenda();
}
function cambiarModoAgenda(modo) {
    modoAgendaActivo = modo;
    if ($('btn-agenda-modo-lista')) {
        $('btn-agenda-modo-lista').className = modo === 'lista'
            ? 'px-3 py-1.5 text-[11px] font-bold rounded-lg bg-white shadow-xs'
            : 'px-3 py-1.5 text-[11px] font-bold rounded-lg text-slate-600';
    }
    if ($('btn-agenda-modo-calendario')) {
        $('btn-agenda-modo-calendario').className = modo === 'calendario'
            ? 'px-3 py-1.5 text-[11px] font-bold rounded-lg bg-white shadow-xs'
            : 'px-3 py-1.5 text-[11px] font-bold rounded-lg text-slate-600';
    }
    renderAgenda();
}
function seleccionarDiaCalendarioAgenda(fecha) {
    if (detalleAgendaVisible && fechaAgendaSeleccionada === fecha) {
        detalleAgendaVisible = false;
    } else {
        fechaAgendaSeleccionada = fecha;
        detalleAgendaVisible = true;
    }
    modoAgendaActivo = 'calendario';
    renderAgenda();
}
function cambiarMesCalendarioAgenda(delta) {
    const base = new Date(`${fechaAgendaSeleccionada || fechaLocalISO()}T12:00:00`);
    base.setMonth(base.getMonth() + delta);
    fechaAgendaSeleccionada = fechaLocalISO(new Date(base.getFullYear(), base.getMonth(), 1, 12));
    detalleAgendaVisible = false;
    modoAgendaActivo = 'calendario';
    renderAgenda();
}
function cambiarMesAnioCalendarioAgenda() {
    const mes = parseInt($('agenda-calendario-mes')?.value || '0');
    const anio = parseInt($('agenda-calendario-anio')?.value || new Date().getFullYear());
    if (!Number.isFinite(mes) || !Number.isFinite(anio)) return;
    fechaAgendaSeleccionada = fechaLocalISO(new Date(anio, mes, 1, 12));
    detalleAgendaVisible = false;
    modoAgendaActivo = 'calendario';
    renderAgenda();
}
function irHoyCalendarioAgenda() {
    fechaAgendaSeleccionada = fechaLocalISO();
    detalleAgendaVisible = true;
    modoAgendaActivo = 'calendario';
    renderAgenda();
}
function abrirModalAgenda(fecha = fechaAgendaSeleccionada || fechaLocalISO()) {
    $('modal-agenda')?.classList.remove('hidden');
    if (!$('edit-agenda-id')?.value) {
        bloquearCamposReagendaAgenda(false);
        if ($('agenda-fecha')) $('agenda-fecha').value = fecha || fechaLocalISO();
        if ($('agenda-hora')) $('agenda-hora').value = '';
        if ($('btn-guardar-agenda')) $('btn-guardar-agenda').innerText = 'Agregar a la Agenda';
        if ($('titulo-form-agenda')) $('titulo-form-agenda').innerHTML = `<i data-lucide="calendar-plus" class="w-5 h-5 text-amber-300"></i> Agendar Nueva Visita`;
        $('btn-cancelar-agenda')?.classList.add('hidden');
    }
    renderHorariosRecomendados();
    renderIcons();
}
function cerrarModalAgenda() {
    $('modal-agenda')?.classList.add('hidden');
}
function bloquearCamposReagendaAgenda(activo) {
    ['agenda-cliente-buscar', 'agenda-direccion', 'agenda-notes', 'agenda-clinica-servicio', 'agenda-clinica-costo'].forEach(id => {
        const campo = $(id);
        if (!campo) return;
        campo.disabled = activo;
        campo.classList.toggle('opacity-60', activo);
        campo.classList.toggle('cursor-not-allowed', activo);
    });
    $('agenda-cliente-sugerencias')?.classList.add('hidden');
    if ($('agenda-cliente-status')) {
        $('agenda-cliente-status').textContent = activo
            ? 'Reagenda solo fecha y hora. Los datos de la cita se conservan igual.'
            : 'Elige un propietario o mascota. Si no existe, se pedirá confirmación al guardar.';
        $('agenda-cliente-status').classList.remove('text-emerald-600', 'text-amber-600');
        $('agenda-cliente-status').classList.toggle('text-blue-600', activo);
        $('agenda-cliente-status').classList.toggle('text-slate-400', !activo);
    }
}
function renderAgendaRow(a, hoy = fechaLocalISO(), compacto = false) {
    const nombre = a.clienteNombre || a.ownerName || 'Desconocido';
    const mascota = (a.petName && a.petName !== 'N/A') ? ` (${a.petName})` : '';
    const direccion = a.direccion || a.address || '';
    const notas = a.notas || a.notes || 'Sin notas';
    const estado = a.estado || 'Programada';
    const esServicioExterno = (a.origen || '') === 'Servicio externo' || (!a.petId && (a.petName || '').toLowerCase().includes('extern'));
    const fechaNormalizada = normalizarFechaCita(a);
    const esHoy = fechaNormalizada === hoy;
    const owner = clientes.find(c => c.id === (a.clienteId || a.ownerId));
    const tel = typeof telefonoLimpio === 'function' ? telefonoLimpio(owner?.phone) : String(owner?.phone || '').replace(/\D/g, '');
    const puedeConfirmar = estado === 'Programada';
    const puedeAtender = estado === 'Confirmada';
    const puedeCancelar = ['Programada', 'Confirmada'].includes(estado);
    const puedeReagendar = ['Programada', 'Confirmada'].includes(estado);
    return `
        <article class="agenda-row ${esHoy ? 'today' : ''} ${compacto ? 'compact' : ''}">
            <div class="agenda-row-main">
                <div class="agenda-time">
                    <span>${horaCita(a)}</span>
                    <small>${fechaCitaCompacta(a)}</small>
                </div>
                <div class="agenda-main">
                    <div class="agenda-title-line">
                        <span class="agenda-title">${nombre}${mascota}</span>
                        ${esHoy ? '<span class="agenda-badge amber">Hoy</span>' : ''}
                        <span class="agenda-badge ${estado === 'Confirmada' ? 'green' : estado === 'Cancelada' ? 'rose' : estado === 'Atendida' ? 'slate' : 'blue'}">${estado}</span>
                    </div>
                    <div class="agenda-meta">
                        <span>${direccion || 'Sin dirección'}</span>
                        <span>${notas}</span>
                    </div>
                </div>
                <div class="agenda-actions">
                    ${puedeConfirmar ? `<button type="button" onclick="cambiarEstadoCita(${a.id}, 'Confirmada')" class="agenda-action primary">Confirmar</button>` : ''}
                    ${puedeAtender && a.petId ? `<button type="button" onclick="atenderCita(${a.id})" class="agenda-action primary">Atender</button>` : ''}
                    ${puedeAtender && esServicioExterno ? `<button type="button" onclick="marcarServicioExternoAtendido(${a.id})" class="agenda-action primary">Atender</button>` : ''}
                    ${tel ? `<a href="https://wa.me/52${tel}" target="_blank" rel="noopener" class="agenda-action green" title="WhatsApp">WhatsApp</a>` : ''}
                    <button onclick="abrirNavegacionMaps('${direccion.replace(/'/g, "\\'")}')" class="agenda-action blue" title="Maps">Maps</button>
                </div>
            </div>
            <details class="action-menu row-action-menu">
                <summary class="agenda-action more cursor-pointer" title="Más acciones">Más</summary>
                <div class="action-menu-popover row-action-panel">
                    ${puedeConfirmar ? `<button type="button" onclick="cambiarEstadoCita(${a.id}, 'Confirmada')"><i data-lucide="check" class="w-4 h-4 text-emerald-700"></i> Confirmar cita</button>` : ''}
                    ${puedeReagendar ? `<button type="button" onclick="iniciarEdicionAgenda(${a.id})"><i data-lucide="calendar-range" class="w-4 h-4 text-blue-700"></i> Reagendar</button>` : ''}
                    <button type="button" onclick="crearRecordatorioApple(${a.id})"><i data-lucide="list-todo" class="w-4 h-4 text-amber-700"></i> Enviar a Reminders</button>
                    ${puedeCancelar ? `<button type="button" onclick="cambiarEstadoCita(${a.id}, 'Cancelada')" class="text-rose-700"><i data-lucide="x-circle" class="w-4 h-4"></i> Cancelar cita</button>` : ''}
                    <button type="button" onclick="eliminarCita(${a.id})" class="text-rose-700"><i data-lucide="trash-2" class="w-4 h-4"></i> Eliminar</button>
                </div>
            </details>
        </article>`;
}
function renderAgendaCalendarioMes(citas) {
    const base = new Date(`${fechaAgendaSeleccionada || fechaLocalISO()}T12:00:00`);
    const year = base.getFullYear();
    const month = base.getMonth();
    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);
    const inicioSemana = primerDia.getDay();
    const totalCeldas = Math.ceil((inicioSemana + ultimoDia.getDate()) / 7) * 7;
    const hoy = fechaLocalISO();
    const citasPorFecha = citas.reduce((acc, cita) => {
        const fecha = normalizarFechaCita(cita);
        acc[fecha] = acc[fecha] || [];
        acc[fecha].push(cita);
        return acc;
    }, {});
    const dias = Array.from({ length: totalCeldas }, (_, idx) => {
        const diaMes = idx - inicioSemana + 1;
        if (diaMes < 1 || diaMes > ultimoDia.getDate()) return `<div class="calendar-day muted"></div>`;
        const fecha = fechaLocalISO(new Date(year, month, diaMes, 12));
        const items = (citasPorFecha[fecha] || []).sort((a, b) => fechaHoraCita(a) - fechaHoraCita(b));
        const visibles = items.slice(0, 3);
        const extras = items.length - visibles.length;
        return `
            <button type="button" onclick="seleccionarDiaCalendarioAgenda('${fecha}')" class="calendar-day ${detalleAgendaVisible && fecha === fechaAgendaSeleccionada ? 'selected' : ''} ${fecha === hoy ? 'today' : ''}">
                <span class="calendar-day-number">${diaMes}</span>
                <div class="calendar-day-events">
                    ${visibles.map(cita => {
                        const estado = (cita.estado || 'Programada').toLowerCase();
                        const tipo = cita.origen === 'Servicio externo' || cita.clinicaId ? 'external' : estado === 'confirmada' ? 'confirmed' : estado === 'cancelada' ? 'cancelled' : 'scheduled';
                        const titulo = `${cita.petName || cita.clienteNombre || 'Cita'}`;
                        return `<span class="calendar-event ${tipo}" title="${titulo}">${titulo}</span>`;
                    }).join('')}
                    ${extras > 0 ? `<span class="calendar-event more">+${extras} más</span>` : ''}
                </div>
            </button>`;
    }).join('');
    const citasDia = (citasPorFecha[fechaAgendaSeleccionada] || []).sort((a, b) => fechaHoraCita(a) - fechaHoraCita(b));
    const tituloMes = base.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    const meses = Array.from({ length: 12 }, (_, idx) => new Date(2026, idx, 1).toLocaleDateString('es-MX', { month: 'long' }));
    const totalMes = Object.entries(citasPorFecha)
        .filter(([fecha]) => fecha.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
        .reduce((acc, [, items]) => acc + items.length, 0);
    return `
        <div class="agenda-calendar">
            <div class="agenda-calendar-header">
                <div>
                    <h4>${tituloMes}</h4>
                    <span>${totalMes} cita${totalMes === 1 ? '' : 's'} este mes</span>
                </div>
                <div class="calendar-nav">
                    <button type="button" onclick="cambiarMesCalendarioAgenda(-1)" title="Mes anterior"><i data-lucide="chevron-left" class="w-4 h-4"></i></button>
                    <select id="agenda-calendario-mes" onchange="cambiarMesAnioCalendarioAgenda()">
                        ${meses.map((nombre, idx) => `<option value="${idx}" ${idx === month ? 'selected' : ''}>${nombre}</option>`).join('')}
                    </select>
                    <input type="number" id="agenda-calendario-anio" min="2000" max="2100" value="${year}" onchange="cambiarMesAnioCalendarioAgenda()">
                    <button type="button" onclick="cambiarMesCalendarioAgenda(1)" title="Mes siguiente"><i data-lucide="chevron-right" class="w-4 h-4"></i></button>
                    <button type="button" onclick="irHoyCalendarioAgenda()" class="today-shortcut">Hoy</button>
                </div>
            </div>
            <div class="calendar-layout ${detalleAgendaVisible ? 'with-detail' : 'no-detail'}">
                <div class="calendar-month">
                    <div class="calendar-weekdays">
                        ${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(dia => `<span>${dia}</span>`).join('')}
                    </div>
                    <div class="calendar-grid">${dias}</div>
                </div>
                ${detalleAgendaVisible ? `<div class="calendar-detail">
                    <div class="calendar-detail-header">
                        <h5>${new Date(`${fechaAgendaSeleccionada}T12:00:00`).toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'short' })}</h5>
                        <button type="button" onclick="abrirModalAgenda('${fechaAgendaSeleccionada}')" class="calendar-add-button"><i data-lucide="plus" class="w-4 h-4"></i> Agendar</button>
                    </div>
                    <div class="calendar-day-list">
                        ${citasDia.length ? citasDia.map(cita => renderAgendaRow(cita, hoy, true)).join('') : `<p class="text-xs text-slate-400 py-3">No hay citas para este día.</p>`}
                    </div>
                </div>` : ''}
            </div>
        </div>`;
}
function renderAgenda() {
    const list = $('lista-agenda'); 
    if(!list) return;
    list.innerHTML = "";
    const citas = citasAgendaFiltradas();
    if (modoAgendaActivo === 'calendario') {
        list.innerHTML = renderAgendaCalendarioMes(citas);
        renderIcons();
        return;
    }
    if(citas.length === 0) { list.innerHTML = `<div class="text-center py-12 text-gray-400 text-xs italic">No hay visitas en este filtro.</div>`; return; }
    const ordenadas = citas.sort((a,b) => fechaHoraCita(a) - fechaHoraCita(b));
    const hoy = fechaLocalISO();
    const grupos = [
        { titulo: 'Hoy', items: ordenadas.filter(cita => normalizarFechaCita(cita) === hoy) },
        { titulo: 'Próximas', items: ordenadas.filter(cita => normalizarFechaCita(cita) > hoy) },
        { titulo: 'Pasadas', items: ordenadas.filter(cita => normalizarFechaCita(cita) < hoy) }
    ].filter(grupo => grupo.items.length);
    list.innerHTML = grupos.map(grupo => `
            <div class="agenda-group">
            <div class="agenda-group-header">
                <h4 class="text-[11px] font-black text-slate-500 uppercase tracking-wider">${grupo.titulo}</h4>
                <span class="text-[10px] font-bold text-slate-400">${grupo.items.length} visita${grupo.items.length === 1 ? '' : 's'}</span>
            </div>
            ${grupo.items.map(a => renderAgendaRow(a, hoy)).join('')}
        </div>
    `).join('');
    renderIcons();
}
function guardarCita(e) {
    e.preventDefault();
    const editId = $('edit-agenda-id').value;
    const fecha = $('agenda-fecha').value;
    const hora = $('agenda-hora').value;
    const conflicto = conflictoHorarioAgenda(fecha, hora, editId);
    if (conflicto) {
        alert(`Ya hay una visita activa muy cerca de ese horario.\n\nCita existente: ${horaCita(conflicto)} hrs · ${conflicto.clienteNombre || 'Cliente'} ${conflicto.petName ? `(${conflicto.petName})` : ''}\n\nAgenda la siguiente visita al menos 45 minutos después.`);
        return;
    }
    if (editId) {
        const idEditando = parseInt(editId);
        agenda = agenda.map(item => item.id === idEditando ? { ...item, fecha, hora, estado: 'Programada' } : item);
        const servicioExterno = (serviciosExternos || []).find(item => item.agendaId === idEditando);
        if (servicioExterno) {
            servicioExterno.fecha = fecha;
            servicioExterno.hora = hora;
            servicioExterno.fechaISO = new Date(`${fecha}T12:00:00`).toISOString();
            saveStore('serviciosExternos');
            if (typeof renderServiciosExternos === 'function') renderServiciosExternos();
            if (typeof renderGananciasConsultas === 'function') renderGananciasConsultas();
        }
        saveStore('agenda');
        cancelarEdicionAgenda();
        renderAgenda();
        renderHorariosRecomendados();
        if (typeof renderDashboard === 'function') renderDashboard();
        return;
    }
    let selectVal = $('agenda-cliente-select').value;
    if(!selectVal) {
        const nombreNuevo = $('agenda-cliente-buscar')?.value?.trim() || '';
        if (!nombreNuevo) {
            alert('Escribe el propietario o paciente para agendar.');
            return;
        }
        if (!confirm(`No encontré "${nombreNuevo}" en expedientes.\n\n¿Crear este propietario nuevo y guardar la cita?`)) return;
        const nuevoOwner = crearPropietarioDesdeAgenda(nombreNuevo);
        if (!nuevoOwner) {
            alert('Escribe el nombre del propietario para crear la cita.');
            return;
        }
        selectVal = `${nuevoOwner.id}|`;
    }
    if (selectVal.startsWith('clinic|')) {
        const clinica = typeof clinicaExternaPorId === 'function' ? clinicaExternaPorId(selectVal.split('|')[1]) : null;
        if (!clinica) {
            alert('No encontré la clínica seleccionada. Revisa el catálogo de servicios externos.');
            return;
        }
        const servicio = $('agenda-clinica-servicio')?.value.trim() || $('agenda-notes')?.value.trim() || 'Servicio externo';
        const total = parseFloat($('agenda-clinica-costo')?.value || 0);
        const citaBase = {
            id: editId ? parseInt(editId) : Date.now(),
            clienteId: null,
            petId: null,
            clinicaId: clinica.id,
            fecha,
            hora,
            clienteNombre: clinica.nombre || 'Servicio externo',
            petName: servicio,
            direccion: $('agenda-direccion').value || clinica.direccion || '',
            notas: servicio,
            estado: editId ? (agenda.find(item => item.id === parseInt(editId))?.estado || 'Programada') : 'Programada',
            origen: 'Servicio externo'
        };
        agenda = editId
            ? agenda.map(item => item.id === citaBase.id ? { ...item, ...citaBase } : item)
            : [...agenda, citaBase];
        sincronizarServicioExternoDesdeAgenda(citaBase, clinica, servicio, total);
        if (!editId) setTimeout(() => preguntarCrearReminderAutomatico(citaBase.id), 250);
        cancelarEdicionAgenda();
        saveStore('agenda');
        $('form-agenda').reset();
        if ($('agenda-cliente-buscar')) $('agenda-cliente-buscar').value = '';
        $('agenda-clinica-detalle')?.classList.add('hidden');
        renderAgenda();
        renderHorariosRecomendados();
        if (typeof renderDashboard === 'function') renderDashboard();
        return;
    }
    const ownerId = parseInt(selectVal.split('|')[0]);
    const petId = selectVal.split('|')[1] ? parseInt(selectVal.split('|')[1]) : null;
    const ownerObj = clientes.find(item => item.id === ownerId);
    const petObj = ownerObj && petId ? ownerObj.mascotas.find(m => m.id === petId) : null;
    if (editId) {
        agenda = agenda.map(item => {
            if (item.id === parseInt(editId)) {
                item.fecha = fecha;
                item.hora = hora;
                item.clienteId = ownerId; 
                item.petId = petId;
                item.clienteNombre = ownerObj ? ownerObj.owner : 'Desconocido';
                item.petName = petObj ? petObj.name : 'N/A';
                item.direccion = $('agenda-direccion').value;
                item.notas = $('agenda-notes').value || 'Sin notas';
            }
            return item;
        });
        cancelarEdicionAgenda();
    } else {
        const nuevaCita = {
            id: Date.now(), 
            clienteId: ownerId, 
            petId: petId,
            fecha,
            hora,
            clienteNombre: ownerObj ? ownerObj.owner : 'Desconocido',
            petName: petObj ? petObj.name : 'N/A',
            direccion: $('agenda-direccion').value,
            notas: $('agenda-notes').value || 'Sin notas',
            estado: 'Programada'
        };
        agenda.push(nuevaCita);
        setTimeout(() => preguntarCrearReminderAutomatico(nuevaCita.id), 250);
    }
    saveStore('agenda'); 
    $('form-agenda').reset(); 
    if ($('agenda-cliente-buscar')) $('agenda-cliente-buscar').value = '';
    cerrarModalAgenda();
    renderAgenda();
    renderHorariosRecomendados();
    if (typeof renderDashboard === 'function') renderDashboard();
}
function preguntarCrearReminderAutomatico(idCita) {
    const cita = agenda.find(item => item.id === idCita);
    if (!cita || cita.estado === 'Cancelada') return;
    const quiere = confirm('Cita guardada. ¿Crear recordatorio en Apple Reminders ahora?');
    if (quiere) crearRecordatorioApple(idCita);
}
function iniciarEdicionAgenda(id) {
    const target = agenda.find(item => item.id === id);
    if (!target) return;
    abrirModalAgenda(target.fecha || fechaAgendaSeleccionada || fechaLocalISO());
    $('edit-agenda-id').value = target.id;
    $('agenda-fecha').value = target.fecha;
    $('agenda-hora').value = target.hora;
    if ((target.origen || '') === 'Servicio externo' && target.clinicaId) {
        const clinica = typeof clinicaExternaPorId === 'function' ? clinicaExternaPorId(target.clinicaId) : null;
        $('agenda-cliente-select').value = `clinic|${target.clinicaId}`;
        if ($('agenda-cliente-buscar')) $('agenda-cliente-buscar').value = clinica?.nombre || target.clienteNombre || 'Servicio externo';
        $('agenda-clinica-detalle')?.classList.remove('hidden');
        const servicioExterno = (serviciosExternos || []).find(item => item.agendaId === target.id);
        if ($('agenda-clinica-servicio')) $('agenda-clinica-servicio').value = servicioExterno?.servicioCobrado || target.notas || target.petName || '';
        if ($('agenda-clinica-costo')) $('agenda-clinica-costo').value = servicioExterno?.total || '';
    } else {
        const clientVal = target.clienteId || target.ownerId;
        $('agenda-cliente-select').value = target.petId ? `${clientVal}|${target.petId}` : `${clientVal}|`;
        sincronizarBusquedaClienteAgenda();
        $('agenda-clinica-detalle')?.classList.add('hidden');
    }
    $('agenda-direccion').value = target.direccion || target.address || '';
    $('agenda-notes').value = (target.notas || target.notes) === 'Sin notas' ? '' : (target.notas || target.notes);
    $('titulo-form-agenda').innerHTML = `<i data-lucide="calendar-range" class="text-amber-600 w-5 h-5"></i> Reagendar Visita`;
    $('btn-guardar-agenda').innerText = "Guardar Reagenda";
    $('btn-cancelar-agenda').classList.remove('hidden');
    bloquearCamposReagendaAgenda(true);
    renderHorariosRecomendados();
    renderIcons();
}
function cambiarEstadoCita(id, estado) {
    const cita = agenda.find(item => item.id === id);
    if (!cita) return;
    const actual = cita.estado || 'Programada';
    const permitidos = {
        Programada: ['Confirmada', 'Cancelada'],
        Confirmada: ['Atendida', 'Cancelada'],
        Atendida: [],
        Cancelada: []
    };
    if (!permitidos[actual]?.includes(estado)) {
        alert(`La cita está ${actual}. No se puede cambiar a ${estado}.`);
        renderAgenda();
        return;
    }
    cita.estado = estado;
    saveStore('agenda');
    renderAgenda();
    renderHorariosRecomendados();
    if (typeof renderDashboard === 'function') renderDashboard();
}
function atenderCita(id) {
    const cita = agenda.find(item => item.id === id);
    const clienteId = cita?.clienteId || cita?.ownerId;
    if (!clienteId || !cita?.petId) return;
    cita.estado = 'Atendida';
    citaActivaId = id;
    saveStore('agenda');
    if (typeof renderDashboard === 'function') renderDashboard();
    cargarPacienteAConsulta(clienteId, cita.petId);
}
function marcarServicioExternoAtendido(agendaId) {
    const cita = agenda.find(item => item.id === agendaId);
    if (!cita) return;
    if ((cita.origen || '') !== 'Servicio externo' && !cita.clinicaId) {
        atenderCita(agendaId);
        return;
    }
    if (cita.estado !== 'Confirmada') {
        alert(`La cita está ${cita.estado || 'Programada'}. Primero confírmala para marcarla atendida.`);
        renderAgenda();
        return;
    }
    cita.estado = 'Atendida';
    const servicio = (serviciosExternos || []).find(item => item.agendaId === agendaId);
    if (servicio) servicio.estadoAgenda = 'Atendida';
    registrarAuditoria('agenda', 'Atender', `Servicio externo atendido: ${cita.clienteNombre || cita.notas || agendaId}`, agendaId);
    saveStore('agenda');
    if (servicio) saveStore('serviciosExternos');
    renderAgenda();
    renderHorariosRecomendados();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderServiciosExternos === 'function') renderServiciosExternos();
}
function gestionarServicioExternoAgenda(agendaId) {
    const cita = agenda.find(item => item.id === agendaId);
    const servicio = serviciosExternos.find(item => item.agendaId === agendaId);
    if (cita?.estado === 'Confirmada') {
        marcarServicioExternoAtendido(agendaId);
        return;
    }
    if (!servicio) {
        switchTab('servicios-externos');
        alert('No encontré el servicio externo vinculado a esta cita. Puedes revisarlo en Servicios Externos.');
        return;
    }
    switchTab('servicios-externos');
    renderServiciosExternos();
}
function cancelarEdicionAgenda() {
    $('edit-agenda-id').value = ''; 
    bloquearCamposReagendaAgenda(false);
    $('form-agenda').reset();
    if ($('agenda-fecha')) $('agenda-fecha').value = fechaAgendaSeleccionada || fechaLocalISO();
    if ($('agenda-cliente-buscar')) $('agenda-cliente-buscar').value = '';
    if ($('agenda-cliente-status')) {
        $('agenda-cliente-status').textContent = 'Elige un propietario o mascota. Si no existe, se pedirá confirmación al guardar.';
        $('agenda-cliente-status').classList.remove('text-emerald-600', 'text-amber-600');
        $('agenda-cliente-status').classList.add('text-slate-400');
    }
    $('agenda-cliente-sugerencias')?.classList.add('hidden');
    $('titulo-form-agenda').innerHTML = `<i data-lucide="calendar-plus" class="w-5 h-5 text-amber-300"></i> Agendar Nueva Visita`;
    $('btn-guardar-agenda').innerText = "Agregar a la Agenda";
    $('btn-cancelar-agenda').classList.add('hidden');
    $('agenda-clinica-detalle')?.classList.add('hidden');
    if ($('agenda-clinica-servicio')) $('agenda-clinica-servicio').value = '';
    if ($('agenda-clinica-costo')) $('agenda-clinica-costo').value = '';
    cerrarModalAgenda();
    renderHorariosRecomendados();
    renderIcons();
}
function abrirNavegacionMaps(direccion) {
    const encoded = encodeURIComponent(direccion);
    if(/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        window.open(`maps://?q=${encoded}`, '_blank');
    } else { 
        window.open(`https://maps.google.com/maps?q=${encoded}`, '_blank'); 
    }
}
function esDispositivoAppleMovil() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function datosRecordatorioCita(cita) {
    const cliente = cita.clienteNombre || cita.ownerName || 'Cliente';
    const mascota = cita.petName && cita.petName !== 'N/A' ? cita.petName : 'Paciente';
    const direccion = cita.direccion || cita.address || 'Sin dirección';
    const notas = cita.notas || cita.notes || 'Sin notas';
    const fecha = normalizarFechaCita(cita);
    const hora = horaCita(cita);
    const fechaRecordatorio = `${fecha} ${hora}`;
    const titulo = `VetHome: ${mascota} - ${cliente} | ${fechaRecordatorio}`;
    const detalle = [
        `Actividad: ${notas}`,
        `Lugar: ${direccion}`
    ].join('\n');
    return { titulo, detalle, fecha, hora, fechaRecordatorio, direccion, notas, cliente, mascota };
}
async function copiarTextoSeguro(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch (error) {
        console.warn('No se pudo copiar al portapapeles.', error);
        return false;
    }
}
async function crearRecordatorioApple(idCita) {
    const cita = agenda.find(item => item.id === idCita);
    if (!cita) return;
    const datos = datosRecordatorioCita(cita);
    const shortcutName = 'VetHome Recordatorio';
    const textoPlano = `${datos.titulo}\n\n${datos.detalle}`;
    const shortcutUrl = `shortcuts://x-callback-url/run-shortcut?name=${encodeURIComponent(shortcutName)}&input=text&text=${encodeURIComponent(textoPlano)}`;
    if (!esDispositivoAppleMovil()) {
        const copiado = await copiarTextoSeguro(textoPlano);
        alert(copiado
            ? 'Datos copiados. En iPhone/iPad este botón abre Apple Shortcuts para crear el recordatorio.'
            : 'En iPhone/iPad este botón abre Apple Shortcuts para crear el recordatorio.');
        return;
    }
    await copiarTextoSeguro(textoPlano);
    if (!localStorage.getItem('vethome_reminders_shortcut_hint')) {
        alert('Beta Apple Reminders: el atajo "VetHome Recordatorio" solo debe recibir Texto y agregar la Entrada del atajo a Recordatorios. También copié los datos por si necesitas pegarlos manualmente.');
        localStorage.setItem('vethome_reminders_shortcut_hint', '1');
    }
    window.location.href = shortcutUrl;
}
function eliminarCita(id) { 
    if(confirm("¿Remover esta visita de la agenda?")) { 
        agenda = agenda.filter(a=>a.id!==id); 
        saveStore('agenda'); 
        renderAgenda(); 
    } 
}
