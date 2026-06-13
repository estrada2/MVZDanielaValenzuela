// Eutanasia humanitaria.
// Guarda formatos administrativos, genera PDFs y registra el ingreso en Finanzas.
const EUTANASIA_COSTOS = {
    'Chico': 1200,
    'Mediano': 1500,
    'Mediano/Grande': 2000,
    'Grande': 2500,
    'Extra grande/Gigante': 3500
};
const EUTANASIA_LOGO_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QDARXhpZgAATU0AKgAAAAgABQESAAMAAAABAAEAAAEaAAUAAAABAAAASgEbAAUAAAABAAAAUgEoAAMAAAABAAIAAIdpAAQAAAABAAAAWgAAAAAAAABIAAAAAQAAAEgAAAABAASShgAHAAAAJwAAAJCgAQADAAAAAQABAACgAgAEAAAAAQAAAYSgAwAEAAAAAQAAAMMAAAAAQVNDSUkAAAAzODgsMTk1LDAsMC44MTQyMTA1MjYzMTU3ODk1LC0xAP/hClFodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDYuMC4wIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6ZXhpZj0iaHR0cDovL25zLmFkb2JlLmNvbS9leGlmLzEuMC8iIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIiBleGlmOlBpeGVsWURpbWVuc2lvbj0iMTk1IiBleGlmOlBpeGVsWERpbWVuc2lvbj0iMzg4IiBleGlmOkNvbG9yU3BhY2U9IjEiIGV4aWY6VXNlckNvbW1lbnQ9IjM4OCwxOTUsMCwwLjgxNDIxMDUyNjMxNTc4OTUsLTEiIHRpZmY6WFJlc29sdXRpb249IjcyLzEiIHRpZmY6UmVzb2x1dGlvblVuaXQ9IjIiIHRpZmY6T3JpZW50YXRpb249IjEiIHRpZmY6WVJlc29sdXRpb249IjcyLzEiLz4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8P3hwYWNrZXQgZW5kPSJ3Ij8+AP/AABEIAMMBhAMBIgACEQEDEQH/xAAfAAABBQEBAQEBAQAAAAAAAAAAAQIDBAUGBwgJCgv/xAC1EAACAQMDAgQDBQUEBAAAAX0BAgMABBEFEiExQQYTUWEHInEUMoGRoQgjQrHBFVLR8CQzYnKCCQoWFxgZGiUmJygpKjQ1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4eLj5OXm5+jp6vHy8/T19vf4+fr/xAAfAQADAQEBAQEBAQEBAAAAAAAAAQIDBAUGBwgJCgv/xAC1EQACAQIEBAMEBwUEBAABAncAAQIDEQQFITEGEkFRB2FxEyIygQgUQpGhscEJIzNS8BVictEKFiQ04SXxFxgZGiYnKCkqNTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqCg4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2dri4+Tl5ufo6ery8/T19vf4+fr/2wBDAAICAgICAgMCAgMEAwMDBAYEBAQEBgcGBgYGBgcIBwcHBwcHCAgICAgICAgKCgoKCgoMDAwMDA0NDQ0NDQ0NDQ3/2wBDAQICAgMDAwYDAwYOCQgJDg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg7/3QAEABn/2gAMAwEAAhEDEQA/AP38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//Q/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigA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zP6jA+bfHHgLWry48nRNPVrVfCt9pu1WRFWafZsSuhuPBN9F/wAIgdLsltpNPiltbqSJkXy0kh2f8D+evc9n+01DRI33q5/r0zT6rA+UNX8M+ML7w5o3hKDwl5cmlaraXE+oPLCsTJHLveVPLfzN/wD2zrsNL8D6jaaV4+d9PX7frt5ey2vzJvmSRP3fz17/ALUpirsWn9amH1Q+aNB0Hxb4NkaWXwy+uf2hptpat5EtsrwvHDseF/Mkj+T+P5K9M8Labr3hL4fx25gF5qdtbuy24ZVDS8lU39PQZr0vyk3b6d5SdqKmK5w9hyHzf4FHi+3+1TeI/DOsQatrS/6VqE8toyW6/P5aIkd3LJsjrN0zwr4vh8PaP4HfQBbNpN1FO2sebD9nZYJt+9Pn8zzJP9uOvqDYlG2j60H1Q+aNU8L+Kl0vXPBkHh37WusXr3UWrebCsSpJNv3v+8+0b4/+udaWoeAte1CXxdaQ/u21PRreztbzci7pY4dj7/L/AHif8Dr6I2p6LSeXzmj+0ZwCeF5z5J8M/DfxDeatYzalb6vZtpVnLFFc3NxZtEryQ+X8iQfvHT/rpXd+C7HxNpFtpXhLUPC3lw6aMPqbSwmKTZuG9USR5Qznk70HWvfPKSjykq6mYzq/GH1WB83XXw81X/hW0OlW+lxrq0WrRXiquxXX/S97vvj/AOmdUNX8Ca7NeapqU+jXF1I2uPeWc9jcpHdRrJCkfmw+Z+7/AIP46+nvK96PLT+7UU8dOBc8LDkPnax8K+L7rwnpNtq9t59xa64lz8/krL9l3/fm8j935n+5VPV/DvijTB4t0638N/28viDzZba7823VF8yHy0Sb7RIP/HK+lNvzUbPm3/xVf16ZH1Q5nwPp91pPhPS9Pvo/Jngtkjkj3btrAYIz3xXW01RtWnVw1KnOdUAooooAKKKKAP/X/fyiiigAooooAKKKKACiiigBNoqleWNtfW8lpdRrJDKu2RW7rV6ij++B+dviX9iDS9R+J0Or6bd+T4VnY3N5aZ+ZZefkT/YPvyOnPFfeWg6Hpeg6bb6XpEC21pbgrBGmcBTz3963GXc1OVdtd+OzXE4qEKNafwnLQwUKU+eA2Nflp+0UtFcB1BRRRQAUUUUAFFFFABRRRQAUm0UtFABRRRQAUUUUAJtFG0UtFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQB/9D9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/0f38ooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooA//S/fyiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/9P9/KKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKAP/2Q==';

