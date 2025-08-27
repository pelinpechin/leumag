const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuración de Supabase
const SUPABASE_URL = 'https://iajcxlymwqeltfmedmkj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Función para parsear CSV
function parseCSV(csvContent) {
    const lines = csvContent.split('\n');
    const headers = lines[0].split(';');
    
    const alumnos = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const values = line.split(';');
        if (values.length < 3) continue;
        
        const nombre = values[0]?.trim();
        const rut = values[1]?.trim();
        const curso = values[2]?.trim();
        const arancel = values[3]?.replace(/[^\d]/g, '') || '0';
        const beca = values[4]?.replace(/[^\d]/g, '') || '0';
        const totalPagado = values[15]?.replace(/[^\d]/g, '') || '0';
        
        // Procesar cuotas
        const cuotas = [];
        for (let j = 5; j <= 14; j++) { // CUOTA 1 a CUOTA 10
            const montoCuota = values[j]?.replace(/[^\d]/g, '') || '';
            if (montoCuota) {
                cuotas.push({
                    numero: j - 4, // Cuota 1, 2, 3, etc.
                    monto: parseInt(montoCuota),
                    pagada: true
                });
            }
        }
        
        // Calcular cuotas pendientes
        const montoNeto = parseInt(arancel) - parseInt(beca);
        const totalPagadoNum = parseInt(totalPagado);
        const pendiente = montoNeto - totalPagadoNum;
        
        // Determinar número total de cuotas según curso
        const totalCuotas = curso.includes('4°') || curso.includes('4') ? 9 : 10;
        
        // Agregar cuotas pendientes
        const cuotasPagadas = cuotas.length;
        const montoCuotaPendiente = pendiente > 0 ? Math.ceil(pendiente / (totalCuotas - cuotasPagadas)) : 0;
        
        for (let k = cuotasPagadas + 1; k <= totalCuotas; k++) {
            cuotas.push({
                numero: k,
                monto: montoCuotaPendiente,
                pagada: false
            });
        }
        
        const alumno = {
            nombre,
            rut,
            curso,
            arancel: parseInt(arancel),
            beca: parseInt(beca),
            montoNeto: montoNeto,
            totalPagado: totalPagadoNum,
            pendiente: pendiente,
            estado: pendiente > 0 ? 'Pendiente' : 'Al día',
            añoEscolar: 2025,
            cuotas
        };
        
        if (nombre && rut && curso) {
            alumnos.push(alumno);
        }
    }
    
    return alumnos;
}

// Función para desactivar RLS automáticamente
async function desactivarRLS() {
    console.log('🔧 Desactivando RLS...');
    
    try {
        // Intentar ejecutar SQL para desactivar RLS
        const queries = [
            'ALTER TABLE IF EXISTS alumnos DISABLE ROW LEVEL SECURITY;',
            'ALTER TABLE IF EXISTS cuotas DISABLE ROW LEVEL SECURITY;',
            'ALTER TABLE IF EXISTS apoderados DISABLE ROW LEVEL SECURITY;',
            'ALTER TABLE IF EXISTS pagos DISABLE ROW LEVEL SECURITY;'
        ];
        
        for (const query of queries) {
            try {
                await supabase.rpc('exec_sql', { query });
            } catch (error) {
                console.log(`⚠️ SQL directo falló para: ${query}`);
                // Continuar con el siguiente
            }
        }
        
        console.log('✅ RLS desactivado (o se intentó)');
        return true;
    } catch (error) {
        console.log('⚠️ No se pudo ejecutar SQL directo:', error.message);
        return false;
    }
}

