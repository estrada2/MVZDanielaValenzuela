let modoDatosRemotos = 'app_state';
let normalizedReloadTimer = null;

const TABLAS_NORMALIZADAS = [
    'clientes',
    'mascotas',
    'servicios',
    'inventario',
    'agenda',
    'consultas',
    'pagos',
    'movimientos_inventario'
];

function idsLegacy(lista) {
    return lista.map(item => item?.id ?? item?.legacy_id).filter(id => id !== undefined && id !== null);
}

function numeroONulo(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
}

function fechaAgenda(cita) {
    if (cita.fecha) return cita.fecha;
    if (cita.date) return cita.date;
    return null;
}

function horaAgenda(cita) {
    if (cita.hora) return cita.hora;
    if (cita.time) return cita.time;
    return null;
}

function fechaISOConsulta(consulta) {
    if (consulta.fechaISO) return consulta.fechaISO;
    const fecha = new Date(consulta.fecha);
    return Number.isNaN(fecha.getTime()) ? new Date().toISOString() : fecha.toISOString();
}

async function upsertTabla(nombre, registros, columnas = '*') {
    if (!registros.length) return [];
    const { data, error } = await supabaseClient
        .from(nombre)
        .upsert(registros, { onConflict: 'user_id,legacy_id' })
        .select(columnas);
    if (error) throw error;
    return data || [];
}

async function borrarFaltantes(nombre, legacyIds) {
    let query = supabaseClient.from(nombre).delete().eq('user_id', usuarioActivo.id);
    if (legacyIds.length) query = query.not('legacy_id', 'in', `(${legacyIds.join(',')})`);
    const { error } = await query;
    if (error) throw error;
}

