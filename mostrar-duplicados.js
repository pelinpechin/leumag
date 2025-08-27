const fs = require('fs');

async function mostrarDuplicados() {
    console.log('🔍 ANÁLISIS DE DUPLICADOS EN CSV\n');
    
    try {
        // Leer CSV
        const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
        const lines = csvContent.split('\n');
        
        // Almacenar todos los alumnos con sus líneas
        const todosLosAlumnos = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('totales')) continue;
            
            const values = line.split(';');
            if (values.length < 3) continue;
            
            const nombre = values[0]?.trim();
            const rut = values[1]?.trim();
            const curso = values[2]?.trim();
            
            if (nombre && rut && curso) {
                todosLosAlumnos.push({
                    linea: i + 1,
                    nombre,
                    rut,
                    rutLimpio: rut.replace(/[.-]/g, ''),
                    curso,
                    lineaCompleta: line
                });
            }
        }
        
        console.log(`Total alumnos procesados: ${todosLosAlumnos.length}`);
        
        // Encontrar duplicados por RUT
        const rutCount = {};
        const duplicados = [];
        
        todosLosAlumnos.forEach(alumno => {
            if (!rutCount[alumno.rutLimpio]) {
                rutCount[alumno.rutLimpio] = [];
            }
            rutCount[alumno.rutLimpio].push(alumno);
        });
        
        // Identificar RUTs que aparecen más de una vez
        Object.keys(rutCount).forEach(rut => {
            if (rutCount[rut].length > 1) {
                duplicados.push({
                    rut: rut,
                    instancias: rutCount[rut]
                });
            }
        });
        
        console.log(`\n❌ Se encontraron ${duplicados.length} RUTs duplicados:`);
        console.log('='.repeat(80));
        
        duplicados.forEach((dup, index) => {
            console.log(`\n${index + 1}. RUT: ${dup.rut} (${dup.instancias.length} veces)`);
            dup.instancias.forEach((inst, i) => {
                console.log(`   ${i + 1}) Línea ${inst.linea}: ${inst.nombre} - ${inst.rut} - ${inst.curso}`);
            });
        });
        
        // Contar total de registros duplicados
        const totalDuplicados = duplicados.reduce((acc, dup) => acc + (dup.instancias.length - 1), 0);
        console.log(`\n📊 RESUMEN:`);
        console.log(`Total registros en CSV: ${todosLosAlumnos.length}`);
        console.log(`RUTs únicos: ${Object.keys(rutCount).length}`);
        console.log(`RUTs duplicados: ${duplicados.length}`);
        console.log(`Registros duplicados a eliminar: ${totalDuplicados}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

mostrarDuplicados();