const { createClient } = require('@supabase/supabase-js');

const SUPABASE_CONFIG = {
    url: 'https://iajcxlymwqeltfmedmkj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk'
};

async function verificarEstructura() {
    const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
    
    try {
        console.log('📡 Obteniendo estructura de la tabla alumnos...\n');
        
        // Obtener un registro para ver las columnas disponibles
        const { data: sample, error } = await supabase
            .from('alumnos')
            .select('*')
            .limit(1);
            
        if (error) throw error;
        
        if (sample && sample.length > 0) {
            const columnas = Object.keys(sample[0]);
            console.log('📋 COLUMNAS DISPONIBLES EN SUPABASE:');
            console.log('=====================================');
            columnas.forEach((col, index) => {
                console.log(`${index + 1}. ${col}`);
            });
            
            console.log('\n📊 EJEMPLO DE REGISTRO:');
            console.log('========================');
            console.log(JSON.stringify(sample[0], null, 2));
        }
        
        // También verificar si hay columnas relacionadas con pagos
        console.log('\n🔍 BUSCANDO COLUMNAS DE PAGOS...');
        const columnasDisponibles = Object.keys(sample[0]);
        const columnasPagos = columnasDisponibles.filter(col => 
            col.toLowerCase().includes('pago') || 
            col.toLowerCase().includes('cuota') || 
            col.toLowerCase().includes('total')
        );
        
        if (columnasPagos.length > 0) {
            console.log('✅ Columnas relacionadas con pagos encontradas:');
            columnasPagos.forEach(col => console.log(`  - ${col}`));
        } else {
            console.log('❌ No se encontraron columnas relacionadas con pagos');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

verificarEstructura();