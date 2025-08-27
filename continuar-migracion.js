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
            const cuotas = {};
            for (let j = 1; j <= 10; j++) {
                const cuotaIndex = j + 4;
                const cuotaValue = values[cuotaIndex] && values[cuotaIndex].trim() !== '' 
                    ? parseInt(values[cuotaIndex].trim()) 
                    : 0;
                cuotas[`cuota_${j}`] = cuotaValue;
            }
            
            students.push({
                nombre,
                rut: rut.replace(/[.-]/g, ''),
                rutFormateado: rut,
                curso,
                cuotas
            });
        }
    }
    
    return students;
}

async function continuarMigracion() {
    console.log('🔄 CONTINUANDO MIGRACIÓN DE CUOTAS\n');
    
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    try {
        // 1. Leer CSV
        const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
        const alumnosCSV = parseCSVCuotas(csvContent);
        console.log(`📁 CSV: ${alumnosCSV.length} alumnos`);
        
        // 2. Obtener alumnos de Supabase que necesitan migración
        const { data: alumnosSupabase, error } = await supabase
            .from('alumnos')
            .select('id, rut, nombre, cuota_1, cuota_2, cuota_3, cuota_4, cuota_5')
            .order('nombre');
            
        if (error) throw error;
        console.log(`📡 Supabase: ${alumnosSupabase.length} alumnos`);
        
        // 3. Identificar alumnos que necesitan migración (cuotas en 0)
        const mapaSupabase = new Map();
        let necesitanMigracion = 0;
        
        alumnosSupabase.forEach(alumno => {
            const rutLimpio = alumno.rut.replace(/[.-]/g, '');
            mapaSupabase.set(rutLimpio, alumno);
            
            // Verificar si necesita migración (todas las cuotas en 0)
            const sumaCuotas = (alumno.cuota_1 || 0) + (alumno.cuota_2 || 0) + 
                             (alumno.cuota_3 || 0) + (alumno.cuota_4 || 0) + (alumno.cuota_5 || 0);
            if (sumaCuotas === 0) {
                necesitanMigracion++;
            }
        });
        
        console.log(`🎯 Alumnos que necesitan migración: ${necesitanMigracion}\n`);
        
        let actualizados = 0;
        let yaActualizados = 0;
        let errores = 0;
        
        // 4. Procesar solo los que necesitan migración
        for (const alumnoCSV of alumnosCSV) {
            const alumnoSupabase = mapaSupabase.get(alumnoCSV.rut);
            
            if (!alumnoSupabase) continue;
            
            // Verificar si ya está migrado
            const sumaCuotas = (alumnoSupabase.cuota_1 || 0) + (alumnoSupabase.cuota_2 || 0) + 
                             (alumnoSupabase.cuota_3 || 0) + (alumnoSupabase.cuota_4 || 0) + (alumnoSupabase.cuota_5 || 0);
            
            if (sumaCuotas > 0) {
                yaActualizados++;
                continue;
            }
            
            try {
                // Actualizar cuotas
                const { error: updateError } = await supabase
                    .from('alumnos')
                    .update({
                        ...alumnoCSV.cuotas,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', alumnoSupabase.id);
                
                if (updateError) {
                    console.log(`❌ ${alumnoCSV.nombre}: ${updateError.message}`);
                    errores++;
                } else {
                    actualizados++;
                    if (actualizados % 25 === 0) {
                        console.log(`✅ Actualizados: ${actualizados}`);
                    }
                }
                
            } catch (error) {
                console.log(`❌ Error ${alumnoCSV.nombre}: ${error.message}`);
                errores++;
            }
            
            // Pausa pequeña
            if (actualizados % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        console.log('\n📊 RESUMEN:');
        console.log(`Ya actualizados: ${yaActualizados}`);
        console.log(`Nuevos actualizados: ${actualizados}`);
        console.log(`Errores: ${errores}`);
        console.log(`Total migrados: ${yaActualizados + actualizados}/${alumnosCSV.length}`);
        
        if (actualizados > 0) {
            console.log('\n✅ Migración completada exitosamente');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

continuarMigracion();