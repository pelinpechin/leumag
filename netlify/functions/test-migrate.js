// Función simple para probar migración
exports.handler = async (event, context) => {
    console.log('🧪 Test endpoint activado');
    
    try {
        // Datos de prueba simples
        const datosEjemplo = [
            {
                nombre: 'JUAN PEREZ GONZALEZ',
                rut: '12.345.678-9',
                curso: 'NT1 A',
                arancel: 1265000,
                beca: 0,
                montoNeto: 1265000,
                totalPagado: 379500,
                pendiente: 885500,
                estado: 'Pendiente',
                añoEscolar: 2025,
                cuotas: [
                    { numero: 1, monto: 126500, pagada: true },
                    { numero: 2, monto: 126500, pagada: true },
                    { numero: 3, monto: 126500, pagada: true },
                    { numero: 4, monto: 126500, pagada: false }
                ]
            }
        ];
        
        console.log(`📊 Datos de prueba: ${datosEjemplo.length} alumnos`);
        
        // Simular migración exitosa
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                message: 'Migración de prueba completada',
                migrados: 1,
                errores: 0,
                total: 1,
                test: true
            })
        };
        
    } catch (error) {
        console.error('❌ Error en test:', error);
        
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: false,
                error: error.message,
                test: true
            })
        };
    }
};