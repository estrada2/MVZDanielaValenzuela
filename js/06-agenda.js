function actualizarSelectAgenda() {
    const sel = $('agenda-cliente-select'); 
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Vincular Propietario --</option>';
    clientes.forEach(c => {
        if(c.mascotas && c.mascotas.length > 0) {
            c.mascotas.forEach(m => { sel.innerHTML += `<option value="${c.id}|${m.id}">${c.owner} (${m.name})</option>`; });
        } else { sel.innerHTML += `<option value="${c.id}|">${c.owner} (Sin mascotas)</option>`; }
    });
}
function autocompletarDireccionAgenda() {
    const selectVal = $('agenda-cliente-select').value;
    if(!selectVal) return;
    const ownerId = parseInt(selectVal.split('|')[0]);
    const tgt = clientes.find(c => c.id === ownerId);
    if(tgt) $('agenda-direccion').value = tgt.address;
}
let filtroAgendaActivo = 'todas';
let citaActivaId = null;
function fechaLocalISO(fecha = new Date()) {
    const offset = fecha.getTimezoneOffset() * 60000;
    return new Date(fecha.getTime() - offset).toISOString().split('T')[0];
}
function citasAgendaFiltradas() {
    const hoy = fechaLocalISO();
    const finSemana = new Date();
    finSemana.setDate(finSemana.getDate() + 7);
    const limiteSemana = fechaLocalISO(finSemana);
    return agenda.filter(cita => {
        const estado = cita.estado || 'Programada';
        if (filtroAgendaActivo === 'hoy') return cita.fecha === hoy;
        if (filtroAgendaActivo === 'semana') return cita.fecha >= hoy && cita.fecha <= limiteSemana;
        if (filtroAgendaActivo === 'pendientes') return ['Programada', 'Confirmada'].includes(estado);
        return true;
    });
}
function filtrarAgenda(filtro) {
    filtroAgendaActivo = filtro;
    ['todas', 'hoy', 'semana', 'pendientes'].forEach(item => {
        const boton = $(`btn-agenda-${item}`);
        if (!boton) return;
        boton.className = item === filtro
            ? 'px-2 py-1 text-[10px] font-bold rounded bg-white shadow-xs'
            : 'px-2 py-1 text-[10px] font-bold rounded text-slate-600';
    });
    renderAgenda();
}
function renderAgenda() {
    const list = $('lista-agenda'); 
    if(!list) return;
    list.innerHTML = "";
    const citas = citasAgendaFiltradas();
    if(citas.length === 0) { list.innerHTML = `<div class="text-center py-12 text-gray-400 text-xs italic">No hay visitas en este filtro.</div>`; return; }
    const ordenadas = citas.sort((a,b) => new Date(`${a.fecha}T${a.hora}`) - new Date(`${b.fecha}T${b.hora}`));
    const hoy = fechaLocalISO();
    const grupos = [
        { titulo: 'Hoy', items: ordenadas.filter(cita => cita.fecha === hoy) },
        { titulo: 'Próximas', items: ordenadas.filter(cita => cita.fecha > hoy) },
        { titulo: 'Pasadas', items: ordenadas.filter(cita => cita.fecha < hoy) }
    ].filter(grupo => grupo.items.length);
    list.innerHTML = grupos.map(grupo => `
        <div class="space-y-2">
            <div class="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm py-1 flex items-center justify-between">
                <h4 class="text-[11px] font-black text-slate-500 uppercase tracking-wider">${grupo.titulo}</h4>
                <span class="text-[10px] font-bold text-slate-400">${grupo.items.length} visita${grupo.items.length === 1 ? '' : 's'}</span>
            </div>
            ${grupo.items.map(a => {
        const nombre = a.clienteNombre || a.ownerName || 'Desconocido';
        const mascota = (a.petName && a.petName !== 'N/A') ? ` (${a.petName})` : '';
        const direccion = a.direccion || a.address || '';
        const notas = a.notas || a.notes || 'Sin notas';
        const estado = a.estado || 'Programada';
        const esHoy = a.fecha === hoy;
        const owner = clientes.find(c => c.id === (a.clienteId || a.ownerId));
        const tel = typeof telefonoLimpio === 'function' ? telefonoLimpio(owner?.phone) : String(owner?.phone || '').replace(/\D/g, '');
        const badgeEstado = {
            Programada: 'bg-blue-100 text-blue-800',
            Confirmada: 'bg-emerald-100 text-emerald-800',
            Atendida: 'bg-slate-200 text-slate-700',
            Cancelada: 'bg-rose-100 text-rose-700'
        }[estado] || 'bg-gray-100 text-gray-700';
        return `
            <div class="border rounded-xl p-4 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 shadow-3xs hover:shadow-md transition-all ${esHoy ? 'bg-amber-50 border-amber-300' : 'bg-white'}">
                <div class="space-y-1 text-xs">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="bg-blue-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">📅 ${a.fecha} • ${a.hora} hrs</span>
                        <span class="font-bold text-slate-800">${nombre}${mascota}</span>
                        ${esHoy ? '<span class="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px]">HOY</span>' : ''}
                        <span class="${badgeEstado} font-bold px-2 py-0.5 rounded text-[10px]">${estado}</span>
                    </div>
                    <p class="text-gray-600 font-medium">📍 ${direccion}</p>
                    <p class="text-slate-400 italic">📝 Nota: ${notas}</p>
                </div>
                <div class="flex flex-wrap gap-1.5 w-full xl:w-auto shrink-0 justify-end">
                    ${a.petId && estado !== 'Cancelada' ? `<button onclick="atenderCita(${a.id})" class="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"><i data-lucide="stethoscope" class="w-3.5 h-3.5"></i> Atender</button>` : ''}
                    ${estado === 'Programada' ? `<button onclick="cambiarEstadoCita(${a.id}, 'Confirmada')" class="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1"><i data-lucide="check" class="w-3.5 h-3.5"></i> Confirmar</button>` : ''}
                    <select onchange="cambiarEstadoCita(${a.id}, this.value)" class="px-2 py-1.5 border rounded-lg text-xs bg-white">
                        ${['Programada', 'Confirmada', 'Atendida', 'Cancelada'].map(opcion => `<option value="${opcion}" ${estado === opcion ? 'selected' : ''}>${opcion}</option>`).join('')}
                    </select>
                    ${tel ? `<a href="https://wa.me/52${tel}" target="_blank" rel="noopener" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition-all"><i data-lucide="message-circle" class="w-3.5 h-3.5"></i> WhatsApp</a>` : ''}
                    <button onclick="exportarCitaAApple(${a.id})" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition-all"><i data-lucide="bell" class="w-3.5 h-3.5"></i> Sincronizar iPad</button>
                    <button onclick="abrirNavegacionMaps('${direccion.replace(/'/g, "\\'")}')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition-all"><i data-lucide="map" class="w-3.5 h-3.5"></i> Maps</button>
                    <button onclick="iniciarEdicionAgenda(${a.id})" class="text-gray-400 hover:text-amber-600 p-1.5 bg-white border rounded-lg shadow-xs transition-all"><i data-lucide="edit" class="w-4 h-4"></i></button>
                    <button onclick="eliminarCita(${a.id})" class="text-gray-300 hover:text-red-500 p-1.5 border rounded-lg shadow-xs transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>`;
            }).join('')}
        </div>
    `).join('');
    renderIcons();
}
function guardarCita(e) {
    e.preventDefault();
    const selectVal = $('agenda-cliente-select').value;
    if(!selectVal) return;
    const ownerId = parseInt(selectVal.split('|')[0]);
    const petId = selectVal.split('|')[1] ? parseInt(selectVal.split('|')[1]) : null;
    const ownerObj = clientes.find(item => item.id === ownerId);
    const petObj = ownerObj && petId ? ownerObj.mascotas.find(m => m.id === petId) : null;
    const editId = $('edit-agenda-id').value;
    const fecha = $('agenda-fecha').value;
    const hora = $('agenda-hora').value;
    const duplicada = agenda.some(item => item.id !== parseInt(editId) && item.fecha === fecha && item.hora === hora && (item.estado || 'Programada') !== 'Cancelada');
    if (duplicada) {
        alert("Ya existe una visita programada en ese horario.");
        return;
    }
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
                item.estado = $('agenda-estado').value;
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
            estado: $('agenda-estado').value
        };
        agenda.push(nuevaCita);
    }
    saveStore('agenda'); 
    $('form-agenda').reset(); 
    renderAgenda();
}
function iniciarEdicionAgenda(id) {
    const target = agenda.find(item => item.id === id);
    if (!target) return;
    $('edit-agenda-id').value = target.id;
    $('agenda-fecha').value = target.fecha;
    $('agenda-hora').value = target.hora;
    const clientVal = target.clienteId || target.ownerId;
    $('agenda-cliente-select').value = target.petId ? `${clientVal}|${target.petId}` : `${clientVal}|`;
    $('agenda-direccion').value = target.direccion || target.address || '';
    $('agenda-notes').value = (target.notas || target.notes) === 'Sin notas' ? '' : (target.notas || target.notes);
    $('agenda-estado').value = target.estado || 'Programada';
    $('titulo-form-agenda').innerHTML = `<i data-lucide="calendar-range" class="text-amber-600 w-5 h-5"></i> Reagendar Visita`;
    $('btn-guardar-agenda').innerText = "Actualizar Cita";
    $('btn-cancelar-agenda').classList.remove('hidden');
    renderIcons();
}
function cambiarEstadoCita(id, estado) {
    const cita = agenda.find(item => item.id === id);
    if (!cita) return;
    cita.estado = estado;
    saveStore('agenda');
    renderAgenda();
}
function atenderCita(id) {
    const cita = agenda.find(item => item.id === id);
    const clienteId = cita?.clienteId || cita?.ownerId;
    if (!clienteId || !cita?.petId) return;
    cita.estado = 'Confirmada';
    citaActivaId = id;
    saveStore('agenda');
    cargarPacienteAConsulta(clienteId, cita.petId);
}
function cancelarEdicionAgenda() {
    $('edit-agenda-id').value = ''; 
    $('form-agenda').reset();
    $('titulo-form-agenda').innerHTML = `<i data-lucide="calendar-plus" class="text-blue-600 w-5 h-5"></i> Agendar Nueva Visita`;
    $('btn-guardar-agenda').innerText = "Agregar a la Agenda";
    $('btn-cancelar-agenda').classList.add('hidden');
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
function exportarCitaAApple(idCita) {
    const cita = agenda.find(item => item.id === idCita);
    if (!cita) return;
    const fechaLimpia = cita.fecha.replace(/-/g, '');
    const horaLimpia = cita.hora.replace(/:/g, '');
    const startDateTime = `${fechaLimpia}T${horaLimpia}00`;
    let horaS = parseInt(cita.hora.split(':')[0]);
    let minS = cita.hora.split(':')[1];
    horaS = horaS + 1; 
    const endDateTime = `${fechaLimpia}T${String(horaS).padStart(2, '0')}${minS}00`;
    const petNameStr = cita.petName && cita.petName !== 'N/A' ? `(${cita.petName})` : '';
    const nombreCliente = cita.clienteNombre || cita.ownerName || 'Cliente';
    const direccion = cita.direccion || cita.address || '';
    const notas = cita.notas || cita.notes || '';
    const icsData = [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PROID:-//VetHomePro//NONSGML v7.5//MX', 'BEGIN:VEVENT',
        `UID:${cita.id}@vethomepro.local`, `DTSTAMP:${startDateTime}Z`, `DTSTART:${startDateTime}`, `DTEND:${endDateTime}`,
        `SUMMARY:🐾 Consulta Vet: ${nombreCliente} ${petNameStr}`, `LOCATION:${direccion}`, `DESCRIPTION:Motivo/Notas: ${notas}`,
        'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio de consulta', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const blob = new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cita-${nombreCliente.replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}
function eliminarCita(id) { 
    if(confirm("¿Remover esta visita de la agenda?")) { 
        agenda = agenda.filter(a=>a.id!==id); 
        saveStore('agenda'); 
        renderAgenda(); 
    } 
}
