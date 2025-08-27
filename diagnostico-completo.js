const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_CONFIG = {
    url: 'https://iajcxlymwqeltfmedmkj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk'
};

async function diagnosticoCompleto() {
    console.log('🔍 DIAGNÓSTICO COMPLETO\n');
    
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    try {
        // 1. ANÁLISIS DEL CSV
        console.log('📁 ANÁLISIS DEL CSV:');
        const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
        const lines = csvContent.split('\n');
        const alumnosCSV = [];
        const rutsCSV = [];
        
        console.log(`Total líneas en CSV: ${lines.length} (incluyendo encabezado)`);
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('totales')) continue;
            
            const values = line.split(';');
            if (values.length < 3) continue;
            
            const nombre = values[0]?.trim();
            const rut = values[1]?.trim();
            const curso = values[2]?.trim();
            
            if (nombre && rut && curso) {
                const rutLimpio = rut.replace(/[.-]/g, '');
                alumnosCSV.push({
                    nombre,
                    rut: rutLimpio,
                    rutFormateado: rut,
                    curso
                });
                rutsCSV.push(rutLimpio);
            }
        }
        
        const duplicadosCSV = rutsCSV.filter((rut, index) => rutsCSV.indexOf(rut) !== index);
        console.log(`Alumnos válidos en CSV: ${alumnosCSV.length}`);
        console.log(`Duplicados en CSV: ${duplicadosCSV.length}`);
        if (duplicadosCSV.length > 0) {
            console.log('RUTs duplicados en CSV:', duplicadosCSV);
        }
        
        // 2. ANÁLISIS DE SUPABASE
        console.log('\n📡 ANÁLISIS DE SUPABASE:');
        
        // Contar total real
        const { count, error: countError } = await supabase
            .from('alumnos')
            .select('*', { count: 'exact', head: true });
            
        if (countError) throw countError;
        
        // Obtener todos los datos
        const { data: alumnosSupabase, error } = await supabase
            .from('alumnos')
            .select('nombre, rut, curso')
            .order('nombre');
            
        if (error) throw error;
        
        const rutsSupabase = alumnosSupabase.map(a => a.rut.replace(/[.-]/g, ''));
        const duplicadosSupabase = rutsSupabase.filter((rut, index) => rutsSupabase.indexOf(rut) !== index);
        
        console.log(`Conteo exacto en Supabase: ${count}`);
        console.log(`Registros obtenidos: ${alumnosSupabase.length}`);
        console.log(`Duplicados en Supabase: ${duplicadosSupabase.length}`);
        if (duplicadosSupabase.length > 0) {
            console.log('RUTs duplicados en Supabase:', duplicadosSupabase);
        }
        
        // 3. COMPARACIÓN BIDIRECCIONAL
        console.log('\n🔄 COMPARACIÓN BIDIRECCIONAL:');
        
        const setRutsCSV = new Set(rutsCSV);
        const setRutsSupabase = new Set(rutsSupabase);
        
        // Alumnos en CSV pero no en Supabase
        const enCSVnoSupabase = alumnosCSV.filter(a => !setRutsSupabase.has(a.rut));
        // Alumnos en Supabase pero no en CSV  
        const enSupabaseNoCSV = alumnosSupabase.filter(a => !setRutsCSV.has(a.rut.replace(/[.-]/g, '')));
        
        console.log(`En CSV pero NO en Supabase: ${enCSVnoSupabase.length}`);
        console.log(`En Supabase pero NO en CSV: ${enSupabaseNoCSV.length}`);
        
        if (enCSVnoSupabase.length > 0) {
            console.log('\n❌ ALUMNOS QUE FALTAN EN SUPABASE:');
            enCSVnoSupabase.forEach((alumno, i) => {
                console.log(`${i + 1}. ${alumno.nombre} - ${alumno.rutFormateado} - ${alumno.curso}`);
            });
            
            // Generar SQL
            const sqlContent = enCSVnoSupabase.map(alumno => 
                `INSERT INTO alumnos (nombre, rut, curso, arancel, beca, total_pagado, pendiente, estado, año_escolar) VALUES ('${alumno.nombre}', '${alumno.rutFormateado}', '${alumno.curso}', 1265000, 0, 0, 1265000, 'Pendiente', 2025);`
            ).join('\n\n');
            
            fs.writeFileSync('insertar-faltantes.sql', sqlContent);
            console.log('\n✅ SQL guardado en: insertar-faltantes.sql');
        }
        
        if (enSupabaseNoCSV.length > 0) {
            console.log('\n⚠️ ALUMNOS EN SUPABASE QUE NO ESTÁN EN CSV:');
            enSupabaseNoCSV.forEach((alumno, i) => {
                console.log(`${i + 1}. ${alumno.nombre} - ${alumno.rut} - ${alumno.curso}`);
            });
        }
        
        console.log('\n📊 RESUMEN:');
        console.log(`CSV: ${alumnosCSV.length} alumnos`);
        console.log(`Supabase: ${count} alumnos`);
        console.log(`Diferencia: ${Math.abs(alumnosCSV.length - count)} alumnos`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

diagnosticoCompleto();