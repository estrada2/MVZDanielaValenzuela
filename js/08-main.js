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
        estadoPago: consulta.estadoPago || 'Pagado'
    }))));
    const externos = (serviciosExternos || []).map(servicio => ({
        ...servicio,
        origenFinanciero: 'Externo',
        clienteNombre: servicio.clienteNombre || 'Servicio externo',
        mascotaNombre: 'Sin expediente',
        fechaObj: dashboardFechaConsulta(servicio),
        total: parseFloat(servicio.total) || 0,
        estadoPago: servicio.estadoPago || 'Pagado'
    }));
    return [...consultas, ...externos];
}
function dashboardFormatoMoneda(valor) {
    return (parseFloat(valor) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
function renderDashboard() {
    const hoy = new Date();
    const hoyStr = fechaLocalInput(hoy);
    const citasHoy = agenda.filter(cita => cita.fecha === hoyStr && !['Atendida', 'Cancelada'].includes(cita.estado || 'Programada'));
    const consultas = dashboardConsultas();
    const ingresosHoy = consultas
        .filter(con => con.estadoPago === 'Pagado' && con.fechaObj?.toDateString() === hoy.toDateString())
        .reduce((acc, con) => acc + con.total, 0);
    const pendientes = consultas.filter(con => con.estadoPago === 'Pendiente');
    const montoPendiente = pendientes.reduce((acc, con) => acc + con.total, 0);
    const stockCritico = inventario.filter(item => item.stock <= stockMinimo(item));

    if ($('dash-citas-hoy')) $('dash-citas-hoy').innerText = citasHoy.length;
    if ($('dash-ingresos-hoy')) $('dash-ingresos-hoy').innerText = dashboardFormatoMoneda(ingresosHoy);
    if ($('dash-pendiente')) $('dash-pendiente').innerText = dashboardFormatoMoneda(montoPendiente);
    if ($('dash-stock-critico')) $('dash-stock-critico').innerText = stockCritico.length;

    dashboardSetLista('dash-lista-agenda', citasHoy.slice(0, 5).map(cita => `
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-xl p-3 bg-slate-50">
            <div>
                <p class="text-sm font-bold text-slate-900">${cita.hora || '--:--'} · ${cita.petName || 'Paciente'} </p>
                <p class="text-xs text-slate-500">${cita.clienteNombre || 'Cliente'} · ${cita.notas || 'Sin notas'}</p>
            </div>
            ${cita.petId ? `<button type="button" onclick="atenderCita(${cita.id})" class="bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center justify-center gap-1"><i data-lucide="stethoscope" class="w-3.5 h-3.5"></i> Atender</button>` : ''}
        </div>
    `).join(''), 'No hay citas activas para hoy.');

    const recientes = consultas
        .filter(con => con.fechaObj && con.origenFinanciero !== 'Externo')
        .sort((a, b) => b.fechaObj - a.fechaObj)
        .slice(0, 4);
    dashboardSetLista('dash-pacientes-recientes', recientes.map(con => `
        <button type="button" onclick="abrirModalHistorial(${con.ownerId}, ${con.petId})" class="w-full text-left border rounded-xl p-3 bg-slate-50 hover:bg-slate-100">
            <p class="text-xs font-bold text-slate-900">${con.mascotaNombre}</p>
            <p class="text-[11px] text-slate-500">${con.clienteNombre} · ${con.origenFinanciero || 'Consulta'} · ${con.fechaObj.toLocaleDateString('es-MX')}</p>
        </button>
    `).join(''), 'Aún no hay consultas registradas.');

    dashboardSetLista('dash-stock-lista', stockCritico.slice(0, 5).map(item => `
        <div class="flex items-center justify-between border rounded-xl p-3 bg-amber-50 border-amber-100">
            <div>
                <p class="text-xs font-bold text-slate-900">${item.name}</p>
                <p class="text-[11px] text-slate-500">Mínimo ${stockMinimo(item)} · ${item.categoria || 'Medicamento'}</p>
            </div>
            <span class="text-xs font-black text-amber-800">${item.stock}</span>
        </div>
    `).join(''), 'No hay stock crítico.');

    dashboardSetLista('dash-pagos-pendientes', pendientes.slice(0, 5).map(con => `
        <div class="flex items-center justify-between border rounded-xl p-3 bg-rose-50 border-rose-100">
            <div>
                <p class="text-xs font-bold text-slate-900">${con.mascotaNombre}</p>
                <p class="text-[11px] text-slate-500">${con.clienteNombre} · ${con.servicioCobrado || 'Servicio'}</p>
            </div>
            <span class="text-xs font-black text-rose-700">$${dashboardFormatoMoneda(con.total)}</span>
        </div>
    `).join(''), 'No hay pagos pendientes.');
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
