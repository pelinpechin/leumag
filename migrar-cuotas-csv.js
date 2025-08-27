const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_CONFIG = {
    url: 'https://iajcxlymwqeltfmedmkj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk'
};

function parseCSVCuotas(csvContent) {
    const lines = csvContent.split('\n');
    const students = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('totales') || line === ';;;;;;;;;;;;;;;') continue;
        
        const values = line.split(';');
        if (values.length < 3) continue;
        
        const nombre = values[0]?.trim();
        const rut = values[1]?.trim();
        const curso = values[2]?.trim();
        
        if (nombre && rut && curso) {
            // Extraer cuotas (columnas 5-14)
            const cuotas = {};
            for (let j = 1; j <= 10; j++) {
                const cuotaIndex = j + 4; // cuota_1 está en índice 5, cuota_2 en 6, etc.
                const cuotaValue = values[cuotaIndex] && values[cuotaIndex].trim() !== '' 
                    ? parseInt(values[cuotaIndex].trim()) 
                    : 0;
                cuotas[`cuota_${j}`] = cuotaValue;
            }
            
            // Calcular total
            const totalCalculado = Object.values(cuotas).reduce((sum, value) => sum + value, 0);
            
            students.push({
                nombre,
                rut: rut.replace(/[.-]/g, ''),
                rutFormateado: rut,
                curso,
                cuotas,
                totalCalculado,
                linea: i + 1
            });
        }
    }
    
    return students;
}

async function migrarCuotasCSV() {
    console.log('🔄 MIGRACIÓN DE CUOTAS DEL CSV A SUPABASE\n');
    
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    try {
        // 1. Leer y parsear CSV
        console.log('📁 Leyendo CSV...');
        const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
        const alumnosCSV = parseCSVCuotas(csvContent);
        console.log(`✅ CSV parseado: ${alumnosCSV.length} alumnos\n`);
        
        // 2. Obtener alumnos de Supabase
        console.log('📡 Obteniendo alumnos de Supabase...');
        const { data: alumnosSupabase, error: fetchError } = await supabase
            .from('alumnos')
            .select('id, rut, nombre, curso')
            .order('nombre');
            
        if (fetchError) throw fetchError;
        console.log(`✅ Supabase consultado: ${alumnosSupabase.length} alumnos\n`);
        
        // 3. Crear mapa de Supabase por RUT
        const mapaSupabase = new Map();
        alumnosSupabase.forEach(alumno => {
            mapaSupabase.set(alumno.rut.replace(/[.-]/g, ''), alumno);
        });
        
        console.log('🔄 Iniciando migración de cuotas...\n');
        
        let actualizados = 0;
        let errores = 0;
        let noEncontrados = 0;
        
        // 4. Actualizar cada alumno
        for (let i = 0; i < alumnosCSV.length; i++) {
            const alumnoCSV = alumnosCSV[i];
            const alumnoSupabase = mapaSupabase.get(alumnoCSV.rut);
            
            if (!alumnoSupabase) {
                console.log(`❌ No encontrado: ${alumnoCSV.nombre} (${alumnoCSV.rutFormateado})`);
                noEncontrados++;
                continue;
            }
            
            try {
                // Preparar datos para actualizar
                const updateData = {
                    ...alumnoCSV.cuotas,
                    // El trigger se encargará de recalcular total_pagado y pendiente
                    updated_at: new Date().toISOString()
                };
                
                // Actualizar en Supabase
                const { error: updateError } = await supabase
                    .from('alumnos')
                    .update(updateData)
                    .eq('id', alumnoSupabase.id);
                
                if (updateError) {
                    console.log(`❌ Error actualizando ${alumnoCSV.nombre}: ${updateError.message}`);
                    errores++;
                } else {
                    actualizados++;
                    if (actualizados % 50 === 0) {
                        console.log(`✅ Actualizados: ${actualizados}/${alumnosCSV.length}`);
                    }
                }
                
            } catch (error) {
                console.log(`❌ Error procesando ${alumnoCSV.nombre}: ${error.message}`);
                errores++;
            }
            
            // Pequeña pausa para no sobrecargar la API
            if (i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        
        console.log('\n📊 RESUMEN DE LA MIGRACIÓN:');
        console.log(`Total alumnos CSV: ${alumnosCSV.length}`);
        console.log(`Actualizados exitosamente: ${actualizados}`);
        console.log(`No encontrados en Supabase: ${noEncontrados}`);
        console.log(`Errores: ${errores}`);
        
        if (actualizados > 0) {
            console.log('\n✅ Migración de cuotas completada');
            console.log('📝 Los totales y pendientes se recalcularon automáticamente');
        }
        
        // 5. Generar SQL de respaldo si hay errores
        if (errores > 0 || noEncontrados > 0) {
            console.log('\n📄 Generando SQL de respaldo para casos con error...');
            
            const sqlStatements = [];
            
            alumnosCSV.forEach(alumno => {
                const alumnoSupabase = mapaSupabase.get(alumno.rut);
                if (alumnoSupabase) {
                    const cuotasSQL = Object.entries(alumno.cuotas)
                        .map(([cuota, valor]) => `${cuota} = ${valor}`)
                        .join(', ');
                    
                    sqlStatements.push(
                        `UPDATE alumnos SET ${cuotasSQL}, updated_at = NOW() WHERE id = '${alumnoSupabase.id}';`
                    );
                }
            });
            
            fs.writeFileSync('migrar-cuotas-respaldo.sql', sqlStatements.join('\n'));
            console.log('✅ SQL de respaldo guardado en: migrar-cuotas-respaldo.sql');
        }
        
    } catch (error) {
        console.error('❌ Error en la migración:', error);
    }
}

migrarCuotasCSV();