function escapeEutanasia(valor) {
    if (typeof escapeHTML === 'function') return escapeHTML(valor);
    return String(valor ?? '').replace(/[&<>"']/g, caracter => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }[caracter]));
}

function actualizarCostoEutanasia() {
    const tamano = $('eutanasia-tamano')?.value || '';
    if ($('eutanasia-costo') && EUTANASIA_COSTOS[tamano]) {
        $('eutanasia-costo').value = EUTANASIA_COSTOS[tamano];
    }
}

function abrirLecturaEutanasia() {
    $('modal-lectura-eutanasia')?.classList.remove('hidden');
    renderIcons();
}

function cerrarLecturaEutanasia() {
    $('modal-lectura-eutanasia')?.classList.add('hidden');
}

function motivosEutanasiaSeleccionados() {
    return Array.from($$('.eutanasia-motivo:checked')).map(input => input.value);
}

function valorEutanasia(id) {
    return $(id)?.value?.trim() || '';
}

function fechaHoraEutanasia(registro) {
    const fecha = registro.fecha || fechaLocalISO();
    const hora = registro.hora || '12:00';
    return new Date(`${fecha}T${hora}`);
}

function canvasTieneFirma(canvasId) {
    const canvas = $(canvasId);
    if (!canvas) return false;
    try {
        const ctx = canvas.getContext('2d');
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] > 0) return true;
        }
    } catch (error) {
        console.warn('No se pudo leer el lienzo de firma.', error);
    }
    return false;
}

function obtenerFirmaCanvas(canvasId) {
    const canvas = $(canvasId);
    if (!canvas || !canvasTieneFirma(canvasId)) return '';
    try {
        return canvas.toDataURL('image/png');
    } catch (error) {
        console.warn('No se pudo exportar firma del lienzo.', error);
        return '';
    }
}

