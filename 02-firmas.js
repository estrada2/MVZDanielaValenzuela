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
        return { x: clienteX - rect.left, y: clienteY - rect.top };
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
