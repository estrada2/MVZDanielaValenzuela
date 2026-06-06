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
        const valorInventario = (parseFloat(m.costoUnitario || 0) * parseInt(m.stock || 0));
        return `
            <div class="p-3 border rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xs transition-all ${critico || vencido ? 'bg-rose-50 border-rose-200' : porVencer ? 'bg-amber-50 border-amber-200' : 'bg-white'}">
                <div>
                    <b class="text-sm text-slate-800">${m.name}</b><br>
                    <span class="text-[10px] text-gray-500 uppercase tracking-wider">${m.categoria || 'Medicamento'} · ${m.unit} · mínimo ${stockMinimo(m)}</span>
                    <div class="flex flex-wrap gap-1.5 mt-1">
                        ${m.lote ? `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Lote ${m.lote}</span>` : ''}
                        ${m.proveedor ? `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">${m.proveedor}</span>` : ''}
                        ${m.costoUnitario ? `<span class="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Costo $${formatoMoneda(m.costoUnitario)} · Valor $${formatoMoneda(valorInventario)}</span>` : ''}
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
        proveedor: $('medProveedor')?.value || '',
        costoUnitario: parseFloat($('medCostoUnitario')?.value || 0)
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
    if ($('medCostoUnitario')) $('medCostoUnitario').value = target.costoUnitario || '';
    $(INVENTARIO_FORM.titleId).innerHTML = INVENTARIO_FORM.titleEdit;
    document.querySelector(INVENTARIO_FORM.submitSelector).innerText = INVENTARIO_FORM.submitEdit;
    renderIcons();
}
function cancelarEdicionMedicamento() {
    ensureHiddenInput(INVENTARIO_FORM.formId, INVENTARIO_FORM.editId);
    resetFormState(INVENTARIO_FORM);
    if ($('medMinStock')) $('medMinStock').value = 3;
    if ($('medCostoUnitario')) $('medCostoUnitario').value = '';
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
    renderServiciosExternos();
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
function fechaLocalInputFinanzas(fecha = new Date()) {
    const offset = fecha.getTimezoneOffset() * 60000;
    return new Date(fecha.getTime() - offset).toISOString().split('T')[0];
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
function costoInsumosConsulta(con) {
    return (con.insumos || []).reduce((acc, ins) => acc + (parseFloat(ins.costoSubtotal) || (parseFloat(ins.costoUnitario) || 0) * (parseInt(ins.qty) || 0)), 0);
}
function obtenerGastosFiltrados() {
    return (gastosFinancieros || [])
        .map(gasto => ({ ...gasto, fechaObj: parseFechaConsulta(gasto), monto: parseFloat(gasto.monto || 0) }))
        .filter(gasto => estaEnFiltro(gasto.fechaObj))
        .sort((a, b) => (b.fechaObj?.getTime() || 0) - (a.fechaObj?.getTime() || 0));
}
function obtenerConsultasFinanzas() {
    const consultas = clientes.flatMap(c => (c.mascotas || []).flatMap(m => (m.historial || []).map(con => ({
        ...con,
        origenFinanciero: 'Consulta',
        ownerId: c.id,
        petId: m.id,
        clienteNombre: c.owner,
        mascotaNombre: m.name,
        fechaObj: parseFechaConsulta(con),
        total: parseFloat(con.costoTotal) || 0,
        costoInsumos: costoInsumosConsulta(con),
        estadoPago: con.estadoPago || 'Pagado',
        metodoPago: con.metodoPago || 'Efectivo',
        notaPago: con.notaPago || ''
    }))));
    const externos = (serviciosExternos || []).map(servicio => ({
        ...servicio,
        origenFinanciero: 'Externo',
        clienteNombre: servicio.clienteNombre || 'Servicio externo',
        mascotaNombre: 'Sin expediente',
        fechaObj: parseFechaConsulta(servicio),
        total: parseFloat(servicio.total) || 0,
        estadoPago: servicio.estadoPago || 'Pagado',
        metodoPago: servicio.metodoPago || 'Efectivo',
        notaPago: servicio.notaPago || '',
        tipo: servicio.tipo || 'Servicio externo'
    }));
    return [...consultas, ...externos].sort((a, b) => (b.fechaObj?.getTime() || 0) - (a.fechaObj?.getTime() || 0));
}
function renderGananciasConsultas() {
    const txtMonto = $('monto-ganancias-filtrado');
    if (!txtMonto) return;
    const consultasFiltradas = obtenerConsultasFinanzas().filter(con => estaEnFiltro(con.fechaObj));
    const cobradas = consultasFiltradas.filter(con => con.estadoPago === 'Pagado');
    const pendientes = consultasFiltradas.filter(con => con.estadoPago === 'Pendiente');
    const totalAcumulado = cobradas.reduce((acc, con) => acc + con.total, 0);
    const costoInsumos = cobradas.reduce((acc, con) => acc + (parseFloat(con.costoInsumos || 0)), 0);
    const gastos = obtenerGastosFiltrados();
    const totalGastos = gastos.reduce((acc, gasto) => acc + gasto.monto, 0);
    const utilidadNeta = totalAcumulado - costoInsumos - totalGastos;
    const totalPendiente = pendientes.reduce((acc, con) => acc + con.total, 0);
    const ticketPromedio = cobradas.length ? totalAcumulado / cobradas.length : 0;
    txtMonto.innerText = formatoMoneda(totalAcumulado);
    if ($('total-consultas-filtrado')) $('total-consultas-filtrado').innerText = cobradas.length;
    if ($('ticket-promedio-filtrado')) $('ticket-promedio-filtrado').innerText = formatoMoneda(ticketPromedio);
    if ($('monto-costo-insumos')) $('monto-costo-insumos').innerText = formatoMoneda(costoInsumos);
    if ($('monto-gastos-filtrado')) $('monto-gastos-filtrado').innerText = formatoMoneda(totalGastos);
    if ($('monto-utilidad-neta')) $('monto-utilidad-neta').innerText = formatoMoneda(utilidadNeta);
    if ($('monto-pendiente-filtrado')) $('monto-pendiente-filtrado').innerText = formatoMoneda(totalPendiente);
    renderListaIngresos(consultasFiltradas);
    renderGastosFinancieros(gastos);
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
                    <p class="text-[11px] text-slate-500">${fecha} · ${con.origenFinanciero || 'Consulta'} · ${con.metodoPago}</p>
                    <p class="text-[11px] text-slate-500">${servicio}</p>
                    ${con.notaPago ? `<p class="text-[10px] text-slate-400 italic">${con.notaPago}</p>` : ''}
                </div>
                <div class="text-right space-y-1">
                    <span class="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${badgePago}">${con.estadoPago}</span>
                    <p class="text-sm font-black ${con.estadoPago === 'Pagado' ? 'text-emerald-700' : 'text-slate-600'}">$${formatoMoneda(con.total)}</p>
                    ${con.costoInsumos ? `<p class="text-[10px] text-blue-600 font-bold">Costo insumos: $${formatoMoneda(con.costoInsumos)}</p>` : ''}
                    ${con.estadoPago === 'Pendiente' ? (con.origenFinanciero === 'Externo'
                        ? `<button type="button" onclick="marcarServicioExternoPagado(${con.id})" class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">Marcar pagado</button>`
                        : `<button type="button" onclick="marcarConsultaPagada(${con.ownerId}, ${con.petId}, ${con.id})" class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-lg">Marcar pagado</button>`
                    ) : ''}
                </div>
            </div>`;
    }).join('');
}
function renderGastosFinancieros(gastos = obtenerGastosFiltrados()) {
    const lista = $('lista-gastos-financieros');
    if (!lista) return;
    if ($('gasto-fecha') && !$('gasto-fecha').value) $('gasto-fecha').value = fechaLocalInputFinanzas();
    if (!gastos.length) {
        lista.innerHTML = `<p class="text-xs text-gray-400 text-center py-8">No hay gastos en este periodo.</p>`;
        return;
    }
    lista.innerHTML = gastos.map(gasto => `
        <div class="bg-slate-50 border rounded-xl p-3 flex items-center justify-between gap-3">
            <div>
                <p class="text-xs font-bold text-slate-900">${gasto.categoria || 'Gasto'} · $${formatoMoneda(gasto.monto)}</p>
                <p class="text-[11px] text-slate-500">${gasto.fechaObj ? gasto.fechaObj.toLocaleDateString('es-MX') : gasto.fecha || 'Sin fecha'} · ${gasto.descripcion || 'Sin descripción'}</p>
            </div>
            <div class="flex items-center gap-1">
                <button type="button" onclick="iniciarEdicionGastoFinanciero(${gasto.id})" class="text-gray-400 hover:text-amber-600 p-1 bg-white border rounded-lg"><i data-lucide="edit" class="w-3.5 h-3.5"></i></button>
                <button type="button" onclick="eliminarGastoFinanciero(${gasto.id})" class="text-gray-300 hover:text-red-500 p-1 bg-white border rounded-lg"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            </div>
        </div>
    `).join('');
    renderIcons();
}
function guardarGastoFinanciero(e) {
    e.preventDefault();
    const editId = $('edit-gasto-id')?.value;
    const fecha = $('gasto-fecha')?.value || fechaLocalInputFinanzas();
    const item = {
        id: editId ? parseInt(editId) : uid(),
        fecha,
        fechaISO: editId ? (gastosFinancieros.find(g => g.id === parseInt(editId))?.fechaISO || new Date(`${fecha}T12:00:00`).toISOString()) : new Date(`${fecha}T12:00:00`).toISOString(),
        categoria: $('gasto-categoria')?.value || 'Gasolina',
        descripcion: $('gasto-descripcion')?.value.trim() || '',
        monto: parseFloat($('gasto-monto')?.value || 0)
    };
    gastosFinancieros = editId ? gastosFinancieros.map(g => g.id === item.id ? item : g) : [item, ...gastosFinancieros];
    saveStore('gastosFinancieros');
    cancelarEdicionGastoFinanciero();
    renderGananciasConsultas();
}
function iniciarEdicionGastoFinanciero(id) {
    const gasto = gastosFinancieros.find(g => g.id === id);
    if (!gasto) return;
    $('edit-gasto-id').value = gasto.id;
    $('gasto-fecha').value = gasto.fecha || fechaLocalInputFinanzas(parseFechaConsulta(gasto) || new Date());
    $('gasto-categoria').value = gasto.categoria || 'Gasolina';
    $('gasto-descripcion').value = gasto.descripcion || '';
    $('gasto-monto').value = gasto.monto || 0;
    $('btn-gasto-financiero').innerText = 'Actualizar gasto';
    $('btn-cancelar-gasto')?.classList.remove('hidden');
}
function cancelarEdicionGastoFinanciero() {
    $('form-gasto-financiero')?.reset();
    if ($('edit-gasto-id')) $('edit-gasto-id').value = '';
    if ($('gasto-fecha')) $('gasto-fecha').value = fechaLocalInputFinanzas();
    if ($('btn-gasto-financiero')) $('btn-gasto-financiero').innerText = 'Guardar gasto';
    $('btn-cancelar-gasto')?.classList.add('hidden');
}
function eliminarGastoFinanciero(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    gastosFinancieros = gastosFinancieros.filter(g => g.id !== id);
    saveStore('gastosFinancieros');
    renderGananciasConsultas();
}
function renderServiciosExternos() {
    const lista = $('lista-servicios-externos');
    if (!lista) return;
    if ($('externo-fecha') && !$('externo-fecha').value) $('externo-fecha').value = fechaLocalInputFinanzas();
    const ordenados = [...(serviciosExternos || [])].sort((a, b) => (parseFechaConsulta(b)?.getTime() || 0) - (parseFechaConsulta(a)?.getTime() || 0));
    if (!ordenados.length) {
        lista.innerHTML = `
            <div class="border border-dashed border-slate-200 rounded-2xl bg-slate-50 p-8 text-center">
                <i data-lucide="briefcase-medical" class="w-10 h-10 mx-auto text-slate-300 mb-2"></i>
                <p class="text-sm font-black text-slate-600">Aún no hay servicios externos</p>
                <p class="text-xs text-slate-400 mt-1">Cuando guardes ultrasonidos, toma de muestras u otros trabajos, aparecerán aquí.</p>
            </div>`;
        renderIcons();
        return;
    }
    lista.innerHTML = ordenados.map(item => {
        const pendiente = (item.estadoPago || 'Pagado') === 'Pendiente';
        const agendado = Boolean(item.agendaId || item.hora);
        const fecha = item.fecha || formatoFechaCorta(parseFechaConsulta(item));
        return `
            <article class="border rounded-2xl bg-white overflow-hidden shadow-xs ${pendiente ? 'border-rose-200' : agendado ? 'border-blue-200' : 'border-slate-200'}">
                <div class="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div class="flex items-start gap-3 min-w-0">
                        <div class="w-11 h-11 rounded-xl ${pendiente ? 'bg-rose-50 text-rose-700 border-rose-100' : 'bg-blue-50 text-blue-700 border-blue-100'} border flex items-center justify-center shrink-0">
                            <i data-lucide="${agendado ? 'calendar-check' : 'briefcase-medical'}" class="w-5 h-5"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="flex flex-wrap items-center gap-2">
                                <h4 class="text-sm font-black text-slate-900">${item.servicioCobrado || 'Servicio externo'}</h4>
                                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${pendiente ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}">${item.estadoPago || 'Pagado'}</span>
                                ${agendado ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">Agendado</span>` : ''}
                            </div>
                            <p class="text-xs text-slate-600 mt-1"><b>${item.clienteNombre || 'Sin contacto'}</b> · ${fecha}</p>
                            ${item.hora ? `<p class="text-[11px] text-blue-700 font-bold mt-0.5">${item.hora} hrs ${item.direccion ? `· ${item.direccion}` : ''}</p>` : item.direccion ? `<p class="text-[11px] text-slate-500 mt-0.5">${item.direccion}</p>` : ''}
                            ${item.notaPago ? `<p class="text-[11px] text-slate-400 italic mt-1 line-clamp-2">${item.notaPago}</p>` : ''}
                        </div>
                    </div>
                    <div class="flex flex-row lg:flex-col items-end justify-between gap-3">
                        <div class="text-right">
                            <p class="text-[10px] uppercase font-bold text-slate-400">Ingreso</p>
                            <p class="font-black text-lg ${pendiente ? 'text-rose-700' : 'text-emerald-700'}">$${formatoMoneda(item.total)}</p>
                            <p class="text-[10px] text-slate-400">${item.metodoPago || 'Efectivo'}</p>
                        </div>
                        <div class="flex flex-wrap items-center justify-end gap-1.5">
                            ${item.agendaId ? `<button onclick="crearRecordatorioApple(${item.agendaId})" class="text-amber-700 hover:bg-amber-50 px-2.5 py-2 bg-white border rounded-lg shadow-2xs transition-all flex items-center gap-1 text-[11px] font-bold" title="Apple Reminders"><i data-lucide="list-todo" class="w-4 h-4"></i> Reminder</button>` : ''}
                            ${pendiente ? `<button onclick="marcarServicioExternoPagado(${item.id})" class="text-emerald-700 hover:bg-emerald-50 px-2.5 py-2 bg-white border border-emerald-200 rounded-lg shadow-2xs transition-all flex items-center gap-1 text-[11px] font-bold" title="Marcar pagado"><i data-lucide="check-circle" class="w-4 h-4"></i> Cobrar</button>` : ''}
                            <button onclick="iniciarEdicionServicioExterno(${item.id})" class="text-amber-700 hover:bg-amber-50 px-2.5 py-2 bg-white border rounded-lg shadow-2xs transition-all flex items-center gap-1 text-[11px] font-bold" title="Editar"><i data-lucide="edit" class="w-4 h-4"></i> Editar</button>
                            <button onclick="eliminarServicioExterno(${item.id})" class="text-gray-400 hover:text-red-500 p-2 bg-white border rounded-lg shadow-2xs transition-all" title="Eliminar"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
                        </div>
                    </div>
                </div>
            </article>`;
    }).join('');
    renderIcons();
}
function sincronizarAgendaServicioExterno(item, agendar) {
    if (!agendar) {
        if (item.agendaId) {
            agenda = agenda.filter(cita => cita.id !== item.agendaId);
            item.agendaId = null;
            saveStore('agenda');
            if (typeof renderAgenda === 'function') renderAgenda();
        }
        return true;
    }
    if (!item.fecha || !item.hora) {
        alert('Para agendar un servicio externo necesitas fecha y hora.');
        return false;
    }
    const conflicto = typeof conflictoHorarioAgenda === 'function'
        ? conflictoHorarioAgenda(item.fecha, item.hora, item.agendaId || '')
        : null;
    if (conflicto) {
        alert(`Ese horario interfiere con una cita activa.\n\nCita existente: ${horaCita(conflicto)} hrs · ${conflicto.clienteNombre || 'Cliente'} ${conflicto.petName ? `(${conflicto.petName})` : ''}\n\nUsa un horario con al menos 45 minutos de separación.`);
        return false;
    }
    const agendaItem = {
        id: item.agendaId || uid(),
        fecha: item.fecha,
        hora: item.hora,
        clienteId: null,
        petId: null,
        clienteNombre: item.clienteNombre || 'Servicio externo',
        petName: item.servicioCobrado || 'Externo',
        direccion: item.direccion || '',
        notas: item.servicioCobrado || 'Servicio externo',
        estado: 'Programada',
        origen: 'Servicio externo'
    };
    const existe = agenda.some(cita => cita.id === agendaItem.id);
    agenda = existe ? agenda.map(cita => cita.id === agendaItem.id ? { ...cita, ...agendaItem } : cita) : [...agenda, agendaItem];
    item.agendaId = agendaItem.id;
    saveStore('agenda');
    if (typeof renderAgenda === 'function') renderAgenda();
    return true;
}
function guardarServicioExterno(e) {
    e.preventDefault();
    const editId = $('edit-servicio-externo-id')?.value;
    const fecha = $('externo-fecha')?.value || fechaLocalInputFinanzas();
    const item = {
        id: editId ? parseInt(editId) : uid(),
        fecha,
        hora: $('externo-hora')?.value || '',
        fechaISO: editId ? (serviciosExternos.find(s => s.id === parseInt(editId))?.fechaISO || new Date(`${fecha}T12:00:00`).toISOString()) : new Date(`${fecha}T12:00:00`).toISOString(),
        clienteNombre: $('externo-cliente')?.value.trim() || '',
        servicioCobrado: $('externo-servicio')?.value.trim() || '',
        direccion: $('externo-direccion')?.value.trim() || '',
        agendaId: editId ? (serviciosExternos.find(s => s.id === parseInt(editId))?.agendaId || null) : null,
        total: parseFloat($('externo-total')?.value || 0),
        metodoPago: $('externo-metodo')?.value || 'Efectivo',
        estadoPago: $('externo-estado')?.value || 'Pagado',
        notaPago: $('externo-nota')?.value.trim() || '',
        tipo: 'Servicio externo'
    };
    if (!sincronizarAgendaServicioExterno(item, $('externo-agendar')?.checked)) return;
    serviciosExternos = editId
        ? serviciosExternos.map(s => s.id === item.id ? item : s)
        : [item, ...serviciosExternos];
    saveStore('serviciosExternos');
    cancelarEdicionServicioExterno();
    renderServiciosExternos();
    renderGananciasConsultas();
    if (typeof renderDashboard === 'function') renderDashboard();
}
function iniciarEdicionServicioExterno(id) {
    const item = serviciosExternos.find(s => s.id === id);
    if (!item) return;
    $('edit-servicio-externo-id').value = item.id;
    $('externo-fecha').value = item.fecha || fechaLocalInputFinanzas(parseFechaConsulta(item) || new Date());
    $('externo-hora').value = item.hora || '';
    $('externo-cliente').value = item.clienteNombre || '';
    $('externo-servicio').value = item.servicioCobrado || '';
    $('externo-direccion').value = item.direccion || '';
    $('externo-total').value = item.total || 0;
    $('externo-metodo').value = item.metodoPago || 'Efectivo';
    $('externo-estado').value = item.estadoPago || 'Pagado';
    $('externo-nota').value = item.notaPago || '';
    if ($('externo-agendar')) $('externo-agendar').checked = Boolean(item.agendaId || item.hora);
    $('btn-servicio-externo').innerText = 'Actualizar Servicio Externo';
    $('btn-cancelar-servicio-externo')?.classList.remove('hidden');
    document.getElementById('form-servicio-externo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function cancelarEdicionServicioExterno() {
    $('form-servicio-externo')?.reset();
    if ($('edit-servicio-externo-id')) $('edit-servicio-externo-id').value = '';
    if ($('externo-fecha')) $('externo-fecha').value = fechaLocalInputFinanzas();
    if ($('externo-hora')) $('externo-hora').value = '';
    if ($('externo-agendar')) $('externo-agendar').checked = false;
    if ($('btn-servicio-externo')) $('btn-servicio-externo').innerText = 'Guardar Servicio Externo';
    $('btn-cancelar-servicio-externo')?.classList.add('hidden');
}
function eliminarServicioExterno(id) {
    if (!confirm('¿Eliminar este servicio externo?')) return;
    const item = serviciosExternos.find(s => s.id === id);
    if (item?.agendaId) {
        agenda = agenda.filter(cita => cita.id !== item.agendaId);
        saveStore('agenda');
        if (typeof renderAgenda === 'function') renderAgenda();
    }
    serviciosExternos = serviciosExternos.filter(s => s.id !== id);
    saveStore('serviciosExternos');
    renderServiciosExternos();
    renderGananciasConsultas();
    if (typeof renderDashboard === 'function') renderDashboard();
}
function marcarServicioExternoPagado(id) {
    const item = serviciosExternos.find(s => s.id === id);
    if (!item) return;
    const metodo = prompt('Método de pago:', item.metodoPago || 'Efectivo');
    if (metodo === null) return;
    item.estadoPago = 'Pagado';
    item.metodoPago = metodo || item.metodoPago || 'Efectivo';
    item.notaPago = item.notaPago ? `${item.notaPago} | Pagado ${new Date().toLocaleString('es-MX')}` : `Pagado ${new Date().toLocaleString('es-MX')}`;
    if (item.agendaId) {
        const cita = agenda.find(agendaItem => agendaItem.id === item.agendaId);
        if (cita && !['Cancelada'].includes(cita.estado || 'Programada')) {
            cita.estado = 'Atendida';
            saveStore('agenda');
            if (typeof renderAgenda === 'function') renderAgenda();
        }
    }
    saveStore('serviciosExternos');
    renderServiciosExternos();
    renderGananciasConsultas();
    if (typeof renderDashboard === 'function') renderDashboard();
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
    const headers = ['Fecha', 'Cliente', 'Mascota', 'Tipo', 'Servicios', 'Total', 'Costo insumos', 'Utilidad bruta', 'Estado de pago', 'Metodo', 'Nota'];
    const rows = consultas.map(con => [
        con.fechaObj ? con.fechaObj.toLocaleString('es-MX') : con.fecha,
        con.clienteNombre,
        con.mascotaNombre,
        con.tipo || '',
        con.servicioCobrado || '',
        con.total,
        con.costoInsumos || 0,
        (parseFloat(con.total || 0) - parseFloat(con.costoInsumos || 0)),
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
    const costoInsumos = cobradas.reduce((acc, con) => acc + (parseFloat(con.costoInsumos || 0)), 0);
    const gastos = obtenerGastosFiltrados();
    const totalGastos = gastos.reduce((acc, gasto) => acc + gasto.monto, 0);
    const utilidadNeta = totalCobrado - costoInsumos - totalGastos;
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
        `Costo de insumos: $${formatoMoneda(costoInsumos)}`,
        `Gastos: $${formatoMoneda(totalGastos)}`,
        `Utilidad neta: $${formatoMoneda(utilidadNeta)}`,
        `Pendiente: $${formatoMoneda(totalPendiente)}`,
        `Consultas cobradas: ${cobradas.length}`,
        '',
        'Por método de pago:',
        ...Object.entries(porMetodo).map(([metodo, total]) => `${metodo}: $${formatoMoneda(total)}`),
        '',
        'Gastos:',
        ...gastos.map(gasto => `${gasto.fechaObj ? gasto.fechaObj.toLocaleTimeString('es-MX') : ''} | ${gasto.categoria} | $${formatoMoneda(gasto.monto)} | ${gasto.descripcion || ''}`),
        '',
        'Movimientos:',
        ...consultas.map(con => `${con.fechaObj ? con.fechaObj.toLocaleTimeString('es-MX') : ''} | ${con.clienteNombre} | ${con.mascotaNombre} | ${con.estadoPago} | $${formatoMoneda(con.total)} | costo $${formatoMoneda(con.costoInsumos || 0)} | ${con.servicioCobrado || ''}`)
    ];
    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `corte-dia-vethome-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
}
