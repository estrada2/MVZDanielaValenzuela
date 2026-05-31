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
function renderAgenda() {
    const list = $('lista-agenda'); 
    if(!list) return;
    list.innerHTML = "";
    if(agenda.length === 0) { list.innerHTML = `<div class="text-center py-12 text-gray-400 text-xs italic">No hay visitas agendadas.</div>`; return; }
    agenda.sort((a,b) => new Date(`${a.fecha}T${a.hora}`) - new Date(`${b.fecha}T${b.hora}`)).forEach(a => {
        const nombre = a.clienteNombre || a.ownerName || 'Desconocido';
        const mascota = (a.petName && a.petName !== 'N/A') ? ` (${a.petName})` : '';
        const direccion = a.direccion || a.address || '';
        const notas = a.notas || a.notes || 'Sin notas';
        list.innerHTML += `
            <div class="bg-white border rounded-xl p-4 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-3 shadow-3xs hover:shadow-md transition-all">
                <div class="space-y-1 text-xs">
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="bg-blue-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">📅 ${a.fecha} • ${a.hora} hrs</span>
                        <span class="font-bold text-slate-800">${nombre}${mascota}</span>
                    </div>
                    <p class="text-gray-600 font-medium">📍 ${direccion}</p>
                    <p class="text-slate-400 italic">📝 Nota: ${notas}</p>
                </div>
                <div class="flex flex-wrap gap-1.5 w-full xl:w-auto shrink-0 justify-end">
                    <button onclick="exportarCitaAApple(${a.id})" class="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition-all"><i data-lucide="bell" class="w-3.5 h-3.5"></i> Sincronizar iPad</button>
                    <button onclick="abrirNavegacionMaps('${direccion.replace(/'/g, "\\'")}')" class="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-xs transition-all"><i data-lucide="map" class="w-3.5 h-3.5"></i> Maps</button>
                    <button onclick="iniciarEdicionAgenda(${a.id})" class="text-gray-400 hover:text-amber-600 p-1.5 bg-white border rounded-lg shadow-xs transition-all"><i data-lucide="edit" class="w-4 h-4"></i></button>
                    <button onclick="eliminarCita(${a.id})" class="text-gray-300 hover:text-red-500 p-1.5 border rounded-lg shadow-xs transition-all"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                </div>
            </div>`;
    });
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
    if (editId) {
        agenda = agenda.map(item => {
            if (item.id === parseInt(editId)) {
                item.fecha = $('agenda-fecha').value;
                item.hora = $('agenda-hora').value;
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
            fecha: $('agenda-fecha').value,
            hora: $('agenda-hora').value,
            clienteNombre: ownerObj ? ownerObj.owner : 'Desconocido',
            petName: petObj ? petObj.name : 'N/A',
            direccion: $('agenda-direccion').value,
            notas: $('agenda-notes').value || 'Sin notas'
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
    $('titulo-form-agenda').innerHTML = `<i data-lucide="calendar-range" class="text-amber-600 w-5 h-5"></i> Reagendar Visita`;
    $('btn-guardar-agenda').innerText = "Actualizar Cita";
    $('btn-cancelar-agenda').classList.remove('hidden');
    renderIcons();
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
