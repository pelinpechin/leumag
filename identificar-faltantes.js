const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_CONFIG = {
    url: 'https://iajcxlymwqeltfmedmkj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk'
};

async function identificarFaltantes() {
    console.log('🔍 Identificando alumnos faltantes...\n');
    
    // Inicializar Supabase
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    try {
        // Leer CSV
        const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
        const lines = csvContent.split('\n');
        const alumnosCSV = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('totales')) continue;
            
            const values = line.split(';');
            if (values.length < 3) continue;
            
            const nombre = values[0]?.trim();
            const rut = values[1]?.trim();
            const curso = values[2]?.trim();
            
            if (nombre && rut && curso) {
                alumnosCSV.push({
                    nombre,
                    rut: rut.replace(/[.-]/g, ''),
                    rutFormateado: rut,
                    curso
                });
            }
        }
        
        console.log(`📁 CSV cargado: ${alumnosCSV.length} alumnos`);
        
        // Obtener datos de Supabase
        const { data: alumnosSupabase, error } = await supabase
            .from('alumnos')
            .select('nombre, rut, curso')
            .order('nombre');
            
        if (error) throw error;
        
        console.log(`📡 Supabase cargado: ${alumnosSupabase.length} alumnos`);
        
        // Crear set de RUTs de Supabase para comparación rápida
        const rutsSupabase = new Set(
            alumnosSupabase.map(a => a.rut.replace(/[.-]/g, ''))
        );
        
        // Encontrar faltantes
        const faltantes = alumnosCSV.filter(alumnoCSV => 
            !rutsSupabase.has(alumnoCSV.rut)
        );
        
        console.log(`❌ Alumnos faltantes: ${faltantes.length}\n`);
        
        if (faltantes.length > 0) {
            console.log('📋 Lista de alumnos faltantes:');
            console.log('=====================================');
            faltantes.forEach((alumno, i) => {
                console.log(`${i + 1}. ${alumno.nombre} - ${alumno.rutFormateado} - ${alumno.curso}`);
            });
            
            // Generar SQL INSERT
            console.log('\n📄 SQL INSERT para agregar a Supabase:');
            console.log('=====================================');
            
            faltantes.forEach(alumno => {
                const sql = `INSERT INTO alumnos (nombre, rut, curso, arancel, beca, total_pagado, pendiente, estado, año_escolar) VALUES ('${alumno.nombre}', '${alumno.rutFormateado}', '${alumno.curso}', 1265000, 0, 0, 1265000, 'Pendiente', 2025);`;
                console.log(sql);
            });
            
            // Guardar SQL en archivo
            const sqlContent = faltantes.map(alumno => 
                `INSERT INTO alumnos (nombre, rut, curso, arancel, beca, total_pagado, pendiente, estado, año_escolar) VALUES ('${alumno.nombre}', '${alumno.rutFormateado}', '${alumno.curso}', 1265000, 0, 0, 1265000, 'Pendiente', 2025);`
            ).join('\n\n');
            
            fs.writeFileSync('insertar-faltantes.sql', sqlContent);
            console.log('\n✅ SQL guardado en: insertar-faltantes.sql');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

identificarFaltantes();