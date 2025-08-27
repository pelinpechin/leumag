const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const SUPABASE_CONFIG = {
    url: 'https://iajcxlymwqeltfmedmkj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk'
};

async function verificarFranciscaTrivino() {
    console.log('🔍 VERIFICANDO DATOS DE FRANCISCA TRIVINO\n');
    
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    try {
        // 1. Buscar en Supabase
        console.log('📡 Buscando en Supabase...');
        const { data: supabaseData, error } = await supabase
            .from('alumnos')
            .select('*')
            .ilike('nombre', '%trivino%')
            .ilike('nombre', '%francisca%');
            
        if (error) throw error;
        
        if (supabaseData && supabaseData.length > 0) {
            console.log('✅ Encontrado en Supabase:');
            supabaseData.forEach(alumno => {
                console.log(`\n👤 ${alumno.nombre}`);
                console.log(`   RUT: ${alumno.rut}`);
                console.log(`   Curso: ${alumno.curso}`);
                console.log(`   Arancel: $${alumno.arancel?.toLocaleString() || 'N/A'}`);
                console.log(`   Beca: $${alumno.beca?.toLocaleString() || '0'}`);
                console.log(`   Total pagado: $${alumno.total_pagado?.toLocaleString() || '0'}`);
                console.log(`   Pendiente: $${alumno.pendiente?.toLocaleString() || 'N/A'}`);
                console.log(`   Estado: ${alumno.estado || 'N/A'}`);
                
                // Mostrar cuotas
                console.log('   Cuotas:');
                for (let i = 1; i <= 10; i++) {
                    const cuota = alumno[`cuota_${i}`] || 0;
                    if (cuota > 0) {
                        console.log(`     Cuota ${i}: $${cuota.toLocaleString()}`);
                    }
                }
                
                // Verificar cálculo
                const sumaCuotas = Array.from({length: 10}, (_, i) => alumno[`cuota_${i + 1}`] || 0)
                    .reduce((sum, cuota) => sum + cuota, 0);
                    
                const pendienteCalculado = (alumno.arancel || 0) - (alumno.beca || 0) - sumaCuotas;
                
                console.log(`\n📊 VERIFICACIÓN DE CÁLCULOS:`);
                console.log(`   Suma de cuotas: $${sumaCuotas.toLocaleString()}`);
                console.log(`   Pendiente DB: $${alumno.pendiente?.toLocaleString() || 'N/A'}`);
                console.log(`   Pendiente calculado: $${pendienteCalculado.toLocaleString()}`);
                console.log(`   ¿Coincide?: ${alumno.pendiente === pendienteCalculado ? '✅' : '❌'}`);
            });
        } else {
            console.log('❌ No encontrado en Supabase');
        }
        
        // 2. Buscar en CSV
        console.log('\n📁 Buscando en CSV...');
        const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
        const lines = csvContent.split('\n');
        
        let encontradoCSV = false;
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = line.split(';');
            if (values.length < 3) continue;
            
            const nombre = values[0]?.trim().toLowerCase();
            
            if (nombre.includes('trivino') && nombre.includes('francisca')) {
                encontradoCSV = true;
                
                console.log('✅ Encontrado en CSV:');
                console.log(`   Línea ${i + 1}: ${values[0]?.trim()}`);
                console.log(`   RUT: ${values[1]?.trim()}`);
                console.log(`   Curso: ${values[2]?.trim()}`);
                console.log(`   Arancel: ${values[3]?.trim()}`);
                console.log(`   Beca: ${values[4]?.trim()}`);
                
                // Cuotas
                let totalCuotas = 0;
                console.log('   Cuotas CSV:');
                for (let j = 1; j <= 10; j++) {
                    const cuotaIndex = j + 4;
                    const cuotaValue = values[cuotaIndex] && values[cuotaIndex].trim() !== '' 
                        ? parseInt(values[cuotaIndex].trim()) 
                        : 0;
                    if (cuotaValue > 0) {
                        console.log(`     Cuota ${j}: $${cuotaValue.toLocaleString()}`);
                    }
                    totalCuotas += cuotaValue;
                }
                
                const totalPagadoCSV = values[15] && values[15].trim() !== '' 
                    ? parseInt(values[15].trim()) 
                    : 0;
                    
                console.log(`   Total cuotas sumado: $${totalCuotas.toLocaleString()}`);
                console.log(`   Total pagado CSV: $${totalPagadoCSV.toLocaleString()}`);
                break;
            }
        }
        
        if (!encontradoCSV) {
            console.log('❌ No encontrado en CSV');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

verificarFranciscaTrivino();