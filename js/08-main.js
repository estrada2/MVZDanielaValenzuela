document.addEventListener('DOMContentLoaded', async () => {
    $('form-login')?.addEventListener('submit', iniciarSesion);
    const listo = await initRemoteStorage();
    if (!listo) return;
    document.addEventListener('click', (e) => {
        const wrapper = $('dropdown-servicios-wrapper');
        const panel = $('dropdown-servicios-opciones');
        if (wrapper && !wrapper.contains(e.target)) {
            panel?.classList.add('hidden');
        }
        const buscadorGlobal = $('buscador-global');
        const resultadosGlobales = $('resultados-busqueda-global');
        if (buscadorGlobal && resultadosGlobales && !buscadorGlobal.contains(e.target) && !resultadosGlobales.contains(e.target)) {
            resultadosGlobales.classList.add('hidden');
        }
    });
    refrescarInterfaz();
    setupSignatureCanvas('canvas-firma'); 
    setupSignatureCanvas('canvas-firma-vet');
    setupWhiteboardCanvas();
    renderIcons();
});
function refrescarInterfaz() {
    renderDashboard();
    renderClientes(); 
    renderAgenda(); 
    renderInventario(); 
    renderFinanzas(); 
    renderGananciasConsultas();
    if (typeof renderServiciosExternos === 'function') renderServiciosExternos();
    actualizarSelectAgenda(); 
    revisarAlertasStockGlobal(); 
    renderIcons();
}
function dashboardFechaConsulta(consulta) {
    if (consulta.fechaISO) return new Date(consulta.fechaISO);
    const fecha = new Date(consulta.fecha);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
}
function dashboardConsultas() {
    const consultas = clientes.flatMap(cliente => (cliente.mascotas || []).flatMap(mascota => (mascota.historial || []).map(consulta => ({
        ...consulta,
        origenFinanciero: 'Consulta',
        clienteNombre: cliente.owner,
        mascotaNombre: mascota.name,
        ownerId: cliente.id,
        petId: mascota.id,
        fechaObj: dashboardFechaConsulta(consulta),
        total: parseFloat(consulta.costoTotal) || 0,
        estadoPago: typeof estadoPagoCalculado === 'function'
            ? estadoPagoCalculado({ ...consulta, total: parseFloat(consulta.costoTotal) || 0 })
            : (consulta.estadoPago || 'Pagado'),
        abonos: consulta.abonos || []
    }))));
    const externos = (serviciosExternos || []).map(servicio => ({
        ...servicio,
        origenFinanciero: 'Externo',
        clienteNombre: servicio.clienteNombre || 'Servicio externo',
        mascotaNombre: 'Sin expediente',
        fechaObj: dashboardFechaConsulta(servicio),
        total: parseFloat(servicio.total) || 0,
        estadoPago: typeof estadoPagoCalculado === 'function' ? estadoPagoCalculado(servicio) : (servicio.estadoPago || 'Pagado'),
        abonos: servicio.abonos || []
    }));
    return [...consultas, ...externos];
}
function dashboardIngresadoEnDia(item, fechaObjetivo) {
    const abonos = item.abonos || [];
    const totalAbonadoDia = abonos
        .filter(abono => {
            const fecha = abono.fechaISO ? new Date(abono.fechaISO) : null;
            return fecha && !Number.isNaN(fecha.getTime()) && fecha.toDateString() === fechaObjetivo.toDateString();
        })
        .reduce((acc, abono) => acc + (parseFloat(abono.monto) || 0), 0);
    if (totalAbonadoDia) return totalAbonadoDia;
    if (item.estadoPago === 'Pagado' && !abonos.length && item.fechaObj?.toDateString() === fechaObjetivo.toDateString()) return item.total;
    return 0;
}
function dashboardFormatoMoneda(valor) {
    return (parseFloat(valor) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function diasHastaFecha(fecha) {
    if (!fecha || Number.isNaN(fecha.getTime())) return null;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const objetivo = new Date(fecha);
    objetivo.setHours(0, 0, 0, 0);
    return Math.ceil((objetivo - hoy) / (1000 * 60 * 60 * 24));
}
function claseNotificacionPrioridad(prioridad) {
    if (prioridad === 'alta') return {
        card: 'bg-rose-50 border-rose-200 text-rose-900',
        icon: 'text-rose-700',
        banner: 'bg-rose-50 border-rose-200 text-rose-900'
    };
    if (prioridad === 'media') return {
        card: 'bg-amber-50 border-amber-200 text-amber-900',
        icon: 'text-amber-700',
        banner: 'bg-amber-50 border-amber-200 text-amber-900'
    };
    return {
        card: 'bg-blue-50 border-blue-100 text-blue-900',
        icon: 'text-blue-700',
        banner: 'bg-blue-50 border-blue-100 text-blue-900'
    };
}
function notificacionesVacunas() {
    const items = [];
    clientes.forEach(cliente => {
        (cliente.mascotas || []).forEach(mascota => {
            if (typeof vacunasPacienteDesdeHistorial !== 'function') return;
            vacunasPacienteDesdeHistorial(mascota).forEach(vacuna => {
                const dias = diasHastaFecha(vacuna.fechaRefuerzo);
                if (dias === null || dias > 45) return;
                items.push({
                    id: `vacuna-${cliente.id}-${mascota.id}-${vacuna.id}`,
                    tipo: 'Vacuna',
                    prioridad: dias < 0 ? 'alta' : 'media',
                    icono: 'syringe',
                    titulo: dias < 0 ? `Refuerzo vencido: ${mascota.name}` : `Refuerzo próximo: ${mascota.name}`,
                    detalle: `${vacuna.nombre} · ${dias < 0 ? `${Math.abs(dias)} días vencida` : `en ${dias} días`}`,
                    accion: `abrirModalHistorial(${cliente.id}, ${mascota.id})`
                });
            });
        });
    });
    return items;
}
function notificacionesSeguimientos() {
    const items = [];
    clientes.forEach(cliente => {
        (cliente.mascotas || []).forEach(mascota => {
            (mascota.historial || []).forEach(consulta => {
                if (!consulta.seguimiento?.requerido) return;
                const fecha = consulta.seguimiento.fecha ? new Date(`${consulta.seguimiento.fecha}T12:00:00`) : null;
                const dias = fecha ? diasHastaFecha(fecha) : null;
                if (dias !== null && dias > 7) return;
                items.push({
                    id: `seguimiento-${consulta.id}`,
                    tipo: 'Seguimiento',
                    prioridad: dias !== null && dias <= 0 ? 'alta' : 'media',
                    icono: 'activity',
                    titulo: dias === null ? `Seguimiento pendiente: ${mascota.name}` : dias < 0 ? `Seguimiento vencido: ${mascota.name}` : `Seguimiento en ${dias} días`,
                    detalle: consulta.seguimiento.nota || consulta.motivo || 'Revisión clínica pendiente',
                    accion: `abrirModalHistorial(${cliente.id}, ${mascota.id})`
                });
            });
        });
    });
    return items;
}
function notificacionesOperativas() {
    const ahora = new Date();
    const hoy = fechaLocalInput(ahora);
    const citas = agenda
        .filter(cita => cita.fecha === hoy && !['Atendida', 'Cancelada'].includes(cita.estado || 'Programada'))
        .map(cita => ({ cita, fechaObj: fechaHoraCita(cita) }))
        .filter(item => !Number.isNaN(item.fechaObj.getTime()))
        .map(({ cita, fechaObj }) => {
            const minutos = Math.round((fechaObj - ahora) / 60000);
            if (minutos < -15 || minutos > 60) return null;
            return {
                id: `cita-${cita.id}`,
                tipo: 'Agenda',
                prioridad: minutos <= 15 ? 'alta' : 'media',
                icono: cita.petId ? 'calendar-clock' : 'briefcase-medical',
                titulo: minutos < 0 ? `Cita en curso: ${cita.petName || cita.clienteNombre}` : `Cita en ${minutos} min`,
                detalle: `${cita.hora || '--:--'} · ${cita.clienteNombre || 'Cliente'} · ${cita.notas || 'Sin notas'}`,
                accion: cita.petId ? `atenderCita(${cita.id})` : `gestionarServicioExternoAgenda(${cita.id})`
            };
        })
        .filter(Boolean);
    const stock = inventario
        .filter(item => item.stock <= stockMinimo(item))
        .slice(0, 8)
        .map(item => ({
            id: `stock-${item.id}`,
            tipo: 'Stock',
            prioridad: item.stock <= 0 ? 'alta' : 'media',
            icono: 'package-search',
            titulo: item.stock <= 0 ? `Agotado: ${item.name}` : `Stock crítico: ${item.name}`,
            detalle: `${item.stock} disponibles · mínimo ${stockMinimo(item)}`,
            accion: `switchTab('inventario')`
        }));
    const pagos = dashboardConsultas()
        .filter(item => item.estadoPago === 'Pendiente')
        .sort((a, b) => (typeof saldoPendiente === 'function' ? saldoPendiente(b) : b.total) - (typeof saldoPendiente === 'function' ? saldoPendiente(a) : a.total))
        .slice(0, 8)
        .map(item => ({
            id: `pago-${item.origenFinanciero}-${item.id}`,
            tipo: 'Pago',
            prioridad: 'media',
            icono: 'badge-dollar-sign',
            titulo: `Pago pendiente: $${dashboardFormatoMoneda(typeof saldoPendiente === 'function' ? saldoPendiente(item) : item.total)}`,
            detalle: `${item.clienteNombre} · ${item.servicioCobrado || item.servicio || 'Servicio'}`,
            accion: item.origenFinanciero === 'Externo' ? `switchTab('servicios-externos')` : `abrirModalHistorial(${item.ownerId}, ${item.petId})`
        }));
    return [...citas, ...notificacionesVacunas(), ...notificacionesSeguimientos(), ...stock, ...pagos]
        .sort((a, b) => (a.prioridad === 'alta' ? -1 : 0) - (b.prioridad === 'alta' ? -1 : 0));
}
function idsNotificacionesVistas() {
    try {
        return JSON.parse(sessionStorage.getItem('vethome_notificaciones_vistas') || '[]');
    } catch {
        return [];
    }
}
function guardarNotificacionesVistas(ids) {
    sessionStorage.setItem('vethome_notificaciones_vistas', JSON.stringify(Array.from(new Set(ids))));
}
function ejecutarAccionNotificacion(accion) {
    cerrarPanelNotificaciones();
    Function(accion)();
}
function renderCardNotificacion(item, compacto = false) {
    const clase = claseNotificacionPrioridad(item.prioridad);
    return `
        <button type="button" onclick="ejecutarAccionNotificacion('${item.accion.replace(/'/g, "\\'")}')" class="w-full text-left border rounded-xl ${clase.card} p-3 flex items-start gap-2 hover:brightness-95 transition-all">
            <i data-lucide="${item.icono}" class="w-4 h-4 mt-0.5 shrink-0 ${clase.icon}"></i>
            <span class="min-w-0">
                <span class="block text-[10px] font-black uppercase opacity-70">${item.tipo}</span>
                <span class="block ${compacto ? 'text-xs' : 'text-sm'} font-black truncate">${item.titulo}</span>
                <span class="block text-[11px] opacity-75 ${compacto ? 'line-clamp-1' : ''}">${item.detalle}</span>
            </span>
        </button>
    `;
}
function ocultarBannerNotificacion() {
    const primera = notificacionesOperativas()[0];
    if (primera) sessionStorage.setItem('vethome_banner_notificacion_oculta', primera.id);
    $('banner-notificacion-principal')?.classList.add('hidden');
}
function renderNotificacionesOperativas() {
    const notificaciones = notificacionesOperativas();
    const vistas = new Set(idsNotificacionesVistas());
    const noVistas = notificaciones.filter(item => !vistas.has(item.id));
    const badge = $('badge-notificaciones');
    if (badge) {
        badge.classList.toggle('hidden', !noVistas.length);
        badge.innerText = noVistas.length > 9 ? '9+' : String(noVistas.length);
    }
    dashboardSetLista('dash-notificaciones', notificaciones.slice(0, 4).map(item => renderCardNotificacion(item, true)).join(''), 'No hay alertas importantes por ahora.');
    const banner = $('banner-notificacion-principal');
    const primera = noVistas[0];
    if (!banner || !primera || sessionStorage.getItem('vethome_banner_notificacion_oculta') === primera.id) {
        banner?.classList.add('hidden');
    } else {
        const clase = claseNotificacionPrioridad(primera.prioridad);
        banner.className = `${clase.banner} border-b px-4 sm:px-6 py-3`;
        if ($('banner-notificacion-icono')) $('banner-notificacion-icono').setAttribute('data-lucide', primera.icono);
        if ($('banner-notificacion-titulo')) $('banner-notificacion-titulo').innerText = primera.titulo;
        if ($('banner-notificacion-detalle')) $('banner-notificacion-detalle').innerText = primera.detalle;
    }
    if (!$('modal-notificaciones')?.classList.contains('hidden')) renderListaNotificaciones();
}
function renderListaNotificaciones() {
    const lista = $('lista-notificaciones');
    if (!lista) return;
    const notificaciones = notificacionesOperativas();
    lista.innerHTML = notificaciones.length
        ? notificaciones.map(item => renderCardNotificacion(item)).join('')
        : `<div class="text-center text-slate-400 text-xs py-12 border border-dashed rounded-2xl bg-white">No hay notificaciones activas.</div>`;
    renderIcons();
}
function abrirPanelNotificaciones() {
    guardarNotificacionesVistas([...idsNotificacionesVistas(), ...notificacionesOperativas().map(item => item.id)]);
    renderListaNotificaciones();
    renderNotificacionesOperativas();
    setHidden('modal-notificaciones', false);
    renderIcons();
}
function cerrarPanelNotificaciones() {
    setHidden('modal-notificaciones', true);
}
function itemBusquedaGlobal(tipo, titulo, detalle, accion, icono) {
    return { tipo, titulo, detalle, accion, icono };
}
function resultadosBusquedaGlobal(termino) {
    const q = String(termino || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const coincide = valor => String(valor || '').toLowerCase().includes(q);
    const resultados = [];
    clientes.forEach(cliente => {
        if (coincide(cliente.owner) || coincide(cliente.phone) || coincide(cliente.address)) {
            resultados.push(itemBusquedaGlobal('Cliente', cliente.owner, `${cliente.phone || 'Sin teléfono'} · ${cliente.address || 'Sin dirección'}`, `switchTab('clientes'); verMascotasCliente(${cliente.id})`, 'users'));
        }
        (cliente.mascotas || []).forEach(mascota => {
            if (coincide(mascota.name) || coincide(mascota.species) || coincide(mascota.raza)) {
                resultados.push(itemBusquedaGlobal('Mascota', mascota.name, `${cliente.owner} · ${mascota.species || 'Paciente'}`, `abrirModalHistorial(${cliente.id}, ${mascota.id})`, 'paw-print'));
            }
        });
    });
    agenda.forEach(cita => {
        if ([cita.clienteNombre, cita.petName, cita.notas, cita.direccion, cita.fecha, cita.hora].some(coincide)) {
            resultados.push(itemBusquedaGlobal('Agenda', `${cita.hora || '--:--'} · ${cita.petName || cita.clienteNombre || 'Cita'}`, `${cita.fecha || 'Sin fecha'} · ${cita.estado || 'Programada'}`, `switchTab('agenda')`, 'calendar'));
        }
    });
    inventario.forEach(item => {
        if ([item.name, item.categoria, item.lote, item.proveedor].some(coincide)) {
            resultados.push(itemBusquedaGlobal('Stock', item.name, `${item.stock} ${item.unit || ''} · ${item.categoria || 'Insumo'}`, `switchTab('inventario')`, 'package'));
        }
    });
    serviciosExternos.forEach(servicio => {
        if ([servicio.clienteNombre, servicio.servicioCobrado, servicio.notaPago, servicio.direccion].some(coincide)) {
            resultados.push(itemBusquedaGlobal('Externo', servicio.servicioCobrado || 'Servicio externo', `${servicio.clienteNombre || 'Sin contacto'} · $${dashboardFormatoMoneda(servicio.total)}`, `switchTab('servicios-externos')`, 'briefcase-medical'));
        }
    });
    return resultados.slice(0, 8);
}
function ejecutarBusquedaGlobal(accion) {
    $('resultados-busqueda-global')?.classList.add('hidden');
    cerrarBusquedaGlobalMovil();
    if ($('buscador-global')) $('buscador-global').value = '';
    if ($('buscador-global-movil')) $('buscador-global-movil').value = '';
    Function(accion)();
}
function renderBusquedaGlobal() {
    const panel = $('resultados-busqueda-global');
    const input = $('buscador-global');
    if (!panel || !input) return;
    const resultados = resultadosBusquedaGlobal(input.value);
    if (!resultados.length) {
        panel.innerHTML = input.value.trim().length >= 2
            ? `<div class="p-4 text-xs text-slate-400 text-center">Sin resultados.</div>`
            : '';
        panel.classList.toggle('hidden', !input.value.trim());
        return;
    }
    panel.innerHTML = resultados.map(item => `
        <button type="button" onclick="ejecutarBusquedaGlobal('${item.accion.replace(/'/g, "\\'")}')" class="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-start gap-2 border-b border-slate-100 last:border-b-0">
            <i data-lucide="${item.icono}" class="w-4 h-4 text-blue-600 mt-0.5 shrink-0"></i>
            <span class="min-w-0">
                <span class="block text-xs font-black text-slate-900 truncate">${item.titulo}</span>
                <span class="block text-[10px] font-bold text-blue-700 uppercase">${item.tipo}</span>
                <span class="block text-[11px] text-slate-500 truncate">${item.detalle}</span>
            </span>
        </button>
    `).join('');
    panel.classList.remove('hidden');
    renderIcons();
}
function abrirBusquedaGlobalMovil() {
    setHidden('modal-busqueda-global', false);
    setTimeout(() => $('buscador-global-movil')?.focus(), 50);
    renderBusquedaGlobalMovil();
    renderIcons();
}
function cerrarBusquedaGlobalMovil() {
    setHidden('modal-busqueda-global', true);
}
function renderBusquedaGlobalMovil() {
    const panel = $('resultados-busqueda-global-movil');
    const input = $('buscador-global-movil');
    if (!panel || !input) return;
    const resultados = resultadosBusquedaGlobal(input.value);
    if (!resultados.length) {
        panel.innerHTML = input.value.trim().length >= 2
            ? `<div class="p-6 text-xs text-slate-400 text-center">Sin resultados.</div>`
            : `<div class="p-6 text-xs text-slate-400 text-center">Escribe al menos 2 letras.</div>`;
        return;
    }
    panel.innerHTML = resultados.map(item => `
        <button type="button" onclick="ejecutarBusquedaGlobal('${item.accion.replace(/'/g, "\\'")}')" class="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-start gap-2 border-b border-slate-100 last:border-b-0">
            <i data-lucide="${item.icono}" class="w-4 h-4 text-blue-600 mt-0.5 shrink-0"></i>
            <span class="min-w-0">
                <span class="block text-sm font-black text-slate-900 truncate">${item.titulo}</span>
                <span class="block text-[10px] font-bold text-blue-700 uppercase">${item.tipo}</span>
                <span class="block text-xs text-slate-500 truncate">${item.detalle}</span>
            </span>
        </button>
    `).join('');
    renderIcons();
}
function fechaLocalInput(fecha) {
    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, '0');
    const day = String(fecha.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function dashboardSetLista(id, html, emptyText) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = html || `<div class="text-xs text-slate-400 text-center py-6 border border-dashed rounded-xl bg-slate-50">${emptyText}</div>`;
}
function renderAuditoriaDashboard() {
    const lista = $('dash-auditoria');
    if (!lista) return;
    const items = (auditLogs || []).slice(0, 8);
    if (!items.length) {
        lista.innerHTML = `<div class="text-xs text-slate-400 text-center py-6 border border-dashed rounded-xl bg-slate-50">Aún no hay actividad registrada.</div>`;
        return;
    }
    lista.innerHTML = items.map(item => {
        const fecha = item.fechaISO ? new Date(item.fechaISO).toLocaleString('es-MX') : '';
        return `
            <div class="border rounded-xl p-3 bg-slate-50 flex items-start justify-between gap-3">
                <div>
                    <p class="text-xs font-black text-slate-900">${item.accion || 'Cambio'} · ${item.tabla || 'App'}</p>
                    <p class="text-[11px] text-slate-500">${item.resumen || 'Sin detalle'}</p>
                    <p class="text-[10px] text-slate-400">${fecha} · ${item.usuario || 'Usuario'}</p>
                </div>
                <i data-lucide="history" class="w-4 h-4 text-slate-300 shrink-0"></i>
            </div>
        `;
    }).join('');
}
function renderDashboard() {
    const hoy = new Date();
    const hoyStr = fechaLocalInput(hoy);
    const citasHoy = agenda
        .filter(cita => (typeof normalizarFechaCita === 'function' ? normalizarFechaCita(cita) : cita.fecha) === hoyStr && !['Atendida', 'Cancelada'].includes(cita.estado || 'Programada'))
        .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
    const consultas = dashboardConsultas();
    const ingresosHoy = consultas
        .reduce((acc, con) => acc + dashboardIngresadoEnDia(con, hoy), 0);
    const pendientes = consultas.filter(con => con.estadoPago === 'Pendiente');
    const montoPendiente = pendientes.reduce((acc, con) => acc + (typeof saldoPendiente === 'function' ? saldoPendiente(con) : con.total), 0);
    const stockCritico = inventario.filter(item => item.stock <= stockMinimo(item));

    if ($('dash-citas-hoy')) $('dash-citas-hoy').innerText = citasHoy.length;
    if ($('dash-ingresos-hoy')) $('dash-ingresos-hoy').innerText = dashboardFormatoMoneda(ingresosHoy);
    if ($('dash-pendiente')) $('dash-pendiente').innerText = dashboardFormatoMoneda(montoPendiente);
    if ($('dash-stock-critico')) $('dash-stock-critico').innerText = stockCritico.length;
    if ($('dash-fecha-hoy')) $('dash-fecha-hoy').innerText = hoy.toLocaleDateString('es-MX', { weekday: 'long', day: '2-digit', month: 'long' });
    if ($('dash-resumen-dia')) {
        $('dash-resumen-dia').innerText = `${citasHoy.length} visita${citasHoy.length === 1 ? '' : 's'} activa${citasHoy.length === 1 ? '' : 's'} · $${dashboardFormatoMoneda(ingresosHoy)} ingresados hoy · ${pendientes.length} cobro${pendientes.length === 1 ? '' : 's'} pendiente${pendientes.length === 1 ? '' : 's'}.`;
    }

    dashboardSetLista('dash-lista-agenda', citasHoy.slice(0, 5).map(cita => `
        <article class="dash-agenda-item">
            <div class="dash-agenda-time">${cita.hora || '--:--'}</div>
            <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                    <p class="text-sm font-black text-slate-900 truncate">${cita.petName || cita.clienteNombre || 'Visita'}</p>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${cita.petId ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}">${cita.petId ? 'Consulta' : 'Externo'}</span>
                </div>
                <p class="text-xs text-slate-500 truncate">${cita.clienteNombre || 'Cliente'} · ${cita.notas || 'Sin notas'}</p>
                ${cita.direccion ? `<p class="text-[11px] text-slate-400 truncate">${cita.direccion}</p>` : ''}
            </div>
            ${cita.petId
                ? `<button type="button" onclick="atenderCita(${cita.id})" class="dash-row-action"><i data-lucide="stethoscope" class="w-3.5 h-3.5"></i><span>Atender</span></button>`
                : `<button type="button" onclick="gestionarServicioExternoAgenda(${cita.id})" class="dash-row-action"><i data-lucide="briefcase-medical" class="w-3.5 h-3.5"></i><span>Gestionar</span></button>`
            }
        </article>
    `).join(''), 'No hay citas activas para hoy.');

    dashboardSetLista('dash-stock-lista', stockCritico.slice(0, 5).map(item => `
        <div class="dash-list-item bg-amber-50 border-amber-100">
            <span class="dash-list-icon bg-white text-amber-700"><i data-lucide="package-search" class="w-4 h-4"></i></span>
            <div class="min-w-0 flex-1">
                <p class="text-xs font-black text-slate-900 truncate">${item.name}</p>
                <p class="text-[11px] text-slate-500 truncate">Mínimo ${stockMinimo(item)} · ${item.categoria || 'Medicamento'}</p>
            </div>
            <span class="text-xs font-black text-amber-800 shrink-0">${item.stock}</span>
        </div>
    `).join(''), 'No hay stock crítico.');

    dashboardSetLista('dash-pagos-pendientes', pendientes.slice(0, 5).map(con => `
        <div class="dash-list-item bg-rose-50 border-rose-100">
            <span class="dash-list-icon bg-white text-rose-700"><i data-lucide="badge-dollar-sign" class="w-4 h-4"></i></span>
            <div class="min-w-0 flex-1">
                <p class="text-xs font-black text-slate-900 truncate">${con.mascotaNombre}</p>
                <p class="text-[11px] text-slate-500 truncate">${con.clienteNombre} · ${con.servicioCobrado || 'Servicio'}</p>
            </div>
            <span class="text-xs font-black text-rose-700 shrink-0">$${dashboardFormatoMoneda(typeof saldoPendiente === 'function' ? saldoPendiente(con) : con.total)}</span>
        </div>
    `).join(''), 'No hay pagos pendientes.');
    renderNotificacionesOperativas();
    renderIcons();
}
function regresarAlDirectorioDesdeConsulta() {
    switchTab('clientes');
    $('subpagina-mascotas-area')?.classList.add('hidden');
    $('directorio-clientes-area')?.classList.remove('hidden');
    consultaSeleccionada = { ownerId: null, petId: null, ownerObj: null, petObj: null };
    if($('consulta-paciente-nombre')) {
        $('consulta-paciente-nombre').innerText = "Ninguno seleccionado";
    }
    limpiarWhiteboard();
    renderClientes();
}