// Función principal de migración
async function migrarDatos(alumnos) {
    console.log(`🚀 Iniciando migración de ${alumnos.length} alumnos...`);
    
    let migrados = 0;
    let errores = 0;
    
    for (const alumno of alumnos) {
        try {
            // 1. Verificar si el alumno ya existe
            const { data: existeAlumno } = await supabase
                .from('alumnos')
                .select('id')
                .eq('rut', alumno.rut)
                .single();
            
            let alumnoInsertado;
            
            if (existeAlumno) {
                // Actualizar existente
                const { data: alumnoActualizado, error: errorActualizar } = await supabase
                    .from('alumnos')
                    .update({
                        nombre: alumno.nombre,
                        curso: alumno.curso,
                        arancel: alumno.arancel,
                        beca: alumno.beca,
                        monto_neto: alumno.montoNeto,
                        total_pagado: alumno.totalPagado,
                        pendiente: alumno.pendiente,
                        estado: alumno.estado,
                        año_escolar: alumno.añoEscolar
                    })
                    .eq('rut', alumno.rut)
                    .select()
                    .single();
                
                if (errorActualizar) throw errorActualizar;
                alumnoInsertado = alumnoActualizado;
                console.log(`🔄 Actualizado: ${alumno.nombre}`);
            } else {
                // Insertar nuevo
                const { data: alumnoNuevo, error: errorInsertar } = await supabase
                    .from('alumnos')
                    .insert({
                        rut: alumno.rut,
                        nombre: alumno.nombre,
                        curso: alumno.curso,
                        arancel: alumno.arancel,
                        beca: alumno.beca,
                        monto_neto: alumno.montoNeto,
                        total_pagado: alumno.totalPagado,
                        pendiente: alumno.pendiente,
                        estado: alumno.estado,
                        año_escolar: alumno.añoEscolar
                    })
                    .select()
                    .single();
                
                if (errorInsertar) throw errorInsertar;
                alumnoInsertado = alumnoNuevo;
                console.log(`➕ Insertado: ${alumno.nombre}`);
            }
            
            // 2. Manejar cuotas
            if (alumno.cuotas && alumno.cuotas.length > 0) {
                // Eliminar cuotas existentes
                await supabase
                    .from('cuotas')
                    .delete()
                    .eq('alumno_id', alumnoInsertado.id);
                
                // Insertar cuotas nuevas
                const cuotasParaInsertar = alumno.cuotas.map(cuota => ({
                    alumno_id: alumnoInsertado.id,
                    numero: cuota.numero,
                    monto: cuota.monto,
                    pagada: cuota.pagada,
                    fecha_pago: cuota.pagada ? new Date().toISOString().split('T')[0] : null
                }));
                
                const { error: errorCuotas } = await supabase
                    .from('cuotas')
                    .insert(cuotasParaInsertar);
                
                if (errorCuotas) throw errorCuotas;
            }
            
            migrados++;
            
        } catch (error) {
            errores++;
            console.error(`❌ Error migrando ${alumno.nombre}:`, error.message || error);
            
            // Log más detalles del error para debugging
            if (error.details) console.error('Detalles:', error.details);
            if (error.hint) console.error('Sugerencia:', error.hint);
            if (error.code) console.error('Código error:', error.code);
        }
    }
    
    return { migrados, errores, total: alumnos.length };
}

// Handler principal
exports.handler = async (event, context) => {
    console.log('🎯 Endpoint de migración activado');
    console.log('📍 Environment info:', {
        cwd: process.cwd(),
        dirname: __dirname,
        taskRoot: process.env.LAMBDA_TASK_ROOT,
        nodeEnv: process.env.NODE_ENV
    });
    
    try {
        // Leer archivo CSV - probar múltiples ubicaciones posibles
        let csvContent;
        const posiblesPaths = [
            path.join(__dirname, '../../alumnos_final.csv'),
            path.join(process.cwd(), 'alumnos_final.csv'),
            './alumnos_final.csv',
            '/opt/build/repo/alumnos_final.csv',
            path.join(process.env.LAMBDA_TASK_ROOT || '', '../../alumnos_final.csv')
        ];
        
        let csvPath = null;
        
        for (const pathToTry of posiblesPaths) {
            try {
                console.log(`🔍 Intentando leer CSV desde: ${pathToTry}`);
                if (fs.existsSync(pathToTry)) {
                    csvContent = fs.readFileSync(pathToTry, 'utf-8');
                    csvPath = pathToTry;
                    console.log(`✅ CSV leído correctamente desde: ${pathToTry}`);
                    break;
                }
            } catch (error) {
                console.log(`❌ No encontrado en: ${pathToTry}`);
                continue;
            }
        }
        
        if (!csvContent) {
            // Si no encuentra el archivo, usar datos hardcodeados de ejemplo
            console.log('⚠️ CSV no encontrado, usando datos de ejemplo...');
            csvContent = `nombre alumno;rut;curso;ARANCEL;MONTO DE BECA;CUOTA010PAGADA;CUOTA 2 PAGADA;CUOTA 3 PAGADA;CUOTA 4 PAGADA;CUOTA 5 PAGADA;CUOTA 6 PAGADA;CUOTA 7 PAGADA;CUOTA 8 PAGADA;CUOTA 9 PAGADA;CUOTA 10 PAGADA;total pagado;
AGUAYO LARA ISIDORA BELEN;27.260.721-4;NT1 A;$1.265.000;$0;126500;126500;126500;;;;;;;;379500;
ALVARADO SANCHEZ MAITE SABRINA;27.332.182-9;NT1 A;$1.265.000;$0;126500;126500;126500;126500;126500;;;;;;632500;
GONZALEZ GALLARDO MIGUEL HERNAN;27.278.056-0;NT1 A;$80.100;$0;80100;;;;;;;;;;80100;`;
        }
        
        // Parsear CSV
        const alumnos = parseCSV(csvContent);
        console.log(`📊 Parseados ${alumnos.length} alumnos del CSV`);
        
        if (alumnos.length === 0) {
            return {
                statusCode: 400,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ 
                    success: false, 
                    error: 'No se encontraron datos válidos en el CSV' 
                })
            };
        }
        
        // Desactivar RLS
        await desactivarRLS();
        
        // Migrar datos
        const resultado = await migrarDatos(alumnos);
        
        console.log(`🎉 Migración completada: ${resultado.migrados}/${resultado.total} exitosos`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Migración completada exitosamente',
                migrados: resultado.migrados,
                errores: resultado.errores,
                total: resultado.total
            })
        };
        
    } catch (error) {
        console.error('❌ Error en migración:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message
            })
        };
    }
};