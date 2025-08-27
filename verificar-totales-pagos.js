const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_CONFIG = {
    url: 'https://iajcxlymwqeltfmedmkj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk'
};

function parseCSVTotals(csvContent) {
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
            // Total pagado está en la última columna (índice 15)
            const totalCSV = values[15] && values[15].trim() !== '' 
                ? parseInt(values[15].trim()) 
                : 0;
                
            // Calcular suma de cuotas (columnas 5-14)
            let sumaCuotas = 0;
            for (let j = 5; j <= 14; j++) {
                const cuota = values[j] && values[j].trim() !== '' 
                    ? parseInt(values[j].trim()) 
                    : 0;
                sumaCuotas += cuota;
            }
            
            students.push({
                nombre,
                rut: rut.replace(/[.-]/g, ''),
                rutFormateado: rut,
                curso,
                totalCSV,
                sumaCuotas,
                linea: i + 1,
                inconsistente: totalCSV !== sumaCuotas
            });
        }
    }
    
    return students;
}

async function verificarTotalesPagos() {
    console.log('🔍 VERIFICACIÓN DE TOTALES DE PAGOS\n');
    
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    try {
        // 1. Leer y parsear CSV
        console.log('📁 Leyendo CSV...');
        const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
        const alumnosCSV = parseCSVTotals(csvContent);
        console.log(`✅ CSV parseado: ${alumnosCSV.length} alumnos\n`);
        
        // Verificar inconsistencias internas en CSV
        const inconsistencias = alumnosCSV.filter(a => a.inconsistente);
        if (inconsistencias.length > 0) {
            console.log(`⚠️ INCONSISTENCIAS EN CSV (total ≠ suma cuotas): ${inconsistencias.length}`);
            console.log('Primeros 10 casos:');
            inconsistencias.slice(0, 10).forEach(a => {
                console.log(`  ${a.nombre}: Total=${a.totalCSV}, Suma=${a.sumaCuotas}, Diff=${a.totalCSV - a.sumaCuotas}`);
            });
            console.log('');
        }
        
        // 2. Obtener datos de Supabase
        console.log('📡 Obteniendo datos de Supabase...');
        const { data: alumnosSupabase, error } = await supabase
            .from('alumnos')
            .select('nombre, rut, curso, total_pagado')
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
        
        console.log('🔍 COMPARANDO TOTALES CSV vs SUPABASE:\n');
        
        let discrepancias = [];
        let alumnosRevisados = 0;
        let coincidencias = 0;
        
        // 4. Comparar cada alumno
        for (const [rut, alumnoCSV] of mapaCSV) {
            const alumnoSupabase = mapaSupabase.get(rut);
            
            if (!alumnoSupabase) {
                discrepancias.push({
                    tipo: 'no_encontrado',
                    alumno: alumnoCSV,
                    descripcion: 'No encontrado en Supabase'
                });
                continue;
            }
            
            alumnosRevisados++;
            
            const totalSupabase = alumnoSupabase.total_pagado || 0;
            const totalCSV = alumnoCSV.totalCSV;
            
            if (totalCSV !== totalSupabase) {
                discrepancias.push({
                    tipo: 'diferencia_total',
                    alumno: alumnoCSV,
                    supabase: alumnoSupabase,
                    diferencia: totalCSV - totalSupabase
                });
            } else {
                coincidencias++;
            }
        }
        
        console.log(`📊 RESUMEN:`);
        console.log(`Alumnos en CSV: ${alumnosCSV.length}`);
        console.log(`Alumnos en Supabase: ${alumnosSupabase.length}`);
        console.log(`Alumnos revisados: ${alumnosRevisados}`);
        console.log(`Coincidencias: ${coincidencias}`);
        console.log(`Discrepancias: ${discrepancias.length}`);
        console.log(`Inconsistencias internas CSV: ${inconsistencias.length}\n`);
        
        if (discrepancias.length > 0) {
            console.log('❌ DISCREPANCIAS DETALLADAS:\n');
            
            const diferencias = discrepancias.filter(d => d.tipo === 'diferencia_total');
            const noEncontrados = discrepancias.filter(d => d.tipo === 'no_encontrado');
            
            if (noEncontrados.length > 0) {
                console.log(`👤 ALUMNOS NO ENCONTRADOS EN SUPABASE (${noEncontrados.length}):`);
                noEncontrados.forEach(disc => {
                    console.log(`  - ${disc.alumno.nombre} (${disc.alumno.rutFormateado})`);
                });
                console.log('');
            }
            
            if (diferencias.length > 0) {
                console.log(`💰 DIFERENCIAS EN TOTALES PAGADOS (${diferencias.length}):`);
                diferencias.slice(0, 15).forEach((disc, index) => {
                    console.log(`${index + 1}. ${disc.alumno.nombre} - ${disc.alumno.rutFormateado}`);
                    console.log(`   CSV: $${disc.alumno.totalCSV.toLocaleString()} | Supabase: $${disc.supabase.total_pagado.toLocaleString()} | Diferencia: $${disc.diferencia.toLocaleString()}`);
                    if (disc.alumno.inconsistente) {
                        console.log(`   ⚠️ Inconsistente en CSV: Suma cuotas = $${disc.alumno.sumaCuotas.toLocaleString()}`);
                    }
                });
                
                if (diferencias.length > 15) {
                    console.log(`... y ${diferencias.length - 15} diferencias más\n`);
                }
            }
            
            // Guardar reporte completo
            const reporte = {
                resumen: {
                    alumnosCSV: alumnosCSV.length,
                    alumnosSupabase: alumnosSupabase.length,
                    alumnosRevisados,
                    coincidencias,
                    totalDiscrepancias: discrepancias.length,
                    inconsistenciasCSV: inconsistencias.length
                },
                discrepancias: discrepancias.map(disc => ({
                    tipo: disc.tipo,
                    nombre: disc.alumno.nombre,
                    rut: disc.alumno.rutFormateado,
                    curso: disc.alumno.curso,
                    totalCSV: disc.alumno.totalCSV,
                    sumaCuotasCSV: disc.alumno.sumaCuotas,
                    totalSupabase: disc.supabase?.total_pagado || 0,
                    diferencia: disc.diferencia || 0,
                    inconsistenteCSV: disc.alumno.inconsistente
                }))
            };
            
            fs.writeFileSync('reporte-pagos-completo.json', JSON.stringify(reporte, null, 2));
            console.log('✅ Reporte completo guardado en: reporte-pagos-completo.json');
        } else {
            console.log('✅ Todos los totales de pagos coinciden entre CSV y Supabase');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

verificarTotalesPagos();