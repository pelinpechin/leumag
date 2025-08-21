const fs = require('fs');

// Función para parsear moneda (similar a la del sistema)
function parsearMoneda(texto) {
    if (!texto || texto.trim() === '' || texto.trim() === '-') return 0;
    // Remover símbolos y convertir a número
    return parseInt(texto.toString().replace(/[$.,\s]/g, '')) || 0;
}

// Función para formatear moneda
function formatearMoneda(monto) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0
    }).format(monto);
}

console.log('🔍 VERIFICACIÓN COMPLETA DEL ARCHIVO CSV...\n');

try {
    const csvContent = fs.readFileSync('alumnos_final.csv', 'utf-8');
    const lineas = csvContent.split('\n');
    
    let totalVerificados = 0;
    let discrepancias = [];
    let coincidencias = 0;
    
    console.log('📄 Analizando archivo línea por línea...\n');
    
    for (let i = 1; i < lineas.length; i++) {
        if (lineas[i].trim() === '') continue;
        
        const valores = lineas[i].split(';');
        if (valores.length < 16) continue;
        
        // Ignorar línea de totales
        const nombre = valores[0]?.trim() || '';
        if (nombre.toLowerCase() === 'totales' || nombre.toLowerCase() === 'total') {
            console.log(`⏭️ Saltando línea de totales (línea ${i + 1})`);
            continue;
        }
        const rut = valores[1]?.trim() || '';
        
        // Sumar cuotas individuales (columnas 5-14)
        let sumaCuotas = 0;
        const cuotasDetalle = [];
        
        for (let j = 5; j < 15; j++) {
            const valorCuotaStr = valores[j]?.trim() || '';
            const valorCuota = parsearMoneda(valorCuotaStr);
            if (valorCuota > 0) {
                sumaCuotas += valorCuota;
                cuotasDetalle.push(`C${j-4}:${formatearMoneda(valorCuota)}`);
            }
        }
        
        const totalFinalStr = valores[15]?.trim() || '0';
        const totalFinal = parsearMoneda(totalFinalStr);
        const diferencia = Math.abs(sumaCuotas - totalFinal);
        
        totalVerificados++;
        
        if (diferencia > 1) {
            discrepancias.push({
                linea: i + 1,
                nombre: nombre,
                rut: rut,
                sumaCuotas: sumaCuotas,
                totalFinal: totalFinal,
                diferencia: diferencia,
                cuotasDetalle: cuotasDetalle
            });
            
            console.log(`🚨 DISCREPANCIA - Línea ${i + 1}:`);
            console.log(`   📝 ${nombre}`);
            console.log(`   🆔 ${rut}`);
            console.log(`   ➕ Suma cuotas: ${formatearMoneda(sumaCuotas)}`);
            console.log(`   📊 Total final: ${formatearMoneda(totalFinal)}`);
            console.log(`   ⚠️ Diferencia: ${formatearMoneda(diferencia)}`);
            console.log(`   💰 Cuotas: ${cuotasDetalle.join(', ')}`);
            console.log('   ---\n');
        } else {
            coincidencias++;
        }
    }
    
    console.log(`\n📊 RESUMEN FINAL:`);
    console.log(`   ✅ Total verificados: ${totalVerificados}`);
    console.log(`   ✅ Coincidencias perfectas: ${coincidencias}`);
    console.log(`   ❌ Discrepancias encontradas: ${discrepancias.length}`);
    console.log(`   📈 Porcentaje de exactitud: ${((coincidencias / totalVerificados) * 100).toFixed(2)}%`);
    
    if (discrepancias.length === 0) {
        console.log('\n🎉 ¡EXCELENTE! El archivo CSV es 100% consistente.');
        console.log('   Todas las sumatorias de cuotas coinciden con el total final.');
    } else {
        console.log(`\n⚠️ Se encontraron ${discrepancias.length} casos con discrepancias.`);
        console.log('   Revisa los detalles arriba para decidir qué valor usar.');
    }
    
} catch (error) {
    console.error('❌ Error leyendo archivo:', error.message);
}