// Capa de base de datos normalizada.
// Traduce el estado local de la app hacia tablas Supabase y reconstruye el estado al leerlas.
let modoDatosRemotos = 'app_state';
let normalizedReloadTimer = null;
let tablaVacunasPacienteDisponible = false;
let tablaAuditLogsDisponible = false;
let tablaClinicasExternasDisponible = false;

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
    for (const item of pendientes) {
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
            const auditoria = await aplicarFiltroScope(supabaseClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100));
            tablaAuditLogsDisponible = !auditoria.error;
            if (!auditoria.error) rows.audit_logs = auditoria.data || [];
        } catch (errorAuditoria) {
            tablaAuditLogsDisponible = false;
            rows.audit_logs = null;
        }
        const estadoNormalizado = aplicarExtrasMascotas(mapearEstadoNormalizado(rows), estadoExtra);
        return { ok: true, estado: estadoNormalizado };
    } catch (error) {
        return { ok: false, error };
    }
}

async function guardarEstadoBaseNormalizada() {
    const userId = usuarioActivo.id;
    const scope = scopeRemoto();
    const clientesRows = clientes.map(cliente => ({
        ...scope,
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
        updated_at: new Date().toISOString()
    }))).filter(row => row.cliente_id);
    let mascotasGuardadas = [];
    try {
        mascotasGuardadas = await upsertTabla('mascotas', mascotasRows, 'id, legacy_id');
    } catch (errorMascotas) {
        ultimoCodigoSyncParcial = errorMascotas.__syncCode || codigoErrorSync(errorMascotas, 'DB-UP-MASCOTAS');
        registrarErrorSync(ultimoCodigoSyncParcial, errorMascotas, 'guardarEstadoBaseNormalizada:mascotas');
        sincronizacionParcialPendiente = true;
        const guardadas = [];
        for (const row of mascotasRows) {
            try {
                const resultado = await upsertTabla('mascotas', [row], 'id, legacy_id');
                guardadas.push(...resultado);
            } catch (errorMascotaIndividual) {
                const codigoIndividual = errorMascotaIndividual.__syncCode || codigoErrorSync(errorMascotaIndividual, 'DB-UP-MASCOTAS-ROW');
                registrarErrorSync(codigoIndividual, errorMascotaIndividual, `mascota legacy_id=${row.legacy_id} nombre=${row.nombre}`);
            }
        }
        mascotasGuardadas = guardadas;
    }
    const mascotaDbPorLegacy = new Map(mascotasGuardadas.map(row => [row.legacy_id, row.id]));

    const serviciosRows = finanzas.map(servicio => ({
        ...scope,
        legacy_id: servicio.id,
        nombre: servicio.nombre || '',
        precio: parseFloat(servicio.precio || 0),
        activo: true,
        updated_at: new Date().toISOString()
    }));
    await upsertTabla('servicios', serviciosRows, 'id, legacy_id');

    const inventarioRows = inventario.map(item => ({
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
        updated_at: new Date().toISOString()
    }));
    const inventarioGuardado = await upsertTabla('inventario', inventarioRows, 'id, legacy_id');
    const inventarioDbPorLegacy = new Map(inventarioGuardado.map(row => [row.legacy_id, row.id]));

    const agendaRows = agenda.map(cita => ({
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
        updated_at: new Date().toISOString()
    }));
    let agendaGuardada = [];
    try {
        agendaGuardada = await upsertTabla('agenda', agendaRows, 'id, legacy_id');
    } catch (error) {
        console.warn('No se pudo sincronizar agenda completa; se reintentara sin citas externas sin paciente.', error);
        sincronizacionParcialPendiente = true;
        ultimoCodigoSyncParcial = error.__syncCode || codigoErrorSync(error, 'DB-UP-AGENDA');
        registrarErrorSync(ultimoCodigoSyncParcial, error, 'guardarEstadoBaseNormalizada:agenda');
        agendaGuardada = await upsertTabla('agenda', agendaRows.filter(row => row.cliente_id || row.mascota_id), 'id, legacy_id');
    }
    const agendaDbPorLegacy = new Map((agendaGuardada || []).map(row => [row.legacy_id, row.id]));

    const consultasRows = [];
    clientes.forEach(cliente => {
        (cliente.mascotas || []).forEach(mascota => {
            (mascota.historial || []).forEach(consulta => {
                consultasRows.push({
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
                    seguimiento: consulta.seguimiento || {},
                    firma_dueno: consulta.firmaDueno || '',
                    firma_vet: consulta.firmaVet || '',
                    updated_at: new Date().toISOString()
                });
            });
        });
    });
    const consultasGuardadas = await upsertTabla('consultas', consultasRows.filter(row => row.mascota_id), 'id, legacy_id');
    const consultaDbPorLegacy = new Map(consultasGuardadas.map(row => [row.legacy_id, row.id]));

    if (tablaVacunasPacienteDisponible) {
        const vacunasRows = [];
        clientes.forEach(cliente => {
            (cliente.mascotas || []).forEach(mascota => {
                (mascota.vacunasManuales || []).forEach(vacuna => {
                    vacunasRows.push({
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
                        updated_at: new Date().toISOString()
                    });
                });
            });
        });
        await upsertTabla('vacunas_paciente', vacunasRows.filter(row => row.mascota_id), 'id, legacy_id');
    }

    const pagosRows = [];
    clientes.forEach(cliente => {
        (cliente.mascotas || []).forEach(mascota => {
            (mascota.historial || []).forEach(consulta => {
                pagosRows.push({
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
                    updated_at: new Date().toISOString()
                });
            });
        });
    });
    await upsertTabla('pagos', pagosRows.filter(row => row.consulta_id), 'id, legacy_id');

    const agendaLegacyIds = new Set(agenda.map(cita => cita.id));
    const serviciosExternosRows = serviciosExternos.map(servicio => ({
        ...scope,
        legacy_id: servicio.id,
        fecha_iso: fechaISOServicioExterno(servicio),
        fecha_texto: servicio.fecha || '',
        cliente_nombre: servicio.clienteNombre || '',
        servicio: servicio.servicioCobrado || '',
        hora: servicio.hora || '',
        direccion: servicio.direccion || '',
        agenda_id: agendaLegacyIds.has(servicio.agendaId) ? (agendaDbPorLegacy.get(servicio.agendaId) || null) : null,
        clinica_legacy_id: servicio.clinicaId || null,
        total: parseFloat(servicio.total || 0),
        metodo_pago: servicio.metodoPago || 'Efectivo',
        estado_pago: servicio.estadoPago || 'Pagado',
        nota: servicio.notaPago || '',
        abonos: servicio.abonos || [],
        tipo: servicio.tipo || 'Servicio externo',
        updated_at: new Date().toISOString()
    }));
    try {
        await upsertTabla('servicios_externos', serviciosExternosRows, 'id, legacy_id');
    } catch (error) {
        console.warn('No se pudo sincronizar servicios externos; se conserva en local.', error);
        sincronizacionParcialPendiente = true;
        ultimoCodigoSyncParcial = error.__syncCode || codigoErrorSync(error, 'DB-UP-SERVICIOS_EXTERNOS');
        registrarErrorSync(ultimoCodigoSyncParcial, error, 'guardarEstadoBaseNormalizada:servicios_externos');
    }

    if (tablaClinicasExternasDisponible) {
        const clinicasRows = (clinicasExternas || []).map(clinica => ({
            ...scope,
            legacy_id: clinica.id,
            nombre: clinica.nombre || '',
            contacto: clinica.contacto || '',
            telefono: clinica.telefono || '',
            direccion: clinica.direccion || '',
            updated_at: new Date().toISOString()
        }));
        try {
            await upsertTabla('clinicas_externas', clinicasRows, 'id, legacy_id');
        } catch (errorClinicas) {
            tablaClinicasExternasDisponible = false;
            console.warn('No se pudo sincronizar clinicas_externas. Se conservaran en copia local.', errorClinicas);
            ultimoCodigoSyncParcial = errorClinicas.__syncCode || codigoErrorSync(errorClinicas, 'DB-UP-CLINICAS_EXTERNAS');
            registrarErrorSync(ultimoCodigoSyncParcial, errorClinicas, 'guardarEstadoBaseNormalizada:clinicas_externas');
        }
    }

    const gastosRows = gastosFinancieros.map(gasto => ({
        ...scope,
        legacy_id: gasto.id,
        fecha_iso: gasto.fechaISO || new Date().toISOString(),
        fecha_texto: gasto.fecha || '',
        categoria: gasto.categoria || 'Gasolina',
        descripcion: gasto.descripcion || '',
        monto: parseFloat(gasto.monto || 0),
        updated_at: new Date().toISOString()
    }));
    await upsertTabla('gastos', gastosRows, 'id, legacy_id');

    const movimientosRows = movimientosInventario.map(mov => ({
        ...scope,
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

    await procesarEliminacionesPendientes();

    try {
        const extraQuery = supabaseClient.from('app_state').select('data');
        const extraActual = await aplicarFiltroScope(extraQuery).maybeSingle();
        const dataActual = extraActual.data?.data || {};
        await supabaseClient.from('app_state').upsert({
            ...scopeRemoto(),
            data: { ...dataActual, mascotaExtras: extrasMascotasParaAppState() },
            updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' });
    } catch (error) {
        console.warn('No se pudo sincronizar estado extra de app_state.', error);
        sincronizacionParcialPendiente = true;
        ultimoCodigoSyncParcial = error.__syncCode || codigoErrorSync(error, 'DB-UP-APP_STATE_EXTRA');
        registrarErrorSync(ultimoCodigoSyncParcial, error, 'guardarEstadoBaseNormalizada:app_state_extra');
    }
}

async function recargarEstadoNormalizadoPorRealtime(detalle = 'Se recibieron cambios de otro dispositivo.') {
    if (guardandoRemoto) return;
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
}

function programarRecargaNormalizadaRealtime(tabla) {
    if (guardandoRemoto) return;
    if (typeof debePausarAplicacionRemota === 'function' && debePausarAplicacionRemota()) return;
    clearTimeout(normalizedReloadTimer);
    normalizedReloadTimer = setTimeout(() => {
        recargarEstadoNormalizadoPorRealtime(`Cambio recibido en ${tabla}.`);
    }, 500);
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
    if (tablaAuditLogsDisponible) {
        realtimeChannel.on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'audit_logs',
            filter: filtroRealtimeScope()
        }, () => {
            programarRecargaNormalizadaRealtime('audit_logs');
        });
    }
    realtimeChannel.subscribe();
}
