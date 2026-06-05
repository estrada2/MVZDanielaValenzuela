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
let filtroInventarioActivo = 'todos';
function stockMinimo(item) {
    return Number.isFinite(Number(item.minStock)) ? Number(item.minStock) : 3;
}
function caducidadProxima(item) {
    if (!item.caducidad) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const fecha = new Date(`${item.caducidad}T00:00:00`);
    const dias = (fecha - hoy) / (1000 * 60 * 60 * 24);
    return dias >= 0 && dias <= 45;
}
function caducidadVencida(item) {
    if (!item.caducidad) return false;
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return new Date(`${item.caducidad}T00:00:00`) < hoy;
}
function registrarMovimientoInventario({ item, tipo, cantidad, motivo }) {
    movimientosInventario.unshift({
        id: uid(),
        fechaISO: new Date().toISOString(),
        itemId: item.id,
        itemName: item.name,
        tipo,
        cantidad,
        stockResultante: item.stock,
        motivo
    });
    movimientosInventario = movimientosInventario.slice(0, 300);
}
function filtrarInventario(filtro) {
    filtroInventarioActivo = filtro;
    if ($('filtro-inventario')) $('filtro-inventario').value = filtro;
    renderInventario();
}
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
    const busqueda = String($('buscador-inventario')?.value || '').toLowerCase();
    const items = inventario.filter(m => {
        if (filtroInventarioActivo === 'criticos') return m.stock <= stockMinimo(m);
        if (filtroInventarioActivo === 'agotados') return m.stock <= 0;
        if (filtroInventarioActivo === 'caducidad') return caducidadProxima(m) || caducidadVencida(m);
        if (['Vacuna', 'Medicamento', 'Desparasitante', 'Material'].includes(filtroInventarioActivo)) return (m.categoria || 'Medicamento') === filtroInventarioActivo;
        return true;
    }).filter(m => {
        if (!busqueda) return true;
        return [m.name, m.categoria, m.lote, m.proveedor].some(valor => String(valor || '').toLowerCase().includes(busqueda));
    });
    if (!items.length) {
        lst.innerHTML = `<p class="text-xs text-gray-400 text-center py-10">No hay insumos en este filtro.</p>`;
        renderMovimientosInventario();
        return;
    }
    lst.innerHTML = items.map(m => {
        const critico = m.stock <= stockMinimo(m);
        const vencido = caducidadVencida(m);
        const porVencer = caducidadProxima(m);
        return `
            <div class="p-3 border rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs transition-all ${critico || vencido ? 'bg-rose-50 border-rose-200' : porVencer ? 'bg-amber-50 border-amber-200' : 'bg-white'}">
                <div>
                    <b class="text-sm text-slate-800">${m.name}</b><br>
                    <span class="text-[10px] text-gray-500 uppercase tracking-wider">${m.categoria || 'Medicamento'} · ${m.unit} · mínimo ${stockMinimo(m)}</span>
                    <div class="flex flex-wrap gap-1.5 mt-1">
                        ${m.lote ? `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Lote ${m.lote}</span>` : ''}
                        ${m.proveedor ? `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${m.proveedor}</span>` : ''}
                        ${m.caducidad ? `<span class="text-[10px] ${vencido ? 'bg-rose-600 text-white' : porVencer ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-600'} px-2 py-0.5 rounded-full">Caduca ${m.caducidad}</span>` : ''}
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    <span class="font-bold border px-2 py-0.5 rounded-lg text-xs ${critico ? 'bg-rose-600 text-white border-rose-600' : 'bg-gray-100 text-gray-700'}">${m.stock} disp</span>
                    <button onclick="registrarEntradaSalidaStock(${m.id}, 'Entrada')" title="Entrada rápida" class="text-emerald-600 hover:bg-emerald-50 p-1 bg-white border rounded-lg shadow-2xs transition-all"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>
                    <button onclick="registrarEntradaSalidaStock(${m.id}, 'Salida')" title="Salida rápida" class="text-rose-600 hover:bg-rose-50 p-1 bg-white border rounded-lg shadow-2xs transition-all"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button>
                    <button onclick="ajustarStockManual(${m.id})" title="Ajustar existencia" class="text-gray-400 hover:text-blue-600 p-1 bg-white border rounded-lg shadow-2xs transition-all"><i data-lucide="plus-minus" class="w-3.5 h-3.5"></i></button>
                    <button onclick="iniciarEdicionMedicamento(${m.id})" class="text-gray-400 hover:text-amber-600 p-1 bg-white border rounded-lg shadow-2xs transition-all"><i data-lucide="edit" class="w-3.5 h-3.5"></i></button>
                    <button onclick="eliminarMedicamento(${m.id})" class="text-gray-300 hover:text-red-500 p-1 bg-white border rounded-lg shadow-2xs transition-all"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
                </div>
            </div>`;
    }).join('');
    renderIcons();
    renderMovimientosInventario();
}
function guardarMedicamento(e) {
    e.preventDefault();
    const editId = $(INVENTARIO_FORM.editId)?.value;
    const item = {
        id: editId ? parseInt(editId) : uid(),
        name: $('medName').value,
        stock: parseInt($('medStock').value),
        unit: $('medUnit').value,
        categoria: $('medCategoria').value,
        minStock: parseInt($('medMinStock').value),
        lote: $('medLote')?.value || '',
        caducidad: $('medCaducidad')?.value || '',
        proveedor: $('medProveedor')?.value || ''
    };
    const anterior = inventario.find(m => m.id === item.id);
    inventario = editId
        ? inventario.map(m => m.id === item.id ? item : m)
        : [...inventario, item];
    const diferencia = editId ? item.stock - anterior.stock : item.stock;
    if (!editId || diferencia) {
        registrarMovimientoInventario({
            item,
            tipo: diferencia >= 0 ? 'Entrada' : 'Ajuste',
            cantidad: diferencia,
            motivo: editId ? 'Actualización de existencia' : 'Alta inicial de inventario'
        });
    }
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
    $('medCategoria').value = target.categoria || 'Medicamento';
    $('medMinStock').value = stockMinimo(target);
    if ($('medLote')) $('medLote').value = target.lote || '';
    if ($('medCaducidad')) $('medCaducidad').value = target.caducidad || '';
    if ($('medProveedor')) $('medProveedor').value = target.proveedor || '';
    $(INVENTARIO_FORM.titleId).innerHTML = INVENTARIO_FORM.titleEdit;
    document.querySelector(INVENTARIO_FORM.submitSelector).innerText = INVENTARIO_FORM.submitEdit;
    renderIcons();
}
function cancelarEdicionMedicamento() {
    ensureHiddenInput(INVENTARIO_FORM.formId, INVENTARIO_FORM.editId);
    resetFormState(INVENTARIO_FORM);
    if ($('medMinStock')) $('medMinStock').value = 3;
}
function eliminarMedicamento(id) { 
    if(confirm("¿Eliminar este insumo del inventario?")){
        const item = inventario.find(m => m.id === id);
        if (item) registrarMovimientoInventario({ item, tipo: 'Baja', cantidad: -item.stock, motivo: 'Eliminación de insumo' });
        inventario = inventario.filter(m=>m.id!==id); 
        saveStore('inventario'); 
        renderInventario(); 
        revisarAlertasStockGlobal(); 
    }
}
function revisarAlertasStockGlobal() { 
    const criticos = inventario.filter(m => m.stock <= stockMinimo(m));
    const caducidades = inventario.filter(m => caducidadProxima(m) || caducidadVencida(m));
    $('alertas-stock')?.classList.toggle('hidden', criticos.length === 0 && caducidades.length === 0);
    if ($('texto-alerta-stock') && (criticos.length || caducidades.length)) {
        const mensajes = [];
        if (criticos.length) mensajes.push(`Stock crítico: ${criticos.map(m => `${m.name} (${m.stock})`).join(', ')}`);
        if (caducidades.length) mensajes.push(`Caducidad por revisar: ${caducidades.map(m => `${m.name}${m.caducidad ? ` (${m.caducidad})` : ''}`).join(', ')}`);
        $('texto-alerta-stock').innerText = mensajes.join(' · ');
    }
}
function ajustarStockManual(id) {
    const item = inventario.find(m => m.id === id);
    if (!item) return;
    const valor = prompt(`Existencia actual de ${item.name}: ${item.stock}\nIngresa la nueva existencia:`, item.stock);
    if (valor === null) return;
    const nuevaExistencia = parseInt(valor);
    if (!Number.isInteger(nuevaExistencia) || nuevaExistencia < 0) {
        alert("Ingresa una existencia válida.");
        return;
    }
    const diferencia = nuevaExistencia - item.stock;
    if (!diferencia) return;
    item.stock = nuevaExistencia;
    registrarMovimientoInventario({ item, tipo: diferencia > 0 ? 'Entrada' : 'Ajuste', cantidad: diferencia, motivo: 'Ajuste manual' });
    saveStore('inventario');
    renderInventario();
    revisarAlertasStockGlobal();
}
function registrarEntradaSalidaStock(id, tipo) {
    const item = inventario.find(m => m.id === id);
    if (!item) return;
    const valor = prompt(`${tipo} de ${item.name}\nCantidad:`, '1');
    if (valor === null) return;
    const cantidad = parseInt(valor);
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
        alert("Ingresa una cantidad válida.");
        return;
    }
    const delta = tipo === 'Entrada' ? cantidad : -cantidad;
    if (item.stock + delta < 0) {
        alert("No puedes dejar el stock en negativo.");
        return;
    }
    item.stock += delta;
    registrarMovimientoInventario({ item, tipo, cantidad: delta, motivo: `${tipo} rápida` });
    saveStore('inventario');
    renderInventario();
    revisarAlertasStockGlobal();
}
function renderMovimientosInventario() {
    const lista = $('lista-movimientos-inventario');
    if (!lista) return;
    if (!movimientosInventario.length) {
        lista.innerHTML = `<p class="text-xs text-gray-400 text-center py-8">Todavía no hay movimientos registrados.</p>`;
        return;
    }
    lista.innerHTML = movimientosInventario.slice(0, 80).map(mov => {
        const positivo = mov.cantidad > 0;
        return `
            <div class="border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50">
                <div>
                    <p class="text-xs font-bold text-slate-800">${mov.itemName}</p>
                    <p class="text-[11px] text-slate-500">${new Date(mov.fechaISO).toLocaleString('es-MX')} · ${mov.tipo} · ${mov.motivo}</p>
                </div>
                <div class="text-right">
                    <p class="text-sm font-black ${positivo ? 'text-emerald-700' : 'text-rose-700'}">${positivo ? '+' : ''}${mov.cantidad}</p>
                    <p class="text-[10px] text-slate-500">Stock: ${mov.stockResultante}</p>
                </div>
            </div>`;
    }).join('');
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
        ownerId: c.id,
        petId: m.id,
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
    renderResumenMetodosPago(cobradas);
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
                    ${con.estadoPago === 'Pendiente' ? `<button type="button" onclick="marcarConsultaPagada(${con.ownerId}, ${con.petId}, ${con.id})" class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">Marcar pagado</button>` : ''}
                </div>
            </div>`;
    }).join('');
}
function marcarConsultaPagada(ownerId, petId, consultaId) {
    const owner = clientes.find(c => c.id === ownerId);
    const pet = owner?.mascotas.find(m => m.id === petId);
    const consulta = pet?.historial?.find(h => h.id === consultaId);
    if (!consulta) return;
    const metodo = prompt("Método de pago:", consulta.metodoPago || "Efectivo");
    if (metodo === null) return;
    consulta.estadoPago = 'Pagado';
    consulta.metodoPago = metodo || consulta.metodoPago || 'Efectivo';
    consulta.notaPago = consulta.notaPago ? `${consulta.notaPago} | Pagado ${new Date().toLocaleString('es-MX')}` : `Pagado ${new Date().toLocaleString('es-MX')}`;
    saveStore('clientes');
    renderGananciasConsultas();
    if (typeof renderDashboard === 'function') renderDashboard();
    if (typeof renderHistorialClinicoActivo === 'function') renderHistorialClinicoActivo();
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
function renderResumenMetodosPago(consultas) {
    const contenedor = $('resumen-metodos-pago');
    if (!contenedor) return;
    const resumen = {};
    consultas.forEach(con => {
        const metodo = con.metodoPago || 'Efectivo';
        resumen[metodo] = (resumen[metodo] || 0) + con.total;
    });
    const items = Object.entries(resumen);
    if (!items.length) {
        contenedor.innerHTML = `<p class="text-xs text-gray-400 sm:col-span-4 text-center py-3">Sin pagos cobrados.</p>`;
        return;
    }
    contenedor.innerHTML = items.map(([metodo, total]) => `
        <div class="bg-white border rounded-xl p-3">
            <p class="text-[10px] font-bold uppercase text-slate-400">${metodo}</p>
            <p class="text-sm font-black text-slate-900">$${formatoMoneda(total)}</p>
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
function exportarCorteDelDia() {
    const filtroOriginal = filtroGananciasActivo;
    filtroGananciasActivo = 'dia';
    const consultas = obtenerConsultasFinanzas().filter(con => estaEnFiltro(con.fechaObj));
    filtroGananciasActivo = filtroOriginal;
    if (!consultas.length) {
        alert("No hay movimientos para el corte del día.");
        return;
    }
    const cobradas = consultas.filter(con => con.estadoPago === 'Pagado');
    const pendientes = consultas.filter(con => con.estadoPago === 'Pendiente');
    const totalCobrado = cobradas.reduce((acc, con) => acc + con.total, 0);
    const totalPendiente = pendientes.reduce((acc, con) => acc + con.total, 0);
    const porMetodo = {};
    cobradas.forEach(con => {
        porMetodo[con.metodoPago || 'Efectivo'] = (porMetodo[con.metodoPago || 'Efectivo'] || 0) + con.total;
    });
    const lineas = [
        'Corte del día - VetHome Pro',
        new Date().toLocaleString('es-MX'),
        '',
        `Total cobrado: $${formatoMoneda(totalCobrado)}`,
        `Pendiente: $${formatoMoneda(totalPendiente)}`,
        `Consultas cobradas: ${cobradas.length}`,
        '',
        'Por método de pago:',
        ...Object.entries(porMetodo).map(([metodo, total]) => `${metodo}: $${formatoMoneda(total)}`),
        '',
        'Movimientos:',
        ...consultas.map(con => `${con.fechaObj ? con.fechaObj.toLocaleTimeString('es-MX') : ''} | ${con.clienteNombre} | ${con.mascotaNombre} | ${con.estadoPago} | $${formatoMoneda(con.total)} | ${con.servicioCobrado || ''}`)
    ];
    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `corte-dia-vethome-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
}
