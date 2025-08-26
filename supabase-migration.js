// ==================================================
// FUNCIONES DE MIGRACIÓN A SUPABASE
// ==================================================

// Función para obtener el cliente de Supabase
function getSupabaseClient() {
    return window.supabaseClient || supabase;
}

// Función para corregir políticas RLS usando SQL directo
async function corregirRLS() {
    const client = getSupabaseClient();
    if (!client) return false;
    
    try {
        console.log('🔧 Corrigiendo políticas RLS...');
        
        // Ejecutar SQL para permitir acceso completo temporalmente
        const { error } = await client.rpc('exec_sql', {
            query: `
                -- Desactivar RLS temporalmente
                ALTER TABLE alumnos DISABLE ROW LEVEL SECURITY;
                ALTER TABLE cuotas DISABLE ROW LEVEL SECURITY;
                ALTER TABLE apoderados DISABLE ROW LEVEL SECURITY;
                ALTER TABLE pagos DISABLE ROW LEVEL SECURITY;
            `
        });
        
        if (error) {
            console.warn('⚠️ No se pudo ejecutar SQL directo:', error.message);
            return false;
        }
        
        console.log('✅ RLS desactivado temporalmente');
        return true;
    } catch (error) {
        console.warn('⚠️ Error corrigiendo RLS:', error);
        return false;
    }
}

