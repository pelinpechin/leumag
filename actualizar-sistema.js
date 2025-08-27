// Script para actualizar el sistema eliminando funciones obsoletas
// y agregando el estado de cuotas pendientes

const fs = require('fs');

function actualizarSistema() {
    console.log('🔧 ACTUALIZANDO SISTEMA DE TESORERÍA\n');
    
    try {
        // Leer el script actual
        let scriptContent = fs.readFileSync('script.js', 'utf-8');
        
        console.log('📝 Eliminando funciones obsoletas...');
        
        // 1. Eliminar función de recarga de Supabase
        scriptContent = scriptContent.replace(
            /async function recargarDatosSupabase\(\) \{[\s\S]*?\n\}/g, 
            ''
        );
        
        // 2. Eliminar función de ajustes permanentes
        scriptContent = scriptContent.replace(
            /function aplicarAjustesPermanentesExistentes\(\) \{[\s\S]*?\n\}/g, 
            ''
        );
        
        // 3. Eliminar función de ajustes específicos
        scriptContent = scriptContent.replace(
            /function aplicarAjustesEspecificos\(\) \{[\s\S]*?\n\}/g, 
            ''
        );
        
        // 4. Eliminar función de migración automática
        scriptContent = scriptContent.replace(
            /async function migrarAutomaticamente\(\) \{[\s\S]*?\n\}/g, 
            ''
        );
        
        // 5. Eliminar código de conversión de botón migrar
        scriptContent = scriptContent.replace(
            /\/\/ Cambiar el botón de migración por botón de recarga[\s\S]*?\}/g, 
            ''
        );
        
        // 6. Eliminar referencias a ajustes permanentes
        scriptContent = scriptContent.replace(
            /aplicarAjustesPermanentesExistentes\(\);/g, 
            ''
        );
        
        console.log('✅ Funciones obsoletas eliminadas');
        
        // 7. Agregar función para mostrar estado de cuotas
        const estadoCuotasFunction = `
// Función para obtener el estado de una cuota específica
function obtenerEstadoCuota(alumno, numeroCuota) {
    const montoCuota = alumno[\`cuota_\${numeroCuota}\`] || 0;
    const montoEsperado = Math.ceil(alumno.arancel / 10); // Dividir arancel en 10 cuotas aproximadamente
    
    if (montoCuota >= montoEsperado) {
        return { estado: 'pagada', clase: 'bg-success text-white', icono: '✅' };
    } else if (montoCuota > 0) {
        return { estado: 'parcial', clase: 'bg-warning text-dark', icono: '⚠️' };
    } else {
        return { estado: 'pendiente', clase: 'bg-danger text-white', icono: '❌' };
    }
}

// Función para mostrar el detalle de cuotas en el modal
function mostrarDetalleCuotas(alumno) {
    let htmlCuotas = '<div class="row">';
    
    for (let i = 1; i <= 10; i++) {
        const estadoCuota = obtenerEstadoCuota(alumno, i);
        const montoCuota = alumno[\`cuota_\${i}\`] || 0;
        
        htmlCuotas += \`
            <div class="col-md-6 col-lg-4 mb-2">
                <div class="card \${estadoCuota.clase} border-0">
                    <div class="card-body py-2 px-3">
                        <div class="d-flex justify-content-between align-items-center">
                            <span><strong>Cuota \${i}</strong></span>
                            <span>\${estadoCuota.icono}</span>
                        </div>
                        <div class="small">
                            \${montoCuota > 0 ? \`$\${montoCuota.toLocaleString()}\` : 'Pendiente'}
                        </div>
                    </div>
                </div>
            </div>
        \`;
    }
    
    htmlCuotas += '</div>';
    return htmlCuotas;
}

// Actualizar la función existente para mostrar el detalle del alumno
function actualizarModalDetalleAlumno(alumno) {
    const modalBody = document.querySelector('#modalDetalleAlumno .modal-body');
    if (!modalBody) return;
    
    // Calcular estadísticas de cuotas
    let cuotasPagadas = 0;
    let cuotasParciales = 0;
    let cuotasPendientes = 0;
    
    for (let i = 1; i <= 10; i++) {
        const estadoCuota = obtenerEstadoCuota(alumno, i);
        switch (estadoCuota.estado) {
            case 'pagada': cuotasPagadas++; break;
            case 'parcial': cuotasParciales++; break;
            case 'pendiente': cuotasPendientes++; break;
        }
    }
    
    // Agregar resumen de cuotas al modal existente
    const resumenCuotas = \`
        <div class="mt-3">
            <h6>📊 Resumen de Cuotas</h6>
            <div class="row text-center">
                <div class="col-4">
                    <div class="badge bg-success fs-6">✅ \${cuotasPagadas}</div>
                    <div class="small">Pagadas</div>
                </div>
                <div class="col-4">
                    <div class="badge bg-warning fs-6">⚠️ \${cuotasParciales}</div>
                    <div class="small">Parciales</div>
                </div>
                <div class="col-4">
                    <div class="badge bg-danger fs-6">❌ \${cuotasPendientes}</div>
                    <div class="small">Pendientes</div>
                </div>
            </div>
        </div>
        
        <div class="mt-3">
            <h6>💳 Detalle de Cuotas</h6>
            \${mostrarDetalleCuotas(alumno)}
        </div>
    \`;
    
    // Buscar si ya existe el resumen y reemplazarlo, o agregarlo
    const existingResumen = modalBody.querySelector('.mt-3 h6');
    if (existingResumen && existingResumen.textContent.includes('Resumen de Cuotas')) {
        // Reemplazar el resumen existente
        const parent = existingResumen.closest('.mt-3');
        parent.innerHTML = resumenCuotas;
    } else {
        // Agregar al final del modal
        modalBody.insertAdjacentHTML('beforeend', resumenCuotas);
    }
}
`;
        
        // Agregar las nuevas funciones al final del archivo
        scriptContent += estadoCuotasFunction;
        
        console.log('✅ Estado de cuotas agregado');
        
        // 8. Crear backup del archivo original
        fs.writeFileSync('script-backup.js', fs.readFileSync('script.js', 'utf-8'));
        console.log('📦 Backup creado: script-backup.js');
        
        // 9. Escribir el archivo actualizado
        fs.writeFileSync('script.js', scriptContent);
        
        console.log('\n🎉 SISTEMA ACTUALIZADO EXITOSAMENTE');
        console.log('\n✅ Cambios realizados:');
        console.log('   • Eliminadas funciones de migración obsoletas');
        console.log('   • Eliminadas funciones de recarga desde Supabase');
        console.log('   • Eliminadas funciones de ajustes específicos');
        console.log('   • Agregado sistema de estado de cuotas pendientes');
        console.log('   • Agregado detalle visual de cuotas por alumno');
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

actualizarSistema();