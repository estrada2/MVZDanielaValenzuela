function actualizarSelectAgenda() {
    const sel = $('agenda-cliente-select'); 
    if(!sel) return;
    sel.innerHTML = '<option value="">-- Vincular Propietario --</option>';
    clientes.forEach(c => {
        if(c.mascotas && c.mascotas.length > 0) {
            c.mascotas.forEach(m => { sel.innerHTML += `<option value="${c.id}|${m.id}">${c.owner} (${m.name})</option>`; });
        } else { sel.innerHTML += `<option value="${c.id}|">${c.owner} (Sin mascotas)</option>`; }
    });
    if ((clinicasExternas || []).length) {
        sel.innerHTML += '<option disabled>──────── Clínicas externas ────────</option>';
        (clinicasExternas || [])
            .slice()
            .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'))
            .forEach(clinica => {
                sel.innerHTML += `<option value="clinic|${clinica.id}">${clinica.nombre}</option>`;
            });
    }
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
let modoAgendaActivo = 'lista';
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
function fechaCitaBonita(cita) {
    const fecha = fechaHoraCita(cita);
    if (Number.isNaN(fecha.getTime())) return normalizarFechaCita(cita) || 'Sin fecha';
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
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
function renderAgendaCalendarioDia(citas) {
    const hoy = fechaLocalISO();
    const citasHoy = citas
        .filter(cita => normalizarFechaCita(cita) === hoy)
        .sort((a, b) => fechaHoraCita(a) - fechaHoraCita(b));
    const horas = Array.from({ length: 12 }, (_, idx) => `${String(idx + 8).padStart(2, '0')}:00`);
    return `
        <div class="space-y-2">
            ${horas.map(hora => {
                const horaNum = parseInt(hora.slice(0, 2));
                const items = citasHoy.filter(cita => parseInt(horaCita(cita).slice(0, 2)) === horaNum);
                return `
                    <div class="grid grid-cols-[4.5rem_1fr] gap-3 app-list-card">
                        <div class="text-xs font-black text-slate-500">${hora}</div>
                        <div class="space-y-2">
                            ${items.length ? items.map(cita => `
                                <button type="button" onclick="${cita.petId ? `atenderCita(${cita.id})` : `gestionarServicioExternoAgenda(${cita.id})`}" class="w-full text-left rounded-lg border ${cita.origen === 'Servicio externo' ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'} p-2">
                                    <p class="text-xs font-black text-slate-900">${horaCita(cita)} · ${cita.petName || cita.clienteNombre || 'Cita'}</p>
                                    <p class="text-[11px] text-slate-500">${cita.clienteNombre || ''} · ${cita.notas || 'Sin notas'}</p>
                                </button>
                            `).join('') : `<p class="text-[11px] text-slate-300 py-1">Libre</p>`}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}
function renderAgenda() {
    const list = $('lista-agenda'); 
    if(!list) return;
    list.innerHTML = "";
    const citas = citasAgendaFiltradas();
    if(citas.length === 0) { list.innerHTML = `<div class="text-center py-12 text-gray-400 text-xs italic">No hay visitas en este filtro.</div>`; return; }
    if (modoAgendaActivo === 'calendario') {
        list.innerHTML = renderAgendaCalendarioDia(citas);
        renderIcons();
        return;
    }
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
            ${grupo.items.map(a => {
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
        const badgeEstado = {
            Programada: 'bg-blue-100 text-blue-800',
            Confirmada: 'bg-emerald-100 text-emerald-800',
            Atendida: 'bg-slate-200 text-slate-700',
            Cancelada: 'bg-rose-100 text-rose-700'
        }[estado] || 'bg-gray-100 text-gray-700';
        return `
            <article class="agenda-row ${esHoy ? 'today' : ''}">
                <div class="agenda-row-main">
                    <div class="agenda-time">
                        <span>${horaCita(a)}</span>
                        <small>${fechaCitaCompacta(a)}</small>
                    </div>
                    <div class="agenda-main">
                        <div class="agenda-title-line">
                            <span class="agenda-title">${nombre}${mascota}</span>
                            ${esHoy ? '<span class="agenda-badge amber">Hoy</span>' : ''}
                            <span class="agenda-badge ${estado === 'Confirmada' ? 'green' : estado === 'Cancelada' ? 'rose' : 'blue'}">${estado}</span>
                        </div>
                        <div class="agenda-meta">
                            <span>${direccion || 'Sin dirección'}</span>
                            <span>${notas}</span>
                        </div>
                    </div>
                    <div class="agenda-actions">
                            ${a.petId && estado !== 'Cancelada' ? `<button onclick="atenderCita(${a.id})" class="agenda-action primary">Atender</button>` : ''}
                            ${esServicioExterno && estado !== 'Cancelada' ? `<button onclick="gestionarServicioExternoAgenda(${a.id})" class="agenda-action primary">Gestionar</button>` : ''}
                            ${tel ? `<a href="https://wa.me/52${tel}" target="_blank" rel="noopener" class="agenda-action green" title="WhatsApp">WhatsApp</a>` : ''}
                            <button onclick="abrirNavegacionMaps('${direccion.replace(/'/g, "\\'")}')" class="agenda-action blue" title="Maps">Maps</button>
                    </div>
                </div>
                <details class="action-menu row-action-menu">
                    <summary class="agenda-action more cursor-pointer" title="Más acciones">Más</summary>
                    <div class="action-menu-popover row-action-panel">
                        ${estado === 'Programada' ? `<button type="button" onclick="cambiarEstadoCita(${a.id}, 'Confirmada')"><i data-lucide="check" class="w-4 h-4 text-emerald-700"></i> Confirmar cita</button>` : ''}
                        <button type="button" onclick="iniciarEdicionAgenda(${a.id})"><i data-lucide="calendar-range" class="w-4 h-4 text-blue-700"></i> Reagendar</button>
                        <button type="button" onclick="crearRecordatorioApple(${a.id})"><i data-lucide="list-todo" class="w-4 h-4 text-amber-700"></i> Enviar a Reminders</button>
                        <label><i data-lucide="refresh-cw" class="w-4 h-4 text-slate-500"></i><select onchange="cambiarEstadoCita(${a.id}, this.value)" class="flex-1 bg-transparent outline-none text-[12px] font-bold">
                            ${['Programada', 'Confirmada', 'Atendida', 'Cancelada'].map(opcion => `<option value="${opcion}" ${estado === opcion ? 'selected' : ''}>${opcion}</option>`).join('')}
                        </select></label>
                        <button type="button" onclick="eliminarCita(${a.id})" class="text-rose-700"><i data-lucide="trash-2" class="w-4 h-4"></i> Eliminar</button>
                    </div>
                </details>
            </article>`;
            }).join('')}
        </div>
    `).join('');
    renderIcons();
}
function guardarCita(e) {
    e.preventDefault();
    const selectVal = $('agenda-cliente-select').value;
    if(!selectVal) return;
    const editId = $('edit-agenda-id').value;
    const fecha = $('agenda-fecha').value;
    const hora = $('agenda-hora').value;
    const conflicto = conflictoHorarioAgenda(fecha, hora, editId);
    if (conflicto) {
        alert(`Ya hay una visita activa muy cerca de ese horario.\n\nCita existente: ${horaCita(conflicto)} hrs · ${conflicto.clienteNombre || 'Cliente'} ${conflicto.petName ? `(${conflicto.petName})` : ''}\n\nAgenda la siguiente visita al menos 45 minutos después.`);
        return;
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
    $('edit-agenda-id').value = target.id;
    $('agenda-fecha').value = target.fecha;
    $('agenda-hora').value = target.hora;
    if ((target.origen || '') === 'Servicio externo' && target.clinicaId) {
        $('agenda-cliente-select').value = `clinic|${target.clinicaId}`;
        $('agenda-clinica-detalle')?.classList.remove('hidden');
        const servicioExterno = (serviciosExternos || []).find(item => item.agendaId === target.id);
        if ($('agenda-clinica-servicio')) $('agenda-clinica-servicio').value = servicioExterno?.servicioCobrado || target.notas || target.petName || '';
        if ($('agenda-clinica-costo')) $('agenda-clinica-costo').value = servicioExterno?.total || '';
    } else {
        const clientVal = target.clienteId || target.ownerId;
        $('agenda-cliente-select').value = target.petId ? `${clientVal}|${target.petId}` : `${clientVal}|`;
        $('agenda-clinica-detalle')?.classList.add('hidden');
    }
    $('agenda-direccion').value = target.direccion || target.address || '';
    $('agenda-notes').value = (target.notas || target.notes) === 'Sin notas' ? '' : (target.notas || target.notes);
    $('titulo-form-agenda').innerHTML = `<i data-lucide="calendar-range" class="text-amber-600 w-5 h-5"></i> Reagendar Visita`;
    $('btn-guardar-agenda').innerText = "Actualizar Cita";
    $('btn-cancelar-agenda').classList.remove('hidden');
    renderHorariosRecomendados();
    renderIcons();
}
function cambiarEstadoCita(id, estado) {
    const cita = agenda.find(item => item.id === id);
    if (!cita) return;
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
    cita.estado = 'Confirmada';
    citaActivaId = id;
    saveStore('agenda');
    if (typeof renderDashboard === 'function') renderDashboard();
    cargarPacienteAConsulta(clienteId, cita.petId);
}
function gestionarServicioExternoAgenda(agendaId) {
    const cita = agenda.find(item => item.id === agendaId);
    const servicio = serviciosExternos.find(item => item.agendaId === agendaId);
    if (!servicio) {
        switchTab('servicios-externos');
        alert('No encontré el servicio externo vinculado a esta cita. Puedes revisarlo en Servicios Externos.');
        return;
    }
    if (cita && cita.estado === 'Programada') {
        cita.estado = 'Confirmada';
        saveStore('agenda');
        if (typeof renderDashboard === 'function') renderDashboard();
    }
    switchTab('servicios-externos');
    renderServiciosExternos();
}
function cancelarEdicionAgenda() {
    $('edit-agenda-id').value = ''; 
    $('form-agenda').reset();
    $('titulo-form-agenda').innerHTML = `<i data-lucide="calendar-plus" class="text-blue-600 w-5 h-5"></i> Agendar Nueva Visita`;
    $('btn-guardar-agenda').innerText = "Agregar a la Agenda";
    $('btn-cancelar-agenda').classList.add('hidden');
    $('agenda-clinica-detalle')?.classList.add('hidden');
    if ($('agenda-clinica-servicio')) $('agenda-clinica-servicio').value = '';
    if ($('agenda-clinica-costo')) $('agenda-clinica-costo').value = '';
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
