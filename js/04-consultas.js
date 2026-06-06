function actualizarVistaPorTipoConsulta() {
    const tipo = $('consulta-tipo-drop').value;
    const secSeguimiento = $('seccion-campos-seguimiento');
    const secSintomas = $('seccion-sintomas-main');
    const secVacunacion = $('seccion-campos-vacunacion');
    if (!secSeguimiento || !secSintomas || !secVacunacion) return;
    if (tipo === 'Inicial') {
        secSeguimiento.classList.add('hidden');
        secSintomas.classList.remove('hidden');
        secVacunacion.classList.add('hidden');
    } else if (tipo === 'Seguimiento') {
        secSeguimiento.classList.remove('hidden');
        secSintomas.classList.remove('hidden');
        secVacunacion.classList.add('hidden');
    } else if (tipo === 'Vacunacion') {
        secSeguimiento.classList.add('hidden');
        secSintomas.classList.add('hidden');
        secVacunacion.classList.remove('hidden');
    }
    actualizarDisclaimerDinamico();
}
const TEXTO_DECLARACION_RESPONSIVA = "Declaro que la información proporcionada sobre el estado de salud de mi mascota es veraz, completa y actualizada. Asimismo, informo cualquier antecedente médico, enfermedad previa, tratamiento reciente o síntomas presentes antes de la atención veterinaria.";
const TEXTO_CONSENTIMIENTO_RESPONSIVA = "Entiendo y acepto que la aplicación de vacunas o tratamientos en animales que ya cursan con enfermedades, infecciones o padecimientos no reportados puede incrementar el riesgo de complicaciones graves, reacciones adversas e incluso el fallecimiento de la mascota. Asimismo, acepto que el médico veterinario no será responsable por complicaciones, deterioro en la salud o fallecimiento derivados de enfermedades, síntomas o antecedentes clínicos omitidos, ocultados o no informados por el propietario antes del procedimiento, siempre que la atención haya sido brindada conforme a la práctica veterinaria adecuada. El médico veterinario podrá negarse a realizar procedimientos, aplicar vacunas o administrar tratamientos si considera que la mascota requiere valoración clínica adicional, estudios diagnósticos o atención hospitalaria para salvaguardar su bienestar.";
function toggleCamposSeguimiento() {
    actualizarVistaPorTipoConsulta();
}
function toggleSintomasInputsBase() {
    const isAsintomatico = $('check-asintomatico').checked;
    $('wrapper-sintomas-detalles')?.classList.toggle('hidden', isAsintomatico);
    if(isAsintomatico) {
        document.querySelectorAll('.sintoma-chk').forEach(chk => chk.checked = false);
    }
    actualizarDisclaimerDinamico();
}
function actualizarDisclaimerDinamico() {
    if (!consultaSeleccionada.ownerId) return;
    if($('resp-fecha')) $('resp-fecha').innerText = new Date().toLocaleDateString('es-MX');
    if($('resp-dueno')) $('resp-dueno').innerText = consultaSeleccionada.ownerObj.owner;
    if($('resp-tel')) $('resp-tel').innerText = consultaSeleccionada.ownerObj.phone;
    if($('resp-mascota')) $('resp-mascota').innerText = consultaSeleccionada.petObj.name;
    const spc = $('consulta-especie-drop')?.value || "Otro";
    if($('resp-especie')) $('resp-especie').innerText = spc;
    if($('resp-edad')) $('resp-edad').innerText = consultaSeleccionada.petObj.age;
    if($('resp-firma-dueno-lbl')) $('resp-firma-dueno-lbl').innerText = consultaSeleccionada.ownerObj.owner;
    const tipo = $('consulta-tipo-drop').value;
    const motivoTexto = $('motivo')?.value || (tipo === 'Vacunacion' ? 'Vacunación / profilaxis' : '--');
    if($('resp-motivo')) $('resp-motivo').innerText = motivoTexto;
    const contenedorSintomas = $('resp-sintomas-box');
    if($('resp-tipo-consulta-lbl')) $('resp-tipo-consulta-lbl').innerText = tipo;
    if($('resp-parrafo-declaracion')) $('resp-parrafo-declaracion').innerText = TEXTO_DECLARACION_RESPONSIVA;
    if($('resp-parrafo-consentimiento')) $('resp-parrafo-consentimiento').innerText = TEXTO_CONSENTIMIENTO_RESPONSIVA;
    $('resp-datos-generales-box')?.classList.remove('hidden');
    if (!contenedorSintomas) return;
    if (tipo === 'Vacunacion') {
        const vacunas = recolectarVacunasAplicadas();
        const aplicoDesp = $('aplico-desparasitante')?.value || 'No';
        const desparasitante = aplicoDesp === 'Si' ? $('desparasitante-nombre')?.value || 'Sin especificar' : 'No';
        contenedorSintomas.innerHTML = `
            <p class="text-blue-900 font-bold">Biológicos Aplicados:</p>
            <ul class="list-disc pl-4 text-slate-700 italic">
                <li>Vacunas: ${vacunas}</li>
                <li>Desparasitante: ${desparasitante}</li>
            </ul>
        `;
    } else {
        if($('resp-animo-lbl')) $('resp-animo-lbl').innerText = $('consulta-animo-drop')?.value || '--';
        if($('resp-alimentacion-lbl')) $('resp-alimentacion-lbl').innerText = $('consulta-alimentacion')?.value || '--';
        if($('resp-garrapatas-lbl')) $('resp-garrapatas-lbl').innerText = $('consulta-garrapatas')?.value || '--';
        const asintomaticoBox = $('check-asintomatico')?.checked;
        if (asintomaticoBox) {
            contenedorSintomas.innerHTML = `<p class="text-teal-800 font-semibold">✓ SE DECLARA ASINTOMÁTICO: No presenta signos aparentes de enfermedad.</p>`;
        } else {
            const detallesText = recolectarSintomas();
            contenedorSintomas.innerHTML = `<p class="text-red-800 font-bold">⚠️ SÍNTOMAS REPORTADOS:</p><p class="text-slate-700 italic mt-1 bg-white p-2 rounded border">"${detallesText}"</p>`;
        }
    }
    const areaPreviewID = $('resp-id-preview-container');
    if (areaPreviewID) {
        if (consultaSeleccionada.ownerObj.ownerIdFile) {
            areaPreviewID.innerHTML = `<img src="${consultaSeleccionada.ownerObj.ownerIdFile}" class="h-10 w-16 object-cover rounded border border-gray-300 shadow-inner cursor-pointer" onclick="abrirVisorID('${consultaSeleccionada.ownerObj.ownerIdFile}')">`;
        } else {
            areaPreviewID.innerHTML = `<span class="text-gray-400 italic">Sin identificación digitalizada</span>`;
        }
    }
}
function textoNormalizado(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function encontrarInsumoParaVacuna(vacuna) {
    const nombreVacuna = textoNormalizado(vacuna);
    const claves = nombreVacuna.split(/[\s/]+/).filter(p => p.length > 3 && !['vacuna', 'multiple', 'polivalente', 'felina'].includes(p));
    return inventario.find(item => {
        const nombreItem = textoNormalizado(item.name);
        return nombreItem.includes('vac') && claves.some(clave => nombreItem.includes(clave));
    }) || inventario.find(item => {
        const nombreItem = textoNormalizado(item.name);
        return claves.some(clave => nombreItem.includes(clave));
    });
}
function descontarVacunasDelInventario(insumosAplicados) {
    if ($('consulta-tipo-drop')?.value !== 'Vacunacion') return { descontadas: [], noEncontradas: [], sinStock: [] };
    const resultado = { descontadas: [], noEncontradas: [], sinStock: [] };
    vacunasSeleccionadasLista().forEach(vacuna => {
        const item = encontrarInsumoParaVacuna(vacuna);
        if (!item) {
            resultado.noEncontradas.push(vacuna);
            return;
        }
        const yaRegistrado = insumosAplicados.find(ins => ins.id === item.id);
        if (yaRegistrado) {
            yaRegistrado.origen = yaRegistrado.origen || 'Vacuna';
        resultado.descontadas.push({ id: item.id, name: item.name, qty: yaRegistrado.qty, unit: item.unit, origen: 'Vacuna', costoUnitario: parseFloat(item.costoUnitario || 0), costoSubtotal: parseFloat(item.costoUnitario || 0) * yaRegistrado.qty });
            return;
        }
        if (item.stock <= 0) {
            resultado.sinStock.push(item.name);
            return;
        }
        item.stock -= 1;
        registrarMovimientoInventario({
            item,
            tipo: 'Uso',
            cantidad: -1,
            motivo: `Vacunación: ${vacuna} · ${consultaSeleccionada.petObj?.name || 'Paciente'}`
        });
        resultado.descontadas.push({ id: item.id, name: item.name, qty: 1, unit: item.unit, origen: 'Vacuna', costoUnitario: parseFloat(item.costoUnitario || 0), costoSubtotal: parseFloat(item.costoUnitario || 0) });
        insumosAplicados.push({ id: item.id, name: item.name, qty: 1, unit: item.unit, origen: 'Vacuna', costoUnitario: parseFloat(item.costoUnitario || 0), costoSubtotal: parseFloat(item.costoUnitario || 0) });
    });
    return resultado;
}
function toggleDropdownServicios() {
    const panel = $('dropdown-servicios-opciones');
    panel?.classList.toggle('hidden');
}
function rellenarDropdownServicios() {
    const panel = $('dropdown-servicios-opciones');
    if(!panel) return;
    const label = $('dropdown-servicios-label');
    if(label) label.innerText = "-- Seleccionar Servicios --";
    if (finanzas.length === 0) {
        panel.innerHTML = `<p class="text-xs text-gray-400 text-center py-2">No hay servicios configurados.</p>`;
        return;
    }
    panel.innerHTML = finanzas.map(f => `
        <label class="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-medium text-slate-700 transition-colors">
            <input type="checkbox" value="${f.precio}" data-nombre="${f.nombre}" onchange="calcularTotalCobro()" class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 servicio-chk-multi">
            <div class="flex-1 flex justify-between items-center">
                <span>${f.nombre}</span>
                <span class="font-bold text-emerald-600">$${f.precio}</span>
            </div>
        </label>
    `).join('');
}
function calcularTotalCobro() {
    const checkboxes = document.querySelectorAll('.servicio-chk-multi:checked');
    const label = $('dropdown-servicios-label');
    const resumen = $('servicios-seleccionados-resumen');
    let total = 0;
    let serviciosSeleccionados = [];
    checkboxes.forEach(chk => {
        const precio = parseFloat(chk.value) || 0;
        total += precio;
        serviciosSeleccionados.push({ nombre: chk.getAttribute('data-nombre'), precio });
    });
    if (label) {
        if (checkboxes.length === 0) {
            label.innerText = "-- Seleccionar Servicios --";
        } else {
            label.innerText = `${checkboxes.length} servicio${checkboxes.length === 1 ? '' : 's'} seleccionado${checkboxes.length === 1 ? '' : 's'}`;
        }
    }
    if (resumen) {
        resumen.innerHTML = serviciosSeleccionados.length
            ? `
                <div class="space-y-2">
                    <div class="flex items-center justify-between border-b border-emerald-100 pb-2">
                        <span class="font-bold text-emerald-900 uppercase tracking-wide">Resumen de cobro</span>
                        <span class="font-black text-emerald-700">$${total.toFixed(2)}</span>
                    </div>
                    ${serviciosSeleccionados.map(s => `
                        <div class="flex items-center justify-between gap-3">
                            <span class="text-slate-700">${s.nombre}</span>
                            <span class="font-bold text-slate-900">$${s.precio.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
            `
            : 'No hay servicios seleccionados.';
    }
    const txtCostoTotal = $('consulta-costo-total');
    if (txtCostoTotal) {
        txtCostoTotal.innerText = total.toFixed(2);
    }
}
function agregarFilaMedicamento() {
    const container = $('contenedor-filas-medicamentos');
    if(!container) return;
    const filaId = Date.now();
    let options = '<option value="">-- Elegir Insumo --</option>';
    inventario.forEach(m => options += `<option value="${m.id}">${m.name} (${m.stock} ${m.unit})</option>`);
    const div = document.createElement('div');
    div.id = `fila-med-${filaId}`;
    div.className = "flex items-center gap-2 bg-white p-2 rounded-xl border border-gray-200";
    div.innerHTML = `
        <select class="flex-1 px-2 py-1.5 border rounded-lg text-xs bg-gray-50 focus:bg-white outline-none" required onchange="validarStockFila(this)">${options}</select>
        <input type="number" placeholder="Cant" min="1" class="w-16 px-2 py-1.5 border rounded-lg text-xs text-center outline-none" required>
        <button type="button" onclick="eliminarFilaMedicamento(${filaId})" class="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
    `;
    container.appendChild(div);
    renderIcons();
}
function eliminarFilaMedicamento(filaId) { $(`fila-med-${filaId}`)?.remove(); }
function validarStockFila(selectElem) {
    const medId = parseInt(selectElem.value);
    if (!medId) return;
    const med = inventario.find(m => m.id === medId);
    if (med && med.stock <= 0) { alert(`Insumo agotado.`); selectElem.value = ""; }
}
async function guardarConsulta(e) {
    e.preventDefault();
    if (!consultaSeleccionada.petId) { alert("Elija un paciente activo primero."); return; }
    if (!firmaDuenoEstablecida || !firmaVetEstablecida) {
        alert("⛔ ERROR: La carta responsiva no está firmada por ambas partes.");
        abrirModalResponsivaFlotante();
        return;
    }
    const insumosAplicados = [];
    let stockValido = true;
    const contenedorFilas = $('contenedor-filas-medicamentos');
    if (contenedorFilas) {
        for (let fila of contenedorFilas.children) {
            const select = fila.querySelector('select');
            const input = fila.querySelector('input');
            if (select && input && select.value && input.value) {
                const med = inventario.find(m => m.id === parseInt(select.value));
                if (med) {
                    if (med.stock < parseInt(input.value)) { 
                        alert(`Stock insuficiente para ${med.name}`); 
                        stockValido = false; 
                        break; 
                    }
                    const qty = parseInt(input.value);
                    const costoUnitario = parseFloat(med.costoUnitario || 0);
                    insumosAplicados.push({ id: med.id, name: med.name, qty, unit: med.unit, costoUnitario, costoSubtotal: costoUnitario * qty });
                }
            }
        }
    }
    if (!stockValido) return;
    insumosAplicados.forEach(ins => {
        const item = inventario.find(m => m.id === ins.id);
        if (item) {
            item.stock -= ins.qty;
            registrarMovimientoInventario({
                item,
                tipo: 'Uso',
                cantidad: -ins.qty,
                motivo: `Consulta: ${consultaSeleccionada.petObj?.name || 'Paciente'}`
            });
        }
    });
    const controlVacunas = descontarVacunasDelInventario(insumosAplicados);
    saveStore('inventario');
    const tipoConsulta = $('consulta-tipo-drop').value;
    let sintomasTxt = "";
    let moduloSeguimiento = "";
    let vacunasTxt = "";
    let desparasitanteTxt = "";
    let textoDisclaimerIndividual = "";
    if (tipoConsulta === 'Vacunacion') {
        vacunasTxt = recolectarVacunasAplicadas();
        desparasitanteTxt = $('aplico-desparasitante')?.value === 'Si' ? $('desparasitante-nombre')?.value : 'No';
        textoDisclaimerIndividual = `${TEXTO_DECLARACION_RESPONSIVA} ${TEXTO_CONSENTIMIENTO_RESPONSIVA} Servicio: ${tipoConsulta}. Vacunas: ${vacunasTxt} | Desparasitante: ${desparasitanteTxt}.`;
    } else {
        sintomasTxt = recolectarSintomas();
        if (tipoConsulta === 'Seguimiento') {
            moduloSeguimiento = `| Evolución: ${$('seg-memoria')?.value || ''} | Trat. Actual: ${$('seg-tratamiento-actual')?.value || ''}`;
        }
        textoDisclaimerIndividual = `${TEXTO_DECLARACION_RESPONSIVA} ${TEXTO_CONSENTIMIENTO_RESPONSIVA} Servicio: ${tipoConsulta}. Sintomatología: "${sintomasTxt}". Anamnesis: Especie: ${$('consulta-especie-drop')?.value || 'Otro'}, Ánimo: ${$('consulta-animo-drop')?.value || 'Normal'}, Garrapatas: ${$('consulta-garrapatas')?.value || 'No'}, Dieta: ${$('consulta-alimentacion')?.value || 'Croquetas'} ${moduloSeguimiento}.`;
    }
    const checkboxesServicios = document.querySelectorAll('.servicio-chk-multi:checked');
    let costoSrv = 0;
    let serviciosCobradosArray = [];
    checkboxesServicios.forEach(chk => {
        costoSrv += parseFloat(chk.value) || 0;
        serviciosCobradosArray.push(`${chk.getAttribute('data-nombre')} ($${chk.value})`);
    });
    const servicioNombre = serviciosCobradosArray.length > 0 
        ? serviciosCobradosArray.join(' + ') 
        : 'Solo Insumos / General';
    if (costoSrv === 0 && $('consulta-estado-pago')?.value === 'Pagado' && !confirm("No seleccionaste ningún servicio a cobrar. ¿Guardar la consulta con total $0.00?")) return;
    const consultaId = Date.now();
    let notasRapidas = typeof obtenerWhiteboardDataUrl === 'function' ? obtenerWhiteboardDataUrl() : '';
    let firmaDueno = $('canvas-firma').toDataURL();
    let firmaVet = $('canvas-firma-vet').toDataURL();
    if (typeof subirImagenDataUrl === 'function') {
        notasRapidas = await subirImagenDataUrl(notasRapidas, 'consultas', `notas-${consultaId}`);
        firmaDueno = await subirImagenDataUrl(firmaDueno, 'firmas', `dueno-${consultaId}`);
        firmaVet = await subirImagenDataUrl(firmaVet, 'firmas', `vet-${consultaId}`);
    }
    const nuevaConsultaObj = {
        id: consultaId, 
        fecha: new Date().toLocaleString('es-MX'),
        fechaISO: new Date().toISOString(),
        tipo: tipoConsulta,
        peso: $('weight')?.value || '--', 
        temp: $('temp')?.value || '--', 
        motivo: $('motivo')?.value || (tipoConsulta === 'Vacunacion' ? 'Vacunación / profilaxis' : ''), 
        tratamiento: $('tratamiento')?.value || '',
        insumos: insumosAplicados,
        sintomas: sintomasTxt,
        vacunas: tipoConsulta === 'Vacunacion' ? vacunasTxt : null,
        desparasitante: tipoConsulta === 'Vacunacion' ? desparasitanteTxt : null,
        disclaimer: textoDisclaimerIndividual,
        costoTotal: parseFloat(costoSrv.toFixed(2)), // Asegurado como número
        servicioCobrado: servicioNombre,
        metodoPago: $('consulta-metodo-pago')?.value || 'Efectivo',
        estadoPago: $('consulta-estado-pago')?.value || 'Pagado',
        notaPago: $('consulta-nota-pago')?.value || '',
        abonos: $('consulta-estado-pago')?.value === 'Pagado'
            ? [{ id: uid(), fechaISO: new Date().toISOString(), monto: parseFloat(costoSrv.toFixed(2)), metodo: $('consulta-metodo-pago')?.value || 'Efectivo' }]
            : [],
        seguimiento: {
            requerido: Boolean($('consulta-requiere-seguimiento')?.checked),
            nota: $('consulta-seguimiento-nota')?.value || '',
            fecha: $('consulta-seguimiento-fecha')?.value || '',
            hora: $('consulta-seguimiento-hora')?.value || ''
        },
        notasRapidas,
        vacunasControlStock: tipoConsulta === 'Vacunacion' ? controlVacunas : null,
        firmaDueno,
        firmaVet
    };
    const clientIdx = clientes.findIndex(c => c.id === consultaSeleccionada.ownerId);
    if(clientIdx !== -1) {
        const petIdx = clientes[clientIdx].mascotas.findIndex(m => m.id === consultaSeleccionada.petId);
        if(petIdx !== -1) {
            if(!clientes[clientIdx].mascotas[petIdx].historial) {
                clientes[clientIdx].mascotas[petIdx].historial = [];
            }
            clientes[clientIdx].mascotas[petIdx].historial.unshift(nuevaConsultaObj);
            registrarAuditoria('consultas', 'Crear', `Consulta ${tipoConsulta} guardada para ${consultaSeleccionada.petObj.name}`, nuevaConsultaObj.id);
            saveStore('clientes');
            if (typeof citaActivaId !== 'undefined' && citaActivaId) {
                const cita = agenda.find(item => item.id === citaActivaId);
                if (cita) {
                    cita.estado = 'Atendida';
                    saveStore('agenda');
                    if (typeof renderDashboard === 'function') renderDashboard();
                }
                citaActivaId = null;
            }
            if (nuevaConsultaObj.seguimiento.requerido && nuevaConsultaObj.seguimiento.fecha) {
                const citaSeguimiento = {
                    id: uid() + 2,
                    fecha: nuevaConsultaObj.seguimiento.fecha,
                    hora: nuevaConsultaObj.seguimiento.hora || '10:00',
                    clienteId: consultaSeleccionada.ownerId,
                    petId: consultaSeleccionada.petId,
                    clienteNombre: consultaSeleccionada.ownerObj.owner,
                    petName: consultaSeleccionada.petObj.name,
                    direccion: consultaSeleccionada.ownerObj.address,
                    notas: nuevaConsultaObj.seguimiento.nota || 'Seguimiento clínico',
                    estado: 'Programada',
                    origen: 'Seguimiento'
                };
                agenda.push(citaSeguimiento);
                registrarAuditoria('agenda', 'Crear', `Seguimiento agendado para ${consultaSeleccionada.petObj.name}`, nuevaConsultaObj.id);
                saveStore('agenda');
                renderAgenda();
                if (typeof renderDashboard === 'function') renderDashboard();
                if (typeof crearRecordatorioApple === 'function' && confirm('Seguimiento agendado. ¿Crear recordatorio en Apple Reminders ahora?')) {
                    crearRecordatorioApple(citaSeguimiento.id);
                }
            }
            const avisosStock = [];
            if (controlVacunas.noEncontradas?.length) avisosStock.push(`Sin coincidencia en inventario: ${controlVacunas.noEncontradas.join(', ')}`);
            if (controlVacunas.sinStock?.length) avisosStock.push(`Sin stock para descontar: ${controlVacunas.sinStock.join(', ')}`);
            alert(`¡Expediente de consulta guardado exitosamente!${avisosStock.length ? '\n\nControl de stock:\n' + avisosStock.join('\n') : ''}`);
        }
    }
    $('form-consulta')?.reset();
    if(contenedorFilas) contenedorFilas.innerHTML = "";
    limpiarLienzoFirma('canvas-firma'); 
    limpiarLienzoFirma('canvas-firma-vet');
    limpiarWhiteboard();
    renderSubpaginaMascotas(); // Refresca la vista de mascotas
    renderGananciasConsultas();
    switchTab('clientes');
    revisarAlertasStockGlobal();
}
function cancelarConsultaActiva() {
    if (!confirm("¿Cancelar esta consulta y volver al expediente? No se guardarán los datos capturados.")) return;
    $('form-consulta')?.reset();
    const contenedorFilas = $('contenedor-filas-medicamentos');
    if(contenedorFilas) contenedorFilas.innerHTML = "";
    limpiarLienzoFirma('canvas-firma'); 
    limpiarLienzoFirma('canvas-firma-vet');
    limpiarWhiteboard();
    regresarAlDirectorioDesdeConsulta();
}
function cargarPacienteAConsulta(ownerId, petId) {
    const ownerObj = clientes.find(c => c.id === ownerId);
    const petObj = ownerObj?.mascotas.find(m => m.id === petId);
    if (!ownerObj || !petObj) return;
    consultaSeleccionada = { ownerId, petId, ownerObj, petObj };
    if($('consulta-paciente-nombre')) {
        $('consulta-paciente-nombre').innerText = `${petObj.name} (Dueño: ${ownerObj.owner})`;
    }
    const dropEspecie = $('consulta-especie-drop');
    if(dropEspecie) {
        dropEspecie.value = petObj.species.toLowerCase().includes('gat') ? 'Gato' : (petObj.species.toLowerCase().includes('perr') || petObj.species.toLowerCase().includes('can') ? 'Perro' : 'Otro');
    }
    firmaDuenoEstablecida = false; 
    firmaVetEstablecida = false;
    actualizarVistaPorTipoConsulta();
    actualizarIndicadorFirmaStatus(); 
    actualizarDisclaimerDinamico();
    rellenarDropdownServicios();
    calcularTotalCobro();
    limpiarWhiteboard();
    switchTab('nueva-consulta');
}