function dibujarFirmaCanvas(canvasId, dataUrl) {
    const canvas = $(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
}

function sincronizarIngresoEutanasia(registro) {
    const existente = (serviciosExternos || []).find(item => item.eutanasiaId === registro.id || (registro.financieroId && item.id === registro.financieroId));
    const financieroId = existente?.id || registro.financieroId || uid();
    const ingreso = {
        id: financieroId,
        fechaISO: registro.fechaISO || new Date(`${registro.fecha}T12:00:00`).toISOString(),
        fecha: registro.fecha,
        hora: registro.hora || '',
        clienteNombre: registro.propietario || 'Eutanasia',
        servicioCobrado: `Eutanasia humanitaria - ${registro.tamano}`,
        direccion: registro.domicilio || '',
        agendaId: null,
        total: parseFloat(registro.costo || 0),
        metodoPago: registro.metodoPago || 'Efectivo',
        estadoPago: registro.estadoPago || 'Pagado',
        notaPago: `Paciente: ${registro.paciente || 'Sin nombre'}`,
        abonos: registro.estadoPago === 'Pagado'
            ? [{ id: uid(), fechaISO: new Date().toISOString(), monto: parseFloat(registro.costo || 0), metodo: registro.metodoPago || 'Efectivo', nota: 'Pago registrado desde eutanasia' }]
            : [],
        clinicaId: null,
        eutanasiaId: registro.id,
        tipo: 'Eutanasia'
    };
    serviciosExternos = existente
        ? serviciosExternos.map(item => item.id === existente.id ? ingreso : item)
        : [ingreso, ...(serviciosExternos || [])];
    registro.financieroId = financieroId;
}

function recolectarEutanasiaFormulario() {
    const id = parseInt(valorEutanasia('eutanasia-id') || 0) || uid();
    const fecha = valorEutanasia('eutanasia-fecha') || fechaLocalISO();
    const hora = valorEutanasia('eutanasia-hora');
    const tamano = valorEutanasia('eutanasia-tamano');
    const existente = (eutanasias || []).find(item => item.id === id);
    return {
        id,
        financieroId: existente?.financieroId || null,
        createdAt: existente?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        fecha,
        hora,
        fechaISO: new Date(`${fecha}T12:00:00`).toISOString(),
        tamano,
        costo: parseFloat(valorEutanasia('eutanasia-costo') || EUTANASIA_COSTOS[tamano] || 0),
        metodoPago: valorEutanasia('eutanasia-metodo') || 'Efectivo',
        estadoPago: valorEutanasia('eutanasia-estado-pago') || 'Pagado',
        propietario: valorEutanasia('eutanasia-propietario'),
        telefono: valorEutanasia('eutanasia-telefono'),
        identificacion: valorEutanasia('eutanasia-identificacion'),
        domicilio: valorEutanasia('eutanasia-domicilio'),
        paciente: valorEutanasia('eutanasia-paciente'),
        especie: valorEutanasia('eutanasia-especie'),
        raza: valorEutanasia('eutanasia-raza'),
        sexo: valorEutanasia('eutanasia-sexo'),
        edad: valorEutanasia('eutanasia-edad'),
        color: valorEutanasia('eutanasia-color'),
        veterinario: valorEutanasia('eutanasia-veterinario') || 'Daniela Valenzuela',
        cedula: valorEutanasia('eutanasia-cedula'),
        diagnostico: valorEutanasia('eutanasia-diagnostico'),
        motivos: motivosEutanasiaSeleccionados(),
        motivoOtro: valorEutanasia('eutanasia-motivo-otro'),
        observaciones: valorEutanasia('eutanasia-observaciones'),
        destino: valorEutanasia('eutanasia-destino'),
        destinoOtro: valorEutanasia('eutanasia-destino-otro'),
        consentimientoLeido: Boolean($('eutanasia-consentimiento-leido')?.checked),
        firmaPropietario: existente?.firmaPropietario || '',
        firmaVeterinario: existente?.firmaVeterinario || ''
    };
}

async function guardarEutanasia(event) {
    event.preventDefault();
    const registro = recolectarEutanasiaFormulario();
    if (!registro.tamano || !registro.costo) {
        alert('Selecciona el tamaño para calcular el costo.');
        return;
    }
    if (!registro.consentimientoLeido) {
        alert('Confirma que el propietario leyó y comprendió el consentimiento antes de firmar.');
        return;
    }
    const firmaPropietarioCanvas = obtenerFirmaCanvas('canvas-eutanasia-propietario');
    const firmaVeterinarioCanvas = obtenerFirmaCanvas('canvas-eutanasia-vet');
    if (!firmaPropietarioCanvas && !registro.firmaPropietario) {
        alert('Falta la firma del propietario.');
        return;
    }
    if (!firmaVeterinarioCanvas && !registro.firmaVeterinario) {
        alert('Falta la firma del médico veterinario.');
        return;
    }
    if (firmaPropietarioCanvas) {
        registro.firmaPropietario = typeof subirImagenDataUrl === 'function'
            ? await subirImagenDataUrl(firmaPropietarioCanvas, 'firmas-eutanasia', `propietario-${registro.id}`)
            : firmaPropietarioCanvas;
    }
    if (firmaVeterinarioCanvas) {
        registro.firmaVeterinario = typeof subirImagenDataUrl === 'function'
            ? await subirImagenDataUrl(firmaVeterinarioCanvas, 'firmas-eutanasia', `vet-${registro.id}`)
            : firmaVeterinarioCanvas;
    }
    sincronizarIngresoEutanasia(registro);
    eutanasias = (eutanasias || []).some(item => item.id === registro.id)
        ? eutanasias.map(item => item.id === registro.id ? registro : item)
        : [registro, ...(eutanasias || [])];
    registrarAuditoria('eutanasias', 'Guardar', `Eutanasia: ${registro.paciente} · ${registro.propietario} · $${registro.costo}`, registro.id);
    saveStore('eutanasias');
    saveStore('serviciosExternos');
    limpiarFormularioEutanasia();
    renderEutanasia();
    if (typeof renderGananciasConsultas === 'function') renderGananciasConsultas();
    if (typeof renderDashboard === 'function') renderDashboard();
}

function limpiarFormularioEutanasia() {
    $('form-eutanasia')?.reset();
    if ($('eutanasia-id')) $('eutanasia-id').value = '';
    if ($('eutanasia-fecha')) $('eutanasia-fecha').value = fechaLocalISO();
    if ($('eutanasia-hora')) $('eutanasia-hora').value = new Date().toTimeString().slice(0, 5);
    if ($('eutanasia-veterinario')) $('eutanasia-veterinario').value = 'Daniela Valenzuela';
    if ($('eutanasia-consentimiento-leido')) $('eutanasia-consentimiento-leido').checked = false;
    if ($('btn-eutanasia-guardar')) $('btn-eutanasia-guardar').innerText = 'Guardar formatos e ingreso';
    limpiarLienzoFirma('canvas-eutanasia-propietario');
    limpiarLienzoFirma('canvas-eutanasia-vet');
    renderIcons();
}

function editarEutanasia(id) {
    const registro = (eutanasias || []).find(item => item.id === id);
    if (!registro) return;
    const campos = {
        'eutanasia-id': registro.id,
        'eutanasia-fecha': registro.fecha,
        'eutanasia-hora': registro.hora,
        'eutanasia-tamano': registro.tamano,
        'eutanasia-costo': registro.costo,
        'eutanasia-metodo': registro.metodoPago,
        'eutanasia-estado-pago': registro.estadoPago,
        'eutanasia-propietario': registro.propietario,
        'eutanasia-telefono': registro.telefono,
        'eutanasia-identificacion': registro.identificacion,
        'eutanasia-domicilio': registro.domicilio,
        'eutanasia-paciente': registro.paciente,
        'eutanasia-especie': registro.especie,
        'eutanasia-raza': registro.raza,
        'eutanasia-sexo': registro.sexo,
        'eutanasia-edad': registro.edad,
        'eutanasia-color': registro.color,
        'eutanasia-veterinario': registro.veterinario,
        'eutanasia-cedula': registro.cedula,
        'eutanasia-diagnostico': registro.diagnostico,
        'eutanasia-motivo-otro': registro.motivoOtro,
        'eutanasia-observaciones': registro.observaciones,
        'eutanasia-destino': registro.destino,
        'eutanasia-destino-otro': registro.destinoOtro
    };
    Object.entries(campos).forEach(([idCampo, valor]) => {
        if ($(idCampo)) $(idCampo).value = valor || '';
    });
    $$('.eutanasia-motivo').forEach(input => {
        input.checked = (registro.motivos || []).includes(input.value);
    });
    if ($('eutanasia-consentimiento-leido')) $('eutanasia-consentimiento-leido').checked = registro.consentimientoLeido !== false;
    dibujarFirmaCanvas('canvas-eutanasia-propietario', registro.firmaPropietario);
    dibujarFirmaCanvas('canvas-eutanasia-vet', registro.firmaVeterinario);
    if ($('btn-eutanasia-guardar')) $('btn-eutanasia-guardar').innerText = 'Actualizar formatos e ingreso';
    $('form-eutanasia')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function eliminarEutanasia(id) {
    const registro = (eutanasias || []).find(item => item.id === id);
    if (!registro || !confirm(`¿Eliminar los formatos de ${registro.paciente || 'este paciente'}?`)) return;
    eutanasias = (eutanasias || []).filter(item => item.id !== id);
    serviciosExternos = (serviciosExternos || []).filter(item => item.eutanasiaId !== id && item.id !== registro.financieroId);
    registrarAuditoria('eutanasias', 'Borrar', `Eutanasia eliminada: ${registro.paciente || id}`, id);
    saveStore('eutanasias');
    saveStore('serviciosExternos');
    renderEutanasia();
    if (typeof renderGananciasConsultas === 'function') renderGananciasConsultas();
}

function renderEutanasia() {
    const lista = $('lista-eutanasia');
    if (!lista) return;
    if ($('eutanasia-fecha') && !$('eutanasia-fecha').value) limpiarFormularioEutanasia();
    const busqueda = String($('buscador-eutanasia')?.value || '').toLowerCase();
    const registros = [...(eutanasias || [])]
        .filter(item => [item.propietario, item.paciente, item.telefono, item.tamano].some(valor => String(valor || '').toLowerCase().includes(busqueda)))
        .sort((a, b) => fechaHoraEutanasia(b) - fechaHoraEutanasia(a));
    if (!registros.length) {
        lista.innerHTML = `<div class="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-400">No hay formatos guardados.</div>`;
        renderIcons();
        return;
    }
    lista.innerHTML = registros.map(registro => {
        const fecha = fechaHoraEutanasia(registro);
        const opcionesFecha = registro.hora ? { dateStyle: 'medium', timeStyle: 'short' } : { dateStyle: 'medium' };
        const fechaTexto = Number.isNaN(fecha.getTime()) ? registro.fecha : fecha.toLocaleString('es-MX', opcionesFecha);
        const costoTexto = typeof formatoMoneda === 'function' ? formatoMoneda(registro.costo || 0) : Number(registro.costo || 0).toFixed(2);
        const pagoClase = registro.estadoPago === 'Pagado' ? 'green' : 'rose';
        return `
            <article class="eutanasia-record-card">
                <div class="eutanasia-record-main">
                    <div class="eutanasia-record-icon">
                        <i data-lucide="heart-handshake" class="w-4 h-4"></i>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center justify-between gap-2">
                            <h4 class="text-sm font-black text-slate-900 truncate">${escapeEutanasia(registro.paciente || 'Paciente sin nombre')}</h4>
                            <span class="app-chip ${pagoClase}">$${costoTexto}</span>
                        </div>
                        <p class="text-xs text-slate-500 truncate">${escapeEutanasia(registro.propietario || 'Sin propietario')} · ${escapeEutanasia(fechaTexto)}</p>
                        <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span class="app-chip blue">${escapeEutanasia(registro.tamano || 'Sin tamaño')}</span>
                            <span class="app-chip ${pagoClase}">${escapeEutanasia(registro.estadoPago || 'Pagado')}</span>
                        </div>
                        <p class="text-[11px] text-slate-400 truncate mt-1.5">${escapeEutanasia(registro.diagnostico || 'Sin diagnóstico capturado')}</p>
                    </div>
                </div>
                <div class="eutanasia-record-actions">
                    <button type="button" onclick="descargarPDFEutanasia(${registro.id}, 'completo')" class="btn-primary">PDF completo</button>
                    <button type="button" onclick="descargarPDFEutanasia(${registro.id}, 'consentimiento')" class="btn-soft">Consentimiento</button>
                    <button type="button" onclick="descargarPDFEutanasia(${registro.id}, 'medica')" class="btn-soft">Médica</button>
                    <button type="button" onclick="editarEutanasia(${registro.id})" class="btn-soft text-amber-700">Editar</button>
                    <button type="button" onclick="eliminarEutanasia(${registro.id})" class="btn-danger-soft">Eliminar</button>
                </div>
            </article>
        `;
    }).join('');
    renderIcons();
}

function checkboxPDF(activo) {
    return `<span class="pdf-check">${activo ? '&#10003;' : ''}</span>`;
}

function lineaPDF(valor, fallback = '____________________________') {
    return escapeEutanasia(valor || fallback);
}

function campoLineaPDF(label, valor, className = '') {
    return `<p class="pdf-line ${className}"><span>${label}</span><b>${lineaPDF(valor, '')}</b></p>`;
}

function firmaPDF(src, label, nombre = '') {
    return `
        <div class="pdf-signature">
            ${src ? `<img src="${src}" alt="${escapeEutanasia(label)}">` : ''}
            <div></div>
            <p>${escapeEutanasia(label)}${nombre ? `: ${escapeEutanasia(nombre)}` : ''}</p>
        </div>
    `;
}

function logoFooterPDF() {
    return `<div class="pdf-brand"><img src="${EUTANASIA_LOGO_DATA_URL}" alt="Daniela Valenzuela"></div>`;
}

function plantillaConsentimientoEutanasia(registro) {
    const destino = registro.destino || '';
    return `
        <section class="eutanasia-pdf-page">
            <h1>CONSENTIMIENTO INFORMADO Y AUTORIZACIÓN<br>PARA EUTANASIA HUMANITARIA</h1>
            <p class="pdf-date"><b>FECHA:</b> <span>${lineaPDF(registro.fecha)}</span></p>
            <h2>DATOS DEL PROPIETARIO</h2>
            ${campoLineaPDF('Nombre completo:', registro.propietario)}
            ${campoLineaPDF('Teléfono:', registro.telefono)}
            ${campoLineaPDF('Identificación oficial:', registro.identificacion)}
            ${campoLineaPDF('Domicilio:', registro.domicilio)}
            <h2>DATOS DEL PACIENTE</h2>
            ${campoLineaPDF('Nombre:', registro.paciente, 'half')}
            ${campoLineaPDF('Especie:', registro.especie, 'half')}
            ${campoLineaPDF('Raza:', registro.raza, 'half')}
            ${campoLineaPDF('Sexo:', registro.sexo, 'half')}
            ${campoLineaPDF('Edad:', registro.edad, 'half')}
            ${campoLineaPDF('Color o señas particulares:', registro.color)}
            <h2>DECLARACIÓN Y AUTORIZACIÓN</h2>
            <p>Yo, <span class="inline-line">${lineaPDF(registro.propietario)}</span>, propietario o responsable legal del paciente antes descrito, manifiesto que:</p>
            <ul>
                <li text-align: justify>- He sido informado(a) sobre la condición médica y el pronóstico de mi mascota.</li>
                <li>- Comprendo que la eutanasia es un procedimiento humanitario e irreversible que ocasionará su fallecimiento.</li>
                <li>- He tenido la oportunidad de realizar preguntas y aclarar mis dudas.</li>
                <li>- Entiendo que la recomendación de eutanasia se basa en criterios médicos y de bienestar animal.</li>
                <li>- El procedimiento se llevará a cabo conforme a la legislación vigente en materia de bienestar animal y a la NOM-033-SAG/ZOO-2014, así como disposiciones aplicables.</li>
                <li>- Libero al Médico Veterinario y al establecimiento de cualquier responsabilidad derivada de información falsa, incompleta u ocultada respecto al paciente.</li>
                <li>- Autorizo voluntariamente la realización del procedimiento.</li>
            </ul>
            <h2>DESTINO DE LOS RESTOS</h2>
            <p class="pdf-option">${checkboxPDF(destino === 'Cremación individual')} Cremación individual</p>
            <p class="pdf-option">${checkboxPDF(destino === 'Cremación colectiva')} Cremación colectiva</p>
            <p class="pdf-option">${checkboxPDF(destino === 'Entrega del cuerpo al propietario')} Entrega del cuerpo al propietario</p>
            <p class="pdf-option">${checkboxPDF(destino === 'Otro')} Otro: <span class="inline-line short">${lineaPDF(registro.destinoOtro, '')}</span></p>
           ${firmaPDF(registro.firmaPropietario, 'Firma', registro.propietario)}
           ${logoFooterPDF()}
        </section>
        
    `;
}

function plantillaInfoMedicaEutanasia(registro) {
    const motivos = registro.motivos || [];
    return `
        <section class="eutanasia-pdf-page">
            <h1>INFORMACIÓN MÉDICA</h1>
            ${campoLineaPDF('Nombre del Médico Veterinario:', registro.veterinario)}
            ${campoLineaPDF('Cédula Profesional:', registro.cedula)}
            <p class="pdf-label">Diagnóstico, condición clínica y/o signología principal:</p>
            <p class="pdf-box lined">${lineaPDF(registro.diagnostico, '')}</p>
            <h2>Motivo médico que justifica la eutanasia</h2>
            <p class="pdf-option">${checkboxPDF(motivos.includes('Enfermedad terminal'))} Enfermedad terminal</p>
            <p class="pdf-option">${checkboxPDF(motivos.includes('Enfermedad irreversible'))} Enfermedad irreversible</p>
            <p class="pdf-option">${checkboxPDF(motivos.includes('Dolor o sufrimiento no controlable'))} Dolor o sufrimiento no controlable</p>
            <p class="pdf-option">${checkboxPDF(motivos.includes('Trauma severo incompatible con calidad de vida'))} Trauma severo incompatible con una adecuada calidad de vida</p>
            <p class="pdf-option">${checkboxPDF(motivos.includes('Deterioro grave e irreversible'))} Deterioro grave e irreversible</p>
            <p class="pdf-option">${checkboxPDF(Boolean(registro.motivoOtro))} Otro: <span class="inline-line">${lineaPDF(registro.motivoOtro, '')}</span></p>
            <p class="pdf-label">Observaciones médicas relevantes:</p>
            <p class="pdf-box lined small">${lineaPDF(registro.observaciones, '')}</p>
            <h2>CERTIFICACIÓN MÉDICA</h2>
            <p>Certifico que el paciente descrito fue evaluado clínicamente y que, de acuerdo con mi criterio profesional, la eutanasia constituye una medida humanitaria médicamente justificada para evitar sufrimiento significativo o irreversible.</p>
            ${firmaPDF(registro.firmaVeterinario, 'Firma del Médico Veterinario', registro.veterinario)}
            ${campoLineaPDF('Fecha y hora:', `${registro.fecha || ''} ${registro.hora || ''}`.trim())}
            ${logoFooterPDF()}
        </section>
    `;
}

function htmlPDFEutanasia(registro, tipo) {
    const estilos = `
        <style>
            .eutanasia-pdf { color: #1f2940; font-family: Arial, Helvetica, sans-serif; }
            .eutanasia-pdf-page { width: 720px; min-height: 960px; padding: 54px 58px 44px; background: #fff; page-break-after: always; box-sizing: border-box; position: relative; }
            .eutanasia-pdf-page:last-child { page-break-after: auto; }
            .eutanasia-pdf h1 { text-align: center; color: #07184a; font-size: 20px; line-height: 1.08; margin: 0 0 32px; font-weight: 900; letter-spacing: -0.2px; }
            .eutanasia-pdf h2 { color: #07184a; font-size: 13px; margin: 24px 0 12px; font-weight: 900; }
            .eutanasia-pdf p, .eutanasia-pdf li { font-size: 12.8px; line-height: 1.28; margin: 5px 0; }
            .eutanasia-pdf ul { margin: 12px 0 18px; padding-left: 0; list-style-position: inside; }
            .pdf-date { text-align: right; margin-top: -12px; margin-bottom: 28px; }
            .pdf-date span { display: inline-block; min-width: 160px; border-bottom: 1.5px dashed #6b7280; text-align: center; padding-bottom: 2px; }
            .pdf-line { display: flex; align-items: baseline; gap: 6px; margin: 4px 0; }
            .pdf-line span { flex: 0 0 auto; }
            .pdf-line b { flex: 1; min-height: 16px; border-bottom: 1.5px dashed #6b7280; font-weight: 500; padding-left: 4px; }
            .pdf-line.half { width: 52%; }
            .inline-line { display: inline-block; min-width: 300px; border-bottom: 1.5px dashed #6b7280; padding: 0 6px 1px; }
            .inline-line.short { min-width: 240px; }
            .pdf-label { margin-top: 8px; }
            .pdf-box { min-height: 78px; padding: 7px 2px; white-space: pre-wrap; }
            .pdf-box.lined {
                background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 19px, #6b7280 20px);
                line-height: 20px;
            }
            .pdf-box.small { min-height: 64px; }
            .pdf-option { display: flex; align-items: center; gap: 7px; margin: 7px 0 !important; }
            .pdf-check { width: 10px; height: 10px; border: 1.4px solid #6b7280; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; line-height: 1; color: #07184a; flex: 0 0 auto; }
            .pdf-signature { margin-top: -10px; width: 78%; }
            .pdf-signature img { display: block; max-width: 260px; height: 58px; object-fit: contain; margin-left: 72px; }
            .pdf-signature div { border-bottom: 1.5px dashed #6b7280; height: 1px; }
            .pdf-signature p { margin-top: 6px; color: #1f2940; }
            .pdf-brand { position: absolute; left: 0; right: 0; bottom: -24px; text-align: right; }
            .pdf-brand img { width: 230px; height: auto; display: inline-block; }
        </style>
    `;
    const consentimiento = plantillaConsentimientoEutanasia(registro);
    const medica = plantillaInfoMedicaEutanasia(registro);
    const contenido = tipo === 'consentimiento' ? consentimiento : tipo === 'medica' ? medica : `${consentimiento}${medica}`;
    return `<div class="eutanasia-pdf">${estilos}${contenido}</div>`;
}

function descargarPDFEutanasia(id, tipo = 'completo') {
    const registro = (eutanasias || []).find(item => item.id === id);
    if (!registro) return;
    if (typeof html2pdf !== 'function') {
        alert('No se pudo cargar el generador de PDF.');
        return;
    }
    const contenedor = document.createElement('div');
    contenedor.style.position = 'fixed';
    contenedor.style.left = '-10000px';
    contenedor.style.top = '0';
    contenedor.style.background = '#fff';
    contenedor.innerHTML = htmlPDFEutanasia(registro, tipo);
    document.body.appendChild(contenedor);
    const nombre = `${tipo === 'completo' ? 'Eutanasia' : tipo}_${registro.paciente || 'Paciente'}_${registro.fecha || fechaLocalISO()}.pdf`.replace(/\s+/g, '_');
    html2pdf().set({
        margin: 0,
        filename: nombre,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'pt', format: 'letter', orientation: 'portrait' }
    }).from(contenedor.firstElementChild).save().then(() => contenedor.remove());
}
