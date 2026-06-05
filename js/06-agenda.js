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
function fechaCitaBonita(cita) {
    const fecha = fechaHoraCita(cita);
    if (Number.isNaN(fecha.getTime())) return normalizarFechaCita(cita) || 'Sin fecha';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
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
    const ordenadas = citas.sort((a,b) => fechaHoraCita(a) - fechaHoraCita(b));
    const hoy = fechaLocalISO();
    const grupos = [
        { titulo: 'Hoy', items: ordenadas.filter(cita => normalizarFechaCita(cita) === hoy) },
        { titulo: 'Próximas', items: ordenadas.filter(cita => normalizarFechaCita(cita) > hoy) },
        { titulo: 'Pasadas', items: ordenadas.filter(cita => normalizarFechaCita(cita) < hoy) }
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
        const fechaNormalizada = normalizarFechaCita(a);
        const esHoy = fechaNormalizada === hoy;
        const owner = clientes.find(c => c.id === (a.clienteId || a.ownerId));
        const tel = typeof telefonoLimpio === 'function' ? telefonoLimpio(owner?.phone) : String(owner?.phone || '').replace(/\D/g, '');
        const badgeEstado = {
            Programada: 'bg-blue-100 text-blue-800',
            Confirmada: 'bg-emerald-100 text-emerald-800',
            Atendida: 'bg-slate-200 text-slate-700',
            Cancelada: 'bg-rose-100 text-rose-700'
        }[estado] || 'bg-gray-100 text-gray-700';
        return `
            <div class="border rounded-xl px-3 py-3 shadow-3xs hover:shadow-md transition-all ${esHoy ? 'bg-amber-50 border-amber-300' : 'bg-white'}">
                <div class="grid grid-cols-1 xl:grid-cols-[6.75rem_1fr_auto] gap-3 items-center">
                    <div class="rounded-lg bg-slate-900 text-white px-3 py-2">
                        <span class="block text-[13px] font-black leading-tight">${horaCita(a)} hrs</span>
                        <span class="block text-[10px] font-bold text-slate-300 leading-tight">${fechaCitaBonita(a)}</span>
                    </div>
                    <div class="min-w-0 space-y-1">
                        <div class="flex flex-wrap items-center gap-1.5">
                            <span class="font-black text-sm text-slate-900">${nombre}${mascota}</span>
                            ${esHoy ? '<span class="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded text-[10px]">HOY</span>' : ''}
                            <span class="${badgeEstado} font-bold px-2 py-0.5 rounded text-[10px]">${estado}</span>
                        </div>
                        <p class="text-[11px] text-gray-600 font-medium flex items-start gap-1"><i data-lucide="map-pin" class="w-3 h-3 mt-0.5 shrink-0 text-rose-500"></i><span class="truncate">${direccion || 'Sin dirección'}</span></p>
                        <p class="text-[11px] text-slate-500 italic flex items-start gap-1"><i data-lucide="notebook-pen" class="w-3 h-3 mt-0.5 shrink-0 text-slate-400"></i><span class="line-clamp-1">${notas}</span></p>
                    </div>
                    <div class="grid grid-cols-4 sm:grid-cols-[repeat(8,2.25rem)] gap-1.5 w-full xl:w-auto justify-end">
                        ${a.petId && estado !== 'Cancelada' ? `<button onclick="atenderCita(${a.id})" class="h-9 w-9 bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center justify-center" title="Atender"><i data-lucide="stethoscope" class="w-4 h-4"></i></button>` : ''}
                        ${estado === 'Programada' ? `<button onclick="cambiarEstadoCita(${a.id}, 'Confirmada')" class="h-9 w-9 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg flex items-center justify-center" title="Confirmar"><i data-lucide="check" class="w-4 h-4"></i></button>` : ''}
                        ${tel ? `<a href="https://wa.me/52${tel}" target="_blank" rel="noopener" class="h-9 w-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center shadow-xs transition-all" title="WhatsApp"><i data-lucide="message-circle" class="w-4 h-4"></i></a>` : ''}
                        <button onclick="abrirNavegacionMaps('${direccion.replace(/'/g, "\\'")}')" class="h-9 w-9 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center shadow-xs transition-all" title="Maps"><i data-lucide="map" class="w-4 h-4"></i></button>
                        <button onclick="crearRecordatorioApple(${a.id})" class="h-9 w-9 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg flex items-center justify-center shadow-xs transition-all" title="Apple Reminders"><i data-lucide="list-todo" class="w-4 h-4"></i></button>
                        <button onclick="exportarCitaAApple(${a.id})" class="h-9 w-9 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg flex items-center justify-center shadow-xs transition-all" title="Calendario"><i data-lucide="calendar-plus" class="w-4 h-4"></i></button>
                        <button onclick="iniciarEdicionAgenda(${a.id})" class="h-9 w-9 text-gray-500 hover:text-amber-600 bg-white border rounded-lg shadow-xs transition-all flex items-center justify-center" title="Editar"><i data-lucide="edit" class="w-4 h-4"></i></button>
                        <button onclick="eliminarCita(${a.id})" class="h-9 w-9 text-gray-400 hover:text-red-500 border rounded-lg shadow-xs transition-all flex items-center justify-center" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        <select onchange="cambiarEstadoCita(${a.id}, this.value)" class="col-span-4 sm:col-span-8 px-2 py-1.5 border rounded-lg text-[11px] bg-white font-semibold">
                            ${['Programada', 'Confirmada', 'Atendida', 'Cancelada'].map(opcion => `<option value="${opcion}" ${estado === opcion ? 'selected' : ''}>${opcion}</option>`).join('')}
                        </select>
                    </div>
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
    const titulo = `VetHome: ${mascota} - ${cliente}`;
    const detalle = [
        `Paciente: ${mascota}`,
        `Propietario: ${cliente}`,
        `Fecha: ${fecha}`,
        `Hora: ${hora}`,
        `Dirección: ${direccion}`,
        `Notas: ${notas}`
    ].join('\n');
    return { titulo, detalle, fecha, hora, direccion, notas, cliente, mascota };
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
