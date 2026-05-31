const INVENTARIO_FORM = {
    formId: 'form-inventario',
    editId: 'edit-med-id',
    titleId: 'titulo-form-inventario',
    submitSelector: '#form-inventario button[type="submit"]',
    titleDefault: '<i data-lucide="package-plus" class="text-blue-600 w-5 h-5"></i> Registrar Insumo',
    titleEdit: '<i data-lucide="edit-3" class="text-amber-600 w-5 h-5"></i> Editar Insumo',
    submitDefault: 'Guardar en Almacén',
    submitEdit: 'Actualizar Insumo'
};
function ensureHiddenInput(formId, inputId) {
    if ($(inputId)) return;
    const inputHidden = document.createElement('input');
    inputHidden.type = 'hidden';
    inputHidden.id = inputId;
    $(formId)?.appendChild(inputHidden);
}
function renderInventario() {
    const lst = $('lista-inventario'); 
    if(!lst) return;
    lst.innerHTML = inventario.map(m => {
        const critico = m.stock <= 3;
        return `
            <div class="p-3 border rounded-xl flex justify-between items-center shadow-xs transition-all ${critico ? 'bg-rose-50 border-rose-200' : 'bg-white'}">
                <div>
                    <b class="text-sm text-slate-800">${m.name}</b><br>
                    <span class="text-[10px] text-gray-500 uppercase tracking-wider">${m.unit}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="font-bold border px-2 py-0.5 rounded-lg text-xs ${critico ? 'bg-rose-600 text-white border-rose-600' : 'bg-gray-100 text-gray-700'}">${m.stock} disp</span>
                    <button onclick="iniciarEdicionMedicamento(${m.id})" class="text-gray-400 hover:text-amber-600 p-1 bg-white border rounded-lg shadow-2xs transition-all"><i data-lucide="edit" class="w-3.5 h-3.5"></i></button>
                    <button onclick="eliminarMedicamento(${m.id})" class="text-gray-300 hover:text-red-500 p-1 bg-white border rounded-lg shadow-2xs transition-all"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>
            </div>`;
    }).join('');
    renderIcons();
}
function guardarMedicamento(e) {
    e.preventDefault();
    const editId = $(INVENTARIO_FORM.editId)?.value;
    const item = {
        id: editId ? parseInt(editId) : uid(),
        name: $('medName').value,
        stock: parseInt($('medStock').value),
        unit: $('medUnit').value
    };
    inventario = editId
        ? inventario.map(m => m.id === item.id ? item : m)
        : [...inventario, item];
    saveStore('inventario');
    cancelarEdicionMedicamento();
    renderInventario(); 
    revisarAlertasStockGlobal();
}
function iniciarEdicionMedicamento(id) {
    const target = inventario.find(m => m.id === id);
    if (!target) return;
    ensureHiddenInput(INVENTARIO_FORM.formId, INVENTARIO_FORM.editId);
    $(INVENTARIO_FORM.editId).value = target.id;
    $('medName').value = target.name;
    $('medStock').value = target.stock;
    $('medUnit').value = target.unit;
    $(INVENTARIO_FORM.titleId).innerHTML = INVENTARIO_FORM.titleEdit;
    document.querySelector(INVENTARIO_FORM.submitSelector).innerText = INVENTARIO_FORM.submitEdit;
    renderIcons();
}
function cancelarEdicionMedicamento() {
    ensureHiddenInput(INVENTARIO_FORM.formId, INVENTARIO_FORM.editId);
    resetFormState(INVENTARIO_FORM);
}
function eliminarMedicamento(id) { 
    if(confirm("¿Eliminar este insumo del inventario?")){
        inventario = inventario.filter(m=>m.id!==id); 
        saveStore('inventario'); 
        renderInventario(); 
        revisarAlertasStockGlobal(); 
    }
}
function revisarAlertasStockGlobal() { 
    $('alertas-stock')?.classList.toggle('hidden', inventario.filter(m=>m.stock<=3).length===0); 
}
const FINANZAS_FORM = {
    formId: 'form-finanzas',
    editId: 'edit-fin-id',
    titleId: 'titulo-form-finanzas',
    submitSelector: '#form-finanzas button[type="submit"]',
    titleDefault: '<i data-lucide="plus-circle" class="text-emerald-600 w-5 h-5"></i> Configurar Nuevo Cobro',
    titleEdit: '<i data-lucide="edit-3" class="text-amber-600 w-5 h-5"></i> Editar Servicio',
    submitDefault: 'Añadir al Catálogo',
    submitEdit: 'Actualizar Precio'
};
function renderFinanzas() {
    const lst = $('lista-finanzas'); 
    if(!lst) return;
    lst.innerHTML = finanzas.map(f => `
        <div class="p-3 border border-emerald-200 bg-emerald-50/40 rounded-xl flex justify-between items-center shadow-3xs">
            <div><b class="text-sm text-slate-800">${f.nombre}</b></div>
            <div class="flex items-center gap-2">
                <span class="font-bold text-emerald-800 text-sm">$${f.precio} MXN</span>
                <button onclick="iniciarEdicionServicio(${f.id})" class="text-gray-400 hover:text-amber-600 p-1 bg-white border rounded-lg shadow-2xs transition-all"><i data-lucide="edit" class="w-3.5 h-3.5"></i></button>
                <button onclick="eliminarServicio(${f.id})" class="text-emerald-400 hover:text-red-500 p-1 bg-white border rounded-lg shadow-2xs transition-all"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        </div>`).join('');
    renderIcons();
}
function guardarServicio(e) {
    e.preventDefault();
    const editId = $(FINANZAS_FORM.editId)?.value;
    const item = {
        id: editId ? parseInt(editId) : uid(),
        nombre: $('fin-nombre').value,
        precio: parseFloat($('fin-precio').value)
    };
    finanzas = editId
        ? finanzas.map(f => f.id === item.id ? item : f)
        : [...finanzas, item];
    saveStore('finanzas');
    cancelarEdicionServicio();
    renderFinanzas();
    rellenarDropdownServicios();
}
function iniciarEdicionServicio(id) {
    const target = finanzas.find(f => f.id === id);
    if (!target) return;
    ensureHiddenInput(FINANZAS_FORM.formId, FINANZAS_FORM.editId);
    $(FINANZAS_FORM.editId).value = target.id;
    $('fin-nombre').value = target.nombre;
    $('fin-precio').value = target.precio;
    $(FINANZAS_FORM.titleId).innerHTML = FINANZAS_FORM.titleEdit;
    document.querySelector(FINANZAS_FORM.submitSelector).innerText = FINANZAS_FORM.submitEdit;
    renderIcons();
}
function cancelarEdicionServicio() {
    ensureHiddenInput(FINANZAS_FORM.formId, FINANZAS_FORM.editId);
    resetFormState(FINANZAS_FORM);
}
function eliminarServicio(id) { 
    if(confirm("¿Eliminar este servicio del catálogo de cobros?")){
        finanzas = finanzas.filter(f=>f.id!==id); 
        saveStore('finanzas'); 
        renderFinanzas();
        rellenarDropdownServicios();
    }
}
function abrirVisorID(src) { 
    const target = $('img-visor-target');
    if(target) target.src = src; 
    $('modal-id-viewer')?.classList.remove('hidden'); 
}
function cerrarVisorID() { $('modal-id-viewer')?.classList.add('hidden'); }
let filtroGananciasActivo = 'dia';
function formatoMoneda(valor) {
    return (parseFloat(valor) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseFechaConsulta(consulta) {
    if (consulta.fechaISO) return new Date(consulta.fechaISO);
    const directa = new Date(consulta.fecha);
    if (!Number.isNaN(directa.getTime())) return directa;
    const partes = String(consulta.fecha || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/);
    if (!partes) return null;
    const [, dia, mes, anio, hora = '0', minuto = '0'] = partes;
    return new Date(Number(anio), Number(mes) - 1, Number(dia), Number(hora), Number(minuto));
}
function estaEnFiltro(fechaConsulta, ahora = new Date()) {
    if (!fechaConsulta) return filtroGananciasActivo === 'todo';
    if (filtroGananciasActivo === 'todo') return true;
    if (filtroGananciasActivo === 'personalizado') {
        const inicio = $('finanzas-fecha-inicio')?.value ? new Date(`${$('finanzas-fecha-inicio').value}T00:00:00`) : null;
        const fin = $('finanzas-fecha-fin')?.value ? new Date(`${$('finanzas-fecha-fin').value}T23:59:59`) : null;
        if (inicio && fechaConsulta < inicio) return false;
        if (fin && fechaConsulta > fin) return false;
        return true;
    }
    if (filtroGananciasActivo === 'dia') return fechaConsulta.toDateString() === ahora.toDateString();
    if (filtroGananciasActivo === 'semana') {
        const difDias = (ahora.getTime() - fechaConsulta.getTime()) / (1000 * 3600 * 24);
        return difDias >= 0 && difDias <= 7;
    }
    if (filtroGananciasActivo === 'mes') {
        return fechaConsulta.getMonth() === ahora.getMonth() && fechaConsulta.getFullYear() === ahora.getFullYear();
    }
    return true;
}
function obtenerConsultasFinanzas() {
    return clientes.flatMap(c => (c.mascotas || []).flatMap(m => (m.historial || []).map(con => ({
        ...con,
        clienteNombre: c.owner,
        mascotaNombre: m.name,
        fechaObj: parseFechaConsulta(con),
        total: parseFloat(con.costoTotal) || 0,
        estadoPago: con.estadoPago || 'Pagado',
        metodoPago: con.metodoPago || 'Efectivo',
        notaPago: con.notaPago || ''
    })))).sort((a, b) => (b.fechaObj?.getTime() || 0) - (a.fechaObj?.getTime() || 0));
}
function renderGananciasConsultas() {
    const txtMonto = $('monto-ganancias-filtrado');
    if (!txtMonto) return;
    const consultasFiltradas = obtenerConsultasFinanzas().filter(con => estaEnFiltro(con.fechaObj));
    const cobradas = consultasFiltradas.filter(con => con.estadoPago === 'Pagado');
    const pendientes = consultasFiltradas.filter(con => con.estadoPago === 'Pendiente');
    const totalAcumulado = cobradas.reduce((acc, con) => acc + con.total, 0);
    const totalPendiente = pendientes.reduce((acc, con) => acc + con.total, 0);
    const ticketPromedio = cobradas.length ? totalAcumulado / cobradas.length : 0;
    txtMonto.innerText = formatoMoneda(totalAcumulado);
    if ($('total-consultas-filtrado')) $('total-consultas-filtrado').innerText = cobradas.length;
    if ($('ticket-promedio-filtrado')) $('ticket-promedio-filtrado').innerText = formatoMoneda(ticketPromedio);
    if ($('monto-pendiente-filtrado')) $('monto-pendiente-filtrado').innerText = formatoMoneda(totalPendiente);
    renderListaIngresos(consultasFiltradas);
    renderResumenServicios(cobradas);
}
function renderListaIngresos(consultas) {
    const lista = $('lista-ingresos-consultas');
    if (!lista) return;
    if (!consultas.length) {
        lista.innerHTML = `<p class="text-xs text-gray-400 text-center py-8">No hay ingresos en este periodo.</p>`;
        return;
    }
    lista.innerHTML = consultas.map(con => {
        const fecha = con.fechaObj ? con.fechaObj.toLocaleDateString('es-MX') : (con.fecha || 'Sin fecha');
        const servicio = con.servicioCobrado || 'Sin servicio registrado';
        const badgePago = con.estadoPago === 'Pagado'
            ? 'bg-emerald-100 text-emerald-800'
            : con.estadoPago === 'Pendiente'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-slate-100 text-slate-700';
        return `
            <div class="bg-white border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                    <p class="text-xs font-bold text-slate-900">${con.clienteNombre} · ${con.mascotaNombre}</p>
                    <p class="text-[11px] text-slate-500">${fecha} · ${con.tipo || 'Consulta'} · ${con.metodoPago}</p>
                    <p class="text-[11px] text-slate-500">${servicio}</p>
                    ${con.notaPago ? `<p class="text-[10px] text-slate-400 italic">${con.notaPago}</p>` : ''}
                </div>
                <div class="text-right space-y-1">
                    <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${badgePago}">${con.estadoPago}</span>
                    <p class="text-sm font-black ${con.estadoPago === 'Pagado' ? 'text-emerald-700' : 'text-slate-600'}">$${formatoMoneda(con.total)}</p>
                </div>
            </div>`;
    }).join('');
}
function renderResumenServicios(consultas) {
    const contenedor = $('resumen-servicios-finanzas');
    if (!contenedor) return;
    const resumen = {};
    consultas.forEach(con => {
        const servicios = (con.servicioCobrado || 'Sin servicio registrado').split(' + ');
        servicios.forEach(servicio => {
            const nombre = servicio.replace(/\s*\(\$.*?\)\s*/g, '').trim() || 'Sin servicio registrado';
            const montoMatch = servicio.match(/\(\$(\d+(?:\.\d+)?)\)/);
            const monto = montoMatch ? parseFloat(montoMatch[1]) : con.total / servicios.length;
            if (!resumen[nombre]) resumen[nombre] = { cantidad: 0, total: 0 };
            resumen[nombre].cantidad += 1;
            resumen[nombre].total += monto;
        });
    });
    const items = Object.entries(resumen).sort((a, b) => b[1].total - a[1].total);
    if (!items.length) {
        contenedor.innerHTML = `<p class="text-xs text-gray-400 text-center py-8">Sin servicios cobrados.</p>`;
        return;
    }
    contenedor.innerHTML = items.slice(0, 6).map(([nombre, data]) => `
        <div class="bg-white border rounded-xl p-3">
            <div class="flex justify-between gap-2">
                <span class="text-xs font-bold text-slate-800">${nombre}</span>
                <span class="text-xs font-black text-emerald-700">$${formatoMoneda(data.total)}</span>
            </div>
            <p class="text-[10px] text-gray-500 mt-1">${data.cantidad} cobro${data.cantidad === 1 ? '' : 's'}</p>
        </div>
    `).join('');
}
function filtrarGanancias(tipoFiltro) {
    filtroGananciasActivo = tipoFiltro;
    const filtros = ['dia', 'semana', 'mes', 'todo', 'personalizado'];
    filtros.forEach(f => {
        const btn = $(`btn-filtro-${f}`);
        if (btn) {
            if (f === tipoFiltro) {
                btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg transition-all text-slate-700 bg-white shadow-3xs";
            } else {
                btn.className = "px-3 py-1.5 text-xs font-bold rounded-lg transition-all text-slate-600 hover:text-slate-900";
            }
        }
    });
    renderGananciasConsultas();
}
function exportarIngresosCSV() {
    const consultas = obtenerConsultasFinanzas().filter(con => estaEnFiltro(con.fechaObj));
    if (!consultas.length) {
        alert("No hay ingresos para exportar en este periodo.");
        return;
    }
    const headers = ['Fecha', 'Cliente', 'Mascota', 'Tipo', 'Servicios', 'Total', 'Estado de pago', 'Metodo', 'Nota'];
    const rows = consultas.map(con => [
        con.fechaObj ? con.fechaObj.toLocaleString('es-MX') : con.fecha,
        con.clienteNombre,
        con.mascotaNombre,
        con.tipo || '',
        con.servicioCobrado || '',
        con.total,
        con.estadoPago,
        con.metodoPago,
        con.notaPago
    ]);
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ingresos-vethome-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
}
