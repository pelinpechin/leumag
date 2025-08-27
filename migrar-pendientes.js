const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_CONFIG = {
    url: 'https://iajcxlymwqeltfmedmkj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk'
};

async function migrarPendientes() {
    console.log('🎯 MIGRACIÓN FINAL DE CASOS PENDIENTES\n');
    
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    try {
        // Leer reporte de discrepancias
        const reporteContent = fs.readFileSync('verificacion-cuotas-completa.json', 'utf-8');
        const reporte = JSON.parse(reporteContent);
        
        console.log(`📋 Casos pendientes: ${reporte.discrepancias.length}`);
        
        // Leer CSV para obtener datos
        const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
        const lines = csvContent.split('\n');
        
        // Crear mapa de datos CSV por RUT
        const datosCSV = new Map();
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = line.split(';');
            if (values.length < 3) continue;
            
            const nombre = values[0]?.trim();
            const rut = values[1]?.trim();
            
            if (nombre && rut) {
                const cuotas = {};
                for (let j = 1; j <= 10; j++) {
                    const cuotaIndex = j + 4;
                    const cuotaValue = values[cuotaIndex] && values[cuotaIndex].trim() !== '' 
                        ? parseInt(values[cuotaIndex].trim()) 
                        : 0;
                    cuotas[`cuota_${j}`] = cuotaValue;
                }
                
                datosCSV.set(rut.replace(/[.-]/g, ''), cuotas);
            }
        }
        
        let actualizados = 0;
        let errores = 0;
        
        // Procesar cada caso pendiente
        for (const discrepancia of reporte.discrepancias) {
            if (!discrepancia.rut) {
                console.log(`❌ RUT faltante para ${discrepancia.nombre}`);
                errores++;
                continue;
            }
            
            const rutLimpio = discrepancia.rut.replace(/[.-]/g, '');
            const cuotasCSV = datosCSV.get(rutLimpio);
            
            if (!cuotasCSV) {
                console.log(`❌ No se encontraron datos CSV para ${discrepancia.nombre}`);
                errores++;
                continue;
            }
            
            try {
                // Actualizar directamente por RUT
                const { error: updateError } = await supabase
                    .from('alumnos')
                    .update({
                        ...cuotasCSV,
                        updated_at: new Date().toISOString()
                    })
                    .eq('rut', discrepancia.rut);
                
                if (updateError) {
                    console.log(`❌ Error ${discrepancia.nombre}: ${updateError.message}`);
                    errores++;
                } else {
                    actualizados++;
                    console.log(`✅ ${actualizados}. ${discrepancia.nombre}`);
                }
                
            } catch (error) {
                console.log(`❌ Error procesando ${discrepancia.nombre}: ${error.message}`);
                errores++;
            }
            
            // Pausa breve
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('\n📊 RESULTADO FINAL:');
        console.log(`Actualizados: ${actualizados}`);
        console.log(`Errores: ${errores}`);
        
        if (actualizados === reporte.discrepancias.length) {
            console.log('\n🎉 ¡MIGRACIÓN COMPLETADA AL 100%!');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

migrarPendientes();