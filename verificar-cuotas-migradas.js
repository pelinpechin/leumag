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

async function verificarCuotasMigradas() {
    console.log('🔍 VERIFICACIÓN DE CUOTAS MIGRADAS\n');
    
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    try {
        // 1. Leer CSV
        console.log('📁 Leyendo CSV...');
        const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
        const alumnosCSV = parseCSVCuotas(csvContent);
        console.log(`✅ CSV parseado: ${alumnosCSV.length} alumnos\n`);
        
        // 2. Verificar si las columnas de cuotas existen en Supabase
        console.log('🔍 Verificando estructura de Supabase...');
        const { data: sampleData, error: sampleError } = await supabase
            .from('alumnos')
            .select('*')
            .limit(1);
            
        if (sampleError) throw sampleError;
        
        const columnasDisponibles = Object.keys(sampleData[0]);
        const columnasCuotas = columnasDisponibles.filter(col => col.startsWith('cuota_'));
        
        console.log(`📋 Columnas de cuotas encontradas: ${columnasCuotas.length}`);
        if (columnasCuotas.length === 0) {
            console.log('❌ No se encontraron columnas de cuotas en Supabase');
            console.log('💡 Primero ejecuta el script: agregar-columnas-cuotas.sql');
            return;
        }
        
        console.log(`✅ Columnas disponibles: ${columnasCuotas.join(', ')}\n`);
        
        // 3. Obtener datos completos de Supabase
        console.log('📡 Obteniendo datos de Supabase...');
        const { data: alumnosSupabase, error: fetchError } = await supabase
            .from('alumnos')
            .select('nombre, rut, curso, total_pagado, cuota_1, cuota_2, cuota_3, cuota_4, cuota_5, cuota_6, cuota_7, cuota_8, cuota_9, cuota_10')
            .order('nombre');
            
        if (fetchError) throw fetchError;
        console.log(`✅ Supabase consultado: ${alumnosSupabase.length} alumnos\n`);
        
        // 4. Crear mapas para comparación
        const mapaCSV = new Map();
        const mapaSupabase = new Map();
        
        alumnosCSV.forEach(alumno => {
            mapaCSV.set(alumno.rut, alumno);
        });
        
        alumnosSupabase.forEach(alumno => {
            mapaSupabase.set(alumno.rut.replace(/[.-]/g, ''), alumno);
        });
        
        console.log('🔍 COMPARANDO CUOTAS CSV vs SUPABASE:\n');
        
        let coincidenciasPerfectas = 0;
        let discrepanciasCuotas = 0;
        let discrepanciasTotales = 0;
        let noEncontrados = 0;
        
        const reporteDiscrepancias = [];
        
        // 5. Comparar cada alumno
        for (const [rut, alumnoCSV] of mapaCSV) {
            const alumnoSupabase = mapaSupabase.get(rut);
            
            if (!alumnoSupabase) {
                noEncontrados++;
                continue;
            }
            
            // Comparar cuotas individuales
            const discrepanciasCuotasAlumno = [];
            let totalCSV = 0;
            let totalSupabase = 0;
            
            for (let i = 1; i <= 10; i++) {
                const cuotaCSV = alumnoCSV.cuotas[`cuota_${i}`] || 0;
                const cuotaSupabase = alumnoSupabase[`cuota_${i}`] || 0;
                
                totalCSV += cuotaCSV;
                totalSupabase += cuotaSupabase;
                
                if (cuotaCSV !== cuotaSupabase) {
                    discrepanciasCuotasAlumno.push({
                        cuota: i,
                        csv: cuotaCSV,
                        supabase: cuotaSupabase,
                        diferencia: cuotaCSV - cuotaSupabase
                    });
                }
            }
            
            const totalSupabaseDB = alumnoSupabase.total_pagado || 0;
            const diferenciaTotalDB = totalCSV - totalSupabaseDB;
            
            // Clasificar resultado
            if (discrepanciasCuotasAlumno.length === 0 && diferenciaTotalDB === 0) {
                coincidenciasPerfectas++;
            } else {
                if (discrepanciasCuotasAlumno.length > 0) discrepanciasCuotas++;
                if (diferenciaTotalDB !== 0) discrepanciasTotales++;
                
                reporteDiscrepancias.push({
                    alumno: alumnoCSV,
                    totalCSV,
                    totalSupabaseCalculado: totalSupabase,
                    totalSupabaseDB,
                    diferenciaTotalDB,
                    discrepanciasCuotas: discrepanciasCuotasAlumno
                });
            }
        }
        
        console.log(`📊 RESUMEN DE LA VERIFICACIÓN:`);
        console.log(`Alumnos revisados: ${mapaCSV.size}`);
        console.log(`Coincidencias perfectas: ${coincidenciasPerfectas}`);
        console.log(`Discrepancias en cuotas: ${discrepanciasCuotas}`);
        console.log(`Discrepancias en totales: ${discrepanciasTotales}`);
        console.log(`No encontrados: ${noEncontrados}\n`);
        
        if (reporteDiscrepancias.length > 0) {
            console.log('❌ DISCREPANCIAS ENCONTRADAS:\n');
            
            // Mostrar primeras 10 discrepancias
            reporteDiscrepancias.slice(0, 10).forEach((reporte, index) => {
                console.log(`${index + 1}. ${reporte.alumno.nombre} - ${reporte.alumno.rutFormateado}`);
                console.log(`   Total CSV: $${reporte.totalCSV.toLocaleString()}`);
                console.log(`   Total Supabase (DB): $${reporte.totalSupabaseDB.toLocaleString()}`);
                console.log(`   Total Supabase (calculado): $${reporte.totalSupabaseCalculado.toLocaleString()}`);
                
                if (reporte.discrepanciasCuotas.length > 0) {
                    console.log('   Cuotas diferentes:');
                    reporte.discrepanciasCuotas.forEach(cuota => {
                        console.log(`     Cuota ${cuota.cuota}: CSV=$${cuota.csv.toLocaleString()} vs Supabase=$${cuota.supabase.toLocaleString()}`);
                    });
                }
                console.log('');
            });
            
            if (reporteDiscrepancias.length > 10) {
                console.log(`... y ${reporteDiscrepancias.length - 10} discrepancias más\n`);
            }
            
            // Guardar reporte completo
            fs.writeFileSync('verificacion-cuotas-completa.json', JSON.stringify({
                resumen: {
                    alumnosRevisados: mapaCSV.size,
                    coincidenciasPerfectas,
                    discrepanciasCuotas,
                    discrepanciasTotales,
                    noEncontrados
                },
                discrepancias: reporteDiscrepancias
            }, null, 2));
            
            console.log('✅ Reporte detallado guardado en: verificacion-cuotas-completa.json');
        } else {
            console.log('✅ ¡Perfecto! Todas las cuotas coinciden entre CSV y Supabase');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

verificarCuotasMigradas();