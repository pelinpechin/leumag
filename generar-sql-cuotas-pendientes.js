const fs = require('fs');

function generarSQLPendientes() {
    console.log('📄 GENERANDO SQL PARA CASOS PENDIENTES\n');
    
    try {
        // Leer CSV
        const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
        const lines = csvContent.split('\n');
        
        // Leer reporte de discrepancias
        const reporteContent = fs.readFileSync('verificacion-cuotas-completa.json', 'utf-8');
        const reporte = JSON.parse(reporteContent);
        
        console.log(`📋 Casos pendientes: ${reporte.discrepancias.length}`);
        
        // Crear mapa de datos CSV
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
                
                datosCSV.set(nombre.toLowerCase(), {
                    rut,
                    cuotas
                });
            }
        }
        
        const sqlStatements = [];
        let procesados = 0;
        
        // Generar SQL para cada caso pendiente
        for (const discrepancia of reporte.discrepancias) {
            const nombreKey = discrepancia.nombre.toLowerCase();
            const datosAlumno = datosCSV.get(nombreKey);
            
            if (datosAlumno) {
                const cuotasSQL = Object.entries(datosAlumno.cuotas)
                    .map(([cuota, valor]) => `${cuota} = ${valor}`)
                    .join(', ');
                
                sqlStatements.push(
                    `-- ${discrepancia.nombre}`,
                    `UPDATE alumnos SET ${cuotasSQL}, updated_at = NOW() WHERE rut = '${datosAlumno.rut}';`,
                    ''
                );
                
                procesados++;
                console.log(`✅ ${procesados}. ${discrepancia.nombre}`);
            } else {
                console.log(`❌ No encontrado: ${discrepancia.nombre}`);
            }
        }
        
        // Escribir archivo SQL
        const sqlContent = [
            '-- SQL para actualizar cuotas de los casos pendientes',
            '-- Ejecutar en Supabase SQL Editor',
            '',
            ...sqlStatements
        ].join('\n');
        
        fs.writeFileSync('migrar-cuotas-pendientes.sql', sqlContent);
        
        console.log(`\n📊 RESUMEN:`);
        console.log(`Total casos: ${reporte.discrepancias.length}`);
        console.log(`Procesados: ${procesados}`);
        console.log(`\n✅ SQL generado: migrar-cuotas-pendientes.sql`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

generarSQLPendientes();