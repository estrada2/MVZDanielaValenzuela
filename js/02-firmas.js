// Firmas, responsiva y whiteboard.
// Agrupa lienzos táctiles usados en consulta: firma del propietario, firma MVZ y notas rápidas.
function setupSignatureCanvas(canvasId) {
    const canvas = $(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let dibujando = false;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    function obtenerCoordenadas(e) {
        const rect = canvas.getBoundingClientRect();
        const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
        const clienteY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: (clienteX - rect.left) * (canvas.width / rect.width),
            y: (clienteY - rect.top) * (canvas.height / rect.height)
        };
    }
    function iniciarDibujo(e) {
        dibujando = true;
        const coords = obtenerCoordenadas(e);
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        if (e.cancelable) e.preventDefault();
    }
    function procesarDibujo(e) {
        if (!dibujando) return;
        const coords = obtenerCoordenadas(e);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        if (canvasId === 'canvas-firma') firmaDuenoEstablecida = true;
        if (canvasId === 'canvas-firma-vet') firmaVetEstablecida = true;
        if (e.cancelable) e.preventDefault();
    }
    function finalizarDibujo() {
        if (dibujando) {
            dibujando = false;
            ctx.closePath();
            actualizarIndicadorFirmaStatus();
        }
    }
    canvas.addEventListener('mousedown', iniciarDibujo);
    canvas.addEventListener('mousemove', procesarDibujo);
    canvas.addEventListener('mouseup', finalizarDibujo);
    canvas.addEventListener('mouseleave', finalizarDibujo);
    canvas.addEventListener('touchstart', iniciarDibujo, { passive: false });
    canvas.addEventListener('touchmove', procesarDibujo, { passive: false });
    canvas.addEventListener('touchend', finalizarDibujo);
}
function limpiarLienzoFirma(canvasId) {
    const canvas = $(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (canvasId === 'canvas-firma') firmaDuenoEstablecida = false;
    if (canvasId === 'canvas-firma-vet') firmaVetEstablecida = false;
    actualizarIndicadorFirmaStatus();
}
function dibujarImagenEnCanvasFirma(canvasId, dataUrl) {
    const canvas = $(canvasId);
    if (!canvas || !dataUrl) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = dataUrl;
}
function cargarResponsivaMascotaEnCanvas() {
    const responsiva = typeof responsivaPacienteActual === 'function' ? responsivaPacienteActual() : null;
    if (!responsiva?.firmaDueno || !responsiva?.firmaVet) return;
    dibujarImagenEnCanvasFirma('canvas-firma', responsiva.firmaDueno);
    dibujarImagenEnCanvasFirma('canvas-firma-vet', responsiva.firmaVet);
    firmaDuenoEstablecida = true;
    firmaVetEstablecida = true;
    actualizarIndicadorFirmaStatus();
}
function recolectarSintomas() {
    if($('check-asintomatico')?.checked) return "Declarado sano/asintomático";
    const checkboxes = document.querySelectorAll('.sintoma-chk:checked');
    let seleccionados = Array.from(checkboxes).map(chk => chk.value);
    let detalles = $('sintomas-detalles')?.value.trim() || "";
    let resultado = seleccionados.join(', ');
    if(detalles) resultado += (resultado ? ' | ' : '') + detalles;
    return resultado || "Ningún síntoma especificado";
}
function recolectarVacunasAplicadas() {
    const seleccionadas = Array.from($$('.vacuna-chk:checked')).map(chk => chk.value);
    const extra = $('vacunas-aplicadas-extra')?.value.trim();
    if (extra) seleccionadas.push(extra);
    return seleccionadas.join(', ') || 'Ninguna especificada';
}
function vacunasSeleccionadasLista() {
    return Array.from($$('.vacuna-chk:checked')).map(chk => chk.value);
}

let whiteboardHerramienta = 'lapiz';
let whiteboardGrosor = 4;
let whiteboardTieneContenido = false;

// Whiteboard simple compatible con mouse, touch y Apple Pencil.
function setupWhiteboardCanvas() {
    const canvas = $('consulta-whiteboard');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let dibujando = false;
    function coordenadas(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (canvas.width / rect.width),
            y: (e.clientY - rect.top) * (canvas.height / rect.height)
        };
    }
    function prepararTrazo() {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = whiteboardHerramienta === 'borrador' ? whiteboardGrosor * 4 : whiteboardGrosor;
        ctx.globalCompositeOperation = whiteboardHerramienta === 'borrador' ? 'destination-out' : 'source-over';
    }
    canvas.addEventListener('pointerdown', e => {
        dibujando = true;
        canvas.setPointerCapture?.(e.pointerId);
        prepararTrazo();
        const punto = coordenadas(e);
        ctx.beginPath();
        ctx.moveTo(punto.x, punto.y);
        e.preventDefault();
    });
    canvas.addEventListener('pointermove', e => {
        if (!dibujando) return;
        prepararTrazo();
        const punto = coordenadas(e);
        ctx.lineTo(punto.x, punto.y);
        ctx.stroke();
        whiteboardTieneContenido = true;
        e.preventDefault();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(evento => {
        canvas.addEventListener(evento, e => {
            if (!dibujando) return;
            dibujando = false;
            ctx.closePath();
            canvas.releasePointerCapture?.(e.pointerId);
        });
    });
}

function cambiarHerramientaWhiteboard(herramienta) {
    whiteboardHerramienta = herramienta;
    const activo = 'p-2 bg-slate-900 text-white rounded-lg border border-slate-900';
    const inactivo = 'p-2 bg-white text-slate-600 rounded-lg border border-slate-200';
    if ($('btn-whiteboard-lapiz')) $('btn-whiteboard-lapiz').className = herramienta === 'lapiz' ? activo : inactivo;
    if ($('btn-whiteboard-borrador')) $('btn-whiteboard-borrador').className = herramienta === 'borrador' ? activo : inactivo;
}

function cambiarGrosorWhiteboard(valor) {
    whiteboardGrosor = parseInt(valor) || 4;
}

function limpiarWhiteboard() {
    const canvas = $('consulta-whiteboard');
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    whiteboardTieneContenido = false;
}

function obtenerWhiteboardDataUrl() {
    const canvas = $('consulta-whiteboard');
    if (!canvas || !whiteboardTieneContenido) return '';
    return canvas.toDataURL('image/png');
}
