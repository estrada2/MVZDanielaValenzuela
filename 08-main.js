document.addEventListener('DOMContentLoaded', async () => {
    await initPersistentStorage();
    document.addEventListener('click', (e) => {
        const wrapper = $('dropdown-servicios-wrapper');
        const panel = $('dropdown-servicios-opciones');
        if (wrapper && !wrapper.contains(e.target)) {
            panel?.classList.add('hidden');
        }
    });
    renderClientes(); 
    renderAgenda(); 
    renderInventario(); 
    renderFinanzas(); 
    renderGananciasConsultas();
    actualizarSelectAgenda(); 
    revisarAlertasStockGlobal(); 
    setupSignatureCanvas('canvas-firma'); 
    setupSignatureCanvas('canvas-firma-vet');
    renderIcons();
});
function regresarAlDirectorioDesdeConsulta() {
    switchTab('clientes');
    $('subpagina-mascotas-area')?.classList.add('hidden');
    $('directorio-clientes-area')?.classList.remove('hidden');
    consultaSeleccionada = { ownerId: null, petId: null, ownerObj: null, petObj: null };
    if($('consulta-paciente-nombre')) {
        $('consulta-paciente-nombre').innerText = "Ninguno seleccionado";
    }
    renderClientes();
}