// Función para migrar datos del CSV a Supabase
async function migrarDatosASupabase() {
    // Intentar inicializar si no está listo
    if (!isSupabaseReady()) {
        if (window.initializeSupabase) {
            window.initializeSupabase();
            // Esperar un poco para la inicialización
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    const client = getSupabaseClient();
    if (!client) {
        alert('⚠️ Supabase no está configurado. Revisa supabase-config.js');
        return;
    }
    
    // Mostrar instrucciones para RLS
    const proceder = confirm(`⚠️ ANTES DE MIGRAR:

Para que funcione la migración, necesitas ejecutar este SQL en Supabase:

1. Ve a tu proyecto en Supabase
2. Abre "SQL Editor"  
3. Ejecuta este comando:

ALTER TABLE alumnos DISABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas DISABLE ROW LEVEL SECURITY;
ALTER TABLE apoderados DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos DISABLE ROW LEVEL SECURITY;

¿Ya ejecutaste el SQL y quieres proceder?`);
    
    if (!proceder) {
        alert('👉 Ve a Supabase SQL Editor, ejecuta el comando y luego intenta migrar de nuevo.');
        return;
    }

    try {
        console.log('🚀 Iniciando migración a Supabase...');
        
        if (datosAlumnos.length === 0) {
            alert('No hay datos para migrar. Primero carga el CSV.');
            return;
        }

        let migrados = 0;
        let errores = 0;

        for (const alumno of datosAlumnos) {
            try {
                // 1. Insertar o actualizar alumno
                let alumnoInsertado;
                
                // Primero verificar si existe
                const { data: existeAlumno } = await client
                    .from('alumnos')
                    .select('id')
                    .eq('rut', alumno.rut)
                    .single();

                if (existeAlumno) {
                    // Ya existe - actualizar
                    const { data: alumnoActualizado, error: errorActualizar } = await client
                        .from('alumnos')
                        .update({
                            nombre: alumno.nombre,
                            curso: alumno.curso,
                            arancel: alumno.arancel,
                            beca: alumno.beca,
                            total_pagado: alumno.totalPagado || 0,
                            pendiente: alumno.pendiente || 0,
                            estado: alumno.estado,
                            año_escolar: alumno.añoEscolar || 2025
                        })
                        .eq('rut', alumno.rut)
                        .select()
                        .single();

                    if (errorActualizar) throw errorActualizar;
                    alumnoInsertado = alumnoActualizado;
                    console.log(`🔄 Actualizado: ${alumno.nombre}`);
                } else {
                    // No existe - insertar nuevo
                    const { data: alumnoNuevo, error: errorInsertar } = await client
                        .from('alumnos')
                        .insert({
                            rut: alumno.rut,
                            nombre: alumno.nombre,
                            curso: alumno.curso,
                            arancel: alumno.arancel,
                            beca: alumno.beca,
                            total_pagado: alumno.totalPagado || 0,
                            pendiente: alumno.pendiente || 0,
                            estado: alumno.estado,
                            año_escolar: alumno.añoEscolar || 2025
                        })
                        .select()
                        .single();

                    if (errorInsertar) throw errorInsertar;
                    alumnoInsertado = alumnoNuevo;
                    console.log(`➕ Insertado: ${alumno.nombre}`);
                }

                // 2. Insertar o actualizar cuotas
                if (alumno.cuotas && alumno.cuotas.length > 0) {
                    // Eliminar cuotas existentes para este alumno
                    await client
                        .from('cuotas')
                        .delete()
                        .eq('alumno_id', alumnoInsertado.id);

                    // Insertar cuotas nuevas
                    const cuotasParaInsertar = alumno.cuotas.map((cuota, index) => ({
                        alumno_id: alumnoInsertado.id,
                        numero: index + 1,
                        monto: cuota.monto || 0,
                        pagada: cuota.pagada || false,
                        fecha_pago: cuota.pagada ? new Date().toISOString().split('T')[0] : null
                    }));

                    const { error: errorCuotas } = await client
                        .from('cuotas')
                        .insert(cuotasParaInsertar);

                    if (errorCuotas) throw errorCuotas;
                }

                // 3. Insertar o actualizar apoderado
                if (alumno.apoderado || alumno.correoApoderado) {
                    // Eliminar apoderados existentes para este alumno
                    await client
                        .from('apoderados')
                        .delete()
                        .eq('alumno_id', alumnoInsertado.id);

                    // Insertar apoderado nuevo
                    const { error: errorApoderado } = await client
                        .from('apoderados')
                        .insert({
                            alumno_id: alumnoInsertado.id,
                            nombre: alumno.apoderado || 'Sin información',
                            email: alumno.correoApoderado || null
                        });

                    if (errorApoderado) console.warn('Error insertando apoderado:', errorApoderado);
                }

                migrados++;
                console.log(`✅ Migrado: ${alumno.nombre} (${migrados}/${datosAlumnos.length})`);

            } catch (error) {
                errores++;
                console.error(`❌ Error migrando ${alumno.nombre}:`, error.message || error);
                
                // Continuar con el siguiente alumno sin detener el proceso
                console.log(`⏭️ Continuando con siguiente alumno...`);
            }
        }

        // Mostrar resultado
        alert(`🎉 Migración completada!
        
✅ Migrados exitosamente: ${migrados}
❌ Errores (duplicados): ${errores}
📊 Total procesados: ${datosAlumnos.length}

Los datos ahora están en Supabase y se sincronizarán automáticamente.`);

        console.log(`🎉 Migración completada: ${migrados}/${datosAlumnos.length} alumnos migrados`);

        // Opcional: cambiar a modo Supabase automáticamente
        if (migrados > 0) {
            const usar = confirm('¿Deseas cambiar a usar Supabase ahora? (Recomendado)');
            if (usar) {
                await cargarDatosDesdeSupabase();
            }
        }

    } catch (error) {
        console.error('❌ Error en migración:', error);
        alert(`Error durante la migración: ${error.message}`);
    }
}

// Función para cargar datos desde Supabase
async function cargarDatosDesdeSupabase() {
    const client = getSupabaseClient();
    if (!client) {
        console.log('⚠️ Supabase no configurado, usando localStorage');
        return false;
    }

    try {
        console.log('📡 Cargando datos desde Supabase...');

        // Cargar alumnos con sus cuotas y apoderados
        const { data: alumnos, error } = await client
            .from('alumnos')
            .select(`
                *,
                cuotas (*),
                apoderados (*)
            `)
            .eq('año_escolar', 2025)
            .order('nombre');

        if (error) throw error;

        if (alumnos && alumnos.length > 0) {
            // Convertir formato de Supabase al formato local
            datosAlumnos = alumnos.map(alumno => ({
                id: alumno.id,
                nombre: alumno.nombre,
                rut: alumno.rut,
                curso: alumno.curso,
                arancel: alumno.arancel,
                beca: alumno.beca,
                montoNeto: alumno.monto_neto,
                totalPagado: alumno.total_pagado,
                totalPagadoReal: alumno.total_pagado,
                pendiente: alumno.pendiente,
                estado: alumno.estado,
                añoEscolar: alumno.año_escolar,
                
                // Convertir cuotas
                cuotas: (alumno.cuotas || [])
                    .sort((a, b) => a.numero - b.numero)
                    .map(cuota => ({
                        numero: cuota.numero,
                        monto: cuota.monto,
                        pagada: cuota.pagada,
                        fechaPago: cuota.fecha_pago,
                        metodoPago: cuota.metodo_pago
                    })),
                
                // Información del apoderado
                apoderado: alumno.apoderados?.[0]?.nombre || '',
                correoApoderado: alumno.apoderados?.[0]?.email || ''
            }));

            console.log(`✅ Cargados ${datosAlumnos.length} alumnos desde Supabase`);
            
            // Actualizar interfaz
            actualizarCursos();
            aplicarFiltros();
            actualizarEstadisticas();
            
            // Mostrar indicador de Supabase activo
            mostrarEstadoSupabase(true);
            
            return true;
        }

        return false;

    } catch (error) {
        console.error('❌ Error cargando desde Supabase:', error);
        return false;
    }
}

// Función para actualizar un pago en Supabase
async function actualizarPagoSupabase(rutAlumno, numeroCuota, pagada, monto = 0, metodoPago = 'efectivo') {
    const client = getSupabaseClient();
    if (!client) {
        console.log('Supabase no disponible, usando método local');
        return false;
    }

    try {
        // 1. Buscar el alumno
        const { data: alumno } = await client
            .from('alumnos')
            .select('id')
            .eq('rut', rutAlumno)
            .single();

        if (!alumno) throw new Error('Alumno no encontrado');

        // 2. Actualizar la cuota
        const { error: errorCuota } = await client
            .from('cuotas')
            .update({
                pagada: pagada,
                fecha_pago: pagada ? new Date().toISOString().split('T')[0] : null,
                metodo_pago: pagada ? metodoPago : null
            })
            .eq('alumno_id', alumno.id)
            .eq('numero', numeroCuota);

        if (errorCuota) throw errorCuota;

        // 3. Si es un pago, registrar en historial
        if (pagada && monto > 0) {
            const { error: errorPago } = await client
                .from('pagos')
                .insert({
                    alumno_id: alumno.id,
                    monto: monto,
                    metodo_pago: metodoPago,
                    usuario: 'Sistema'
                });

            if (errorPago) console.warn('Error registrando pago en historial:', errorPago);
        }

        console.log(`✅ Pago actualizado en Supabase: ${rutAlumno} - Cuota ${numeroCuota}`);
        
        // Recargar datos para sincronizar
        await cargarDatosDesdeSupabase();
        
        return true;

    } catch (error) {
        console.error('❌ Error actualizando pago en Supabase:', error);
        return false;
    }
}

// Función para mostrar estado de conexión con Supabase
function mostrarEstadoSupabase(conectado) {
    // Crear o actualizar indicador
    let indicador = document.getElementById('indicadorSupabase');
    
    if (!indicador) {
        indicador = document.createElement('div');
        indicador.id = 'indicadorSupabase';
        indicador.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            z-index: 1000;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(indicador);
    }

    if (conectado) {
        indicador.innerHTML = '🟢 Supabase Conectado';
        indicador.style.backgroundColor = '#d4edda';
        indicador.style.color = '#155724';
        indicador.style.border = '1px solid #c3e6cb';
    } else {
        indicador.innerHTML = '🟡 Modo Local';
        indicador.style.backgroundColor = '#fff3cd';
        indicador.style.color = '#856404';
        indicador.style.border = '1px solid #ffeaa7';
    }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // Intentar cargar desde Supabase primero
    setTimeout(async () => {
        const cargadoSupabase = await cargarDatosDesdeSupabase();
        if (!cargadoSupabase) {
            mostrarEstadoSupabase(false);
        }
    }, 1000);
});

// Exportar funciones para uso global
window.migrarDatosASupabase = migrarDatosASupabase;
window.cargarDatosDesdeSupabase = cargarDatosDesdeSupabase;
window.actualizarPagoSupabase = actualizarPagoSupabase;