function mapearEstadoNormalizado(rows) {
    const clientesPorId = new Map();
    const mascotasPorId = new Map();
    const pagosPorConsulta = new Map();

    (rows.clientes || []).forEach(row => {
        clientesPorId.set(row.id, {
            id: row.legacy_id || row.id,
            dbId: row.id,
            owner: row.nombre || '',
            phone: row.telefono || '',
            email: row.email || '',
            address: row.direccion || '',
            ownerNotes: row.notas || '',
            ownerIdFile: row.id_photo || '',
            mascotas: []
        });
    });

    (rows.mascotas || []).forEach(row => {
        const mascota = {
            id: row.legacy_id || row.id,
            dbId: row.id,
            name: row.nombre || '',
            species: row.especie || '',
            raza: row.raza || '',
            age: row.edad ?? '',
            peso: row.peso ?? '',
            spayed: row.esterilizado || '',
            photo: row.foto || '',
            estudios: row.estudios || [],
            historial: []
        };
        mascotasPorId.set(row.id, mascota);
        clientesPorId.get(row.cliente_id)?.mascotas.push(mascota);
    });

    (rows.pagos || []).forEach(row => {
        if (row.consulta_id) pagosPorConsulta.set(row.consulta_id, row);
    });

    (rows.consultas || []).forEach(row => {
        const pago = pagosPorConsulta.get(row.id);
        const consulta = {
            id: row.legacy_id || row.id,
            fecha: row.fecha_texto || new Date(row.fecha_iso).toLocaleString('es-MX'),
            fechaISO: row.fecha_iso,
            tipo: row.tipo || '',
            peso: row.peso || '--',
            temp: row.temperatura || '--',
            motivo: row.motivo || '',
            tratamiento: row.tratamiento || '',
            sintomas: row.sintomas || '',
            vacunas: row.vacunas,
            desparasitante: row.desparasitante,
            disclaimer: row.disclaimer || '',
            insumos: row.insumos || [],
            costoTotal: parseFloat(pago?.total || 0),
            servicioCobrado: pago?.servicio_cobrado || 'Sin servicio registrado',
            metodoPago: pago?.metodo_pago || 'Efectivo',
            estadoPago: pago?.estado_pago || 'Pagado',
            notaPago: pago?.nota_pago || '',
            notasRapidas: row.notas_rapidas || '',
            vacunasControlStock: row.vacunas_control_stock,
            firmaDueno: row.firma_dueno || '',
            firmaVet: row.firma_vet || ''
        };
        mascotasPorId.get(row.mascota_id)?.historial.push(consulta);
    });

    mascotasPorId.forEach(mascota => {
        mascota.historial.sort((a, b) => new Date(b.fechaISO).getTime() - new Date(a.fechaISO).getTime());
        delete mascota.dbId;
    });

    const clientesMapeados = Array.from(clientesPorId.values()).map(cliente => {
        delete cliente.dbId;
        return cliente;
    });

    const mascotasPorLegacy = new Map();
    clientesMapeados.forEach(cliente => {
        cliente.mascotas.forEach(mascota => mascotasPorLegacy.set(mascota.id, mascota));
    });

    const clientesPorLegacy = new Map(clientesMapeados.map(cliente => [cliente.id, cliente]));
    const agendaMapeada = (rows.agenda || []).map(row => {
        const cliente = clientesPorLegacy.get((rows.clientes || []).find(c => c.id === row.cliente_id)?.legacy_id || row.cliente_id);
        const mascota = mascotasPorLegacy.get((rows.mascotas || []).find(m => m.id === row.mascota_id)?.legacy_id || row.mascota_id);
        return {
            id: row.legacy_id || row.id,
            fecha: row.fecha || '',
            hora: row.hora ? String(row.hora).slice(0, 5) : '',
            clienteId: cliente?.id || row.cliente_id,
            petId: mascota?.id || row.mascota_id,
            clienteNombre: cliente?.owner || '',
            petName: mascota?.name || '',
            direccion: row.direccion || '',
            notas: row.notas || 'Sin notas',
            estado: row.estado || 'Programada'
        };
    });

    return {
        clientes: clientesMapeados,
        inventario: (rows.inventario || []).map(row => ({
            id: row.legacy_id || row.id,
            name: row.nombre || '',
            stock: row.stock || 0,
            unit: row.unidad || '',
            categoria: row.categoria || 'Medicamento',
            minStock: row.stock_minimo ?? 3,
            lote: row.lote || '',
            caducidad: row.caducidad || '',
            proveedor: row.proveedor || ''
        })),
        agenda: agendaMapeada,
        finanzas: (rows.servicios || []).map(row => ({
            id: row.legacy_id || row.id,
            nombre: row.nombre || '',
            precio: parseFloat(row.precio || 0)
        })),
        movimientosInventario: (rows.movimientos_inventario || []).map(row => ({
            id: row.legacy_id || row.id,
            fechaISO: row.fecha_iso,
            itemId: row.inventario_id,
            itemName: row.item_nombre || '',
            tipo: row.tipo || '',
            cantidad: row.cantidad || 0,
            stockResultante: row.stock_resultante || 0,
            motivo: row.motivo || ''
        }))
    };
}

async function cargarEstadoBaseNormalizada() {
    try {
        const consultas = await Promise.all(TABLAS_NORMALIZADAS.map(tabla =>
            supabaseClient.from(tabla).select('*').eq('user_id', usuarioActivo.id)
        ));
        const error = consultas.find(resultado => resultado.error)?.error;
        if (error) return { ok: false, error };
        const rows = Object.fromEntries(TABLAS_NORMALIZADAS.map((tabla, index) => [tabla, consultas[index].data || []]));
        return { ok: true, estado: mapearEstadoNormalizado(rows) };
    } catch (error) {
        return { ok: false, error };
    }
}

