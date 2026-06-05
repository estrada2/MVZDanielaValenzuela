function exportarResponsivaAPDF() {
    if (!consultaSeleccionada.petId) return;
    const elementoOrigen = $('seccion-responsiva-imprimir');
    const clonParaImpresion = elementoOrigen.cloneNode(true);
    const srcFirmaDueno = $('canvas-firma').toDataURL();
    const srcFirmaVet = $('canvas-firma-vet').toDataURL();
    const contenedorCanvasDueno = clonParaImpresion.querySelector('#canvas-firma');
    const contenedorCanvasVet = clonParaImpresion.querySelector('#canvas-firma-vet');
    if(contenedorCanvasDueno) contenedorCanvasDueno.outerHTML = `<img src="${srcFirmaDueno}" class="h-20 object-contain border rounded-md mx-auto">`;
    if(contenedorCanvasVet) contenedorCanvasVet.outerHTML = `<img src="${srcFirmaVet}" class="h-20 object-contain border rounded-md mx-auto">`;
    clonParaImpresion.querySelectorAll('button').forEach(btn => btn.remove());
    html2pdf().set({
        margin: 15,
        filename: `Responsiva_${consultaSeleccionada.petObj.name}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
    }).from(clonParaImpresion).save();
}
const PDF_TEXTO_DECLARACION_RESPONSIVA = "Declaro que la información proporcionada sobre el estado de salud de mi mascota es veraz, completa y actualizada. Asimismo, informo cualquier antecedente médico, enfermedad previa, tratamiento reciente o síntomas presentes antes de la atención veterinaria.";
const PDF_TEXTO_SIGNOS_RESPONSIVA = "Entiendo que es mi responsabilidad informar cualquier signo clínico, incluyendo, pero no limitándose a: vómito, diarrea, fiebre, decaimiento, pérdida de apetito, tos, secreciones, contacto con animales enfermos, tratamientos o medicamentos recientes.";
const PDF_TEXTO_SERVICIO_DOMICILIO = "Entiendo que los servicios veterinarios a domicilio se realizan bajo las condiciones disponibles en el entorno del paciente y que algunos procedimientos, estudios diagnósticos o tratamientos pueden requerir atención en clínica u hospital veterinario para garantizar la seguridad y bienestar de la mascota. Reconozco que la consulta a domicilio no sustituye hospitalización, monitoreo continuo ni servicios de emergencia veterinaria.";
const PDF_TEXTO_CONSENTIMIENTO_RESPONSIVA = "Entiendo y acepto que la aplicación de vacunas o tratamientos en animales que ya cursan con enfermedades, infecciones o padecimientos no reportados puede incrementar el riesgo de complicaciones graves, reacciones adversas e incluso el fallecimiento de la mascota. Asimismo, acepto que el médico veterinario no será responsable por complicaciones, deterioro en la salud o fallecimiento derivados de enfermedades, síntomas o antecedentes clínicos omitidos, ocultados o no informados por el propietario antes del procedimiento, siempre que la atención haya sido brindada conforme a la práctica veterinaria adecuada. El médico veterinario podrá negarse a realizar procedimientos, aplicar vacunas o administrar tratamientos si considera que la mascota requiere valoración clínica adicional, estudios diagnósticos o atención hospitalaria para salvaguardar su bienestar.";
function descargarResponsivaHistorialPDF(ownerId, petId, consultaId) {
    const ownerObj = clientes.find(c => c.id === ownerId);
    const petObj = ownerObj?.mascotas.find(m => m.id === petId);
    const consultaObj = petObj?.historial.find(h => h.id === consultaId);
    if (!consultaObj) { alert("Datos no encontrados."); return; }
    const template = $('comprobante-historial-print-template');
    let bloqueDeclaracionHTML = '';
    if (consultaObj.vacunas) {
        bloqueDeclaracionHTML = `
            <p class="text-justify">${PDF_TEXTO_DECLARACION_RESPONSIVA}</p>
            <div class="mt-2 p-3 border rounded-xl bg-blue-50/70">
                <p class="text-blue-900 font-bold">Biológicos y/o Desparasitantes Aplicados:</p>
                <ul class="list-disc pl-4 text-slate-700 italic">
                    <li>Vacunas: ${consultaObj.vacunas || 'Ninguna'}</li>
                    <li>Desparasitante: ${consultaObj.desparasitante || 'No aplicado'}</li>
                </ul>
            </div>
        `;
    } else {
        bloqueDeclaracionHTML = `
            <p class="text-justify">${PDF_TEXTO_DECLARACION_RESPONSIVA}</p>
            <p class="mt-2 font-medium">Confirmo que, al momento de la consulta, mi mascota presenta:</p>
            <div class="mt-2 p-3 border rounded-xl bg-gray-50/70">
                <p class="text-slate-700 italic">"${consultaObj.sintomas || 'Declarado asintomático.'}"</p>
            </div>
        `;
    }
    template.innerHTML = `
        <div class="p-8 bg-white text-slate-800 space-y-4 font-sans leading-relaxed text-[11px]" style="max-width: 700px; margin: auto;">
            <div class="text-center border-b pb-4 mb-4">
                <h4 class="font-bold text-md uppercase text-slate-900 tracking-wider">Consentimiento Informado y Responsiva</h4>
                <p class="text-xs text-blue-900 font-bold uppercase tracking-wide">Servicio Veterinario a Domicilio — MVZ Daniela Valenzuela</p>
            </div>
            <p class="text-right"><b>Fecha de Atención:</b> <span class="underline">${consultaObj.fecha}</span></p>
            <div class="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-gray-200">
                <p><b>Propietario / Responsable:</b> <span class="underline font-semibold">${ownerObj.owner}</span></p>
                <p><b>Teléfono:</b> <span class="underline font-semibold">${ownerObj.phone}</span></p>
                <p><b>Paciente:</b> <span class="underline font-semibold">${petObj.name}</span></p>
                <p><b>Especie/Raza:</b> <span class="underline font-semibold">${petObj.species}</span> &nbsp;&nbsp;&nbsp;&nbsp;<b>Edad:</b> <span class="underline font-semibold">${petObj.age}</span></p>
            </div>
            <p><b>Procedimiento o servicio:</b> <span class="font-bold underline text-blue-950">${consultaObj.motivo}</span></p>
            <div>
                <h5 class="font-bold text-slate-900 uppercase text-[11px] border-b pb-0.5 mb-1.5">### DECLARACIONES DEL PROPIETARIO</h5>
                ${bloqueDeclaracionHTML}
                <p class="mt-2 text-[10px] text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">${PDF_TEXTO_SIGNOS_RESPONSIVA}</p>
            </div>
            <div>
                <h5 class="font-bold text-slate-900 uppercase text-[11px] border-b pb-0.5 mb-1.5">### SOBRE LOS SERVICIOS A DOMICILIO</h5>
                <p class="text-justify">${PDF_TEXTO_SERVICIO_DOMICILIO}</p>
            </div>
            <div>
                <h5 class="font-bold text-slate-900 uppercase text-[11px] border-b pb-0.5 mb-1.5">### CONSENTIMIENTO Y RESPONSIVA</h5>
                <p class="text-justify">${PDF_TEXTO_CONSENTIMIENTO_RESPONSIVA}</p>
            </div>
            <div>
                <h5 class="font-bold text-slate-900 uppercase text-[11px] border-b pb-0.5 mb-1.5">### FIRMA DE CONFORMIDAD</h5>
                <p class="text-justify">Declaro haber leído y comprendido el presente documento, así como haber tenido oportunidad de resolver mis dudas antes de autorizar el procedimiento.</p>
            </div>
            <div class="pt-4 border-t border-gray-200 mt-4">
                <p class="text-justify text-slate-600 mb-2 font-mono text-[9px] bg-slate-100 p-2 rounded"><b>Detalle clínico guardado:</b> ${consultaObj.disclaimer}</p>
            </div>
            ${consultaObj.notasRapidas ? `
                <div class="pt-3 border-t border-gray-200">
                    <h5 class="font-bold text-slate-900 uppercase text-[11px] border-b pb-0.5 mb-2">### NOTAS RÁPIDAS DE CONSULTA</h5>
                    <img src="${consultaObj.notasRapidas}" class="w-full max-h-52 object-contain border rounded-xl bg-white">
                </div>
            ` : ''}
            <div>
                <div class="grid grid-cols-2 gap-4 pt-2 items-center">
                    <div class="flex flex-col items-center space-y-1 bg-slate-50 p-3 rounded-xl border border-gray-200 text-center">
                        <span class="text-[10px] text-gray-400 font-bold uppercase">Firma del Propietario</span>
                        <img src="${consultaObj.firmaDueno}" class="h-20 object-contain border rounded-md mx-auto bg-white">
                        <p class="text-[10px] text-slate-800 font-bold border-t border-slate-200 w-full pt-1 mt-1">${ownerObj.owner}</p>
                    </div>
                    <div class="flex flex-col items-center space-y-1 bg-slate-50 p-3 rounded-xl border border-gray-200 text-center">
                        <span class="text-[10px] text-gray-400 font-bold uppercase">Firma MVZ Daniela V.</span>
                        <img src="${consultaObj.firmaVet}" class="h-20 object-contain border rounded-md mx-auto bg-white">
                        <p class="text-[10px] text-slate-800 font-bold border-t border-slate-200 w-full pt-1 mt-1">MVZ Daniela Valenzuela</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    html2pdf().set({
        margin: 15, filename: `Responsiva_${petObj.name}_Folio_${consultaObj.id}.pdf`,
        image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' }
    }).from(template.firstElementChild).save();
}
