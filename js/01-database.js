// Capa de base de datos normalizada.
// Traduce el estado local de la app hacia tablas Supabase y reconstruye el estado al leerlas.
let modoDatosRemotos = 'app_state';
let normalizedReloadTimer = null;
let recargaNormalizadaPendiente = false;
const tablasRealtimePendientes = new Set();
let tablaVacunasPacienteDisponible = false;
let tablaAuditLogsDisponible = false;
let tablaClinicasExternasDisponible = false;
let tablaSyncEventsDisponible = false;

const TABLAS_NORMALIZADAS = [
    'clientes',
    'mascotas',
    'servicios',
    'inventario',
    'agenda',
    'consultas',
    'pagos',
    'servicios_externos',
    'gastos',
    'movimientos_inventario'
];

function idsLegacy(lista) {
    return lista.map(item => item?.id ?? item?.legacy_id).filter(id => id !== undefined && id !== null);
}

function numeroONulo(valor) {
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : null;
}

function textoONulo(valor) {
    if (valor === undefined || valor === null) return '';
    return String(valor);
}

function textoBooleano(valor) {
    if (valor === true) return 'Sí';
    if (valor === false) return '';
    return textoONulo(valor);
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
function fechaISOServicioExterno(servicio) {
    if (servicio.fechaISO && !Number.isNaN(new Date(servicio.fechaISO).getTime())) return servicio.fechaISO;
    if (servicio.fecha) {
        const fecha = new Date(`${servicio.fecha}T${servicio.hora || '12:00'}:00`);
        if (!Number.isNaN(fecha.getTime())) return fecha.toISOString();
    }
    return new Date().toISOString();
}
function extrasMascotasParaAppState() {
    const extras = {};
    (clientes || []).forEach(cliente => {
        (cliente.mascotas || []).forEach(mascota => {
            const consultaExtras = {};
            (mascota.historial || []).forEach(consulta => {
                if (consulta.examenFisico) consultaExtras[consulta.id] = { examenFisico: consulta.examenFisico };
            });
            if (mascota.responsiva || Object.keys(consultaExtras).length) {
                extras[mascota.id] = {
                    responsiva: mascota.responsiva || null,
                    consultaExtras
                };
            }
        });
    });
    return extras;
}
function aplicarExtrasMascotas(estado, estadoExtra = {}) {
    const extras = estadoExtra.mascotaExtras || {};
    (estado.clientes || []).forEach(cliente => {
        (cliente.mascotas || []).forEach(mascota => {
            const extra = extras[mascota.id];
            if (!extra) return;
            mascota.responsiva = extra.responsiva || mascota.responsiva || null;
            (mascota.historial || []).forEach(consulta => {
                const consultaExtra = extra.consultaExtras?.[consulta.id];
                if (consultaExtra?.examenFisico) consulta.examenFisico = consultaExtra.examenFisico;
            });
        });
    });
    return estado;
}

async function upsertTabla(nombre, registros, columnas = '*') {
    if (!registros.length) return [];
    const { data, error } = await supabaseClient
        .from(nombre)
        .upsert(registros, { onConflict: 'user_id,legacy_id' })
        .select(columnas);
    if (error) {
        const sinIndiceUnico = error.code === '42P10' || /unique|exclusion|conflict/i.test(error.message || '');
        if (sinIndiceUnico) return upsertTablaManual(nombre, registros, columnas);
        error.__syncCode = `DB-UP-${nombre}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
        throw error;
    }
    return data || [];
}

async function upsertServiciosExternosCompatible(registros) {
    try {
        return await upsertTabla('servicios_externos', registros, 'id, legacy_id');
    } catch (error) {
        const mensaje = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
        const pareceColumnaOpcional = /workspace_id|clinica_legacy_id|tipo|abonos/i.test(mensaje)
            || error?.code === 'PGRST204'
            || error?.code === '42703';
        if (!pareceColumnaOpcional) throw error;
        console.warn('Reintentando servicios_externos con columnas compatibles.', error);
        const registrosCompatibles = registros.map(registro => ({
            user_id: registro.user_id,
            legacy_id: registro.legacy_id,
            fecha_iso: registro.fecha_iso,
            fecha_texto: registro.fecha_texto,
            hora: registro.hora,
            cliente_nombre: registro.cliente_nombre,
            servicio: registro.servicio,
            direccion: registro.direccion,
            agenda_id: registro.agenda_id,
            total: registro.total,
            metodo_pago: registro.metodo_pago,
            estado_pago: registro.estado_pago,
            nota: registro.nota,
            updated_at: registro.updated_at
        }));
        return upsertTabla('servicios_externos', registrosCompatibles, 'id, legacy_id');
    }
}

async function upsertPagosCompatible(registros) {
    try {
        return await upsertTabla('pagos', registros, 'id, legacy_id');
    } catch (error) {
        const mensaje = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
        const pareceColumnaOpcional = /workspace_id|abonos/i.test(mensaje)
            || error?.code === 'PGRST204'
            || error?.code === '42703';
        if (!pareceColumnaOpcional) throw error;
        console.warn('Reintentando pagos con columnas compatibles.', error);
        const registrosCompatibles = registros.map(registro => ({
            user_id: registro.user_id,
            legacy_id: registro.legacy_id,
            consulta_id: registro.consulta_id,
            cliente_id: registro.cliente_id,
            mascota_id: registro.mascota_id,
            servicio_cobrado: registro.servicio_cobrado,
            total: registro.total,
            metodo_pago: registro.metodo_pago,
            estado_pago: registro.estado_pago,
            nota_pago: registro.nota_pago,
            fecha_iso: registro.fecha_iso,
            updated_at: registro.updated_at
        }));
        return upsertTabla('pagos', registrosCompatibles, 'id, legacy_id');
    }
}

async function upsertServiciosCatalogoCompatible(registros) {
    try {
        return await upsertTabla('servicios', registros, 'id, legacy_id');
    } catch (error) {
        const mensaje = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`;
        const pareceColumnaOpcional = /workspace_id|activo/i.test(mensaje)
            || error?.code === 'PGRST204'
            || error?.code === '42703';
        if (!pareceColumnaOpcional) throw error;
        console.warn('Reintentando servicios con columnas compatibles.', error);
        const registrosCompatibles = registros.map(registro => ({
            user_id: registro.user_id,
            legacy_id: registro.legacy_id,
            nombre: registro.nombre,
            precio: registro.precio,
            updated_at: registro.updated_at
        }));
        return upsertTabla('servicios', registrosCompatibles, 'id, legacy_id');
    }
}

async function upsertTablaManual(nombre, registros, columnas = '*') {
    const guardados = [];
    for (const registro of registros) {
        let existenteQuery = supabaseClient
            .from(nombre)
            .select('id')
            .eq('user_id', registro.user_id)
            .eq('legacy_id', registro.legacy_id)
            .maybeSingle();
        const existente = await existenteQuery;
        if (existente.error) {
            existente.error.__syncCode = `DB-LOOKUP-${nombre}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
            throw existente.error;
        }
        const payload = { ...registro };
        let resultado;
        if (existente.data?.id) {
            resultado = await supabaseClient
                .from(nombre)
                .update(payload)
                .eq('id', existente.data.id)
                .select(columnas);
        } else {
            resultado = await supabaseClient
                .from(nombre)
                .insert(payload)
                .select(columnas);
        }
        if (resultado.error) {
            resultado.error.__syncCode = `DB-MANUAL-${nombre}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
            throw resultado.error;
        }
        guardados.push(...(resultado.data || []));
    }
    return guardados;
}

// Borra en Supabase lo que ya no existe localmente dentro del scope activo.
async function borrarFaltantes(nombre, legacyIds) {
    let query = supabaseClient.from(nombre).delete();
    query = aplicarFiltroScope(query);
    if (legacyIds.length) query = query.not('legacy_id', 'in', `(${legacyIds.join(',')})`);
    const { error } = await query;
    if (error) {
        error.__syncCode = `DB-DEL-${nombre}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
        throw error;
    }
}
async function borrarRegistroPorLegacy(nombre, legacyId) {
    let query = supabaseClient.from(nombre).delete().eq('legacy_id', legacyId);
    query = aplicarFiltroScope(query);
    const { error } = await query;
    if (error) {
        error.__syncCode = `DB-DEL-${nombre}`.toUpperCase().replace(/[^A-Z0-9_-]/g, '-');
        throw error;
    }
}
async function procesarEliminacionesPendientes() {
    if (typeof obtenerEliminacionesPendientes !== 'function') return;
    const pendientes = obtenerEliminacionesPendientes();
    if (!pendientes.length) return;
    const restantes = [];
    const consultasPendientes = new Set(pendientes.filter(item => item.tabla === 'consultas').map(item => String(item.legacyId)));
    for (const item of pendientes) {
        if (item.tabla === 'pagos' && consultasPendientes.has(String(item.legacyId))) {
            continue;
        }
        try {
            await borrarRegistroPorLegacy(item.tabla, item.legacyId);
        } catch (error) {
            restantes.push(item);
            sincronizacionParcialPendiente = true;
            ultimoCodigoSyncParcial = error.__syncCode || codigoErrorSync(error, `DB-DEL-${item.tabla || 'REGISTRO'}`);
            registrarErrorSync(ultimoCodigoSyncParcial, error, `procesarEliminacionesPendientes:${item.tabla}`);
        }
    }
    if (typeof guardarEliminacionesPendientes === 'function') guardarEliminacionesPendientes(restantes);
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
            vacunasManuales: rows.vacunas_paciente ? [] : (row.vacunas_manuales || []),
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
            abonos: pago?.abonos || [],
            notasRapidas: row.notas_rapidas || '',
            vacunasControlStock: row.vacunas_control_stock,
            seguimiento: row.seguimiento || {},
            agendaId: row.seguimiento?.agendaId || null,
            firmaDueno: row.firma_dueno || '',
            firmaVet: row.firma_vet || ''
        };
        mascotasPorId.get(row.mascota_id)?.historial.push(consulta);
    });

    (rows.vacunas_paciente || []).forEach(row => {
        const mascota = mascotasPorId.get(row.mascota_id);
        if (!mascota) return;
        mascota.vacunasManuales = mascota.vacunasManuales || [];
        mascota.vacunasManuales.push({
            id: row.legacy_id || row.id,
            nombre: row.nombre || 'Vacuna manual',
            fecha: row.fecha_aplicacion || '',
            fechaRefuerzo: row.fecha_refuerzo || '',
            lote: row.lote || '',
            laboratorio: row.laboratorio || '',
            desparasitante: row.desparasitante || '',
            nota: row.nota || '',
            origen: row.origen || 'Manual',
            fechaISO: row.created_at || new Date().toISOString()
        });
    });

    mascotasPorId.forEach(mascota => {
        mascota.historial.sort((a, b) => new Date(b.fechaISO).getTime() - new Date(a.fechaISO).getTime());
        mascota.vacunasManuales = (mascota.vacunasManuales || []).sort((a, b) =>
            new Date(`${b.fecha || ''}T12:00:00`).getTime() - new Date(`${a.fecha || ''}T12:00:00`).getTime()
        );
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
        const servicioExternoAgenda = (rows.servicios_externos || []).find(servicio => Number(servicio.agenda_id) === Number(row.id));
        return {
            id: row.legacy_id || row.id,
            fecha: row.fecha || '',
            hora: row.hora ? String(row.hora).slice(0, 5) : '',
            clienteId: cliente?.id || row.cliente_id,
            petId: mascota?.id || row.mascota_id,
            clinicaId: servicioExternoAgenda?.clinica_legacy_id || null,
            clienteNombre: cliente?.owner || row.cliente_nombre || '',
            petName: mascota?.name || row.pet_name || '',
            direccion: row.direccion || '',
            notas: row.notas || 'Sin notas',
            estado: row.estado || 'Programada',
            origen: row.origen || 'Consulta'
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
            proveedor: row.proveedor || '',
            costoUnitario: parseFloat(row.costo_unitario || 0)
        })),
        agenda: agendaMapeada,
        finanzas: (rows.servicios || []).map(row => ({
            id: row.legacy_id || row.id,
            nombre: row.nombre || '',
            precio: parseFloat(row.precio || 0)
        })),
        serviciosExternos: (rows.servicios_externos || []).map(row => ({
            id: row.legacy_id || row.id,
            fechaISO: row.fecha_iso,
            fecha: row.fecha_texto || '',
            hora: row.hora ? String(row.hora).slice(0, 5) : '',
            clienteNombre: row.cliente_nombre || '',
            servicioCobrado: row.servicio || '',
            direccion: row.direccion || '',
            agendaId: (rows.agenda || []).find(cita => Number(cita.id) === Number(row.agenda_id))?.legacy_id || null,
            total: parseFloat(row.total || 0),
            metodoPago: row.metodo_pago || 'Efectivo',
            estadoPago: row.estado_pago || 'Pagado',
            notaPago: row.nota || '',
            abonos: row.abonos || [],
            clinicaId: row.clinica_legacy_id || row.clinica_id || null,
            tipo: row.tipo || 'Servicio externo'
        })),
        clinicasExternas: rows.clinicas_externas ? rows.clinicas_externas.map(row => ({
            id: row.legacy_id || row.id,
            nombre: row.nombre || '',
            contacto: row.contacto || '',
            telefono: row.telefono || '',
            direccion: row.direccion || '',
            servicioHabitual: '',
            costoSugerido: 0,
            notas: ''
        })) : clinicasExternas,
        gastosFinancieros: (rows.gastos || []).map(row => ({
            id: row.legacy_id || row.id,
            fechaISO: row.fecha_iso,
            fecha: row.fecha_texto || '',
            categoria: row.categoria || 'Gasolina',
            descripcion: row.descripcion || '',
            monto: parseFloat(row.monto || 0)
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
        })),
        auditLogs: rows.audit_logs ? rows.audit_logs.map(row => ({
            id: row.id,
            fechaISO: row.created_at,
            usuario: row.user_id || '',
            tabla: row.tabla || '',
            accion: row.accion || '',
            registroId: row.registro_id || '',
            resumen: row.resumen || ''
        })) : auditLogs
    };
}

async function cargarEstadoBaseNormalizada() {
    try {
        const consultas = await Promise.all(TABLAS_NORMALIZADAS.map(tabla =>
            aplicarFiltroScope(supabaseClient.from(tabla).select('*'))
        ));
        const error = consultas.find(resultado => resultado.error)?.error;
        if (error) return { ok: false, error };
        const rows = Object.fromEntries(TABLAS_NORMALIZADAS.map((tabla, index) => [tabla, consultas[index].data || []]));
        let estadoExtra = {};
        try {
            const extraQuery = supabaseClient.from('app_state').select('data');
            const extra = await aplicarFiltroScope(extraQuery).maybeSingle();
            estadoExtra = extra.data?.data || {};
        } catch (extraError) {
            console.warn('No se pudo cargar estado extra de app_state.', extraError);
        }
        try {
            const vacunas = await aplicarFiltroScope(supabaseClient.from('vacunas_paciente').select('*'));
            tablaVacunasPacienteDisponible = !vacunas.error;
            if (!vacunas.error) rows.vacunas_paciente = vacunas.data || [];
        } catch (errorVacunas) {
            tablaVacunasPacienteDisponible = false;
        }
        try {
            const clinicas = await aplicarFiltroScope(supabaseClient.from('clinicas_externas').select('*'));
            tablaClinicasExternasDisponible = !clinicas.error;
            if (!clinicas.error) rows.clinicas_externas = clinicas.data || [];
        } catch (errorClinicas) {
            tablaClinicasExternasDisponible = false;
            rows.clinicas_externas = null;
        }
        try {
            const syncEvents = await aplicarFiltroScope(supabaseClient.from('sync_events').select('user_id').limit(1));
            tablaSyncEventsDisponible = !syncEvents.error;
        } catch (_) {
            tablaSyncEventsDisponible = false;
        }
        // La auditoría se conserva en Supabase para diagnóstico, pero no se descarga
        // en cada sincronización porque no forma parte de la interfaz operativa.
        rows.audit_logs = null;
        const estadoNormalizado = aplicarExtrasMascotas(mapearEstadoNormalizado(rows), estadoExtra);
        return { ok: true, estado: estadoNormalizado };
    } catch (error) {
        return { ok: false, error };
    }
}

function filtrarRegistrosPendientes(lista, nombreStore, registrosPendientes = {}) {
    const ids = registrosPendientes?.[nombreStore];
    if (!Array.isArray(ids) || !ids.length) return lista || [];
    const permitidos = new Set(ids.map(String));
    return (lista || []).filter(item => permitidos.has(String(item?.id)));
}

async function cargarMapaIdsRemotos(tabla) {
    const resultado = await aplicarFiltroScope(supabaseClient.from(tabla).select('id, legacy_id'));
    if (resultado.error) throw resultado.error;
    return new Map((resultado.data || []).map(row => [row.legacy_id, row.id]));
}

async function guardarEstadoBaseNormalizada(storesPendientes = new Set(), registrosPendientes = {}) {
    const syncAll = !storesPendientes?.size;
    const debe = nombre => syncAll || storesPendientes.has(nombre);
    const scope = scopeRemoto();
    const ahora = new Date().toISOString();
    const syncClientes = debe('clientes');
    const syncAgenda = debe('agenda');
    const syncInventario = debe('inventario');
    const syncCatalogo = debe('finanzas');
    const syncExternos = debe('serviciosExternos');
    const syncClinicas = debe('clinicasExternas');
    const syncGastos = debe('gastosFinancieros');

    let clienteDbPorLegacy = (syncClientes || syncAgenda) ? await cargarMapaIdsRemotos('clientes') : new Map();
    let mascotaDbPorLegacy = (syncClientes || syncAgenda) ? await cargarMapaIdsRemotos('mascotas') : new Map();
    let agendaDbPorLegacy = syncExternos ? await cargarMapaIdsRemotos('agenda') : new Map();
    let consultaDbPorLegacy = syncClientes ? await cargarMapaIdsRemotos('consultas') : new Map();

    const clientesSeleccionados = syncClientes ? filtrarRegistrosPendientes(clientes, 'clientes', registrosPendientes) : [];
    if (syncClientes) {
        const clientesRows = clientesSeleccionados.map(cliente => ({
            ...scope,
            legacy_id: cliente.id,
            nombre: cliente.owner || '',
            telefono: cliente.phone || '',
            email: cliente.email || '',
            direccion: cliente.address || '',
            notas: cliente.ownerNotes || '',
            id_photo: cliente.ownerIdFile || '',
            updated_at: ahora
        }));
        const guardados = await upsertTabla('clientes', clientesRows, 'id, legacy_id');
        guardados.forEach(row => clienteDbPorLegacy.set(row.legacy_id, row.id));

        const mascotasRows = clientesSeleccionados.flatMap(cliente => (cliente.mascotas || []).map(mascota => ({
            ...scope,
            legacy_id: mascota.id,
            cliente_id: clienteDbPorLegacy.get(cliente.id),
            nombre: textoONulo(mascota.name),
            especie: textoONulo(mascota.species),
            raza: textoONulo(mascota.raza),
            edad: numeroONulo(mascota.age),
            peso: numeroONulo(mascota.peso),
            esterilizado: textoBooleano(mascota.spayed),
            foto: textoONulo(mascota.photo),
            estudios: mascota.estudios || [],
            vacunas_manuales: mascota.vacunasManuales || [],
            updated_at: ahora
        }))).filter(row => row.cliente_id);
        const mascotasGuardadas = await upsertTabla('mascotas', mascotasRows, 'id, legacy_id');
        mascotasGuardadas.forEach(row => mascotaDbPorLegacy.set(row.legacy_id, row.id));

        const consultasRows = clientesSeleccionados.flatMap(cliente => (cliente.mascotas || []).flatMap(mascota =>
            (mascota.historial || []).map(consulta => ({
                ...scope,
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
                seguimiento: { ...(consulta.seguimiento || {}), agendaId: consulta.agendaId || consulta.seguimiento?.agendaId || null },
                firma_dueno: consulta.firmaDueno || '',
                firma_vet: consulta.firmaVet || '',
                updated_at: ahora
            }))
        ));
        const consultasGuardadas = await upsertTabla('consultas', consultasRows.filter(row => row.mascota_id), 'id, legacy_id');
        consultasGuardadas.forEach(row => consultaDbPorLegacy.set(row.legacy_id, row.id));

        const pagosRows = clientesSeleccionados.flatMap(cliente => (cliente.mascotas || []).flatMap(mascota =>
            (mascota.historial || []).map(consulta => ({
                ...scope,
                legacy_id: consulta.id,
                consulta_id: consultaDbPorLegacy.get(consulta.id) || null,
                cliente_id: clienteDbPorLegacy.get(cliente.id) || null,
                mascota_id: mascotaDbPorLegacy.get(mascota.id) || null,
                servicio_cobrado: consulta.servicioCobrado || 'Sin servicio registrado',
                total: parseFloat(consulta.costoTotal || 0),
                metodo_pago: consulta.metodoPago || 'Efectivo',
                estado_pago: consulta.estadoPago || 'Pagado',
                nota_pago: consulta.notaPago || '',
                abonos: consulta.abonos || [],
                fecha_iso: fechaISOConsulta(consulta),
                updated_at: ahora
            }))
        ));
        await upsertPagosCompatible(pagosRows.filter(row => row.consulta_id));

        if (tablaVacunasPacienteDisponible) {
            const vacunasRows = clientesSeleccionados.flatMap(cliente => (cliente.mascotas || []).flatMap(mascota =>
                (mascota.vacunasManuales || []).map(vacuna => ({
                    ...scope,
                    legacy_id: vacuna.id,
                    cliente_id: clienteDbPorLegacy.get(cliente.id) || null,
                    mascota_id: mascotaDbPorLegacy.get(mascota.id) || null,
                    consulta_id: vacuna.consultaId ? consultaDbPorLegacy.get(vacuna.consultaId) || null : null,
                    nombre: vacuna.nombre || 'Vacuna manual',
                    fecha_aplicacion: vacuna.fecha || null,
                    fecha_refuerzo: vacuna.fechaRefuerzo || null,
                    lote: vacuna.lote || '',
                    laboratorio: vacuna.laboratorio || '',
                    desparasitante: vacuna.desparasitante || '',
                    nota: vacuna.nota || '',
                    origen: vacuna.origen || 'Manual',
                    updated_at: ahora
                }))
            ));
            await upsertTabla('vacunas_paciente', vacunasRows.filter(row => row.mascota_id), 'id, legacy_id');
        }
    }

    if (syncCatalogo) {
        const serviciosRows = filtrarRegistrosPendientes(finanzas, 'finanzas', registrosPendientes).map(servicio => ({
            ...scope,
            legacy_id: servicio.id,
            nombre: servicio.nombre || '',
            precio: parseFloat(servicio.precio || 0),
            activo: true,
            updated_at: ahora
        }));
        await upsertServiciosCatalogoCompatible(serviciosRows);
    }

    let inventarioDbPorLegacy = new Map();
    if (syncInventario) {
        const inventarioRows = filtrarRegistrosPendientes(inventario, 'inventario', registrosPendientes).map(item => ({
            ...scope,
            legacy_id: item.id,
            nombre: item.name || '',
            stock: parseInt(item.stock || 0),
            unidad: item.unit || '',
            categoria: item.categoria || 'Medicamento',
            stock_minimo: parseInt(item.minStock || 3),
            lote: item.lote || '',
            caducidad: item.caducidad || null,
            proveedor: item.proveedor || '',
            costo_unitario: parseFloat(item.costoUnitario || 0),
            updated_at: ahora
        }));
        const inventarioGuardado = await upsertTabla('inventario', inventarioRows, 'id, legacy_id');
        inventarioDbPorLegacy = await cargarMapaIdsRemotos('inventario');
        inventarioGuardado.forEach(row => inventarioDbPorLegacy.set(row.legacy_id, row.id));
        const movimientosRows = movimientosInventario.map(mov => ({
            ...scope,
            legacy_id: mov.id,
            inventario_id: inventarioDbPorLegacy.get(mov.itemId) || null,
            item_nombre: mov.itemName || '',
            tipo: mov.tipo || '',
            cantidad: parseInt(mov.cantidad || 0),
            stock_resultante: parseInt(mov.stockResultante || 0),
            motivo: mov.motivo || '',
            fecha_iso: mov.fechaISO || ahora
        }));
        await upsertTabla('movimientos_inventario', movimientosRows, 'id, legacy_id');
    }

    if (syncAgenda) {
        const agendaRows = filtrarRegistrosPendientes(agenda, 'agenda', registrosPendientes).map(cita => ({
            ...scope,
            legacy_id: cita.id,
            cliente_id: clienteDbPorLegacy.get(cita.clienteId || cita.ownerId) || null,
            mascota_id: mascotaDbPorLegacy.get(cita.petId) || null,
            cliente_nombre: cita.clienteNombre || cita.ownerName || '',
            pet_name: cita.petName || '',
            fecha: fechaAgenda(cita),
            hora: horaAgenda(cita),
            direccion: cita.direccion || cita.address || '',
            notas: cita.notas || cita.notes || 'Sin notas',
            estado: cita.estado || 'Programada',
            origen: cita.origen || 'Consulta',
            updated_at: ahora
        }));
        const agendaGuardada = await upsertTabla('agenda', agendaRows, 'id, legacy_id');
        agendaGuardada.forEach(row => agendaDbPorLegacy.set(row.legacy_id, row.id));
    }

    if (syncExternos) {
        if (!agendaDbPorLegacy.size) agendaDbPorLegacy = await cargarMapaIdsRemotos('agenda');
        const serviciosExternosRows = filtrarRegistrosPendientes(serviciosExternos, 'serviciosExternos', registrosPendientes).map(servicio => ({
            ...scope,
            legacy_id: servicio.id,
            fecha_iso: fechaISOServicioExterno(servicio),
            fecha_texto: servicio.fecha || '',
            cliente_nombre: servicio.clienteNombre || '',
            servicio: servicio.servicioCobrado || '',
            hora: servicio.hora || '',
            direccion: servicio.direccion || '',
            agenda_id: servicio.agendaId ? (agendaDbPorLegacy.get(servicio.agendaId) || null) : null,
            clinica_legacy_id: servicio.clinicaId || null,
            total: parseFloat(servicio.total || 0),
            metodo_pago: servicio.metodoPago || 'Efectivo',
            estado_pago: servicio.estadoPago || 'Pagado',
            nota: servicio.notaPago || '',
            abonos: servicio.abonos || [],
            tipo: servicio.tipo || 'Servicio externo',
            updated_at: ahora
        }));
        await upsertServiciosExternosCompatible(serviciosExternosRows);
    }

    if (syncClinicas && tablaClinicasExternasDisponible) {
        const clinicasRows = filtrarRegistrosPendientes(clinicasExternas, 'clinicasExternas', registrosPendientes).map(clinica => ({
            ...scope,
            legacy_id: clinica.id,
            nombre: clinica.nombre || '',
            contacto: clinica.contacto || '',
            telefono: clinica.telefono || '',
            direccion: clinica.direccion || '',
            updated_at: ahora
        }));
        await upsertTabla('clinicas_externas', clinicasRows, 'id, legacy_id');
    }

    if (syncGastos) {
        const gastosRows = filtrarRegistrosPendientes(gastosFinancieros, 'gastosFinancieros', registrosPendientes).map(gasto => ({
            ...scope,
            legacy_id: gasto.id,
            fecha_iso: gasto.fechaISO || ahora,
            fecha_texto: gasto.fecha || '',
            categoria: gasto.categoria || 'Gasolina',
            descripcion: gasto.descripcion || '',
            monto: parseFloat(gasto.monto || 0),
            updated_at: ahora
        }));
        await upsertTabla('gastos', gastosRows, 'id, legacy_id');
    }

    await procesarEliminacionesPendientes();

    if (syncClientes) {
        try {
            await supabaseClient.from('app_state').upsert({
                ...scopeRemoto(),
                data: { mascotaExtras: extrasMascotasParaAppState() },
                updated_at: ahora
            }, { onConflict: 'user_id' });
        } catch (error) {
            console.warn('No se pudo sincronizar estado extra de app_state.', error);
        }
    }

    if (tablaSyncEventsDisponible) {
        const resultadoSync = await supabaseClient.from('sync_events').upsert({
            ...scopeRemoto(),
            source_device: typeof obtenerDeviceId === 'function' ? obtenerDeviceId() : 'web',
            stores: Array.from(storesPendientes || []),
            changed_at: ahora
        }, { onConflict: 'user_id' });
        if (resultadoSync.error) {
            console.warn('No se pudo publicar señal ligera de sincronización.', resultadoSync.error);
            tablaSyncEventsDisponible = false;
        }
    }
}

async function recargarEstadoNormalizadoPorRealtime(detalle = 'Se recibieron cambios de otro dispositivo.') {
    if (guardandoRemoto) return;
    if (hayCambiosPendientesOffline()) {
        recargaNormalizadaPendiente = true;
        return;
    }
    if (typeof debePausarAplicacionRemota === 'function' && debePausarAplicacionRemota()) {
        actualizarEstadoSync('Edición local activa');
        return;
    }
    actualizarEstadoSync('Actualizando...');
    const remoto = await cargarEstadoBaseNormalizada();
    if (!remoto.ok) {
        const codigo = remoto.error?.__syncCode || codigoErrorSync(remoto.error, 'SYNC-LOAD');
        registrarErrorSync(codigo, remoto.error, 'recargarEstadoNormalizadoPorRealtime');
        actualizarEstadoSync(`Error ${codigo}`, true);
        return;
    }
    if (typeof aplicarEstadoRemoto === 'function') {
        aplicarEstadoRemoto(remoto.estado, detalle);
    } else {
        aplicarEstado(remoto.estado);
        if (typeof refrescarInterfaz === 'function') refrescarInterfaz();
        actualizarEstadoSync('Sincronizado');
    }
    tablasRealtimePendientes.clear();
    recargaNormalizadaPendiente = false;
}

function programarRecargaNormalizadaRealtime(tabla) {
    if (guardandoRemoto) return;
    tablasRealtimePendientes.add(tabla);
    if (hayCambiosPendientesOffline()) {
        recargaNormalizadaPendiente = true;
        return;
    }
    if (typeof debePausarAplicacionRemota === 'function' && debePausarAplicacionRemota()) {
        recargaNormalizadaPendiente = true;
        return;
    }
    clearTimeout(normalizedReloadTimer);
    normalizedReloadTimer = setTimeout(() => {
        const tablas = Array.from(tablasRealtimePendientes).join(', ');
        recargarEstadoNormalizadoPorRealtime(`Cambios recibidos en ${tablas}.`);
    }, 5000);
}

function procesarRecargaNormalizadaPendiente() {
    if (!recargaNormalizadaPendiente || guardandoRemoto || hayCambiosPendientesOffline()) return;
    programarRecargaNormalizadaRealtime('pendientes');
}

function escucharCambiosBaseNormalizada() {
    if (!usuarioActivo) return;
    if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = supabaseClient.channel(`vet-data-${usuarioActivo.id}`);
    if (tablaSyncEventsDisponible) {
        realtimeChannel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'sync_events',
            filter: filtroRealtimeScope()
        }, payload => {
            if (payload.new?.source_device === obtenerDeviceId()) return;
            programarRecargaNormalizadaRealtime((payload.new?.stores || []).join(', ') || 'datos');
        });
        realtimeChannel.subscribe();
        return;
    }
    TABLAS_NORMALIZADAS.forEach(tabla => {
        realtimeChannel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: tabla,
            filter: filtroRealtimeScope()
        }, () => {
            programarRecargaNormalizadaRealtime(tabla);
        });
    });
    if (tablaVacunasPacienteDisponible) {
        realtimeChannel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'vacunas_paciente',
            filter: filtroRealtimeScope()
        }, () => {
            programarRecargaNormalizadaRealtime('vacunas_paciente');
        });
    }
    if (tablaClinicasExternasDisponible) {
        realtimeChannel.on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'clinicas_externas',
            filter: filtroRealtimeScope()
        }, () => {
            programarRecargaNormalizadaRealtime('clinicas_externas');
        });
    }
    realtimeChannel.subscribe();
}