async function guardarEstadoBaseNormalizada() {
    const userId = usuarioActivo.id;
    const clientesRows = clientes.map(cliente => ({
        user_id: userId,
        legacy_id: cliente.id,
        nombre: cliente.owner || '',
        telefono: cliente.phone || '',
        email: cliente.email || '',
        direccion: cliente.address || '',
        notas: cliente.ownerNotes || '',
        id_photo: cliente.ownerIdFile || '',
        updated_at: new Date().toISOString()
    }));
    const clientesGuardados = await upsertTabla('clientes', clientesRows, 'id, legacy_id');
    const clienteDbPorLegacy = new Map(clientesGuardados.map(row => [row.legacy_id, row.id]));

    const mascotasRows = clientes.flatMap(cliente => (cliente.mascotas || []).map(mascota => ({
        user_id: userId,
        legacy_id: mascota.id,
        cliente_id: clienteDbPorLegacy.get(cliente.id),
        nombre: mascota.name || '',
        especie: mascota.species || '',
        raza: mascota.raza || '',
        edad: numeroONulo(mascota.age),
        peso: numeroONulo(mascota.peso),
        esterilizado: mascota.spayed || '',
        foto: mascota.photo || '',
        estudios: mascota.estudios || [],
        updated_at: new Date().toISOString()
    }))).filter(row => row.cliente_id);
    const mascotasGuardadas = await upsertTabla('mascotas', mascotasRows, 'id, legacy_id');
    const mascotaDbPorLegacy = new Map(mascotasGuardadas.map(row => [row.legacy_id, row.id]));

    const serviciosRows = finanzas.map(servicio => ({
        user_id: userId,
        legacy_id: servicio.id,
        nombre: servicio.nombre || '',
        precio: parseFloat(servicio.precio || 0),
        activo: true,
        updated_at: new Date().toISOString()
    }));
    await upsertTabla('servicios', serviciosRows, 'id, legacy_id');

    const inventarioRows = inventario.map(item => ({
        user_id: userId,
        legacy_id: item.id,
        nombre: item.name || '',
        stock: parseInt(item.stock || 0),
        unidad: item.unit || '',
        categoria: item.categoria || 'Medicamento',
        stock_minimo: parseInt(item.minStock || 3),
        lote: item.lote || '',
        caducidad: item.caducidad || null,
        proveedor: item.proveedor || '',
        updated_at: new Date().toISOString()
    }));
    const inventarioGuardado = await upsertTabla('inventario', inventarioRows, 'id, legacy_id');
    const inventarioDbPorLegacy = new Map(inventarioGuardado.map(row => [row.legacy_id, row.id]));

    const agendaRows = agenda.map(cita => ({
        user_id: userId,
        legacy_id: cita.id,
        cliente_id: clienteDbPorLegacy.get(cita.clienteId || cita.ownerId) || null,
        mascota_id: mascotaDbPorLegacy.get(cita.petId) || null,
        fecha: fechaAgenda(cita),
        hora: horaAgenda(cita),
        direccion: cita.direccion || cita.address || '',
        notas: cita.notas || cita.notes || 'Sin notas',
        estado: cita.estado || 'Programada',
        updated_at: new Date().toISOString()
    }));
    await upsertTabla('agenda', agendaRows, 'id, legacy_id');

    const consultasRows = [];
    clientes.forEach(cliente => {
        (cliente.mascotas || []).forEach(mascota => {
            (mascota.historial || []).forEach(consulta => {
                consultasRows.push({
                    user_id: userId,
                    legacy_id: consulta.id,
                    cliente_id: clienteDbPorLegacy.get(cliente.id) || null,
                    mascota_id: mascotaDbPorLegacy.get(mascota.id) || null,
                    fecha_iso: fechaISOConsulta(consulta),
                    fecha_texto: consulta.fecha || '',
                    tipo: consulta.tipo || '',
                    peso: consulta.peso || '',
                    temperatura: consulta.temp || '',
                    motivo: consulta.motivo || '',
                    tratamiento: consulta.tratamiento || '',
                    sintomas: consulta.sintomas || '',
                    vacunas: consulta.vacunas,
                    desparasitante: consulta.desparasitante,
                    disclaimer: consulta.disclaimer || '',
                    notas_rapidas: consulta.notasRapidas || '',
                    insumos: consulta.insumos || [],
                    vacunas_control_stock: consulta.vacunasControlStock || null,
                    firma_dueno: consulta.firmaDueno || '',
                    firma_vet: consulta.firmaVet || '',
                    updated_at: new Date().toISOString()
                });
            });
        });
    });
    const consultasGuardadas = await upsertTabla('consultas', consultasRows.filter(row => row.mascota_id), 'id, legacy_id');
    const consultaDbPorLegacy = new Map(consultasGuardadas.map(row => [row.legacy_id, row.id]));

    const pagosRows = [];
    clientes.forEach(cliente => {
        (cliente.mascotas || []).forEach(mascota => {
            (mascota.historial || []).forEach(consulta => {
                pagosRows.push({
                    user_id: userId,
                    legacy_id: consulta.id,
                    consulta_id: consultaDbPorLegacy.get(consulta.id) || null,
                    cliente_id: clienteDbPorLegacy.get(cliente.id) || null,
                    mascota_id: mascotaDbPorLegacy.get(mascota.id) || null,
                    servicio_cobrado: consulta.servicioCobrado || 'Sin servicio registrado',
                    total: parseFloat(consulta.costoTotal || 0),
                    metodo_pago: consulta.metodoPago || 'Efectivo',
                    estado_pago: consulta.estadoPago || 'Pagado',
                    nota_pago: consulta.notaPago || '',
                    fecha_iso: fechaISOConsulta(consulta),
                    updated_at: new Date().toISOString()
                });
            });
        });
    });
    await upsertTabla('pagos', pagosRows.filter(row => row.consulta_id), 'id, legacy_id');

    const movimientosRows = movimientosInventario.map(mov => ({
        user_id: userId,
        legacy_id: mov.id,
        inventario_id: inventarioDbPorLegacy.get(mov.itemId) || null,
        item_nombre: mov.itemName || '',
        tipo: mov.tipo || '',
        cantidad: parseInt(mov.cantidad || 0),
        stock_resultante: parseInt(mov.stockResultante || 0),
        motivo: mov.motivo || '',
        fecha_iso: mov.fechaISO || new Date().toISOString()
    }));
    await upsertTabla('movimientos_inventario', movimientosRows, 'id, legacy_id');

    await borrarFaltantes('pagos', idsLegacy(pagosRows));
    await borrarFaltantes('consultas', idsLegacy(consultasRows));
    await borrarFaltantes('movimientos_inventario', idsLegacy(movimientosInventario));
    await borrarFaltantes('agenda', idsLegacy(agenda));
    await borrarFaltantes('mascotas', idsLegacy(mascotasRows));
    await borrarFaltantes('clientes', idsLegacy(clientes));
    await borrarFaltantes('inventario', idsLegacy(inventario));
    await borrarFaltantes('servicios', idsLegacy(finanzas));
}

function escucharCambiosBaseNormalizada() {
    if (!usuarioActivo) return;
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = supabaseClient.channel(`vet-data-${usuarioActivo.id}`);
    TABLAS_NORMALIZADAS.forEach(tabla => {
        realtimeChannel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: tabla,
            filter: `user_id=eq.${usuarioActivo.id}`
        }, () => {
            if (guardandoRemoto) return;
            clearTimeout(normalizedReloadTimer);
            normalizedReloadTimer = setTimeout(async () => {
                const remoto = await cargarEstadoBaseNormalizada();
                if (!remoto.ok) return;
                aplicarEstado(remoto.estado);
                if (typeof refrescarInterfaz === 'function') refrescarInterfaz();
                actualizarEstadoSync('Sincronizado');
            }, 500);
        });
    });
    realtimeChannel.subscribe();
}
