const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_CONFIG = {
    url: 'https://iajcxlymwqeltfmedmkj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk'
};

function parseCSVPayments(csvContent) {
    const lines = csvContent.split('\n');
    const header = lines[0].split(';');
    const students = [];
    
    // Encontrar índices de las columnas de pagos
    const cuotaIndices = [];
    for (let i = 0; i < header.length; i++) {
        if (header[i].includes('CUOTA') && header[i].includes('PAGADA')) {
            cuotaIndices.push(i);
        }
    }
    
    const totalPagadoIndex = header.findIndex(col => col.toLowerCase().includes('total pagado'));
    
    console.log(`📋 Columnas de cuotas encontradas: ${cuotaIndices.length}`);
    console.log(`📋 Índices de cuotas: ${cuotaIndices.join(', ')}`);
    console.log(`📋 Índice total pagado: ${totalPagadoIndex}`);
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('totales') || line === ';;;;;;;;;;;;;;;') continue;
        
        const values = line.split(';');
        if (values.length < 3) continue;
        
        const nombre = values[0]?.trim();
        const rut = values[1]?.trim();
        const curso = values[2]?.trim();
        
        if (nombre && rut && curso) {
            // Extraer pagos de cuotas
            const pagos = {};
            let totalCalculado = 0;
            
            cuotaIndices.forEach((index, cuotaNum) => {
                const monto = values[index]?.trim();
                const montoNum = monto && monto !== '' ? parseInt(monto) : 0;
                pagos[`cuota_${cuotaNum + 1}`] = montoNum;
                totalCalculado += montoNum;
            });
            
            const totalCSV = totalPagadoIndex >= 0 && values[totalPagadoIndex] 
                ? parseInt(values[totalPagadoIndex]?.trim() || '0') 
                : 0;
            
            students.push({
                nombre,
                rut: rut.replace(/[.-]/g, ''),
                rutFormateado: rut,
                curso,
                pagos,
                totalCSV,
                totalCalculado,
                linea: i + 1
            });
        }
    }
    
    return students;
}

async function verificarPagos() {
    console.log('🔍 VERIFICACIÓN DE PAGOS CSV vs SUPABASE\n');
    
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    try {
        // 1. Leer y parsear CSV
        console.log('📁 Leyendo CSV...');
        const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
        const alumnosCSV = parseCSVPayments(csvContent);
        console.log(`✅ CSV parseado: ${alumnosCSV.length} alumnos\n`);
        
        // 2. Obtener datos de Supabase
        console.log('📡 Obteniendo datos de Supabase...');
        const { data: alumnosSupabase, error } = await supabase
            .from('alumnos')
            .select('nombre, rut, curso, total_pagado, cuota_1, cuota_2, cuota_3, cuota_4, cuota_5, cuota_6, cuota_7, cuota_8, cuota_9, cuota_10')
            .order('nombre');
            
        if (error) throw error;
        console.log(`✅ Supabase consultado: ${alumnosSupabase.length} alumnos\n`);
        
        // 3. Crear mapas por RUT para comparación
        const mapaCSV = new Map();
        const mapaSupabase = new Map();
        
        alumnosCSV.forEach(alumno => {
            mapaCSV.set(alumno.rut, alumno);
        });
        
        alumnosSupabase.forEach(alumno => {
            mapaSupabase.set(alumno.rut.replace(/[.-]/g, ''), alumno);
        });
        
        console.log('🔍 ANÁLISIS DE DISCREPANCIAS:\n');
        
        let discrepancias = [];
        let totalDiscrepancias = 0;
        let alumnosRevisados = 0;
        
        // 4. Comparar cada alumno
        for (const [rut, alumnoCSV] of mapaCSV) {
            const alumnoSupabase = mapaSupabase.get(rut);
            
            if (!alumnoSupabase) {
                console.log(`❌ Alumno ${alumnoCSV.nombre} (${alumnoCSV.rutFormateado}) no encontrado en Supabase`);
                continue;
            }
            
            alumnosRevisados++;
            
            // Comparar total pagado
            const totalSupabase = alumnoSupabase.total_pagado || 0;
            const totalCSV = alumnoCSV.totalCSV;
            
            // Comparar cuotas individuales
            const cuotasDiscrepancias = [];
            for (let i = 1; i <= 10; i++) {
                const cuotaCSV = alumnoCSV.pagos[`cuota_${i}`] || 0;
                const cuotaSupabase = alumnoSupabase[`cuota_${i}`] || 0;
                
                if (cuotaCSV !== cuotaSupabase) {
                    cuotasDiscrepancias.push({
                        cuota: i,
                        csv: cuotaCSV,
                        supabase: cuotaSupabase,
                        diferencia: cuotaCSV - cuotaSupabase
                    });
                }
            }
            
            // Si hay discrepancias, registrar
            if (totalCSV !== totalSupabase || cuotasDiscrepancias.length > 0) {
                discrepancias.push({
                    alumno: alumnoCSV,
                    supabase: alumnoSupabase,
                    totalDiferencia: totalCSV - totalSupabase,
                    cuotasDiscrepancias
                });
                totalDiscrepancias++;
            }
        }
        
        console.log(`📊 RESUMEN:`);
        console.log(`Alumnos revisados: ${alumnosRevisados}`);
        console.log(`Discrepancias encontradas: ${totalDiscrepancias}\n`);
        
        if (discrepancias.length > 0) {
            console.log('❌ DISCREPANCIAS DETALLADAS:\n');
            
            discrepancias.slice(0, 20).forEach((disc, index) => {
                console.log(`${index + 1}. ${disc.alumno.nombre} - ${disc.alumno.rutFormateado}`);
                console.log(`   Total: CSV=${disc.alumno.totalCSV} | Supabase=${disc.supabase.total_pagado} | Diff=${disc.totalDiferencia}`);
                
                if (disc.cuotasDiscrepancias.length > 0) {
                    console.log('   Cuotas con diferencias:');
                    disc.cuotasDiscrepancias.forEach(cuota => {
                        console.log(`     Cuota ${cuota.cuota}: CSV=${cuota.csv} | Supabase=${cuota.supabase} | Diff=${cuota.diferencia}`);
                    });
                }
                console.log('');
            });
            
            if (discrepancias.length > 20) {
                console.log(`... y ${discrepancias.length - 20} discrepancias más\n`);
            }
            
            // Guardar reporte completo
            const reporte = discrepancias.map(disc => ({
                nombre: disc.alumno.nombre,
                rut: disc.alumno.rutFormateado,
                curso: disc.alumno.curso,
                totalCSV: disc.alumno.totalCSV,
                totalSupabase: disc.supabase.total_pagado,
                diferenciTotal: disc.totalDiferencia,
                cuotasDiscrepancias: disc.cuotasDiscrepancias
            }));
            
            fs.writeFileSync('reporte-discrepancias-pagos.json', JSON.stringify(reporte, null, 2));
            console.log('✅ Reporte completo guardado en: reporte-discrepancias-pagos.json');
        } else {
            console.log('✅ No se encontraron discrepancias en los pagos');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

verificarPagos();