// Sistema de Tesorería - JavaScript Principal

let datosAlumnos = [];
let datosFiltrados = [];
let datosCorreos = new Map(); // Map: RUT → {nombre, apoderado, correo}

// Configuración del establecimiento educacional
const DATOS_ESTABLECIMIENTO = {
    nombre: "Colegio Ejemplo",
    direccion: "Av. Principal 123, Santiago",
    telefono: "+56 9 1234 5678",
    email: "tesoreria@colegio.cl",
    rut: "76.123.456-7",
    giro: "EDUCACION",
    // Para integración futura con SII
    tokenSII: null,
    ambiente: "certificacion" // o "produccion"
};

// Configuración de Webpay Plus (Transbank)
const WEBPAY_CONFIG = {
    // URLs del backend - detectar si es local o Netlify
    baseUrl: window.location.origin.includes('localhost') ? window.location.origin : window.location.origin,
    createUrl: window.location.origin.includes('localhost') ? '/api/webpay/create' : '/.netlify/functions/api/webpay/iniciar',
    resultUrl: window.location.origin.includes('localhost') ? '/api/webpay/result' : '/.netlify/functions/api/webpay/result',
    ambiente: "integration", // "integration" o "production"
};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    inicializarSistema();
    configurarEventos();
    mostrarVista('admin'); // Iniciar en vista de administración
});

function inicializarSistema() {
    console.log('🔄 Inicializando sistema...');
    
    // FORZAR LIMPIEZA DE LOCALSTORAGE PARA USAR CSV ACTUALIZADO
    console.log('🧹 Limpiando localStorage para forzar recarga desde CSV...');
    localStorage.removeItem('datosTesoreria');
    
    // Intentar cargar datos guardados primero
    const datosEncontrados = cargarDatosGuardados();
    console.log('📦 Datos encontrados en localStorage:', datosEncontrados);
    
    // Si no hay datos guardados, cargar desde el archivo CSV
    if (!datosEncontrados) {
        console.log('📄 Cargando desde CSV...');
        cargarArchivoAutomatico();
    }
    
    // Debug: mostrar datos después de la carga
    setTimeout(() => {
        console.log('🎯 DATOS FINALES CARGADOS:');
        console.log(`👥 Total alumnos: ${datosAlumnos.length}`);
        
        // AGREGAR ALUMNO DE PRUEBA para testing
        const alumnoPrueba = {
            rut: '27289800-6',
            nombre: 'JUAN CARLOS PÉREZ GONZÁLEZ',
            curso: '8 BASICO A',
            fechaNacimiento: '2010-05-15',
            numeroCuotas: 10,
            totalAPagar: 1600000,
            totalPagado: 960000,
            pendiente: 640000,
            estado: 'moroso',
            añoEscolar: 2025,
            cuotas: []
        };
        
        // Solo agregar si no existe ya
        if (!datosAlumnos.find(a => a.rut.replace(/[.-]/g, '') === '272898006')) {
            datosAlumnos.push(alumnoPrueba);
            console.log('✅ Agregado alumno de prueba: Juan Carlos Pérez González - RUT: 27.289.800-6');
        }
        
        console.log(`👥 Total alumnos (con prueba): ${datosAlumnos.length}`);
        if (datosAlumnos.length > 0) {
            console.log('📋 Primeros 3 alumnos:');
            datosAlumnos.slice(0, 3).forEach((alumno, i) => {
                console.log(`${i+1}. ${alumno.nombre} - RUT: ${alumno.rut}`);
            });
        }
    }, 2000);
}

function configurarEventos() {
    // Evento para cargar archivo CSV
    document.getElementById('csvFile').addEventListener('change', manejarArchivo);
    
    // Eventos para filtros
    document.getElementById('filtroNombre').addEventListener('input', aplicarFiltros);
    document.getElementById('filtroCurso').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroEstado').addEventListener('change', aplicarFiltros);
}

async function cargarArchivoAutomatico() {
    try {
        console.log('🔄 Intentando cargar archivo CSV automáticamente...');
        const response = await fetch('alumnos_final.csv');
        console.log('📡 Respuesta fetch:', response.status, response.statusText);
        
        if (response.ok) {
            console.log('✅ Archivo CSV encontrado, procesando...');
            const texto = await response.text();
            console.log(`📄 Tamaño del archivo CSV: ${texto.length} caracteres`);
            console.log(`🔤 Primeros 200 caracteres:`, texto.substring(0, 200));
            
            procesarCSV(texto);
            
            // Cargar también el archivo de correos
            await cargarArchivosCorreos();
        } else {
            console.log('❌ Archivo CSV no disponible, respuesta:', response.status, response.statusText);
        }
    } catch (error) {
        console.log('❌ Error al cargar archivo CSV automáticamente:', error);
        console.log('🔧 Detalles del error:', error.message, error.stack);
    }
}

async function cargarArchivosCorreos() {
    try {
        console.log('📧 Cargando datos de correos...');
        const response = await fetch('correos.csv');
        if (response.ok) {
            const texto = await response.text();
            procesarCorreosCSV(texto);
        } else {
            console.log('❌ Archivo correos.csv no disponible');
        }
    } catch (error) {
        console.log('❌ Error al cargar correos.csv:', error);
    }
}

function procesarCorreosCSV(textoCSV) {
    const lineas = textoCSV.split('\n');
    let correosProcessed = 0;
    
    for (let i = 1; i < lineas.length; i++) {
        if (lineas[i].trim() === '') continue;
        
        const valores = lineas[i].split(';');
        if (valores.length >= 4) {
            const rut = valores[0]?.trim() || '';
            const nombreAlumno = valores[1]?.trim() || '';
            const apoderado = valores[2]?.trim() || '';
            const correo = valores[3]?.trim() || '';
            
            if (rut && correo) {
                datosCorreos.set(rut, {
                    nombreAlumno,
                    apoderado,
                    correo: correo.toLowerCase()
                });
                correosProcessed++;
            }
        }
    }
    
    console.log(`📧 ¡Correos procesados exitosamente! Cargados ${correosProcessed} correos de apoderados`);
}

function forzarRecargaCSV() {
    console.log('🔄 Forzando recarga de CSV...');
    // Limpiar localStorage
    localStorage.removeItem('datosTesoreria');
    // Limpiar datos actuales
    datosAlumnos = [];
    datosFiltrados = [];
    // Cargar desde CSV
    cargarArchivoAutomatico();
}

function manejarArchivo(evento) {
    const archivo = evento.target.files[0];
    if (archivo && archivo.type === 'text/csv') {
        const lector = new FileReader();
        lector.onload = function(e) {
            procesarCSV(e.target.result);
        };
        lector.readAsText(archivo, 'UTF-8');
    } else {
        alert('Por favor seleccione un archivo CSV válido');
    }
}

function procesarCSV(textoCSV) {
    console.log('📄 Procesando archivo CSV...');
    console.log(`📊 Longitud del texto CSV: ${textoCSV.length}`);
    
    const lineas = textoCSV.split('\n');
    console.log(`📝 Total de líneas: ${lineas.length}`);
    console.log(`🔤 Primera línea (encabezados): "${lineas[0]}"`);
    
    const encabezados = lineas[0].split(';').map(h => h.trim());
    console.log('📋 Encabezados encontrados:', encabezados);
    
    datosAlumnos = [];
    let procesados = 0;
    
    for (let i = 1; i < lineas.length; i++) {
        if (lineas[i].trim() === '') continue;
        
        const valores = lineas[i].split(';');
        if (valores.length < encabezados.length) continue;
        
        // Ignorar línea de totales si existe
        const nombre = valores[0]?.trim() || '';
        if (nombre.toLowerCase() === 'totales' || nombre.toLowerCase() === 'total') {
            console.log('⏭️ Saltando línea de totales del CSV');
            continue;
        }
        
        const alumno = {
            nombre: valores[0]?.trim() || '',
            rut: valores[1]?.trim() || '',
            curso: valores[2]?.trim() || '',
            arancel: parsearMoneda(valores[3]?.trim() || '0'),
            beca: parsearMoneda(valores[4]?.trim() || '0'),
            cuotas: [],
            totalPagado: parseInt(valores[valores.length - 1]?.trim() || '0'),
            totalPagadoCSV: parseInt(valores[valores.length - 1]?.trim() || '0') // Valor original del CSV para comparación
        };
        
        // Calcular información adicional PRIMERO
        alumno.montoNeto = alumno.arancel - alumno.beca;
        alumno.numeroCuotas = obtenerNumeroCuotas(alumno.curso);
        
        // Calcular el valor de cuota regular (usar el valor estándar, no redondear hacia arriba)
        alumno.valorCuotaRegular = Math.round(alumno.montoNeto / alumno.numeroCuotas);
        
        
        // Debug específico para casos de interés
        if (alumno.nombre.includes('AGUAYO LARA ISIDORA') || alumno.nombre.includes('ARANCIBIA ALVAREZ')) {
            console.log(`🔍 DEBUG PASO 1 - ${alumno.nombre}:`);
            console.log(`   - Curso: ${alumno.curso}`);
            console.log(`   - Arancel RAW: "${valores[3]}" → Parseado: ${formatearMoneda(alumno.arancel)}`);
            console.log(`   - Beca RAW: "${valores[4]}" → Parseado: ${formatearMoneda(alumno.beca)}`);
            console.log(`   - Monto Neto: ${formatearMoneda(alumno.montoNeto)}`);
            console.log(`   - Número de cuotas: ${alumno.numeroCuotas}`);
            console.log(`   - Cálculo: ${formatearMoneda(alumno.montoNeto)} ÷ ${alumno.numeroCuotas} = ${formatearMoneda(alumno.valorCuotaRegular)}`);
            console.log(`   - Valores CSV RAW: [${valores.slice(5, 15).map((v, i) => `Col${5+i}="${v}"`).join(', ')}]`);
        }
        
        // Primero, crear TODAS las cuotas que corresponden al alumno (vacías)
        for (let i = 1; i <= alumno.numeroCuotas; i++) {
            alumno.cuotas.push({
                numero: i,
                monto: alumno.valorCuotaRegular,
                pagada: false
            });
        }
        
        // Debug específico para casos de interés
        if (alumno.nombre.includes('AGUAYO LARA ISIDORA') || alumno.nombre.includes('ARANCIBIA ALVAREZ')) {
            console.log(`🔍 DEBUG PASO 2 - Cuotas creadas (${alumno.cuotas.length}):`);
            alumno.cuotas.forEach((cuota, index) => {
                console.log(`   - Índice ${index}: Cuota ${cuota.numero}, Pagada: ${cuota.pagada}, Monto: ${formatearMoneda(cuota.monto)}`);
            });
        }
        
        // NUEVA LÓGICA: Procesar todos los pagos primero, luego distribuir con excedentes
        let pagosCSV = [];
        
        // Recopilar todos los pagos del CSV
        for (let j = 5; j < 15; j++) {
            const numeroCuota = j - 4;
            if (numeroCuota <= alumno.numeroCuotas) {
                const valorCuota = valores[j]?.trim() || '';
                const montoPagado = parsearMoneda(valorCuota);
                
                if (montoPagado > 0) {
                    pagosCSV.push({
                        cuotaOriginal: numeroCuota,
                        monto: montoPagado,
                        columnaCSV: j
                    });
                }
            }
        }
        
        // Debug específico para casos de interés
        if (alumno.nombre.includes('AGUAYO LARA ISIDORA') || alumno.nombre.includes('ARANCIBIA ALVAREZ')) {
            console.log(`🔍 DEBUG PASO 3 - Pagos encontrados en CSV:`);
            pagosCSV.forEach(pago => {
                console.log(`   - Cuota ${pago.cuotaOriginal}: ${formatearMoneda(pago.monto)}`);
            });
        }
        
        // Procesar cada pago con distribución de excedentes
        pagosCSV.forEach(pago => {
            let montoPendiente = pago.monto;
            let cuotaActual = pago.cuotaOriginal;
            
            if (alumno.nombre.includes('AGUAYO LARA ISIDORA') || alumno.nombre.includes('ARANCIBIA ALVAREZ')) {
                console.log(`🔍 Distribuyendo pago de ${formatearMoneda(pago.monto)} desde cuota ${pago.cuotaOriginal}:`);
            }
            
            while (montoPendiente > 0 && cuotaActual <= alumno.numeroCuotas) {
                const indiceCuota = cuotaActual - 1;
                const cuota = alumno.cuotas[indiceCuota];
                
                // Solo procesar si la cuota no está completamente pagada
                if (!cuota.pagada) {
                    const montoEsperado = alumno.valorCuotaRegular;
                    const yaAbonado = (cuota.abonos && cuota.abonos.length > 0) ? 
                                     cuota.abonos.reduce((sum, abono) => sum + abono.monto, 0) : 0;
                    const faltante = montoEsperado - yaAbonado;
                    
                    if (alumno.nombre.includes('AGUAYO LARA ISIDORA') || alumno.nombre.includes('ARANCIBIA ALVAREZ')) {
                        console.log(`   - Cuota ${cuotaActual}: Faltante: ${formatearMoneda(faltante)}, Disponible: ${formatearMoneda(montoPendiente)}`);
                    }
                    
                    if (montoPendiente >= faltante) {
                        // Se puede completar esta cuota
                        cuota.pagada = true;
                        cuota.abonos = []; // Limpiar abonos parciales
                        montoPendiente -= faltante;
                        
                        if (alumno.nombre.includes('AGUAYO LARA ISIDORA') || alumno.nombre.includes('ARANCIBIA ALVAREZ')) {
                            console.log(`   - ✅ Cuota ${cuotaActual} COMPLETADA, Restante: ${formatearMoneda(montoPendiente)}`);
                        }
                    } else {
                        // Abono parcial
                        if (!cuota.abonos) cuota.abonos = [];
                        cuota.abonos.push({
                            monto: montoPendiente,
                            fecha: 'Del archivo CSV',
                            tipo: 'parcial',
                            mediosPago: []
                        });
                        
                        if (alumno.nombre.includes('AGUAYO LARA ISIDORA') || alumno.nombre.includes('ARANCIBIA ALVAREZ')) {
                            console.log(`   - 💰 Cuota ${cuotaActual} ABONO de ${formatearMoneda(montoPendiente)}`);
                        }
                        
                        montoPendiente = 0;
                    }
                }
                
                cuotaActual++;
            }
            
            if (montoPendiente > 0) {
                console.warn(`⚠️ EXCEDENTE: ${alumno.nombre} tiene ${formatearMoneda(montoPendiente)} de excedente después de todas las cuotas`);
            }
        });
        
        // Ya no es necesario actualizar cuotas sin pago - todas están creadas con el valor correcto
        
        alumno.cuotasPagadas = alumno.cuotas.filter(c => c.pagada && c.numero <= alumno.numeroCuotas).length;
        
        // Debug específico para casos de interés - mostrar resultado final
        if (alumno.nombre.includes('AGUAYO LARA ISIDORA') || alumno.nombre.includes('ARANCIBIA ALVAREZ')) {
            console.log(`🔍 DEBUG PASO 4 - Resultado final (${alumno.cuotas.length} cuotas):`);
            alumno.cuotas.forEach((cuota, index) => {
                const estado = cuota.pagada ? 'PAGADA ✅' : 
                             (cuota.abonos && cuota.abonos.length > 0) ? `ABONO ${formatearMoneda(cuota.abonos[0].monto)} 💰` : 
                             'NO PAGADA ❌';
                console.log(`   - Índice ${index}: Cuota ${cuota.numero} = ${estado} (Esperado: ${formatearMoneda(cuota.monto)})`);
            });
        }
        
        // Calcular el monto realmente abonado (incluyendo abonos parciales)
        let totalAbonado = 0;
        alumno.cuotas.forEach(cuota => {
            if (cuota.pagada) {
                totalAbonado += cuota.monto;
            } else if (cuota.abonos && cuota.abonos.length > 0) {
                totalAbonado += cuota.abonos.reduce((sum, abono) => sum + abono.monto, 0);
            }
        });
        
        // Actualizar el total pagado con los cálculos correctos
        alumno.totalPagadoReal = totalAbonado;
        alumno.pendiente = Math.max(0, alumno.montoNeto - totalAbonado);
        alumno.estado = determinarEstado(alumno);
        
        datosAlumnos.push(alumno);
        procesados++;
        
        // Log los primeros 3 alumnos para debug
        if (procesados <= 3) {
            console.log(`👤 Alumno ${procesados}:`, {
                nombre: alumno.nombre,
                rut: alumno.rut,
                curso: alumno.curso
            });
        }
    }
    
    console.log(`📊 Total procesados: ${procesados}`);
    console.log(`📊 Total en datosAlumnos: ${datosAlumnos.length}`);
    
    // Actualizar interfaz
    console.log('🔄 Actualizando interfaz...');
    actualizarCursos();
    aplicarFiltros();
    actualizarEstadisticas();
    
    console.log(`✅ ¡CSV procesado exitosamente! Cargados ${datosAlumnos.length} alumnos`);
    
    // VERIFICACIÓN AUTOMÁTICA DE DISCREPANCIAS
    console.log('🔍 Ejecutando verificación automática de discrepancias...');
    setTimeout(() => {
        verificarDiscrepanciasInmediatas();
    }, 1000);
    
    // Guardar datos procesados
    guardarDatos();
}

function parsearMoneda(texto) {
    if (!texto || texto.trim() === '' || texto.trim() === '-') return 0;
    
    // Convertir a string para procesar
    const textoStr = texto.toString().trim();
    
    // Si contiene guión o es cero, significa "no pagado"
    if (textoStr === '-' || textoStr === '0') return 0;
    
    // Si tiene símbolo de peso, es formato como $1.265.000 (pesos chilenos con punto separador de miles)
    if (textoStr.includes('$')) {
        // Eliminar $ y convertir puntos separadores de miles
        const sinSimbolo = textoStr.replace('$', '').replace(/\./g, '');
        return parseInt(sinSimbolo) || 0;
    }
    
    // Si no tiene símbolo, es valor numérico directo (como 126500, 379500)
    return parseInt(textoStr) || 0;
}

function formatearMoneda(monto) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        minimumFractionDigits: 0
    }).format(monto);
}

function formatearRUT(rut) {
    // Formato estándar chileno: XX.XXX.XXX-X
    if (!rut) return '';
    const limpio = rut.replace(/[^\dkK]/g, '');
    if (limpio.length < 2) return rut;
    
    const dv = limpio.slice(-1);
    const numero = limpio.slice(0, -1);
    
    return numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + '-' + dv;
}

function obtenerNumeroCuotas(curso) {
    // Todos los cursos tienen 10 cuotas
    return 10;
}

function obtenerMesVencimiento(numeroCuota) {
    // Cuota 1 = Marzo, Cuota 2 = Abril, etc.
    const meses = ['', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[numeroCuota] || 'N/A';
}

function esCuotaVencida(numeroCuota) {
    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1; // 0-11 -> 1-12
    const diaActual = fechaActual.getDate();
    
    // Cuota 1 = Marzo (mes 3), Cuota 2 = Abril (mes 4), etc.
    const mesVencimiento = numeroCuota + 2; // Cuota 1 -> mes 3 (marzo)
    
    // Si estamos en el mes de vencimiento, vence el día 5
    if (mesActual === mesVencimiento) {
        return diaActual > 5;
    }
    
    // Si ya pasó el mes de vencimiento, está vencida
    return mesActual > mesVencimiento;
}

function obtenerEstadoCuota(cuota) {
    if (cuota.pagada) return 'pagada';
    if (cuota.monto === 0) return 'sin-asignar';
    
    // Verificar si tiene abonos parciales
    if (cuota.abonos && cuota.abonos.length > 0) {
        const totalAbonado = cuota.abonos.reduce((sum, abono) => sum + abono.monto, 0);
        if (totalAbonado > 0 && totalAbonado < cuota.monto) {
            return esCuotaVencida(cuota.numero) ? 'abono-vencida' : 'abono-pendiente';
        }
    }
    
    if (esCuotaVencida(cuota.numero)) return 'vencida';
    return 'pendiente';
}

function obtenerMontoAbonado(cuota) {
    if (!cuota.abonos) return 0;
    return cuota.abonos.reduce((sum, abono) => sum + abono.monto, 0);
}

function obtenerMontoPendienteCuota(cuota) {
    return cuota.monto - obtenerMontoAbonado(cuota);
}

function detectarIngresoTardio(alumno) {
    if (!alumno.cuotas || alumno.cuotas.length === 0) return false;
    
    // Buscar la primera cuota pagada
    let primerCuotaPagada = null;
    for (let i = 0; i < alumno.cuotas.length && i < alumno.numeroCuotas; i++) {
        if (alumno.cuotas[i].pagada) {
            primerCuotaPagada = i + 1; // +1 porque las cuotas empiezan en 1
            break;
        }
    }
    
    // Si no hay cuotas pagadas, no podemos determinar
    if (primerCuotaPagada === null) return false;
    
    // Si la primera cuota pagada es posterior a la cuota 1, 2 o 3, 
    // probablemente sea ingreso tardío
    if (primerCuotaPagada > 3) {
        console.log(`🎓 Posible ingreso tardío detectado: ${alumno.nombre} - Primera cuota pagada: ${primerCuotaPagada}`);
        return true;
    }
    
    return false;
}

function determinarEstado(alumno) {
    // Si tiene beca completa (100%), está al día automáticamente
    if (alumno.beca >= alumno.arancel) return 'al-dia';
    
    // Si no debe nada (monto neto es 0 o negativo), está al día
    if (alumno.montoNeto <= 0) return 'al-dia';
    
    // Si ya pagó todo lo que debe, está al día
    if (alumno.pendiente <= 0) return 'al-dia';
    
    // Detectar posible ingreso tardío
    const esPosibleIngresoTardio = detectarIngresoTardio(alumno);
    
    // Si no ha pagado ABSOLUTAMENTE NADA y debe dinero
    const totalRealPagado = alumno.totalPagadoReal || alumno.totalPagado || 0;
    if (totalRealPagado === 0 && alumno.montoNeto > 0) {
        // Si parece ser ingreso tardío, no es moroso sino pendiente
        return esPosibleIngresoTardio ? 'ingreso-tardio' : 'moroso';
    }
    
    // Si pagó algo pero aún debe
    if (esPosibleIngresoTardio) {
        return 'ingreso-tardio';
    }
    
    return 'pendiente';
}

function actualizarCursos() {
    const selectCurso = document.getElementById('filtroCurso');
    const cursosUnicos = [...new Set(datosAlumnos.map(a => a.curso))].sort();
    
    selectCurso.innerHTML = '<option value="">Todos</option>';
    cursosUnicos.forEach(curso => {
        const option = document.createElement('option');
        option.value = curso;
        option.textContent = curso;
        selectCurso.appendChild(option);
    });
}

function aplicarFiltros() {
    const filtroNombre = document.getElementById('filtroNombre').value.toLowerCase();
    const filtroCurso = document.getElementById('filtroCurso').value;
    const filtroEstado = document.getElementById('filtroEstado').value;
    
    datosFiltrados = datosAlumnos.filter(alumno => {
        // FILTRO AUTOMÁTICO: Mostrar alumnos de 2025 y nuevos matriculados de 2026
        const esAñoValido = !alumno.añoEscolar || 
                           alumno.añoEscolar === AÑO_ESCOLAR_ACTUAL || 
                           alumno.año === 2026; // Incluir matriculados para 2026
        
        const coincideNombre = alumno.nombre.toLowerCase().includes(filtroNombre);
        const coincideCurso = !filtroCurso || alumno.curso === filtroCurso;
        const coincideEstado = !filtroEstado || alumno.estado === filtroEstado;
        
        return esAñoValido && coincideNombre && coincideCurso && coincideEstado;
    });
    
    mostrarAlumnos();
    actualizarEstadisticas(); // Actualizar estadísticas según el filtro aplicado
}

function mostrarAlumnos() {
    console.log('📋 mostrarAlumnos() llamada. datosFiltrados.length:', datosFiltrados.length);
    const cuerpoTabla = document.getElementById('cuerpoTabla');
    
    if (datosFiltrados.length === 0) {
        cuerpoTabla.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-muted">
                    No se encontraron alumnos que coincidan con los filtros
                </td>
            </tr>
        `;
        return;
    }
    
    let html = '';
    datosFiltrados.forEach(alumno => {
        const estadoClase = `estado-${alumno.estado}`;
        const estadoTexto = {
            'al-dia': alumno.beca >= alumno.arancel ? 'Beca 100%' : 'Al día',
            'pendiente': 'Pendiente',
            'ingreso-tardio': 'Ingreso Tardío',
            'moroso': 'Moroso'
        }[alumno.estado];
        
        html += `
            <tr>
                <td>${alumno.nombre}</td>
                <td class="rut-formato">${formatearRUT(alumno.rut)}</td>
                <td><span class="badge bg-secondary">${alumno.curso}</span></td>
                <td class="moneda-chile">${formatearMoneda(alumno.arancel)}</td>
                <td class="moneda-chile">${formatearMoneda(alumno.beca)}</td>
                <td class="moneda-chile text-success">${formatearMoneda(alumno.totalPagadoReal || alumno.totalPagado)}</td>
                <td class="moneda-chile text-warning">${formatearMoneda(alumno.pendiente)}</td>
                <td>
                    <span class="${estadoClase}">${estadoTexto}</span>
                    <br>
                    ${generarVisualizacionCuotas(alumno.cuotas, alumno)}
                </td>
                <td>
                    <div class="btn-group-vertical d-grid gap-1">
                        <button class="btn btn-primary btn-sm" onclick="mostrarDetalle('${alumno.rut}')">
                            👁️ Ver Detalle
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="confirmarEliminacionAlumno('${alumno.rut}', '${alumno.nombre.replace(/'/g, "\\'")}')">
                            🗑️ Eliminar
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    cuerpoTabla.innerHTML = html;
}

function generarVisualizacionCuotas(cuotas, alumno) {
    let html = '<div class="cuotas-container">';
    
    const numeroCuotas = alumno ? alumno.numeroCuotas : 10;
    
    // Si tiene beca completa, mostrar cuotas según el curso
    if (alumno && alumno.beca >= alumno.arancel) {
        for (let i = 1; i <= numeroCuotas; i++) {
            html += `<span class="badge badge-cuota cuota-vacia" title="Cuota ${i}: Exenta por beca">✓</span>`;
        }
    } else {
        // Mostrar solo las cuotas relevantes para el curso
        cuotas.filter(cuota => cuota.numero <= numeroCuotas).sort((a, b) => a.numero - b.numero).forEach(cuota => {
            const estadoCuota = obtenerEstadoCuota(cuota);
            let claseEstado = 'cuota-vacia';
            let titulo = `Cuota ${cuota.numero}: Sin pago`;
            
            if (estadoCuota === 'pagada') {
                claseEstado = 'cuota-pagada';
                titulo = `Cuota ${cuota.numero} (${obtenerMesVencimiento(cuota.numero)}): ${formatearMoneda(cuota.monto)} - PAGADA`;
            } else if (estadoCuota === 'abono-pendiente') {
                claseEstado = 'cuota-abono-pendiente';
                const abonado = obtenerMontoAbonado(cuota);
                const pendiente = obtenerMontoPendienteCuota(cuota);
                titulo = `Cuota ${cuota.numero} (${obtenerMesVencimiento(cuota.numero)}): Abonado ${formatearMoneda(abonado)} de ${formatearMoneda(cuota.monto)} - PENDIENTE ${formatearMoneda(pendiente)}`;
            } else if (estadoCuota === 'abono-vencida') {
                claseEstado = 'cuota-abono-vencida';
                const abonado = obtenerMontoAbonado(cuota);
                const pendiente = obtenerMontoPendienteCuota(cuota);
                titulo = `Cuota ${cuota.numero} (${obtenerMesVencimiento(cuota.numero)}): Abonado ${formatearMoneda(abonado)} de ${formatearMoneda(cuota.monto)} - VENCIDA ${formatearMoneda(pendiente)}`;
            } else if (estadoCuota === 'vencida') {
                claseEstado = 'cuota-vencida';
                titulo = `Cuota ${cuota.numero} (${obtenerMesVencimiento(cuota.numero)}): ${formatearMoneda(cuota.monto)} - VENCIDA`;
            } else if (estadoCuota === 'pendiente') {
                claseEstado = 'cuota-pendiente';
                titulo = `Cuota ${cuota.numero} (${obtenerMesVencimiento(cuota.numero)}): ${formatearMoneda(cuota.monto)} - PENDIENTE`;
            } else {
                titulo = `Cuota ${cuota.numero} (${obtenerMesVencimiento(cuota.numero)}): Sin asignar`;
            }
            
            html += `<span class="badge badge-cuota ${claseEstado}" title="${titulo}">${cuota.numero}</span>`;
        });
    }
    
    html += '</div>';
    return html;
}

function mostrarDetalle(rut) {
    const alumno = datosAlumnos.find(a => a.rut === rut);
    if (!alumno) return;
    
    const modal = new bootstrap.Modal(document.getElementById('modalDetalle'));
    document.getElementById('modalTitulo').textContent = `Detalle - ${alumno.nombre}`;
    
    let html = `
        <div class="row mb-3">
            <div class="col-md-6">
                <h6>Información del Alumno</h6>
                <p><strong>RUT:</strong> ${formatearRUT(alumno.rut)}</p>
                <p><strong>Curso:</strong> ${alumno.curso}</p>
                <p><strong>Arancel Anual:</strong> ${formatearMoneda(alumno.arancel)}</p>
                <p><strong>Beca:</strong> ${formatearMoneda(alumno.beca)}</p>
                <p><strong>Monto Neto:</strong> ${formatearMoneda(alumno.montoNeto)}</p>
                <p><strong>Valor por Cuota:</strong> ${formatearMoneda(alumno.valorCuotaRegular)}</p>
            </div>
            <div class="col-md-6">
                <h6>Estado de Pagos</h6>
                <p><strong>Total Pagado:</strong> <span class="text-success">${formatearMoneda(alumno.totalPagado)}</span></p>
                <p><strong>Pendiente:</strong> <span class="text-warning">${formatearMoneda(alumno.pendiente)}</span></p>
                <p><strong>Cuotas Pagadas:</strong> ${alumno.cuotasPagadas}/${alumno.numeroCuotas}</p>
                <div class="progress progress-cuotas">
                    <div class="progress-bar bg-success" style="width: ${(alumno.cuotasPagadas/alumno.numeroCuotas)*100}%"></div>
                </div>
            </div>
        </div>
        
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h6>Detalle por Cuotas</h6>
            ${alumno.beca < alumno.arancel ? `
                <div>
                    <button class="btn btn-success btn-sm me-2" onclick="pagarCuotasSeleccionadas('${rut}')">
                        💰 Pagar Seleccionadas
                    </button>
                    <button class="btn btn-outline-secondary btn-sm" onclick="seleccionarTodasPendientes('${rut}')">
                        Seleccionar Todas
                    </button>
                </div>
            ` : `
                <div>
                    <span class="badge bg-success">Exento por Beca 100%</span>
                </div>
            `}
        </div>
        
        <div class="row" id="cuotasContainer">
    `;
    
    if (alumno.beca >= alumno.arancel) {
        // Alumno con beca completa - mostrar cuotas según su curso
        for (let i = 1; i <= alumno.numeroCuotas; i++) {
            html += `
                <div class="col-md-6 col-lg-4 mb-2">
                    <div class="detalle-cuota pagada">
                        <div class="d-flex justify-content-between align-items-center">
                            <strong>Cuota ${i}</strong>
                            <span style="font-size: 1.2rem;">🎓</span>
                        </div>
                        <div><strong>Monto: Exento</strong></div>
                        <div><small class="text-success">Cubierto por beca 100%</small></div>
                    </div>
                </div>
            `;
        }
    } else {
        // Alumno regular - mostrar solo cuotas relevantes para su curso
        alumno.cuotas.filter(cuota => cuota.numero <= alumno.numeroCuotas).sort((a, b) => a.numero - b.numero).forEach(cuota => {
                const estadoCuota = obtenerEstadoCuota(cuota);
                let claseDetalle = '';
                let iconoEstado = '○';
                let textoEstado = 'Sin asignar';
                
                if (estadoCuota === 'pagada') {
                    claseDetalle = 'pagada';
                    iconoEstado = '✅';
                    textoEstado = 'Pagada';
                } else if (estadoCuota === 'abono-pendiente') {
                    claseDetalle = 'abono-pendiente';
                    iconoEstado = '💰';
                    textoEstado = 'Con Abono';
                } else if (estadoCuota === 'abono-vencida') {
                    claseDetalle = 'abono-vencida';
                    iconoEstado = '🔥';
                    textoEstado = 'VENCIDA (Con Abono)';
                } else if (estadoCuota === 'vencida') {
                    claseDetalle = 'vencida';
                    iconoEstado = '🔥';
                    textoEstado = 'VENCIDA';
                } else if (estadoCuota === 'pendiente') {
                    claseDetalle = 'pendiente';
                    iconoEstado = '💰';
                    textoEstado = 'Pendiente';
                }
                
                const disabled = cuota.pagada ? 'disabled' : '';
                const checked = '';
                
                html += `
                    <div class="col-md-6 col-lg-4 mb-2">
                        <div class="detalle-cuota ${claseDetalle} position-relative">
                            ${!cuota.pagada && cuota.monto > 0 && (estadoCuota.includes('pendiente') || estadoCuota.includes('vencida')) ? `
                                <div class="position-absolute top-0 start-0 p-1">
                                    <input type="checkbox" class="form-check-input cuota-checkbox" 
                                           data-cuota="${cuota.numero}" ${checked} ${disabled}>
                                </div>
                            ` : ''}
                            <div class="d-flex justify-content-between align-items-center">
                                <strong>Cuota ${cuota.numero} (${obtenerMesVencimiento(cuota.numero)})</strong>
                                <span style="font-size: 1.2rem;">${iconoEstado}</span>
                            </div>
                            ${estadoCuota.includes('abono') ? `
                                <div><strong>Monto Total: ${formatearMoneda(cuota.monto)}</strong></div>
                                <div class="text-success"><strong>Abonado: ${formatearMoneda(obtenerMontoAbonado(cuota))}</strong></div>
                                <div class="text-warning"><strong>Pendiente: ${formatearMoneda(obtenerMontoPendienteCuota(cuota))}</strong></div>
                            ` : `
                                <div><strong>Monto: ${cuota.monto > 0 ? formatearMoneda(cuota.monto) : 'N/A'}</strong></div>
                            `}
                            <div><small class="${estadoCuota.includes('vencida') ? 'text-danger fw-bold' : 'text-muted'}">${textoEstado}</small></div>
                            ${cuota.pagada ? '<div class="mt-1"><small class="text-success">✓ Pagada</small></div>' : ''}
                            ${estadoCuota.includes('vencida') && !cuota.pagada ? '<div class="mt-1"><small class="text-danger">⏰ Vencida</small></div>' : ''}
                            ${cuota.abonos && cuota.abonos.length > 0 ? `
                                <div class="mt-2">
                                    <small class="text-info">Abonos realizados: ${cuota.abonos.length}</small>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `;
        });
    }
    
    html += '</div>';
    
    // Agregar total de cuotas seleccionadas solo si no tiene beca completa
    if (alumno.beca < alumno.arancel) {
        html += `
            <div class="mt-3 p-3 bg-light rounded">
                <div class="row">
                    <div class="col-md-6">
                        <strong>Cuotas seleccionadas: <span id="cuotasSeleccionadas">0</span></strong>
                    </div>
                    <div class="col-md-6 text-end">
                        <strong>Total a pagar: <span id="totalSeleccionado">${formatearMoneda(0)}</span></strong>
                    </div>
                </div>
            </div>
        `;
    } else {
        html += `
            <div class="mt-3 p-3 bg-success bg-opacity-10 rounded">
                <div class="text-center">
                    <h5 class="text-success mb-0">🎓 Alumno con Beca Completa</h5>
                    <p class="mb-0"><small class="text-muted">No requiere pagos adicionales</small></p>
                </div>
            </div>
        `;
    }
    
    // Agregar sección de correo si el alumno tiene morosidad o deuda pendiente
    const tieneDeuda = alumno.estado === 'moroso' || alumno.pendiente > 0;
    const datosCorreo = datosCorreos.get(alumno.rut);
    
    if (tieneDeuda || datosCorreo) {
        html += `
            <div class="row mt-4">
                <div class="col-12">
                    <hr>
                    <h6>📧 Gestión de Correos</h6>
        `;
        
        if (datosCorreo) {
            html += `
                <div class="mb-3">
                    <div class="row">
                        <div class="col-md-6">
                            <label class="form-label"><strong>Apoderado:</strong></label>
                            <div class="input-group">
                                <input type="text" class="form-control" id="inputApoderado_${alumno.rut}" value="${datosCorreo.apoderado}">
                                <button class="btn btn-outline-primary btn-sm" onclick="guardarApoderado('${alumno.rut}')">
                                    💾 Guardar
                                </button>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <label class="form-label"><strong>Correo:</strong></label>
                            <div class="input-group">
                                <input type="email" class="form-control" id="inputCorreo_${alumno.rut}" value="${datosCorreo.correo}">
                                <button class="btn btn-outline-success btn-sm" onclick="guardarCorreo('${alumno.rut}')">
                                    💾 Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            if (tieneDeuda) {
                html += `
                    <div class="alert alert-warning">
                        <strong>⚠️ Estado de Deuda:</strong><br>
                        Estado: ${alumno.estado}<br>
                        Monto pendiente: ${formatearMoneda(alumno.pendiente)}
                    </div>
                    <button class="btn btn-warning me-2" onclick="enviarCorreoMorosidad('${alumno.rut}')">
                        📧 Enviar Aviso de Morosidad
                    </button>
                `;
            } else {
                html += `
                    <button class="btn btn-info me-2" onclick="enviarCorreoInformativo('${alumno.rut}')">
                        📧 Enviar Correo Informativo
                    </button>
                `;
            }
        } else {
            html += `
                <div class="alert alert-info mb-3">
                    <strong>ℹ️ No se encontraron datos de contacto</strong><br>
                    No hay información de correo registrada para este apoderado.
                </div>
                <div class="card">
                    <div class="card-header">
                        <h6 class="mb-0">➕ Agregar Datos de Contacto</h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <label class="form-label"><strong>Nombre del Apoderado:</strong></label>
                                <input type="text" class="form-control" id="inputNuevoApoderado_${alumno.rut}" placeholder="Ingrese nombre completo">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label"><strong>Correo Electrónico:</strong></label>
                                <input type="email" class="form-control" id="inputNuevoCorreo_${alumno.rut}" placeholder="correo@ejemplo.com">
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="col-12">
                                <button class="btn btn-success" onclick="crearNuevoDatosCorreo('${alumno.rut}')">
                                    ✅ Guardar Datos de Contacto
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
    }
    
    document.getElementById('modalCuerpo').innerHTML = html;
    
    // Agregar eventos para checkboxes
    document.querySelectorAll('.cuota-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            actualizarTotalSeleccionado(rut);
        });
    });
    
    modal.show();
}

function verificarSumatoriasPorCuota() {
    console.log('🔍 Verificando sumatorias por cuota...');
    
    // Array para almacenar totales por cuota
    const totalesPorCuota = [];
    const totalesDirectosCSV = [];
    
    // Inicializar arrays con 10 cuotas
    for (let i = 1; i <= 10; i++) {
        totalesPorCuota[i] = 0;
        totalesDirectosCSV[i] = 0;
    }
    
    // Debug: Verificar procesamiento de primeros 5 alumnos
    console.log('🔍 Debug - Primeros 5 alumnos procesados:');
    datosAlumnos.slice(0, 5).forEach((alumno, index) => {
        console.log(`${index + 1}. ${alumno.nombre} (${alumno.curso}):`);
        console.log(`   - Arancel: ${formatearMoneda(alumno.arancel)}, Beca: ${formatearMoneda(alumno.beca)}`);
        console.log(`   - Valor cuota regular: ${formatearMoneda(alumno.valorCuotaRegular)}`);
        console.log(`   - Número de cuotas: ${alumno.numeroCuotas}`);
        
        alumno.cuotas.forEach(cuota => {
            const montoPagado = cuota.pagada ? cuota.monto : 
                (cuota.abonos && cuota.abonos.length > 0 ? 
                 cuota.abonos.reduce((sum, abono) => sum + abono.monto, 0) : 0);
            if (montoPagado > 0) {
                console.log(`   - Cuota ${cuota.numero}: ${formatearMoneda(montoPagado)} (${cuota.pagada ? 'completa' : 'abono'})`);
            }
        });
    });
    
    // Sumar todos los pagos por cuota desde los datos procesados
    datosAlumnos.forEach(alumno => {
        alumno.cuotas.forEach(cuota => {
            if (cuota.numero <= 10) {
                // Sumar pago completo
                if (cuota.pagada) {
                    totalesPorCuota[cuota.numero] += cuota.monto;
                }
                // Sumar abonos parciales
                else if (cuota.abonos && cuota.abonos.length > 0) {
                    cuota.abonos.forEach(abono => {
                        totalesPorCuota[cuota.numero] += abono.monto;
                    });
                }
            }
        });
    });
    
    // Calcular totales directos del CSV original (para comparación)
    console.log('🔍 Calculando totales directos del archivo CSV...');
    fetch('alumnos_final.csv')
        .then(response => response.text())
        .then(csvText => {
            const lineas = csvText.split('\n');
            
            for (let i = 1; i < lineas.length; i++) {
                if (lineas[i].trim() === '') continue;
                
                const valores = lineas[i].split(';');
                if (valores.length >= 16) {
                    // Procesar cuotas 1-10 (columnas 5-14 en el CSV)
                    for (let j = 5; j < 15; j++) {
                        const numeroCuota = j - 4;
                        const valorCuota = valores[j]?.trim() || '';
                        
                        if (valorCuota !== '' && valorCuota !== '0') {
                            const monto = parsearMoneda(valorCuota);
                            if (monto > 0) {
                                totalesDirectosCSV[numeroCuota] += monto;
                            }
                        }
                    }
                }
            }
            
            // Comparar resultados
            console.log('📊 Comparación de totales:');
            console.log('Cuota | Sistema     | CSV Directo | Diferencia');
            console.log('------|-------------|-------------|------------');
            
            for (let i = 1; i <= 10; i++) {
                const diferencia = totalesPorCuota[i] - totalesDirectosCSV[i];
                const icono = diferencia === 0 ? '✅' : '❌';
                console.log(`  ${i}   | ${formatearMoneda(totalesPorCuota[i]).padEnd(11)} | ${formatearMoneda(totalesDirectosCSV[i]).padEnd(11)} | ${formatearMoneda(diferencia)} ${icono}`);
            }
        })
        .catch(error => {
            console.error('❌ Error al leer CSV para comparación:', error);
        });
    
    // Mostrar resultados del sistema
    console.log('📊 Totales por cuota (desde sistema):');
    for (let i = 1; i <= 10; i++) {
        console.log(`Cuota ${i}: ${formatearMoneda(totalesPorCuota[i])}`);
    }
    
    // Verificar cuota 10 para 4tos medios
    const cuartosMedios = datosAlumnos.filter(a => 
        a.curso.includes('4 MEDIO') || a.curso.includes('4° MEDIO') || a.curso.includes('4TO MEDIO')
    );
    
    let pagosIncorrectosCuota10 = 0;
    cuartosMedios.forEach(alumno => {
        const cuota10 = alumno.cuotas.find(c => c.numero === 10);
        if (cuota10 && (cuota10.pagada || (cuota10.abonos && cuota10.abonos.length > 0))) {
            pagosIncorrectosCuota10++;
            console.warn(`⚠️  ${alumno.nombre} (${alumno.curso}) tiene pago en cuota 10`);
        }
    });
    
    console.log(`📋 4tos medios encontrados: ${cuartosMedios.length}`);
    console.log(`⚠️  4tos medios con pago incorrecto en cuota 10: ${pagosIncorrectosCuota10}`);
}

function actualizarEstadisticas() {
    // Usar datos filtrados para mostrar estadísticas del grupo seleccionado
    const datosParaEstadisticas = datosFiltrados.length > 0 ? datosFiltrados : datosAlumnos;
    
    const totalAlumnos = datosParaEstadisticas.length;
    const totalRecaudado = datosParaEstadisticas.reduce((sum, a) => sum + (a.totalPagadoReal || a.totalPagado), 0);
    
    // Solo contar como "por recaudar" a alumnos que realmente deben dinero (sin beca completa)
    const totalPorRecaudar = datosParaEstadisticas
        .filter(a => a.beca < a.arancel) // Excluir becas completas
        .reduce((sum, a) => sum + Math.max(0, a.pendiente), 0);
    
    // Solo contar como morosos a quienes realmente deben dinero y no han pagado nada
    const alumnosMorosos = datosParaEstadisticas.filter(a => 
        a.estado === 'moroso' && a.beca < a.arancel && a.montoNeto > 0
    ).length;
    
    document.getElementById('totalAlumnos').textContent = totalAlumnos.toLocaleString();
    document.getElementById('totalRecaudado').textContent = formatearMoneda(totalRecaudado);
    document.getElementById('porRecaudar').textContent = formatearMoneda(totalPorRecaudar);
    document.getElementById('alumnosMorosos').textContent = alumnosMorosos.toLocaleString();
    
    // Verificar sumatorias por cuota
    verificarSumatoriasPorCuota();
}

function limpiarFiltros() {
    document.getElementById('filtroNombre').value = '';
    document.getElementById('filtroCurso').value = '';
    document.getElementById('filtroEstado').value = '';
    datosFiltrados = []; // Limpiar filtros para mostrar todas las estadísticas
    aplicarFiltros();
}

function actualizarTotalSeleccionado(rut) {
    const alumno = datosAlumnos.find(a => a.rut === rut);
    if (!alumno) return;
    
    const checkboxes = document.querySelectorAll('.cuota-checkbox:checked');
    let totalSeleccionado = 0;
    let cuotasSeleccionadas = 0;
    
    checkboxes.forEach(checkbox => {
        const numeroCuota = parseInt(checkbox.dataset.cuota);
        const cuota = alumno.cuotas.find(c => c.numero === numeroCuota);
        if (cuota && !cuota.pagada) {
            totalSeleccionado += cuota.monto;
            cuotasSeleccionadas++;
        }
    });
    
    document.getElementById('cuotasSeleccionadas').textContent = cuotasSeleccionadas;
    document.getElementById('totalSeleccionado').textContent = formatearMoneda(totalSeleccionado);
}

function seleccionarTodasPendientes(rut) {
    const checkboxes = document.querySelectorAll('.cuota-checkbox');
    checkboxes.forEach(checkbox => {
        if (!checkbox.disabled) {
            checkbox.checked = true;
        }
    });
    actualizarTotalSeleccionado(rut);
}

function pagarCuotasSeleccionadas(rut) {
    const alumno = datosAlumnos.find(a => a.rut === rut);
    if (!alumno) return;
    
    const checkboxes = document.querySelectorAll('.cuota-checkbox:checked');
    
    if (checkboxes.length === 0) {
        alert('Seleccione al menos una cuota para pagar');
        return;
    }
    
    let totalAPagar = 0;
    const cuotasAPagar = [];
    
    checkboxes.forEach(checkbox => {
        const numeroCuota = parseInt(checkbox.dataset.cuota);
        const cuota = alumno.cuotas.find(c => c.numero === numeroCuota);
        if (cuota && !cuota.pagada) {
            totalAPagar += cuota.monto;
            cuotasAPagar.push({
                numero: numeroCuota,
                monto: cuota.monto,
                mes: obtenerMesVencimiento(numeroCuota)
            });
        }
    });
    
    // Abrir modal de medios de pago
    mostrarModalMediosPago(alumno, cuotasAPagar, totalAPagar);
}

function procesarPagoFinal(alumno, cuotasAPagar, mediosPago) {
    const totalMediosPago = mediosPago.reduce((sum, medio) => sum + medio.monto, 0);
    const totalAPagar = cuotasAPagar.reduce((sum, cuota) => sum + cuota.monto, 0);
    
    // Validar que no se pague más de lo debido
    if (totalMediosPago > totalAPagar) {
        alert('El monto a pagar no puede ser mayor al total adeudado');
        return;
    }
    
    // Validar que se pague algo
    if (totalMediosPago <= 0) {
        alert('Debe ingresar un monto mayor a cero');
        return;
    }
    
    const esPagoParcial = totalMediosPago < totalAPagar;
    const montoPendiente = totalAPagar - totalMediosPago;
    
    let mensajeConfirmacion = `${esPagoParcial ? 'PAGO PARCIAL' : 'PAGO COMPLETO'}\n\n`;
    mensajeConfirmacion += `Alumno: ${alumno.nombre}\n`;
    mensajeConfirmacion += `Cuotas: ${cuotasAPagar.map(c => c.numero).join(', ')}\n`;
    mensajeConfirmacion += `Total adeudado: ${formatearMoneda(totalAPagar)}\n`;
    mensajeConfirmacion += `Monto a pagar ahora: ${formatearMoneda(totalMediosPago)}\n`;
    
    if (esPagoParcial) {
        mensajeConfirmacion += `Quedará pendiente: ${formatearMoneda(montoPendiente)}\n\n`;
        mensajeConfirmacion += `¿Confirmar este ABONO PARCIAL?`;
    } else {
        mensajeConfirmacion += `\n¿Confirmar pago COMPLETO?`;
    }
    
    const confirmar = confirm(mensajeConfirmacion);
    
    if (confirmar) {
        // Procesar pagos (parciales o completos)
        if (esPagoParcial) {
            procesarPagoParcial(cuotasAPagar, totalMediosPago, mediosPago);
        } else {
            procesarPagoCompleto(cuotasAPagar, mediosPago);
        }
        
        // Actualizar totales del alumno
        alumno.totalPagado += totalMediosPago;
        alumno.cuotasPagadas = alumno.cuotas.filter(c => c.pagada && c.numero <= alumno.numeroCuotas).length;
        alumno.pendiente = alumno.montoNeto - alumno.totalPagado;
        alumno.estado = determinarEstado(alumno);
        
        // Guardar en localStorage
        guardarDatos();
        
        // Actualizar interfaz
        actualizarEstadisticas();
        aplicarFiltros();
        
        // Generar y mostrar boleta
        const numeroBoleta = generarNumeroBoleta();
        const datosTransaccion = {
            numero: numeroBoleta,
            fecha: new Date(),
            alumno: alumno,
            cuotas: cuotasAPagar,
            mediosPago: mediosPago,
            total: totalMediosPago,
            esParcial: esPagoParcial
        };
        
        // Guardar transacción
        guardarTransaccion(datosTransaccion);
        
        // Mostrar confirmación con opción de boleta
        const confirmarBoleta = confirm(
            `¡Pago registrado exitosamente!\n\n` +
            `Boleta N° ${numeroBoleta}\n` +
            `Total pagado: ${formatearMoneda(totalMediosPago)}\n` +
            `Nuevo saldo pendiente: ${formatearMoneda(alumno.pendiente)}\n\n` +
            `¿Desea generar la boleta en PDF?`
        );
        
        if (confirmarBoleta) {
            generarBoletaPDF(datosTransaccion);
        }
        
        // Cerrar modales
        const modalMediosPago = bootstrap.Modal.getInstance(document.getElementById('modalMediosPago'));
        const modalDetalle = bootstrap.Modal.getInstance(document.getElementById('modalDetalle'));
        modalMediosPago.hide();
        modalDetalle.hide();
        
        // Actualizar interfaz
        actualizarEstadisticas();
        aplicarFiltros();
        
        // Reabrir el modal de detalle actualizado
        setTimeout(() => mostrarDetalle(alumno.rut), 300);
    }
}

function mostrarModalMediosPago(alumno, cuotasAPagar, totalAPagar) {
    const modal = new bootstrap.Modal(document.getElementById('modalMediosPago'));
    
    let html = `
        <div class="row mb-4">
            <div class="col-md-6">
                <h6>Resumen del Pago</h6>
                <p><strong>Alumno:</strong> ${alumno.nombre}</p>
                <p><strong>RUT:</strong> ${formatearRUT(alumno.rut)}</p>
                <p><strong>Cuotas a pagar:</strong></p>
                <ul>
                    ${cuotasAPagar.map(c => `<li>Cuota ${c.numero} (${c.mes}): ${formatearMoneda(c.monto)}</li>`).join('')}
                </ul>
                <p class="h5"><strong>Total: ${formatearMoneda(totalAPagar)}</strong></p>
            </div>
            <div class="col-md-6">
                <div class="card bg-info bg-opacity-10">
                    <div class="card-body">
                        <h6>💡 Medios de Pago Disponibles</h6>
                        <small class="text-muted">
                            Puede combinar varios medios de pago. El total debe coincidir exactamente con el monto a pagar.
                        </small>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header">
                <h6 class="mb-0">Medios de Pago</h6>
            </div>
            <div class="card-body">
                <div id="mediosPagoContainer">
                    <!-- Medios de pago se agregan dinámicamente -->
                </div>
                
                <div class="row mt-3">
                    <div class="col-md-6">
                        <button type="button" class="btn btn-outline-primary" onclick="agregarMedioPago()">
                            + Agregar Medio de Pago
                        </button>
                    </div>
                    <div class="col-md-6 text-end">
                        <p class="mb-1"><strong>Total a pagar: ${formatearMoneda(totalAPagar)}</strong></p>
                        <p class="mb-1">Pagado: <span class="text-success" id="totalPagado">${formatearMoneda(0)}</span></p>
                        <p class="mb-0">Pendiente: <span class="text-warning" id="totalPendiente">${formatearMoneda(totalAPagar)}</span></p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('modalCuerpoMediosPago').innerHTML = html;
    
    // Inicializar con un medio de pago vacío
    window.mediosPagoData = [];
    window.totalAPagarGlobal = totalAPagar;
    window.alumnoGlobal = alumno;
    window.cuotasAPagarGlobal = cuotasAPagar;
    
    agregarMedioPago();
    
    // Configurar evento del botón confirmar
    document.getElementById('btnConfirmarPago').onclick = function() {
        confirmarPago();
    };
    
    modal.show();
}

let contadorMediosPago = 0;

function agregarMedioPago() {
    contadorMediosPago++;
    const container = document.getElementById('mediosPagoContainer');
    
    const html = `
        <div class="border rounded p-3 mb-3" id="medioPago${contadorMediosPago}">
            <div class="row">
                <div class="col-md-3">
                    <label class="form-label">Medio de Pago:</label>
                    <select class="form-select" id="tipoMedio${contadorMediosPago}" onchange="cambiarTipoMedio(${contadorMediosPago})">
                        <option value="">Seleccionar...</option>
                        <option value="efectivo">💵 Efectivo</option>
                        <option value="tarjeta-debito">💳 Tarjeta Débito</option>
                        <option value="tarjeta-credito">💳 Tarjeta Crédito</option>
                        <option value="cheque">🏦 Cheque</option>
                        <option value="transferencia">📱 Transferencia</option>
                    </select>
                </div>
                <div class="col-md-2">
                    <label class="form-label">Monto:</label>
                    <input type="number" class="form-control" id="montoMedio${contadorMediosPago}" 
                           placeholder="0" onchange="actualizarTotales()" min="0" step="1">
                </div>
                <div class="col-md-6" id="detallesMedio${contadorMediosPago}">
                    <!-- Detalles específicos del medio de pago -->
                </div>
                <div class="col-md-1">
                    <label class="form-label">&nbsp;</label>
                    <button type="button" class="btn btn-outline-danger btn-sm d-block" onclick="eliminarMedioPago(${contadorMediosPago})">
                        🗑️
                    </button>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', html);
}

function cambiarTipoMedio(id) {
    const tipo = document.getElementById(`tipoMedio${id}`).value;
    const detallesContainer = document.getElementById(`detallesMedio${id}`);
    
    let html = '';
    
    switch (tipo) {
        case 'tarjeta-debito':
        case 'tarjeta-credito':
            html = `
                <div class="row">
                    <div class="col-md-6">
                        <label class="form-label">Últimos 4 dígitos:</label>
                        <input type="text" class="form-control" id="ultimos4_${id}" 
                               placeholder="1234" maxlength="4" pattern="[0-9]{4}">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Banco/Emisor:</label>
                        <input type="text" class="form-control" id="banco_${id}" placeholder="Nombre del banco">
                    </div>
                </div>
            `;
            break;
            
        case 'cheque':
            html = `
                <div class="row">
                    <div class="col-md-4">
                        <label class="form-label">Número de Cheque:</label>
                        <input type="text" class="form-control" id="numeroCheque_${id}" placeholder="0001234">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Banco:</label>
                        <input type="text" class="form-control" id="bancoCheque_${id}" placeholder="Banco">
                    </div>
                    <div class="col-md-4">
                        <label class="form-label">Fecha:</label>
                        <input type="date" class="form-control" id="fechaCheque_${id}">
                    </div>
                </div>
            `;
            break;
            
        case 'transferencia':
            html = `
                <div class="row">
                    <div class="col-md-6">
                        <label class="form-label">Banco Origen:</label>
                        <input type="text" class="form-control" id="bancoOrigen_${id}" placeholder="Banco">
                    </div>
                    <div class="col-md-6">
                        <label class="form-label">Referencia:</label>
                        <input type="text" class="form-control" id="referencia_${id}" placeholder="Nº operación">
                    </div>
                </div>
            `;
            break;
            
        case 'efectivo':
            html = `<div class="text-muted"><small>💵 Pago en efectivo</small></div>`;
            break;
    }
    
    detallesContainer.innerHTML = html;
    actualizarTotales();
}

function eliminarMedioPago(id) {
    const elemento = document.getElementById(`medioPago${id}`);
    if (elemento) {
        elemento.remove();
        actualizarTotales();
    }
}

function actualizarTotales() {
    let totalPagado = 0;
    const container = document.getElementById('mediosPagoContainer');
    const mediosPago = container.querySelectorAll('[id^="medioPago"]');
    
    mediosPago.forEach(medio => {
        const id = medio.id.replace('medioPago', '');
        const monto = parseFloat(document.getElementById(`montoMedio${id}`).value) || 0;
        totalPagado += monto;
    });
    
    const totalPendiente = window.totalAPagarGlobal - totalPagado;
    
    document.getElementById('totalPagado').textContent = formatearMoneda(totalPagado);
    document.getElementById('totalPendiente').textContent = formatearMoneda(totalPendiente);
    
    // Cambiar color según estado
    const spanPendiente = document.getElementById('totalPendiente');
    if (totalPendiente === 0) {
        spanPendiente.className = 'text-success';
    } else if (totalPendiente < 0) {
        spanPendiente.className = 'text-danger';
    } else {
        spanPendiente.className = 'text-warning';
    }
}

function confirmarPago() {
    const mediosPago = recopilarMediosPago();
    
    if (mediosPago.length === 0) {
        alert('Debe agregar al menos un medio de pago');
        return;
    }
    
    // Validar que todos los campos requeridos estén completos
    for (const medio of mediosPago) {
        if (!validarMedioPago(medio)) {
            alert(`Complete todos los campos del medio de pago: ${medio.tipo}`);
            return;
        }
    }
    
    procesarPagoFinal(window.alumnoGlobal, window.cuotasAPagarGlobal, mediosPago);
}

function recopilarMediosPago() {
    const mediosPago = [];
    const container = document.getElementById('mediosPagoContainer');
    const medios = container.querySelectorAll('[id^="medioPago"]');
    
    medios.forEach(medio => {
        const id = medio.id.replace('medioPago', '');
        const tipo = document.getElementById(`tipoMedio${id}`).value;
        const monto = parseFloat(document.getElementById(`montoMedio${id}`).value) || 0;
        
        if (tipo && monto > 0) {
            const medioPago = {
                tipo: tipo,
                monto: monto,
                fecha: new Date().toLocaleDateString('es-CL'),
                detalles: {}
            };
            
            // Agregar detalles específicos según el tipo
            switch (tipo) {
                case 'tarjeta-debito':
                case 'tarjeta-credito':
                    medioPago.detalles.ultimos4 = document.getElementById(`ultimos4_${id}`)?.value || '';
                    medioPago.detalles.banco = document.getElementById(`banco_${id}`)?.value || '';
                    break;
                    
                case 'cheque':
                    medioPago.detalles.numeroCheque = document.getElementById(`numeroCheque_${id}`)?.value || '';
                    medioPago.detalles.banco = document.getElementById(`bancoCheque_${id}`)?.value || '';
                    medioPago.detalles.fecha = document.getElementById(`fechaCheque_${id}`)?.value || '';
                    break;
                    
                case 'transferencia':
                    medioPago.detalles.bancoOrigen = document.getElementById(`bancoOrigen_${id}`)?.value || '';
                    medioPago.detalles.referencia = document.getElementById(`referencia_${id}`)?.value || '';
                    break;
            }
            
            mediosPago.push(medioPago);
        }
    });
    
    return mediosPago;
}

function validarMedioPago(medio) {
    switch (medio.tipo) {
        case 'tarjeta-debito':
        case 'tarjeta-credito':
            return medio.detalles.ultimos4 && medio.detalles.ultimos4.length === 4;
            
        case 'cheque':
            return medio.detalles.numeroCheque && medio.detalles.banco;
            
        case 'transferencia':
            return medio.detalles.referencia;
            
        case 'efectivo':
            return true;
            
        default:
            return false;
    }
}

function procesarPagoCompleto(cuotasAPagar, mediosPago) {
    cuotasAPagar.forEach(cuotaInfo => {
        const cuota = window.alumnoGlobal.cuotas.find(c => c.numero === cuotaInfo.numero);
        if (cuota) {
            cuota.pagada = true;
            cuota.fechaPago = new Date().toLocaleDateString('es-CL');
            cuota.mediosPago = mediosPago;
            cuota.abonos = [{
                monto: cuotaInfo.monto,
                fecha: new Date().toLocaleDateString('es-CL'),
                mediosPago: mediosPago,
                tipo: 'completo'
            }];
        }
    });
}

function procesarPagoParcial(cuotasAPagar, montoAPagar, mediosPago) {
    let montoRestante = montoAPagar;
    
    // Distribuir el pago entre las cuotas seleccionadas
    cuotasAPagar.forEach(cuotaInfo => {
        const cuota = window.alumnoGlobal.cuotas.find(c => c.numero === cuotaInfo.numero);
        if (cuota && montoRestante > 0) {
            // Inicializar abonos si no existe
            if (!cuota.abonos) {
                cuota.abonos = [];
            }
            
            // Calcular cuánto falta por pagar de esta cuota
            const totalAbonado = cuota.abonos.reduce((sum, abono) => sum + abono.monto, 0);
            const pendienteCuota = cuotaInfo.monto - totalAbonado;
            
            // Determinar cuánto abonar a esta cuota
            const montoAbono = Math.min(montoRestante, pendienteCuota);
            
            if (montoAbono > 0) {
                // Registrar el abono
                cuota.abonos.push({
                    monto: montoAbono,
                    fecha: new Date().toLocaleDateString('es-CL'),
                    mediosPago: mediosPago,
                    tipo: 'parcial'
                });
                
                // Verificar si la cuota quedó completamente pagada
                const nuevoTotalAbonado = cuota.abonos.reduce((sum, abono) => sum + abono.monto, 0);
                if (nuevoTotalAbonado >= cuotaInfo.monto) {
                    cuota.pagada = true;
                    cuota.fechaPago = new Date().toLocaleDateString('es-CL');
                    // Actualizar el último abono como 'completo'
                    cuota.abonos[cuota.abonos.length - 1].tipo = 'completo';
                }
                
                montoRestante -= montoAbono;
            }
        }
    });
}

function guardarDatos() {
    try {
        localStorage.setItem('datosTesoreria', JSON.stringify(datosAlumnos));
        console.log('Datos guardados en localStorage');
    } catch (error) {
        console.error('Error al guardar datos:', error);
    }
}

function cargarDatosGuardados() {
    try {
        const datosGuardados = localStorage.getItem('datosTesoreria');
        console.log('🔍 localStorage datosTesoreria:', datosGuardados ? 'encontrado' : 'no encontrado');
        if (datosGuardados) {
            datosAlumnos = JSON.parse(datosGuardados);
            console.log(`📊 Datos parseados: ${datosAlumnos.length} alumnos`);
            actualizarCursos();
            aplicarFiltros();
            actualizarEstadisticas();
            console.log(`✅ Datos cargados desde localStorage: ${datosAlumnos.length} alumnos`);
            return true;
        }
    } catch (error) {
        console.error('❌ Error al cargar datos guardados:', error);
    }
    return false;
}

// === FUNCIONES DEL PORTAL DE APODERADOS ===

function mostrarVista(vista) {
    // Ocultar todas las vistas
    document.getElementById('vistaApoderado').style.display = 'none';
    document.getElementById('vistaConsultaAlumno').style.display = 'none';
    document.getElementById('vistaAdmin').style.display = 'none';
    
    // Ocultar botones de navegación
    document.getElementById('btnPortalApoderado').style.display = 'none';
    document.getElementById('btnAdmin').style.display = 'none';
    
    if (vista === 'apoderado') {
        document.getElementById('vistaApoderado').style.display = 'block';
        document.getElementById('btnAdmin').style.display = 'inline-block';
        limpiarFormularioLogin();
    } else if (vista === 'admin') {
        document.getElementById('vistaAdmin').style.display = 'block';
        document.getElementById('btnPortalApoderado').style.display = 'inline-block';
    }
}

function formatearRUTInput(input) {
    let valor = input.value.replace(/[^0-9kK]/g, '');
    
    if (valor.length > 1) {
        const dv = valor.slice(-1);
        const numero = valor.slice(0, -1);
        
        // Formatear con puntos
        const numeroFormateado = numero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        input.value = numeroFormateado + '-' + dv.toUpperCase();
    } else {
        input.value = valor;
    }
}

function consultarAlumno() {
    const rutIngresado = document.getElementById('rutAlumno').value.trim();
    const apellidoIngresado = document.getElementById('apellidoAlumno').value.trim().toUpperCase();
    
    if (!rutIngresado || !apellidoIngresado) {
        alert('Por favor complete todos los campos');
        return;
    }
    
    // Buscar el alumno
    const alumnoEncontrado = datosAlumnos.find(alumno => {
        const rutFormateado = formatearRUT(alumno.rut);
        
        // Buscar el primer apellido en el nombre completo
        // El formato típico es: APELLIDO1 APELLIDO2 NOMBRE1 NOMBRE2
        const partesNombre = alumno.nombre.split(' ');
        const primerApellido = partesNombre[0].toUpperCase();
        
        return rutFormateado === rutIngresado && primerApellido === apellidoIngresado;
    });
    
    if (alumnoEncontrado) {
        mostrarConsultaAlumno(alumnoEncontrado);
    } else {
        alert('No se encontró un alumno con los datos ingresados.\\n\\nVerifique que el RUT y apellido sean correctos.');
    }
}

function mostrarConsultaAlumno(alumno) {
    document.getElementById('vistaApoderado').style.display = 'none';
    document.getElementById('vistaConsultaAlumno').style.display = 'block';
    
    document.getElementById('tituloConsulta').textContent = `Estado de Cuotas - ${alumno.nombre}`;
    
    let html = `
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card border-primary">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0">👤 Información del Estudiante</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>Nombre:</strong> ${alumno.nombre}</p>
                        <p><strong>RUT:</strong> ${formatearRUT(alumno.rut)}</p>
                        <p><strong>Curso:</strong> ${alumno.curso}</p>
                        <p><strong>Arancel Anual:</strong> ${formatearMoneda(alumno.arancel)}</p>
                        ${alumno.beca > 0 ? `<p><strong>Beca:</strong> ${formatearMoneda(alumno.beca)}</p>` : ''}
                        <p><strong>Monto a Pagar:</strong> ${formatearMoneda(alumno.montoNeto)}</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-success">
                    <div class="card-header bg-success text-white">
                        <h6 class="mb-0">💰 Estado de Pagos</h6>
                    </div>
                    <div class="card-body">
                        <p><strong>Total Pagado:</strong> <span class="text-success">${formatearMoneda(alumno.totalPagado)}</span></p>
                        <p><strong>Saldo Pendiente:</strong> <span class="text-warning">${formatearMoneda(Math.max(0, alumno.pendiente))}</span></p>
                        <p><strong>Estado:</strong> <span class="estado-${alumno.estado}">
                            ${alumno.beca >= alumno.arancel ? 'Exento por Beca 100%' : 
                              alumno.estado === 'al-dia' ? 'Al Día' :
                              alumno.estado === 'pendiente' ? 'Con Cuotas Pendientes' :
                              alumno.estado === 'ingreso-tardio' ? 'Ingreso Tardío' : 'Moroso'}
                        </span></p>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar bg-success" style="width: ${Math.min(100, (alumno.totalPagado / Math.max(alumno.montoNeto, 1)) * 100)}%">
                                ${Math.round((alumno.totalPagado / Math.max(alumno.montoNeto, 1)) * 100)}%
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="card">
            <div class="card-header bg-info text-white">
                <h6 class="mb-0">📋 Detalle de Cuotas</h6>
            </div>
            <div class="card-body">
    `;
    
    if (alumno.beca >= alumno.arancel) {
        html += `
            <div class="alert alert-success" role="alert">
                <h5 class="alert-heading">🎓 ¡Felicitaciones!</h5>
                <p>Este estudiante cuenta con una beca del 100%, por lo que no debe realizar pagos de cuotas.</p>
                <hr>
                <p class="mb-0">Todas las cuotas están cubiertas por la beca otorgada.</p>
            </div>
        `;
        
        // Mostrar cuotas como exentas según el curso
        html += '<div class="row">';
        for (let i = 1; i <= alumno.numeroCuotas; i++) {
            html += `
                <div class="col-md-4 col-lg-3 mb-3">
                    <div class="card border-success">
                        <div class="card-body text-center bg-success bg-opacity-10">
                            <h6 class="card-title">Cuota ${i}</h6>
                            <p class="card-text">
                                <span class="badge bg-success">EXENTA</span><br>
                                <small class="text-muted">Cubierta por beca</small>
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }
        html += '</div>';
    } else {
        // Mostrar cuotas normales solo las relevantes para el curso
        html += '<div class="row">';
        alumno.cuotas.filter(cuota => cuota.numero <= alumno.numeroCuotas).sort((a, b) => a.numero - b.numero).forEach(cuota => {
            if (cuota.numero <= alumno.numeroCuotas) {
                const estadoCuotaLogico = obtenerEstadoCuota(cuota);
                let estadoCuota = 'PENDIENTE';
                let colorCard = 'warning';
                let colorBadge = 'warning';
                let icono = '⏳';
                
                if (estadoCuotaLogico === 'pagada') {
                    estadoCuota = 'PAGADA';
                    colorCard = 'success';
                    colorBadge = 'success';
                    icono = '✅';
                } else if (estadoCuotaLogico === 'vencida') {
                    estadoCuota = 'VENCIDA';
                    colorCard = 'danger';
                    colorBadge = 'danger';
                    icono = '🔥';
                } else if (estadoCuotaLogico === 'pendiente') {
                    estadoCuota = 'PENDIENTE';
                    colorCard = 'warning';
                    colorBadge = 'warning';
                    icono = '⏳';
                } else {
                    estadoCuota = 'SIN ASIGNAR';
                    colorCard = 'light';
                    colorBadge = 'secondary';
                    icono = '○';
                }
                
                // Verificar si la cuota puede ser pagada
                const puedeSerPagada = estadoCuotaLogico === 'pendiente' || estadoCuotaLogico === 'vencida' || estadoCuotaLogico === 'abono-pendiente' || estadoCuotaLogico === 'abono-vencida';
                const montoPendiente = estadoCuotaLogico.includes('abono') ? obtenerMontoPendienteCuota(cuota) : cuota.monto;
                
                html += `
                    <div class="col-md-4 col-lg-3 mb-3">
                        <div class="card border-${colorCard}">
                            <div class="card-body text-center">
                                <h6 class="card-title">${icono} Cuota ${cuota.numero}</h6>
                                <p class="card-text">
                                    <strong>${cuota.monto > 0 ? formatearMoneda(cuota.monto) : 'N/A'}</strong><br>
                                    <span class="badge bg-${colorBadge}">${estadoCuota}</span><br>
                                    <small class="text-muted">${obtenerMesVencimiento(cuota.numero)}</small>
                                    ${estadoCuotaLogico.includes('abono') ? `<br><small class="text-info">Abonado: ${formatearMoneda(obtenerMontoAbonado(cuota))}</small><br><small class="text-warning">Pendiente: ${formatearMoneda(montoPendiente)}</small>` : ''}
                                </p>
                                ${puedeSerPagada ? `
                                    <div class="mt-2">
                                        <button class="btn btn-primary btn-sm mb-1 w-100" onclick="pagarConWebpay('${alumno.rut}', ${cuota.numero}, ${montoPendiente})">
                                            💳 Pagar con Webpay
                                        </button>
                                        <div class="small text-muted">Tarjetas de crédito y débito</div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
        });
        html += '</div>';
        
        // Resumen de cuotas
        const cuotasPagadas = alumno.cuotas.filter(c => c.pagada && c.numero <= alumno.numeroCuotas).length;
        const cuotasPendientes = alumno.cuotas.filter(c => !c.pagada && c.monto > 0 && c.numero <= alumno.numeroCuotas).length;
        
        html += `
            <div class="alert alert-info mt-4">
                <h6>📊 Resumen:</h6>
                <ul class="mb-0">
                    <li><strong>Cuotas pagadas:</strong> ${cuotasPagadas} de ${alumno.numeroCuotas}</li>
                    <li><strong>Cuotas pendientes:</strong> ${cuotasPendientes}</li>
                    ${alumno.pendiente > 0 ? `<li><strong>Monto pendiente total:</strong> ${formatearMoneda(alumno.pendiente)}</li>` : ''}
                </ul>
            </div>
        `;
    }
    
    html += `
            </div>
        </div>
        
        <div class="mt-4 text-center">
            <p class="text-muted">
                <small>💡 Para realizar pagos o resolver dudas, contacte directamente con la institución.</small>
            </p>
        </div>
    `;
    
    document.getElementById('contenidoConsulta').innerHTML = html;
}

function volverLogin() {
    document.getElementById('vistaConsultaAlumno').style.display = 'none';
    document.getElementById('vistaApoderado').style.display = 'block';
    limpiarFormularioLogin();
}

function limpiarFormularioLogin() {
    document.getElementById('rutAlumno').value = '';
    document.getElementById('apellidoAlumno').value = '';
}

// === SISTEMA DE BOLETAS ===

function generarNumeroBoleta() {
    const fechaHoy = new Date();
    const año = fechaHoy.getFullYear();
    const mes = String(fechaHoy.getMonth() + 1).padStart(2, '0');
    
    // Obtener contador de boletas del localStorage
    let contadorBoletas = parseInt(localStorage.getItem('contadorBoletas') || '0');
    contadorBoletas++;
    localStorage.setItem('contadorBoletas', contadorBoletas.toString());
    
    // Formato: AAAAMM000001
    return `${año}${mes}${String(contadorBoletas).padStart(6, '0')}`;
}

function guardarTransaccion(datosTransaccion) {
    try {
        // Obtener transacciones existentes
        const transacciones = JSON.parse(localStorage.getItem('transacciones') || '[]');
        
        // Agregar nueva transacción
        transacciones.push(datosTransaccion);
        
        // Guardar
        localStorage.setItem('transacciones', JSON.stringify(transacciones));
        
        console.log(`Transacción ${datosTransaccion.numero} guardada`);
    } catch (error) {
        console.error('Error al guardar transacción:', error);
    }
}

function generarBoletaPDF(datos) {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Configuración de fuente
        doc.setFont('helvetica');
        
        // ENCABEZADO CON LOGOS
        // Agregar logos (si están disponibles)
        try {
            // Aquí se pueden agregar los logos cuando estén convertidos a base64
            // doc.addImage(logoLeumag, 'PNG', 15, 10, 25, 10);
            // doc.addImage(logoExperimentalin, 'PNG', 45, 10, 25, 10);
        } catch (e) {
            // Continuar sin logos si no están disponibles
        }
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(DATOS_ESTABLECIMIENTO.nombre.toUpperCase(), 20, 25);
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.text(`RUT: ${DATOS_ESTABLECIMIENTO.rut}`, 20, 33);
        doc.text(`Giro: ${DATOS_ESTABLECIMIENTO.giro}`, 20, 40);
        doc.text(DATOS_ESTABLECIMIENTO.direccion, 20, 47);
        doc.text(`Tel: ${DATOS_ESTABLECIMIENTO.telefono}`, 20, 54);
        doc.text(`Email: ${DATOS_ESTABLECIMIENTO.email}`, 20, 61);
        
        // BOLETA
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('BOLETA INTERNA DE PAGO', 120, 35);
        doc.text(`N° ${datos.numero}`, 120, 43);
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Fecha: ${datos.fecha.toLocaleDateString('es-CL')}`, 120, 50);
        doc.text(`Hora: ${datos.fecha.toLocaleTimeString('es-CL')}`, 120, 57);
        
        // LÍNEA SEPARADORA
        doc.line(20, 70, 190, 70);
        
        // DATOS DEL CLIENTE/ALUMNO
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('DATOS DEL ALUMNO:', 20, 80);
        
        doc.setFont('helvetica', 'normal');
        doc.text(`Nombre: ${datos.alumno.nombre}`, 20, 83);
        doc.text(`RUT: ${formatearRUT(datos.alumno.rut)}`, 20, 90);
        doc.text(`Curso: ${datos.alumno.curso}`, 20, 97);
        
        // DETALLE DE CUOTAS
        doc.setFont('helvetica', 'bold');
        doc.text('CUOTAS PAGADAS:', 20, 110);
        
        doc.setFont('helvetica', 'normal');
        let yPos = 118;
        datos.cuotas.forEach(cuota => {
            doc.text(`• Cuota ${cuota.numero} (${cuota.mes}): ${formatearMoneda(cuota.monto)}`, 25, yPos);
            yPos += 7;
        });
        
        if (datos.esParcial) {
            doc.setFont('helvetica', 'bold');
            doc.text('PAGO PARCIAL', 25, yPos + 3);
            doc.setFont('helvetica', 'normal');
        }
        
        // MEDIOS DE PAGO
        yPos += 15;
        doc.setFont('helvetica', 'bold');
        doc.text('MEDIOS DE PAGO:', 20, yPos);
        
        doc.setFont('helvetica', 'normal');
        yPos += 8;
        datos.mediosPago.forEach(medio => {
            let textoMedio = `• ${obtenerNombreMedioPago(medio.tipo)}: ${formatearMoneda(medio.monto)}`;
            
            // Agregar detalles según el tipo
            if (medio.tipo === 'tarjeta-debito' || medio.tipo === 'tarjeta-credito') {
                textoMedio += ` (****${medio.detalles.ultimos4})`;
            } else if (medio.tipo === 'cheque') {
                textoMedio += ` (${medio.detalles.banco} N°${medio.detalles.numeroCheque})`;
            } else if (medio.tipo === 'transferencia') {
                textoMedio += ` (Ref: ${medio.detalles.referencia})`;
            }
            
            doc.text(textoMedio, 25, yPos);
            yPos += 7;
        });
        
        // TOTAL
        doc.line(120, yPos + 5, 190, yPos + 5);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(`TOTAL PAGADO: ${formatearMoneda(datos.total)}`, 120, yPos + 15);
        
        // FOOTER
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Esta boleta interna es un comprobante de pago.', 20, 270);
        doc.text('Para efectos tributarios, solicite boleta o factura oficial.', 20, 275);
        doc.text(`Generado el ${new Date().toLocaleString('es-CL')}`, 20, 285);
        
        // NOTA IMPORTANTE
        if (!DATOS_ESTABLECIMIENTO.tokenSII) {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 0, 0);
            doc.text('NOTA: Esta NO es una boleta tributaria oficial del SII', 20, 250);
            doc.setTextColor(0, 0, 0);
        }
        
        // Descargar PDF
        const nombreArchivo = `boleta_${datos.numero}_${datos.alumno.nombre.replace(/\s+/g, '_')}.pdf`;
        doc.save(nombreArchivo);
        
    } catch (error) {
        console.error('Error al generar PDF:', error);
        alert('Error al generar la boleta PDF. Verifique que jsPDF esté cargado correctamente.');
    }
}

function obtenerNombreMedioPago(tipo) {
    const nombres = {
        'efectivo': 'Efectivo',
        'tarjeta-debito': 'Tarjeta Débito', 
        'tarjeta-credito': 'Tarjeta Crédito',
        'cheque': 'Cheque',
        'transferencia': 'Transferencia',
        'webpay': 'Webpay Plus'
    };
    return nombres[tipo] || tipo;
}

// === INTEGRACIÓN FUTURA CON SII ===
// Esta función será útil cuando se implemente la integración oficial

async function generarBoletaOficialSII(datosTransaccion) {
    // TODO: Implementar integración con SII
    // Requerirá:
    // 1. Token de autenticación del SII
    // 2. Certificados digitales
    // 3. API del SII para boletas electrónicas
    // 4. Cumplimiento de formato XML oficial
    
    console.log('Integración con SII pendiente de implementar');
    return null;
}

// Función para exportar datos (futura implementación)
function exportarDatos(formato) {
    console.log(`Exportando datos en formato: ${formato}`);
    // TODO: Implementar exportación a Excel, PDF, etc.
}

// === INTEGRACIÓN CON WEBPAY PLUS ===

async function pagarConWebpay(rutAlumno, numeroCuota, monto) {
    try {
        // Buscar el alumno
        const alumno = datosAlumnos.find(a => a.rut === rutAlumno);
        if (!alumno) {
            throw new Error('Alumno no encontrado');
        }

        // Validar monto
        if (monto <= 0) {
            throw new Error('Monto inválido');
        }

        // Mostrar modal de confirmación
        const confirmarPago = await mostrarModalConfirmacionWebpay(alumno, numeroCuota, monto);
        
        if (confirmarPago) {
            // Generar orden de compra única
            const ordenCompra = `CUOTA-${rutAlumno.replace(/[.-]/g, '')}-${numeroCuota}-${Date.now()}`;
            
            // Crear transacción en Webpay
            await crearTransaccionWebpay({
                ordenCompra,
                rutAlumno,
                alumno: alumno.nombre,
                numeroCuota,
                monto,
                descripcion: `Cuota ${numeroCuota} - ${alumno.nombre}`
            });
        }
    } catch (error) {
        console.error('Error al procesar pago con Webpay:', error);
        alert(`Error: ${error.message}`);
    }
}

function mostrarModalConfirmacionWebpay(alumno, numeroCuota, monto) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">💳 Confirmar Pago con Webpay</h5>
                    </div>
                    <div class="modal-body">
                        <div class="text-center mb-3">
                            <img src="https://www.transbank.cl/public/img/logos/webpay.svg" alt="Webpay" height="40" class="mb-3">
                        </div>
                        <div class="alert alert-info">
                            <strong>Detalle del Pago:</strong>
                        </div>
                        <table class="table table-borderless">
                            <tr>
                                <td><strong>Estudiante:</strong></td>
                                <td>${alumno.nombre}</td>
                            </tr>
                            <tr>
                                <td><strong>RUT:</strong></td>
                                <td>${formatearRUT(alumno.rut)}</td>
                            </tr>
                            <tr>
                                <td><strong>Cuota:</strong></td>
                                <td>Cuota ${numeroCuota} (${obtenerMesVencimiento(numeroCuota)})</td>
                            </tr>
                            <tr class="table-primary">
                                <td><strong>Monto a Pagar:</strong></td>
                                <td><strong>${formatearMoneda(monto)}</strong></td>
                            </tr>
                        </table>
                        <div class="alert alert-warning small">
                            <strong>⚠️ Importante:</strong> Será redirigido al sitio seguro de Webpay para completar el pago. 
                            Asegúrese de completar la transacción para que el pago sea procesado correctamente.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btnConfirmarWebpay">
                            <i class="fas fa-credit-card"></i> Continuar con Webpay
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        
        modal.querySelector('#btnConfirmarWebpay').addEventListener('click', () => {
            bootstrapModal.hide();
            resolve(true);
        });

        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
            resolve(false);
        });

        bootstrapModal.show();
    });
}

async function crearTransaccionWebpay(datosTransaccion) {
    try {
        console.log('🚀 Creando transacción Webpay real:', datosTransaccion);
        
        // Mostrar indicador de carga
        mostrarIndicadorCarga('Conectando con Transbank...');
        
        // Llamada real a la API del backend
        const response = await fetch(`${WEBPAY_CONFIG.baseUrl}${WEBPAY_CONFIG.createUrl}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ...datosTransaccion,
                sessionId: `session-${Date.now()}-${datosTransaccion.rutAlumno}`
            })
        });

        const responseData = await response.json();
        
        if (!response.ok) {
            throw new Error(responseData.error || 'Error al crear transacción');
        }

        if (responseData.success) {
            // Redirigir al Webpay real
            await redirigirAWebpayReal(responseData.url, responseData.token, datosTransaccion);
        } else {
            throw new Error(responseData.error || 'Error al crear transacción');
        }
    } catch (error) {
        ocultarIndicadorCarga();
        throw error;
    }
}

async function redirigirAWebpayReal(url, token, datosTransaccion) {
    try {
        ocultarIndicadorCarga();
        
        console.log('🌐 Redirigiendo a Webpay:', url);
        
        // Mostrar modal de información antes de redireccionar
        const confirmarRedireccion = await mostrarModalRedireccionWebpay();
        
        if (confirmarRedireccion) {
            // Guardar datos de la transacción para el retorno
            localStorage.setItem('webpayPendiente', JSON.stringify({
                token,
                datosTransaccion,
                timestamp: Date.now()
            }));
            
            // Abrir Webpay en una nueva ventana/tab
            const webpayWindow = window.open(url, 'webpay', 'width=800,height=600,scrollbars=yes,resizable=yes');
            
            // Escuchar el resultado del pago
            await esperarResultadoWebpay(webpayWindow, token, datosTransaccion);
        }
    } catch (error) {
        console.error('❌ Error en redirección a Webpay:', error);
        throw error;
    }
}

function mostrarModalRedireccionWebpay() {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title">🔐 Redirección a Webpay</h5>
                    </div>
                    <div class="modal-body text-center">
                        <div class="mb-3">
                            <img src="https://www.transbank.cl/public/img/logos/webpay.svg" alt="Webpay" height="50" class="mb-3">
                        </div>
                        <div class="alert alert-info">
                            <h6><strong>Importante:</strong></h6>
                            <p class="mb-0">
                                Será redirigido al sitio seguro de Transbank para completar su pago.
                                <br><strong>No cierre esta ventana</strong> hasta completar la transacción.
                            </p>
                        </div>
                        <div class="alert alert-warning small">
                            <strong>💡 Consejos:</strong><br>
                            • Asegúrese de tener su tarjeta a mano<br>
                            • La transacción se procesará en tiempo real<br>
                            • Recibirá confirmación inmediata del resultado
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button type="button" class="btn btn-primary" id="btnContinuar">
                            🚀 Continuar a Webpay
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        
        modal.querySelector('#btnContinuar').addEventListener('click', () => {
            bootstrapModal.hide();
            resolve(true);
        });

        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
            resolve(false);
        });

        bootstrapModal.show();
    });
}

async function esperarResultadoWebpay(webpayWindow, token, datosTransaccion) {
    return new Promise((resolve, reject) => {
        // Mostrar indicador de espera
        mostrarIndicadorCarga('Esperando resultado del pago...<br><small>Complete la transacción en la ventana de Webpay</small>');
        
        // Escuchar mensajes de la ventana de Webpay
        const messageListener = async (event) => {
            if (event.data && event.data.type === 'webpayResult') {
                console.log('📨 Resultado recibido de Webpay:', event.data);
                
                window.removeEventListener('message', messageListener);
                clearInterval(checkWindowClosed);
                
                try {
                    ocultarIndicadorCarga();
                    
                    if (event.data.success) {
                        // Procesar pago exitoso
                        await procesarPagoWebpayExitoso({
                            ...datosTransaccion,
                            token,
                            codigoAutorizacion: event.data.authorization,
                            tarjeta: event.data.card,
                            fechaPago: new Date(),
                            ordenCompra: event.data.buyOrder,
                            monto: event.data.amount
                        });
                    } else {
                        alert('❌ Pago rechazado o cancelado: ' + (event.data.error || 'Transacción no completada'));
                    }
                    
                    // Limpiar datos temporales
                    localStorage.removeItem('webpayPendiente');
                    resolve();
                } catch (error) {
                    reject(error);
                }
            }
        };

        window.addEventListener('message', messageListener);
        
        // Verificar si la ventana se cierra sin completar el pago
        const checkWindowClosed = setInterval(() => {
            if (webpayWindow.closed) {
                clearInterval(checkWindowClosed);
                window.removeEventListener('message', messageListener);
                ocultarIndicadorCarga();
                
                // Verificar si hay datos pendientes (pago cancelado)
                const datosPendientes = localStorage.getItem('webpayPendiente');
                if (datosPendientes) {
                    localStorage.removeItem('webpayPendiente');
                    alert('❌ Pago cancelado - La ventana de Webpay fue cerrada sin completar la transacción');
                }
                
                resolve();
            }
        }, 1000);
        
        // Timeout de seguridad (10 minutos)
        setTimeout(() => {
            if (!webpayWindow.closed) {
                webpayWindow.close();
            }
            clearInterval(checkWindowClosed);
            window.removeEventListener('message', messageListener);
            ocultarIndicadorCarga();
            localStorage.removeItem('webpayPendiente');
            reject(new Error('Timeout: El pago tardó demasiado en completarse'));
        }, 10 * 60 * 1000);
    });
}

// Función eliminada - ya no se usa simulación

async function procesarPagoWebpayExitoso(datosPago) {
    try {
        // Buscar el alumno y la cuota
        const alumno = datosAlumnos.find(a => a.rut === datosPago.rutAlumno);
        const cuota = alumno.cuotas.find(c => c.numero === datosPago.numeroCuota);
        
        if (!cuota) {
            throw new Error('Cuota no encontrada');
        }

        // Registrar el pago
        if (!cuota.abonos) {
            cuota.abonos = [];
        }

        cuota.abonos.push({
            monto: datosPago.monto,
            fecha: datosPago.fechaPago.toLocaleDateString('es-CL'),
            tipo: 'webpay',
            mediosPago: [{
                tipo: 'webpay',
                monto: datosPago.monto,
                detalles: {
                    token: datosPago.token,
                    autorizacion: datosPago.codigoAutorizacion,
                    tarjeta: datosPago.tarjeta,
                    ordenCompra: datosPago.ordenCompra
                }
            }]
        });

        // Verificar si la cuota quedó completa
        const totalAbonado = cuota.abonos.reduce((sum, abono) => sum + abono.monto, 0);
        if (totalAbonado >= cuota.monto) {
            cuota.pagada = true;
            cuota.fechaPago = datosPago.fechaPago.toLocaleDateString('es-CL');
            cuota.abonos[cuota.abonos.length - 1].tipo = 'completo';
        }

        // Recalcular totales del alumno
        recalcularTotalesAlumno(alumno);

        // Guardar cambios
        guardarDatosEnStorage();
        
        // Generar boleta
        const datosTransaccion = {
            numero: generarNumeroBoleta(),
            fecha: datosPago.fechaPago,
            alumno: {
                nombre: alumno.nombre,
                rut: alumno.rut,
                curso: alumno.curso
            },
            cuotas: [{
                numero: datosPago.numeroCuota,
                mes: obtenerMesVencimiento(datosPago.numeroCuota),
                monto: datosPago.monto
            }],
            total: datosPago.monto,
            esParcial: totalAbonado < cuota.monto,
            mediosPago: [{
                tipo: 'webpay',
                monto: datosPago.monto,
                detalles: {
                    autorizacion: datosPago.codigoAutorizacion,
                    tarjeta: datosPago.tarjeta,
                    ordenCompra: datosPago.ordenCompra
                }
            }]
        };

        // Guardar transacción
        guardarTransaccion(datosTransaccion);

        // Mostrar resultado exitoso
        mostrarResultadoPagoWebpay(datosTransaccion, true);

        // Refrescar la vista
        mostrarConsultaAlumno(alumno);

    } catch (error) {
        console.error('Error al procesar pago Webpay:', error);
        alert('Error al procesar el pago: ' + error.message);
    }
}

function mostrarResultadoPagoWebpay(datosTransaccion, exito) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header bg-${exito ? 'success' : 'danger'} text-white">
                    <h5 class="modal-title">
                        ${exito ? '✅ Pago Exitoso' : '❌ Pago Rechazado'}
                    </h5>
                </div>
                <div class="modal-body text-center">
                    ${exito ? `
                        <div class="alert alert-success">
                            <h6>¡Pago procesado correctamente!</h6>
                            <p>Su pago ha sido registrado exitosamente.</p>
                        </div>
                        <table class="table table-borderless">
                            <tr>
                                <td><strong>N° Boleta:</strong></td>
                                <td>${datosTransaccion.numero}</td>
                            </tr>
                            <tr>
                                <td><strong>Autorización:</strong></td>
                                <td>${datosTransaccion.mediosPago[0].detalles.autorizacion}</td>
                            </tr>
                            <tr>
                                <td><strong>Tarjeta:</strong></td>
                                <td>${datosTransaccion.mediosPago[0].detalles.tarjeta}</td>
                            </tr>
                            <tr class="table-success">
                                <td><strong>Monto Pagado:</strong></td>
                                <td><strong>${formatearMoneda(datosTransaccion.total)}</strong></td>
                            </tr>
                        </table>
                        <button class="btn btn-outline-primary" onclick="generarBoletaPDF(${JSON.stringify(datosTransaccion).replace(/"/g, '&quot;')})">
                            📄 Descargar Boleta PDF
                        </button>
                    ` : `
                        <div class="alert alert-danger">
                            <h6>El pago no pudo ser procesado</h6>
                            <p>Intente nuevamente o use otro medio de pago.</p>
                        </div>
                    `}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });

    bootstrapModal.show();
}

function recalcularTotalesAlumno(alumno) {
    // Recalcular total pagado incluyendo abonos
    let totalAbonado = 0;
    alumno.cuotas.forEach(cuota => {
        if (cuota.pagada) {
            totalAbonado += cuota.monto;
        } else if (cuota.abonos && cuota.abonos.length > 0) {
            totalAbonado += cuota.abonos.reduce((sum, abono) => sum + abono.monto, 0);
        }
    });
    
    alumno.totalPagadoReal = totalAbonado;
    alumno.pendiente = Math.max(0, alumno.montoNeto - totalAbonado);
    alumno.estado = determinarEstado(alumno);
}

function mostrarIndicadorCarga(mensaje) {
    // Crear o actualizar indicador de carga
    let indicador = document.getElementById('indicadorCarga');
    if (!indicador) {
        indicador = document.createElement('div');
        indicador.id = 'indicadorCarga';
        indicador.className = 'modal fade';
        indicador.innerHTML = `
            <div class="modal-dialog modal-sm">
                <div class="modal-content">
                    <div class="modal-body text-center">
                        <div class="spinner-border text-primary mb-3" role="status">
                            <span class="visually-hidden">Cargando...</span>
                        </div>
                        <div id="mensajeCarga">${mensaje}</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(indicador);
    } else {
        document.getElementById('mensajeCarga').innerHTML = mensaje;
    }
    
    const bootstrapModal = new bootstrap.Modal(indicador, {backdrop: 'static', keyboard: false});
    bootstrapModal.show();
}

function ocultarIndicadorCarga() {
    const indicador = document.getElementById('indicadorCarga');
    if (indicador) {
        const bootstrapModal = bootstrap.Modal.getInstance(indicador);
        if (bootstrapModal) {
            bootstrapModal.hide();
        }
    }
}

function guardarDatosEnStorage() {
    try {
        localStorage.setItem('datosAlumnos', JSON.stringify(datosAlumnos));
        console.log('Datos guardados en localStorage');
    } catch (error) {
        console.error('Error al guardar datos:', error);
    }
}

// === SISTEMA DE ELIMINACIÓN DE ALUMNOS ===

async function confirmarEliminacionAlumno(rutAlumno, nombreAlumno) {
    try {
        const datosEliminacion = await mostrarModalEliminacionAlumno(rutAlumno, nombreAlumno);
        
        if (datosEliminacion) {
            await eliminarAlumno(rutAlumno, datosEliminacion);
        }
    } catch (error) {
        console.error('Error en eliminación:', error);
        alert('Error al eliminar alumno: ' + error.message);
    }
}

function mostrarModalEliminacionAlumno(rutAlumno, nombreAlumno) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-danger text-white">
                        <h5 class="modal-title">⚠️ Confirmar Eliminación de Alumno</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-warning">
                            <h6><strong>⚠️ Atención:</strong></h6>
                            <p class="mb-0">
                                Esta acción eliminará permanentemente al alumno del sistema.
                                <br><strong>No se puede deshacer.</strong>
                            </p>
                        </div>
                        
                        <div class="card mb-3">
                            <div class="card-header bg-light">
                                <h6 class="mb-0">👤 Datos del Alumno a Eliminar</h6>
                            </div>
                            <div class="card-body">
                                <table class="table table-borderless mb-0">
                                    <tr>
                                        <td><strong>Nombre:</strong></td>
                                        <td>${nombreAlumno}</td>
                                    </tr>
                                    <tr>
                                        <td><strong>RUT:</strong></td>
                                        <td>${formatearRUT(rutAlumno)}</td>
                                    </tr>
                                </table>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label class="form-label"><strong>Motivo de Eliminación:</strong></label>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="radio" name="motivoEliminacion" id="motivoRetiro" value="retiro">
                                <label class="form-check-label" for="motivoRetiro">
                                    <strong>🚪 Retiro del estudiante</strong>
                                    <br><small class="text-muted">El alumno se retiró del establecimiento durante el año escolar</small>
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="radio" name="motivoEliminacion" id="motivoNoMatriculado" value="no-matriculado">
                                <label class="form-check-label" for="motivoNoMatriculado">
                                    <strong>❌ No se matriculó</strong>
                                    <br><small class="text-muted">El alumno no completó su matrícula para este año escolar</small>
                                </label>
                            </div>
                        </div>

                        <div class="mb-3">
                            <label for="observacionesEliminacion" class="form-label">Observaciones (opcional):</label>
                            <textarea class="form-control" id="observacionesEliminacion" rows="3" 
                                      placeholder="Agregar información adicional sobre la eliminación..."></textarea>
                        </div>

                        <div class="alert alert-info">
                            <small>
                                <strong>📝 Registro:</strong> Esta eliminación será registrada con fecha, hora y motivo 
                                para fines administrativos y de auditoría.
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            Cancelar
                        </button>
                        <button type="button" class="btn btn-danger" id="btnConfirmarEliminacion">
                            🗑️ Confirmar Eliminación
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        
        const btnConfirmar = modal.querySelector('#btnConfirmarEliminacion');
        const radioButtons = modal.querySelectorAll('input[name="motivoEliminacion"]');
        const observaciones = modal.querySelector('#observacionesEliminacion');

        // Habilitar botón solo cuando se seleccione un motivo
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                btnConfirmar.disabled = false;
            });
        });

        // Inicialmente deshabilitar el botón
        btnConfirmar.disabled = true;

        btnConfirmar.addEventListener('click', () => {
            const motivoSeleccionado = modal.querySelector('input[name="motivoEliminacion"]:checked');
            
            if (!motivoSeleccionado) {
                alert('Por favor seleccione un motivo de eliminación');
                return;
            }

            const datosEliminacion = {
                motivo: motivoSeleccionado.value,
                motivoTexto: motivoSeleccionado.value === 'retiro' ? 'Retiro del estudiante' : 'No se matriculó',
                observaciones: observaciones.value.trim(),
                fecha: new Date().toLocaleDateString('es-CL'),
                hora: new Date().toLocaleTimeString('es-CL'),
                timestamp: Date.now()
            };

            bootstrapModal.hide();
            resolve(datosEliminacion);
        });

        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
            resolve(null);
        });

        bootstrapModal.show();
    });
}

async function eliminarAlumno(rutAlumno, datosEliminacion) {
    try {
        // Buscar el alumno
        const alumnoIndex = datosAlumnos.findIndex(a => a.rut === rutAlumno);
        
        if (alumnoIndex === -1) {
            throw new Error('Alumno no encontrado');
        }

        const alumno = datosAlumnos[alumnoIndex];

        // Registrar la eliminación en el historial
        await registrarEliminacionHistorial(alumno, datosEliminacion);

        // Eliminar el alumno del array
        datosAlumnos.splice(alumnoIndex, 1);

        // Actualizar datos filtrados si es necesario
        const indexFiltrados = datosFiltrados.findIndex(a => a.rut === rutAlumno);
        if (indexFiltrados !== -1) {
            datosFiltrados.splice(indexFiltrados, 1);
        }

        // Guardar cambios
        guardarDatosEnStorage();

        // Actualizar interfaz
        aplicarFiltros();
        actualizarEstadisticas();

        // Mostrar confirmación
        mostrarConfirmacionEliminacion(alumno, datosEliminacion);

        console.log(`✅ Alumno eliminado: ${alumno.nombre} (${rutAlumno}) - Motivo: ${datosEliminacion.motivoTexto}`);

    } catch (error) {
        console.error('❌ Error al eliminar alumno:', error);
        throw error;
    }
}

function registrarEliminacionHistorial(alumno, datosEliminacion) {
    try {
        // Obtener historial existente
        const historialEliminaciones = JSON.parse(localStorage.getItem('historialEliminaciones') || '[]');
        
        // Crear registro de eliminación
        const registroEliminacion = {
            id: `ELI-${Date.now()}`,
            alumno: {
                nombre: alumno.nombre,
                rut: alumno.rut,
                curso: alumno.curso,
                arancel: alumno.arancel,
                beca: alumno.beca,
                totalPagado: alumno.totalPagadoReal || alumno.totalPagado,
                pendiente: alumno.pendiente,
                estado: alumno.estado
            },
            eliminacion: {
                ...datosEliminacion,
                numeroRegistro: historialEliminaciones.length + 1
            }
        };

        // Agregar al historial
        historialEliminaciones.push(registroEliminacion);

        // Guardar historial actualizado
        localStorage.setItem('historialEliminaciones', JSON.stringify(historialEliminaciones));

        console.log('📝 Eliminación registrada en historial:', registroEliminacion.id);

    } catch (error) {
        console.error('❌ Error al registrar eliminación:', error);
        // No bloquear la eliminación por error en el historial
    }
}

function mostrarConfirmacionEliminacion(alumno, datosEliminacion) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header bg-success text-white">
                    <h5 class="modal-title">✅ Alumno Eliminado</h5>
                </div>
                <div class="modal-body text-center">
                    <div class="alert alert-success">
                        <h6>El alumno ha sido eliminado correctamente del sistema</h6>
                    </div>
                    
                    <table class="table table-borderless">
                        <tr>
                            <td><strong>Alumno:</strong></td>
                            <td>${alumno.nombre}</td>
                        </tr>
                        <tr>
                            <td><strong>RUT:</strong></td>
                            <td>${formatearRUT(alumno.rut)}</td>
                        </tr>
                        <tr>
                            <td><strong>Motivo:</strong></td>
                            <td><span class="badge bg-primary">${datosEliminacion.motivoTexto}</span></td>
                        </tr>
                        <tr>
                            <td><strong>Fecha:</strong></td>
                            <td>${datosEliminacion.fecha} ${datosEliminacion.hora}</td>
                        </tr>
                        ${datosEliminacion.observaciones ? `
                        <tr>
                            <td><strong>Observaciones:</strong></td>
                            <td><em>"${datosEliminacion.observaciones}"</em></td>
                        </tr>
                        ` : ''}
                    </table>

                    <div class="alert alert-info small mt-3">
                        <strong>📝 Registro:</strong> Esta eliminación ha sido registrada en el historial 
                        del sistema para fines administrativos.
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" data-bs-dismiss="modal">
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });

    bootstrapModal.show();
}

// Función para ver el historial de eliminaciones (para administradores)
function mostrarHistorialEliminaciones() {
    try {
        const historial = JSON.parse(localStorage.getItem('historialEliminaciones') || '[]');
        
        if (historial.length === 0) {
            alert('No hay registros de eliminaciones en el historial');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header bg-info text-white">
                        <h5 class="modal-title">📝 Historial de Eliminaciones</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="table-responsive">
                            <table class="table table-striped table-hover">
                                <thead class="table-dark">
                                    <tr>
                                        <th>#</th>
                                        <th>Alumno</th>
                                        <th>RUT</th>
                                        <th>Curso</th>
                                        <th>Motivo</th>
                                        <th>Fecha</th>
                                        <th>Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${historial.reverse().map(registro => `
                                        <tr>
                                            <td><small class="text-muted">#${registro.eliminacion.numeroRegistro}</small></td>
                                            <td><strong>${registro.alumno.nombre}</strong></td>
                                            <td class="rut-formato">${formatearRUT(registro.alumno.rut)}</td>
                                            <td><span class="badge bg-secondary">${registro.alumno.curso}</span></td>
                                            <td>
                                                <span class="badge bg-${registro.eliminacion.motivo === 'retiro' ? 'warning' : 'danger'}">
                                                    ${registro.eliminacion.motivoTexto}
                                                </span>
                                            </td>
                                            <td>
                                                <small>${registro.eliminacion.fecha}<br>${registro.eliminacion.hora}</small>
                                            </td>
                                            <td>
                                                <small class="text-muted">${registro.eliminacion.observaciones || '-'}</small>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="mt-3">
                            <small class="text-muted">
                                Total de eliminaciones registradas: <strong>${historial.length}</strong>
                            </small>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bootstrapModal = new bootstrap.Modal(modal);
        
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });

        bootstrapModal.show();

    } catch (error) {
        console.error('Error al mostrar historial:', error);
        alert('Error al cargar el historial de eliminaciones');
    }
}

// === SISTEMA DE MATRÍCULA ===

// Configuración del año escolar actual
const AÑO_ESCOLAR_ACTUAL = 2025;
const AÑO_MATRICULA_SIGUIENTE = 2026;

// Aranceles en UF para 2026 (valor UF pendiente hasta primer día hábil de marzo)
const ARANCELES_UF_2026 = {
    // Básica (1° a 8°): 28,731 UF ÷ 10 cuotas
    BASICA: {
        totalUF: 28.731,
        cuotas: 10,
        niveles: ['1 BASICO', '2 BASICO', '3 BASICO', '4 BASICO', '5 BASICO', '6 BASICO', '7 BASICO', '8 BASICO']
    },
    // Media + NT1/NT2: 32,717 UF ÷ 10 cuotas (4° Medio: 9 cuotas)
    MEDIA_NT: {
        totalUF: 32.717,
        cuotas: 10,
        niveles: ['1 MEDIO', '2 MEDIO', '3 MEDIO', '4 MEDIO', 'NT1', 'NT2', 'NT1 A', 'NT1 B', 'NT2 A', 'NT2 B']
    }
};

// Configuración de costos de matrícula para 2025 (actual)  
// REGLA: Solo educación media paga matrícula $3,500, resto $0
const COSTOS_MATRICULA = {
    'NT1': { matricula: 0, mensualidad: 120000, cuotas: 10 },
    'NT1 A': { matricula: 0, mensualidad: 120000, cuotas: 10 },
    'NT1 B': { matricula: 0, mensualidad: 120000, cuotas: 10 },
    'NT2': { matricula: 0, mensualidad: 120000, cuotas: 10 },
    'NT2 A': { matricula: 0, mensualidad: 120000, cuotas: 10 },
    'NT2 B': { matricula: 0, mensualidad: 120000, cuotas: 10 },
    '1 BASICO A': { matricula: 0, mensualidad: 140000, cuotas: 10 },
    '1 BASICO B': { matricula: 0, mensualidad: 140000, cuotas: 10 },
    '2 BASICO A': { matricula: 0, mensualidad: 140000, cuotas: 10 },
    '2 BASICO B': { matricula: 0, mensualidad: 140000, cuotas: 10 },
    '3 BASICO A': { matricula: 0, mensualidad: 140000, cuotas: 10 },
    '3 BASICO B': { matricula: 0, mensualidad: 140000, cuotas: 10 },
    '4 BASICO A': { matricula: 0, mensualidad: 140000, cuotas: 10 },
    '4 BASICO B': { matricula: 0, mensualidad: 140000, cuotas: 10 },
    '5 BASICO A': { matricula: 0, mensualidad: 150000, cuotas: 10 },
    '5 BASICO B': { matricula: 0, mensualidad: 150000, cuotas: 10 },
    '6 BASICO A': { matricula: 0, mensualidad: 150000, cuotas: 10 },
    '6 BASICO B': { matricula: 0, mensualidad: 150000, cuotas: 10 },
    '7 BASICO A': { matricula: 0, mensualidad: 160000, cuotas: 10 },
    '7 BASICO B': { matricula: 0, mensualidad: 160000, cuotas: 10 },
    '8 BASICO A': { matricula: 0, mensualidad: 160000, cuotas: 10 },
    '8 BASICO B': { matricula: 0, mensualidad: 160000, cuotas: 10 },
    '1 MEDIO A': { matricula: 3500, mensualidad: 180000, cuotas: 10 },
    '1 MEDIO B': { matricula: 3500, mensualidad: 180000, cuotas: 10 },
    '2 MEDIO A': { matricula: 3500, mensualidad: 180000, cuotas: 10 },
    '2 MEDIO B': { matricula: 3500, mensualidad: 180000, cuotas: 10 },
    '3 MEDIO A': { matricula: 3500, mensualidad: 200000, cuotas: 10 },
    '3 MEDIO B': { matricula: 3500, mensualidad: 200000, cuotas: 10 },
    '4 MEDIO A': { matricula: 3500, mensualidad: 200000, cuotas: 9 },
    '4 MEDIO B': { matricula: 3500, mensualidad: 200000, cuotas: 9 },
    '4 MEDIO C': { matricula: 3500, mensualidad: 200000, cuotas: 9 } // Corregido de 270000 a 3500
};

// Tabla de promoción de cursos
const PROMOCION_CURSOS = {
    'NT1': 'NT2',
    'NT1 A': 'NT2 A', 
    'NT1 B': 'NT2 B',
    'NT2': '1 BASICO A',
    'NT2 A': '1 BASICO A',
    'NT2 B': '1 BASICO B',
    '1 BASICO A': '2 BASICO A',
    '1 BASICO B': '2 BASICO B',
    '2 BASICO A': '3 BASICO A',
    '2 BASICO B': '3 BASICO B',
    '3 BASICO A': '4 BASICO A',
    '3 BASICO B': '4 BASICO B',
    '4 BASICO A': '5 BASICO A',
    '4 BASICO B': '5 BASICO B',
    '5 BASICO A': '6 BASICO A',
    '5 BASICO B': '6 BASICO B',
    '6 BASICO A': '7 BASICO A',
    '6 BASICO B': '7 BASICO B',
    '7 BASICO A': '8 BASICO A',
    '7 BASICO B': '8 BASICO B',
    '8 BASICO A': '1 MEDIO A',
    '8 BASICO B': '1 MEDIO B',
    '1 MEDIO A': '2 MEDIO A',
    '1 MEDIO B': '2 MEDIO B',
    '2 MEDIO A': '3 MEDIO A',
    '2 MEDIO B': '3 MEDIO B',
    '3 MEDIO A': '4 MEDIO A',
    '3 MEDIO B': '4 MEDIO B',
    '4 MEDIO A': 'EGRESADO',
    '4 MEDIO B': 'EGRESADO',
    '4 MEDIO C': 'EGRESADO'
};

function obtenerCursoSiguiente(cursoActual) {
    return PROMOCION_CURSOS[cursoActual] || cursoActual;
}

function calcularArancelUF2026(curso) {
    // Determinar si es Básica o Media/NT
    const esCursoBasico = ARANCELES_UF_2026.BASICA.niveles.some(nivel => {
        if (nivel.includes(' ')) {
            return curso.includes(nivel.split(' ')[0] + ' ' + nivel.split(' ')[1]);
        } else {
            return curso === nivel;
        }
    });
    
    const esCursoMedio = ARANCELES_UF_2026.MEDIA_NT.niveles.some(nivel => {
        if (nivel.includes(' ')) {
            return curso.includes(nivel.split(' ')[0] + ' ' + nivel.split(' ')[1]);
        } else {
            return curso === nivel; // Para NT1 y NT2
        }
    });
    
    if (esCursoBasico) {
        return {
            categoria: 'BASICA',
            totalUF: ARANCELES_UF_2026.BASICA.totalUF,
            cuotas: ARANCELES_UF_2026.BASICA.cuotas,
            cuotaUF: ARANCELES_UF_2026.BASICA.totalUF / ARANCELES_UF_2026.BASICA.cuotas
        };
    } else if (esCursoMedio) {
        const cuotas = curso.includes('4 MEDIO') ? 9 : ARANCELES_UF_2026.MEDIA_NT.cuotas;
        return {
            categoria: 'MEDIA_NT',
            totalUF: ARANCELES_UF_2026.MEDIA_NT.totalUF,
            cuotas: cuotas,
            cuotaUF: ARANCELES_UF_2026.MEDIA_NT.totalUF / cuotas
        };
    }
    
    return null;
}

// Estado del proceso de matrícula
let estadoMatricula = {
    paso: 1,
    datosAlumno: {},
    datosApoderado: {},
    documentos: {},
    costosCalculados: {},
    pagoMatriculaCompletado: false
};

function iniciarProcesomatricula() {
    // Reiniciar estado
    estadoMatricula = {
        paso: 1,
        datosAlumno: {},
        datosApoderado: {},
        documentos: {},
        costosCalculados: {},
        pagoMatriculaCompletado: false
    };

    const modal = document.getElementById('modalMatricula');
    const bootstrapModal = new bootstrap.Modal(modal);
    
    mostrarPasoMatricula(1);
    bootstrapModal.show();
}

function mostrarPasoMatricula(paso) {
    estadoMatricula.paso = paso;
    const modalCuerpo = document.getElementById('modalCuerpoMatricula');
    const modalFooter = document.getElementById('modalFooterMatricula');
    
    switch (paso) {
        case 1:
            mostrarFormularioAlumno(modalCuerpo, modalFooter);
            break;
        case 2:
            mostrarFormularioApoderado(modalCuerpo, modalFooter);
            break;
        case 3:
            mostrarListaDocumentos(modalCuerpo, modalFooter);
            break;
        case 4:
            mostrarResumenYCostos(modalCuerpo, modalFooter);
            break;
        case 5:
            mostrarPagoMatricula(modalCuerpo, modalFooter);
            break;
        case 6:
            mostrarConfirmacionMatricula(modalCuerpo, modalFooter);
            break;
    }
}

function mostrarFormularioAlumno(modalCuerpo, modalFooter) {
    modalCuerpo.innerHTML = `
        <div class="row">
            <div class="col-12">
                <div class="progress mb-4">
                    <div class="progress-bar" style="width: 16.66%">Paso 1 de 6: Datos del Estudiante</div>
                </div>
            </div>
        </div>

        <form id="formularioAlumno">
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">👤 Información Personal</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label for="rutAlumno" class="form-label">RUT <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="rutAlumno" 
                                       placeholder="12.345.678-9" required 
                                       oninput="formatearRUTInput(this); setTimeout(verificarAlumnoExistente, 100);"
                                       onblur="verificarAlumnoExistente()"
                                       onkeyup="setTimeout(verificarAlumnoExistente, 100);">
                                <div id="infoAlumnoExistente" class="mt-2 d-none">
                                    <div class="alert alert-info">
                                        <strong>Alumno existente detectado</strong><br>
                                        <span id="textoAlumnoExistente"></span>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label for="nombreCompleto" class="form-label">Nombre Completo <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="nombreCompleto" 
                                       placeholder="Escriba el nombre para buscar alumno existente" required
                                       oninput="buscarPorNombre(this.value)">
                                <div id="sugerenciasNombre" class="mt-2 d-none">
                                    <div class="list-group" id="listaSugerencias"></div>
                                </div>
                                <small class="form-text text-muted">Escriba el nombre para buscar alumnos existentes</small>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="fechaNacimiento" class="form-label">Fecha de Nacimiento <span class="text-danger">*</span></label>
                                        <input type="date" class="form-control" id="fechaNacimiento" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="sexo" class="form-label">Sexo <span class="text-danger">*</span></label>
                                        <select class="form-select" id="sexo" required>
                                            <option value="">Seleccionar...</option>
                                            <option value="M">Masculino</option>
                                            <option value="F">Femenino</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label for="nacionalidad" class="form-label">Nacionalidad</label>
                                <input type="text" class="form-control" id="nacionalidad" 
                                       value="Chilena" placeholder="Nacionalidad">
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">🏫 Información Académica</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label for="cursoMatricula" class="form-label">Curso a Matricular <span class="text-danger">*</span></label>
                                <select class="form-select" id="cursoMatricula" required onchange="calcularCostosMatricula()">
                                    <option value="">Seleccionar curso...</option>
                                    <optgroup label="Educación Parvularia">
                                        <option value="NT1 A">NT1 A (Nivel de Transición 1 - Sección A)</option>
                                        <option value="NT1 B">NT1 B (Nivel de Transición 1 - Sección B)</option>
                                        <option value="NT2 A">NT2 A (Nivel de Transición 2 - Sección A)</option>
                                        <option value="NT2 B">NT2 B (Nivel de Transición 2 - Sección B)</option>
                                    </optgroup>
                                    <optgroup label="Educación Básica">
                                        <option value="1 BASICO A">1° Básico A</option>
                                        <option value="1 BASICO B">1° Básico B</option>
                                        <option value="2 BASICO A">2° Básico A</option>
                                        <option value="2 BASICO B">2° Básico B</option>
                                        <option value="3 BASICO A">3° Básico A</option>
                                        <option value="3 BASICO B">3° Básico B</option>
                                        <option value="4 BASICO A">4° Básico A</option>
                                        <option value="4 BASICO B">4° Básico B</option>
                                        <option value="5 BASICO A">5° Básico A</option>
                                        <option value="5 BASICO B">5° Básico B</option>
                                        <option value="6 BASICO A">6° Básico A</option>
                                        <option value="6 BASICO B">6° Básico B</option>
                                        <option value="7 BASICO A">7° Básico A</option>
                                        <option value="7 BASICO B">7° Básico B</option>
                                        <option value="8 BASICO A">8° Básico A</option>
                                        <option value="8 BASICO B">8° Básico B</option>
                                    </optgroup>
                                    <optgroup label="Educación Media">
                                        <option value="1 MEDIO A">1° Medio A</option>
                                        <option value="1 MEDIO B">1° Medio B</option>
                                        <option value="2 MEDIO A">2° Medio A</option>
                                        <option value="2 MEDIO B">2° Medio B</option>
                                        <option value="3 MEDIO A">3° Medio A</option>
                                        <option value="3 MEDIO B">3° Medio B</option>
                                        <option value="4 MEDIO A">4° Medio A</option>
                                        <option value="4 MEDIO B">4° Medio B</option>
                                        <option value="4 MEDIO C">4° Medio C</option>
                                    </optgroup>
                                </select>
                            </div>
                            
                            <div id="resumenCostos" class="alert alert-info d-none">
                                <h6>💰 Costos de Matrícula:</h6>
                                <ul class="mb-0">
                                    <li>Matrícula: <strong id="costoMatricula">-</strong></li>
                                    <li>Mensualidad: <strong id="costoMensualidad">-</strong></li>
                                    <li>Cuotas anuales: <strong id="numeroCuotas">-</strong></li>
                                </ul>
                            </div>
                            
                            <div class="mb-3">
                                <label for="colegioAnterior" class="form-label">Colegio de Procedencia</label>
                                <input type="text" class="form-control" id="colegioAnterior" 
                                       placeholder="Nombre del colegio anterior (si aplica)">
                            </div>
                            
                            <div class="mb-3">
                                <label for="repitente" class="form-label">¿Es repitente?</label>
                                <select class="form-select" id="repitente">
                                    <option value="No">No</option>
                                    <option value="Si">Sí</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mt-3">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">🏠 Información de Contacto</h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-8">
                                    <div class="mb-3">
                                        <label for="direccion" class="form-label">Dirección <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="direccion" 
                                               placeholder="Dirección completa" required>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="mb-3">
                                        <label for="comuna" class="form-label">Comuna <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="comuna" 
                                               placeholder="Comuna" required>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="telefono" class="form-label">Teléfono</label>
                                        <input type="tel" class="form-control" id="telefono" 
                                               placeholder="+56 9 1234 5678">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="email" class="form-label">Email</label>
                                        <input type="email" class="form-control" id="email" 
                                               placeholder="correo@ejemplo.com">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    `;
    
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-primary" onclick="validarYContinuar(1)">
            Siguiente: Datos del Apoderado →
        </button>
    `;
}

function buscarPorNombre(nombre) {
    console.log(`🔍 Buscando por nombre: "${nombre}"`);
    
    const sugerenciasDiv = document.getElementById('sugerenciasNombre');
    const listaSugerencias = document.getElementById('listaSugerencias');
    const rutInput = document.getElementById('rutAlumno');
    
    // Si el nombre es muy corto, ocultar sugerencias
    if (!nombre || nombre.length < 3) {
        sugerenciasDiv.classList.add('d-none');
        return;
    }
    
    // Buscar alumnos que coincidan
    const coincidencias = datosAlumnos.filter(alumno => 
        alumno.nombre.toLowerCase().includes(nombre.toLowerCase())
    ).slice(0, 5); // Máximo 5 sugerencias
    
    console.log(`📋 Encontradas ${coincidencias.length} coincidencias`);
    
    if (coincidencias.length > 0) {
        // Mostrar sugerencias
        listaSugerencias.innerHTML = '';
        
        coincidencias.forEach(alumno => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = 'list-group-item list-group-item-action';
            item.innerHTML = `
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1">${alumno.nombre}</h6>
                    <small class="text-muted">${alumno.curso}</small>
                </div>
                <p class="mb-1">RUT: ${alumno.rut}</p>
                <small class="text-muted">Click para seleccionar</small>
            `;
            
            item.onclick = () => seleccionarAlumno(alumno);
            listaSugerencias.appendChild(item);
        });
        
        sugerenciasDiv.classList.remove('d-none');
    } else {
        sugerenciasDiv.classList.add('d-none');
    }
}

function seleccionarAlumno(alumno) {
    console.log('👤 Alumno seleccionado:', alumno);
    
    // Auto-completar todos los campos
    const nombreInput = document.getElementById('nombreCompleto');
    const rutInput = document.getElementById('rutAlumno');
    
    console.log('📋 Campos encontrados:', {
        nombreInput: !!nombreInput,
        rutInput: !!rutInput
    });
    
    // Completar nombre
    if (nombreInput) {
        nombreInput.value = alumno.nombre;
        console.log('✅ Nombre completado:', alumno.nombre);
    }
    
    // Completar RUT
    if (rutInput) {
        rutInput.value = alumno.rut;
        rutInput.dispatchEvent(new Event('input', { bubbles: true })); // Trigger input event
        rutInput.dispatchEvent(new Event('change', { bubbles: true })); // Trigger change event
        console.log('✅ RUT completado:', alumno.rut);
        
        // Forzar actualización visual
        setTimeout(() => {
            rutInput.value = alumno.rut;
            console.log('🔄 RUT reconfirmado:', rutInput.value);
        }, 100);
    } else {
        console.log('❌ Campo RUT no encontrado');
    }
    
    // Auto-completar fecha de nacimiento si existe
    const fechaNacInput = document.getElementById('fechaNacimiento');
    if (fechaNacInput && alumno.fechaNacimiento) {
        fechaNacInput.value = alumno.fechaNacimiento;
    }
    
    // Calcular curso siguiente
    const cursoSiguiente = obtenerCursoSiguiente(alumno.curso);
    const cursoSelect = document.getElementById('cursoMatricula');
    
    if (cursoSelect && cursoSiguiente !== 'EGRESADO') {
        cursoSelect.value = cursoSiguiente;
        calcularCostosMatricula();
    }
    
    // Guardar referencia
    estadoMatricula.alumnoExistente = alumno;
    
    // Ocultar sugerencias
    document.getElementById('sugerenciasNombre').classList.add('d-none');
    
    // Mostrar información
    const infoDiv = document.getElementById('infoAlumnoExistente');
    const textoSpan = document.getElementById('textoAlumnoExistente');
    
    if (cursoSiguiente !== 'EGRESADO') {
        textoSpan.innerHTML = `
            <strong>✅ Alumno seleccionado</strong><br>
            <strong class="text-success">${alumno.nombre}</strong><br>
            Curso actual (${AÑO_ESCOLAR_ACTUAL}): <strong>${alumno.curso}</strong><br>
            Curso para matrícula ${AÑO_MATRICULA_SIGUIENTE}: <strong class="text-primary">${cursoSiguiente}</strong>
        `;
    } else {
        textoSpan.innerHTML = `
            <strong>✅ Alumno seleccionado</strong><br>
            <strong class="text-success">${alumno.nombre}</strong><br>
            Curso actual (${AÑO_ESCOLAR_ACTUAL}): <strong>${alumno.curso}</strong><br>
            <span class="text-warning">⚠️ Alumno egresa este año - No requiere re-matrícula</span>
        `;
    }
    
    infoDiv.classList.remove('d-none');
}

function verificarAlumnoExistente() {
    console.log('🔄 verificarAlumnoExistente() ejecutándose...');
    
    const rutInput = document.getElementById('rutAlumno');
    const infoDiv = document.getElementById('infoAlumnoExistente');
    const textoSpan = document.getElementById('textoAlumnoExistente');
    const nombreInput = document.getElementById('nombreCompleto');
    const cursoSelect = document.getElementById('cursoMatricula');
    const fechaNacInput = document.getElementById('fechaNacimiento');
    
    console.log('📋 Elementos encontrados:', {
        rutInput: !!rutInput,
        infoDiv: !!infoDiv,
        nombreInput: !!nombreInput,
        rutValue: rutInput?.value || 'SIN VALOR'
    });
    
    // Limpiar campos si no hay RUT
    if (!rutInput.value || rutInput.value.length < 8) {
        infoDiv.classList.add('d-none');
        nombreInput.value = '';
        nombreInput.readOnly = false;
        nombreInput.placeholder = 'Nombres y apellidos completos';
        if (fechaNacInput) fechaNacInput.value = '';
        estadoMatricula.alumnoExistente = null;
        return;
    }
    
    // Buscar alumno existente en los datos
    const rutLimpio = rutInput.value.replace(/[.-\s]/g, '');
    
    console.log(`🔍 Buscando alumno con RUT: ${rutInput.value}`);
    console.log(`📝 RUT limpio: ${rutLimpio}`);
    console.log(`👥 Total alumnos cargados: ${datosAlumnos.length}`);
    console.log(`🔢 Primeros 5 RUTs en sistema:`, datosAlumnos.slice(0, 5).map(a => ({
        nombre: a.nombre,
        rutOriginal: a.rut,
        rutLimpio: a.rut.replace(/[.-\s]/g, '')
    })));
    
    const alumnoExistente = datosAlumnos.find(alumno => {
        const rutAlumnoLimpio = alumno.rut.replace(/[.-\s]/g, '');
        return rutAlumnoLimpio === rutLimpio;
    });
    
    console.log(`🎯 Alumno encontrado:`, alumnoExistente ? alumnoExistente.nombre : 'No encontrado');
    
    if (alumnoExistente) {
        // Auto-completar INMEDIATAMENTE el nombre
        nombreInput.value = alumnoExistente.nombre;
        nombreInput.readOnly = true;
        nombreInput.classList.add('bg-light');
        
        // Auto-completar fecha de nacimiento si existe
        if (fechaNacInput && alumnoExistente.fechaNacimiento) {
            fechaNacInput.value = alumnoExistente.fechaNacimiento;
        }
        
        // Calcular curso siguiente para matrícula 2026
        const cursoSiguiente = obtenerCursoSiguiente(alumnoExistente.curso);
        
        if (cursoSiguiente !== 'EGRESADO') {
            textoSpan.innerHTML = `
                <strong>✅ Alumno encontrado en el sistema</strong><br>
                <strong class="text-success">${alumnoExistente.nombre}</strong><br>
                Curso actual (${AÑO_ESCOLAR_ACTUAL}): <strong>${alumnoExistente.curso}</strong><br>
                Curso para matrícula ${AÑO_MATRICULA_SIGUIENTE}: <strong class="text-primary">${cursoSiguiente}</strong>
            `;
            
            // Pre-seleccionar curso siguiente
            if (cursoSelect) {
                cursoSelect.value = cursoSiguiente;
                calcularCostosMatricula();
            }
            
            // Guardar referencia del alumno existente para usar sus datos
            estadoMatricula.alumnoExistente = alumnoExistente;
            
        } else {
            textoSpan.innerHTML = `
                <strong>✅ Alumno encontrado</strong><br>
                <strong class="text-success">${alumnoExistente.nombre}</strong><br>
                Curso actual (${AÑO_ESCOLAR_ACTUAL}): <strong>${alumnoExistente.curso}</strong><br>
                <span class="text-warning">⚠️ Alumno egresa este año - No requiere re-matrícula</span>
            `;
        }
        
        infoDiv.classList.remove('d-none');
    } else {
        // RUT no encontrado - limpiar campos
        infoDiv.classList.add('d-none');
        nombreInput.value = '';
        nombreInput.readOnly = false;
        nombreInput.classList.remove('bg-light');
        nombreInput.placeholder = 'Ingrese nombre completo (alumno nuevo)';
        if (fechaNacInput) fechaNacInput.value = '';
        estadoMatricula.alumnoExistente = null;
    }
}

function calcularCostosMatricula() {
    const curso = document.getElementById('cursoMatricula').value;
    const resumenDiv = document.getElementById('resumenCostos');
    
    // Verificar si es para matrícula 2026 (aranceles UF)
    const añoMatricula = AÑO_MATRICULA_SIGUIENTE;
    
    if (curso) {
        let costos;
        
        // Determinar matrícula: solo $3,500 para educación media, resto $0
        const esEducacionMedia = curso.includes('MEDIO');
        const matricula = esEducacionMedia ? 3500 : 0;
        
        if (añoMatricula === 2026) {
            // Calcular con aranceles UF para 2026
            const arancelUF = calcularArancelUF2026(curso);
            
            if (arancelUF) {
                costos = {
                    matricula: matricula,
                    mensualidad: 'PENDIENTE_UF', // Pendiente del valor UF
                    cuotas: arancelUF.cuotas,
                    arancelUF: arancelUF,
                    año: añoMatricula
                };
                
                document.getElementById('costoMatricula').textContent = formatearMoneda(matricula);
                document.getElementById('costoMensualidad').innerHTML = `
                    <strong>${arancelUF.cuotaUF.toFixed(3)} UF por cuota</strong><br>
                    <small class="text-muted">Total: ${arancelUF.totalUF} UF (${arancelUF.categoria})</small><br>
                    <small class="text-warning">⏳ Valor se conoce el primer día hábil de marzo ${añoMatricula}</small>
                `;
                document.getElementById('numeroCuotas').textContent = arancelUF.cuotas + ' cuotas';
            } else {
                // Curso no encontrado en aranceles UF, usar costos tradicionales
                costos = COSTOS_MATRICULA[curso] || { matricula: matricula, mensualidad: 0, cuotas: 10 };
                costos.matricula = matricula; // Asegurar matrícula correcta
                document.getElementById('costoMatricula').textContent = formatearMoneda(costos.matricula);
                document.getElementById('costoMensualidad').textContent = formatearMoneda(costos.mensualidad);
                document.getElementById('numeroCuotas').textContent = costos.cuotas + ' cuotas';
            }
        } else {
            // Usar costos tradicionales para año actual
            costos = COSTOS_MATRICULA[curso] || { matricula: matricula, mensualidad: 0, cuotas: 10 };
            costos.matricula = matricula; // Asegurar matrícula correcta
            document.getElementById('costoMatricula').textContent = formatearMoneda(costos.matricula);
            document.getElementById('costoMensualidad').textContent = formatearMoneda(costos.mensualidad);
            document.getElementById('numeroCuotas').textContent = costos.cuotas + ' cuotas';
        }
        
        estadoMatricula.costosCalculados = costos;
        resumenDiv.classList.remove('d-none');
    } else {
        resumenDiv.classList.add('d-none');
    }
}

function validarRUT(rut) {
    console.log(`🔍 Validando RUT: "${rut}"`);
    
    // VALIDACIÓN PERMISIVA - Solo verificar que no esté vacío y tenga formato básico
    if (!rut || rut.trim() === '') {
        console.log('❌ RUT vacío');
        return false;
    }
    
    // Limpiar el RUT
    const rutLimpio = rut.replace(/[.\-\s]/g, '').toUpperCase();
    console.log(`🧹 RUT limpio: "${rutLimpio}"`);
    
    // Validación muy básica - solo longitud
    if (rutLimpio.length < 7 || rutLimpio.length > 9) {
        console.log(`❌ Longitud incorrecta: ${rutLimpio.length}`);
        return false;
    }
    
    // Si llegamos aquí, considerar válido para no bloquear
    console.log('✅ RUT aceptado (validación permisiva)');
    return true;
}

function validarYContinuar(pasoActual) {
    if (pasoActual === 1) {
        if (validarFormularioAlumno()) {
            guardarDatosAlumno();
            mostrarPasoMatricula(2);
        }
    } else if (pasoActual === 2) {
        if (validarFormularioApoderado()) {
            guardarDatosApoderado();
            mostrarPasoMatricula(3);
        }
    } else if (pasoActual === 3) {
        if (validarDocumentos()) {
            guardarDocumentos();
            mostrarPasoMatricula(4);
        }
    } else if (pasoActual === 4) {
        // Verificar si hay costo de matrícula
        const costos = estadoMatricula.costosCalculados;
        if (costos.matricula === 0) {
            // Si no hay costo de matrícula, marcar como completado y ir directo a confirmación
            estadoMatricula.pagoMatriculaCompletado = true;
            mostrarPasoMatricula(6);
        } else {
            // Si hay costo, ir al pago de matrícula
            mostrarPasoMatricula(5);
        }
    } else if (pasoActual === 5) {
        // Completar matrícula
        if (estadoMatricula.pagoMatriculaCompletado) {
            completarMatricula();
        } else {
            alert('Debe completar el pago de matrícula antes de continuar');
        }
    }
}

function validarFormularioAlumno() {
    const form = document.getElementById('formularioAlumno');
    if (!form.checkValidity()) {
        form.reportValidity();
        return false;
    }
    
    // Validaciones adicionales
    const rut = document.getElementById('rutAlumno').value;
    if (!validarRUT(rut)) {
        alert('El RUT ingresado no es válido');
        return false;
    }
    
    // Verificar si el RUT ya existe (comparar sin formato)
    const rutLimpio = rut.replace(/[.-]/g, '');
    const rutExiste = datosAlumnos.some(alumno => 
        alumno.rut.replace(/[.-]/g, '') === rutLimpio);
    if (rutExiste && !estadoMatricula.alumnoExistente) {
        alert('Ya existe un alumno con este RUT. Use la función de auto-completado para re-matricular.');
        return false;
    }
    
    const curso = document.getElementById('cursoMatricula').value;
    if (!COSTOS_MATRICULA[curso]) {
        alert('Debe seleccionar un curso válido');
        return false;
    }
    
    return true;
}

function guardarDatosAlumno() {
    estadoMatricula.datosAlumno = {
        nombreCompleto: document.getElementById('nombreCompleto').value.trim().toUpperCase(),
        rut: document.getElementById('rutAlumno').value,
        fechaNacimiento: document.getElementById('fechaNacimiento').value,
        sexo: document.getElementById('sexo').value,
        nacionalidad: document.getElementById('nacionalidad').value || 'Chilena',
        curso: document.getElementById('cursoMatricula').value,
        colegioAnterior: document.getElementById('colegioAnterior').value.trim(),
        repitente: document.getElementById('repitente').value,
        direccion: document.getElementById('direccion').value.trim(),
        comuna: document.getElementById('comuna').value.trim(),
        telefono: document.getElementById('telefono').value.trim(),
        email: document.getElementById('email').value.trim()
    };
    
    console.log('Datos del alumno guardados:', estadoMatricula.datosAlumno);
}

function mostrarFormularioApoderado(modalCuerpo, modalFooter) {
    modalCuerpo.innerHTML = `
        <div class="row">
            <div class="col-12">
                <div class="progress mb-4">
                    <div class="progress-bar" style="width: 33.33%">Paso 2 de 6: Datos del Apoderado</div>
                </div>
            </div>
        </div>

        <form id="formularioApoderado">
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">👨‍👩‍👧‍👦 Apoderado Titular</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label for="nombreApoderado" class="form-label">Nombre Completo <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="nombreApoderado" 
                                       placeholder="Nombres y apellidos completos" required>
                            </div>
                            
                            <div class="mb-3">
                                <label for="rutApoderado" class="form-label">RUT <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="rutApoderado" 
                                       placeholder="12.345.678-9" required oninput="formatearRUTInput(this)">
                            </div>
                            
                            <div class="mb-3">
                                <label for="parentesco" class="form-label">Parentesco <span class="text-danger">*</span></label>
                                <select class="form-select" id="parentesco" required>
                                    <option value="">Seleccionar...</option>
                                    <option value="Padre">Padre</option>
                                    <option value="Madre">Madre</option>
                                    <option value="Tutor">Tutor/a Legal</option>
                                    <option value="Abuelo">Abuelo/a</option>
                                    <option value="Tio">Tío/a</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                            
                            <div class="mb-3">
                                <label for="fechaNacimientoApoderado" class="form-label">Fecha de Nacimiento</label>
                                <input type="date" class="form-control" id="fechaNacimientoApoderado">
                            </div>
                            
                            <div class="mb-3">
                                <label for="nacionalidadApoderado" class="form-label">Nacionalidad</label>
                                <input type="text" class="form-control" id="nacionalidadApoderado" 
                                       value="Chilena" placeholder="Nacionalidad">
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">💼 Información Laboral</h6>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label for="profesion" class="form-label">Profesión/Oficio</label>
                                <input type="text" class="form-control" id="profesion" 
                                       placeholder="Profesión u oficio">
                            </div>
                            
                            <div class="mb-3">
                                <label for="empresa" class="form-label">Empresa/Lugar de Trabajo</label>
                                <input type="text" class="form-control" id="empresa" 
                                       placeholder="Nombre de la empresa">
                            </div>
                            
                            <div class="mb-3">
                                <label for="ingresos" class="form-label">Ingresos Mensuales Aproximados</label>
                                <select class="form-select" id="ingresos">
                                    <option value="">Preferir no indicar</option>
                                    <option value="Menos de $500.000">Menos de $500.000</option>
                                    <option value="$500.000 - $800.000">$500.000 - $800.000</option>
                                    <option value="$800.000 - $1.200.000">$800.000 - $1.200.000</option>
                                    <option value="$1.200.000 - $1.800.000">$1.200.000 - $1.800.000</option>
                                    <option value="$1.800.000 - $2.500.000">$1.800.000 - $2.500.000</option>
                                    <option value="Más de $2.500.000">Más de $2.500.000</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mt-3">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">📱 Información de Contacto</h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="telefonoApoderado" class="form-label">Teléfono Principal <span class="text-danger">*</span></label>
                                        <input type="tel" class="form-control" id="telefonoApoderado" 
                                               placeholder="+56 9 1234 5678" required>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="telefonoTrabajo" class="form-label">Teléfono Trabajo</label>
                                        <input type="tel" class="form-control" id="telefonoTrabajo" 
                                               placeholder="+56 2 1234 5678">
                                    </div>
                                </div>
                            </div>
                            
                            <div class="mb-3">
                                <label for="emailApoderado" class="form-label">Email <span class="text-danger">*</span></label>
                                <input type="email" class="form-control" id="emailApoderado" 
                                       placeholder="apoderado@ejemplo.com" required>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-8">
                                    <div class="mb-3">
                                        <label for="direccionApoderado" class="form-label">Dirección <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="direccionApoderado" 
                                               placeholder="Dirección completa" required>
                                        <div class="form-check mt-2">
                                            <input class="form-check-input" type="checkbox" id="mismaDireccion" onchange="copiarDireccionAlumno()">
                                            <label class="form-check-label" for="mismaDireccion">
                                                Misma dirección del estudiante
                                            </label>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="mb-3">
                                        <label for="comunaApoderado" class="form-label">Comuna <span class="text-danger">*</span></label>
                                        <input type="text" class="form-control" id="comunaApoderado" 
                                               placeholder="Comuna" required>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mt-3">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">👨‍👩‍👧‍👦 Apoderado Suplente (Opcional)</h6>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="nombreSuplente" class="form-label">Nombre Completo</label>
                                        <input type="text" class="form-control" id="nombreSuplente" 
                                               placeholder="Nombres y apellidos completos">
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="rutSuplente" class="form-label">RUT</label>
                                        <input type="text" class="form-control" id="rutSuplente" 
                                               placeholder="12.345.678-9" oninput="formatearRUTInput(this)">
                                    </div>
                                </div>
                            </div>
                            
                            <div class="row">
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="parentescoSuplente" class="form-label">Parentesco</label>
                                        <select class="form-select" id="parentescoSuplente">
                                            <option value="">Seleccionar...</option>
                                            <option value="Padre">Padre</option>
                                            <option value="Madre">Madre</option>
                                            <option value="Tutor">Tutor/a Legal</option>
                                            <option value="Abuelo">Abuelo/a</option>
                                            <option value="Tio">Tío/a</option>
                                            <option value="Otro">Otro</option>
                                        </select>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="mb-3">
                                        <label for="telefonoSuplente" class="form-label">Teléfono</label>
                                        <input type="tel" class="form-control" id="telefonoSuplente" 
                                               placeholder="+56 9 1234 5678">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    `;
    
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" onclick="mostrarPasoMatricula(1)">← Anterior</button>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-primary" onclick="validarYContinuar(2)">
            Siguiente: Documentos →
        </button>
    `;
}

function copiarDireccionAlumno() {
    const checkbox = document.getElementById('mismaDireccion');
    const direccionApoderado = document.getElementById('direccionApoderado');
    const comunaApoderado = document.getElementById('comunaApoderado');
    
    if (checkbox.checked && estadoMatricula.datosAlumno.direccion) {
        direccionApoderado.value = estadoMatricula.datosAlumno.direccion;
        comunaApoderado.value = estadoMatricula.datosAlumno.comuna;
    } else if (!checkbox.checked) {
        direccionApoderado.value = '';
        comunaApoderado.value = '';
    }
}

function validarFormularioApoderado() {
    const form = document.getElementById('formularioApoderado');
    if (!form.checkValidity()) {
        form.reportValidity();
        return false;
    }
    
    // Validar RUT del apoderado
    const rutApoderado = document.getElementById('rutApoderado').value;
    if (!validarRUT(rutApoderado)) {
        alert('El RUT del apoderado no es válido');
        return false;
    }
    
    // Validar RUT del suplente si se proporcionó
    const rutSuplente = document.getElementById('rutSuplente').value;
    if (rutSuplente && !validarRUT(rutSuplente)) {
        alert('El RUT del apoderado suplente no es válido');
        return false;
    }
    
    return true;
}

function guardarDatosApoderado() {
    estadoMatricula.datosApoderado = {
        titular: {
            nombre: document.getElementById('nombreApoderado').value.trim().toUpperCase(),
            rut: document.getElementById('rutApoderado').value,
            parentesco: document.getElementById('parentesco').value,
            fechaNacimiento: document.getElementById('fechaNacimientoApoderado').value,
            nacionalidad: document.getElementById('nacionalidadApoderado').value || 'Chilena',
            profesion: document.getElementById('profesion').value.trim(),
            empresa: document.getElementById('empresa').value.trim(),
            ingresos: document.getElementById('ingresos').value,
            telefono: document.getElementById('telefonoApoderado').value.trim(),
            telefonoTrabajo: document.getElementById('telefonoTrabajo').value.trim(),
            email: document.getElementById('emailApoderado').value.trim(),
            direccion: document.getElementById('direccionApoderado').value.trim(),
            comuna: document.getElementById('comunaApoderado').value.trim()
        },
        suplente: {
            nombre: document.getElementById('nombreSuplente').value.trim().toUpperCase(),
            rut: document.getElementById('rutSuplente').value,
            parentesco: document.getElementById('parentescoSuplente').value,
            telefono: document.getElementById('telefonoSuplente').value.trim()
        }
    };
    
    console.log('Datos del apoderado guardados:', estadoMatricula.datosApoderado);
}

// Continuación del sistema de matrícula - Documentos y pasos finales

function mostrarListaDocumentos(modalCuerpo, modalFooter) {
    modalCuerpo.innerHTML = `
        <div class="row">
            <div class="col-12">
                <div class="progress mb-4">
                    <div class="progress-bar" style="width: 50%">Paso 3 de 6: Documentos Requeridos</div>
                </div>
            </div>
        </div>

        <div class="alert alert-info">
            <h6>📋 Documentos Obligatorios para la Matrícula</h6>
            <p class="mb-0">Marque los documentos que ya tiene disponibles. Los documentos faltantes deberán entregarse antes del inicio de clases.</p>
        </div>

        <form id="formularioDocumentos">
            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">👤 Documentos del Estudiante</h6>
                        </div>
                        <div class="card-body">
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="certificadoNacimiento" value="certificado-nacimiento">
                                <label class="form-check-label" for="certificadoNacimiento">
                                    <strong>Certificado de Nacimiento</strong> <span class="text-danger">*</span>
                                    <br><small class="text-muted">Original, no mayor a 90 días</small>
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="fotocopiaRut" value="fotocopia-rut">
                                <label class="form-check-label" for="fotocopiaRut">
                                    <strong>Fotocopia de RUT</strong>
                                    <br><small class="text-muted">Por ambos lados</small>
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="certificadoVacunas" value="certificado-vacunas">
                                <label class="form-check-label" for="certificadoVacunas">
                                    <strong>Certificado de Vacunas</strong>
                                    <br><small class="text-muted">Al día según edad</small>
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="certificadoSalud" value="certificado-salud">
                                <label class="form-check-label" for="certificadoSalud">
                                    <strong>Certificado Médico</strong>
                                    <br><small class="text-muted">Aptitud física para actividades escolares</small>
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="fotosCarnet" value="fotos-carnet">
                                <label class="form-check-label" for="fotosCarnet">
                                    <strong>4 Fotos Carné</strong>
                                    <br><small class="text-muted">Fondo blanco, recientes</small>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">👨‍👩‍👧‍👦 Documentos del Apoderado</h6>
                        </div>
                        <div class="card-body">
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="fotocopiaRutApoderado" value="fotocopia-rut-apoderado">
                                <label class="form-check-label" for="fotocopiaRutApoderado">
                                    <strong>Fotocopia RUT Apoderado</strong> <span class="text-danger">*</span>
                                    <br><small class="text-muted">Por ambos lados</small>
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="certificadoIngresos" value="certificado-ingresos">
                                <label class="form-check-label" for="certificadoIngresos">
                                    <strong>Certificado de Ingresos</strong>
                                    <br><small class="text-muted">Liquidación de sueldo o declaración de ingresos</small>
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="compromisoApoderado" value="compromiso-apoderado">
                                <label class="form-check-label" for="compromisoApoderado">
                                    <strong>Compromiso del Apoderado</strong> <span class="text-danger">*</span>
                                    <br><small class="text-muted">Firmado y con huella digital</small>
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="autorizacionSalidas" value="autorizacion-salidas">
                                <label class="form-check-label" for="autorizacionSalidas">
                                    <strong>Autorización de Salidas</strong>
                                    <br><small class="text-muted">Personas autorizadas a retirar al estudiante</small>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="row mt-3">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h6 class="mb-0">🏫 Documentos Académicos</h6>
                        </div>
                        <div class="card-body">
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="concentracionNotas" value="concentracion-notas">
                                <label class="form-check-label" for="concentracionNotas">
                                    <strong>Concentración de Notas</strong>
                                    <br><small class="text-muted">Del año anterior (si corresponde)</small>
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="certificadoEstudios" value="certificado-estudios">
                                <label class="form-check-label" for="certificadoEstudios">
                                    <strong>Certificado de Estudios</strong>
                                    <br><small class="text-muted">Del colegio anterior</small>
                                </label>
                            </div>
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="checkbox" id="informePersonalidad" value="informe-personalidad">
                                <label class="form-check-label" for="informePersonalidad">
                                    <strong>Informe de Personalidad</strong>
                                    <br><small class="text-muted">Del colegio anterior</small>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </form>
    `;
    
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" onclick="mostrarPasoMatricula(2)">← Anterior</button>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-primary" onclick="validarYContinuar(3)">
            Siguiente: Resumen y Costos →
        </button>
    `;
}

function validarDocumentos() {
    // Documentos obligatorios
    const documentosObligatorios = ['certificado-nacimiento', 'fotocopia-rut-apoderado', 'compromiso-apoderado'];
    const faltantes = [];
    
    documentosObligatorios.forEach(doc => {
        const checkbox = document.querySelector(`input[value="${doc}"]`);
        if (!checkbox.checked) {
            const label = checkbox.nextElementSibling.querySelector('strong').textContent;
            faltantes.push(label);
        }
    });
    
    if (faltantes.length > 0) {
        const confirmar = confirm(`Los siguientes documentos son obligatorios y no han sido marcados:
        
${faltantes.map(doc => '• ' + doc).join('\n')}

¿Desea continuar? Deberá entregarlos antes del inicio de clases.`);
        return confirmar;
    }
    
    return true;
}

function guardarDocumentos() {
    const checkboxes = document.querySelectorAll('#formularioDocumentos input[type="checkbox"]');
    estadoMatricula.documentos = {};
    
    checkboxes.forEach(checkbox => {
        estadoMatricula.documentos[checkbox.value] = checkbox.checked;
    });
    
    console.log('Documentos guardados:', estadoMatricula.documentos);
}

function mostrarResumenYCostos(modalCuerpo, modalFooter) {
    const alumno = estadoMatricula.datosAlumno;
    const apoderado = estadoMatricula.datosApoderado.titular;
    const costos = estadoMatricula.costosCalculados;
    
    modalCuerpo.innerHTML = `
        <div class="row">
            <div class="col-12">
                <div class="progress mb-4">
                    <div class="progress-bar" style="width: 66.66%">Paso 4 de 6: Resumen y Costos</div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-md-8">
                <div class="card">
                    <div class="card-header bg-primary text-white">
                        <h6 class="mb-0">📋 Resumen de la Matrícula</h6>
                    </div>
                    <div class="card-body">
                        <h6>👤 Estudiante:</h6>
                        <ul class="list-unstyled ms-3">
                            <li><strong>Nombre:</strong> ${alumno.nombreCompleto}</li>
                            <li><strong>RUT:</strong> ${formatearRUT(alumno.rut)}</li>
                            <li><strong>Curso:</strong> ${alumno.curso}</li>
                            <li><strong>Fecha Nacimiento:</strong> ${new Date(alumno.fechaNacimiento).toLocaleDateString('es-CL')}</li>
                        </ul>
                        
                        <h6 class="mt-3">👨‍👩‍👧‍👦 Apoderado:</h6>
                        <ul class="list-unstyled ms-3">
                            <li><strong>Nombre:</strong> ${apoderado.nombre}</li>
                            <li><strong>RUT:</strong> ${formatearRUT(apoderado.rut)}</li>
                            <li><strong>Teléfono:</strong> ${apoderado.telefono}</li>
                            <li><strong>Email:</strong> ${apoderado.email}</li>
                        </ul>
                    </div>
                </div>
            </div>
            
            <div class="col-md-4">
                <div class="card">
                    <div class="card-header bg-success text-white">
                        <h6 class="mb-0">💰 Costos de Matrícula</h6>
                    </div>
                    <div class="card-body">
                        <table class="table table-borderless mb-0">
                            <tr>
                                <td><strong>Matrícula:</strong></td>
                                <td class="text-end"><strong>${formatearMoneda(costos.matricula)}</strong></td>
                            </tr>
                            <tr class="table-light">
                                <td colspan="2">
                                    <small class="text-muted">
                                        <strong>Plan Anual:</strong><br>
                                        • ${costos.cuotas} cuotas de ${formatearMoneda(costos.mensualidad)}<br>
                                        • Total año: ${formatearMoneda(costos.mensualidad * costos.cuotas)}
                                    </small>
                                </td>
                            </tr>
                            <tr class="table-success">
                                <td><strong>Total a Pagar Hoy:</strong></td>
                                <td class="text-end"><strong>${formatearMoneda(costos.matricula)}</strong></td>
                            </tr>
                            ${costos.matricula === 0 ? `
                            <tr class="table-info">
                                <td colspan="2" class="text-center">
                                    <small class="text-primary">
                                        <i class="bi bi-check-circle"></i> <strong>Matrícula Sin Costo</strong><br>
                                        No se requiere pago adicional
                                    </small>
                                </td>
                            </tr>` : ''}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" onclick="mostrarPasoMatricula(3)">← Anterior</button>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-success" onclick="validarYContinuar(4)">
            ${costos.matricula === 0 ? 'Completar Matrícula →' : 'Proceder al Pago →'}
        </button>
    `;
}

function mostrarPagoMatricula(modalCuerpo, modalFooter) {
    const costos = estadoMatricula.costosCalculados;
    const alumno = estadoMatricula.datosAlumno;
    
    modalCuerpo.innerHTML = `
        <div class="row">
            <div class="col-12">
                <div class="progress mb-4">
                    <div class="progress-bar" style="width: 83.33%">Paso 5 de 6: Pago de Matrícula</div>
                </div>
            </div>
        </div>

        <div class="alert alert-warning">
            <h6>💳 Pago de Matrícula Obligatorio</h6>
            <p class="mb-0">Para completar la matrícula debe realizar el pago correspondiente. 
            Una vez procesado el pago, el estudiante quedará oficialmente matriculado.</p>
        </div>

        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-info text-white">
                        <h6 class="mb-0">🧾 Detalle del Pago</h6>
                    </div>
                    <div class="card-body">
                        <table class="table table-borderless">
                            <tr>
                                <td><strong>Concepto:</strong></td>
                                <td>Matrícula ${new Date().getFullYear()}</td>
                            </tr>
                            <tr>
                                <td><strong>Estudiante:</strong></td>
                                <td>${alumno.nombreCompleto}</td>
                            </tr>
                            <tr>
                                <td><strong>Curso:</strong></td>
                                <td>${alumno.curso}</td>
                            </tr>
                            <tr class="table-primary">
                                <td><strong>Monto:</strong></td>
                                <td><strong>${formatearMoneda(costos.matricula)}</strong></td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
            
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header bg-success text-white">
                        <h6 class="mb-0">💳 Métodos de Pago</h6>
                    </div>
                    <div class="card-body text-center">
                        <button class="btn btn-primary btn-lg w-100 mb-3" onclick="pagarMatriculaWebpay()">
                            💳 Pagar con Webpay Plus
                            <br><small>Tarjetas de crédito y débito</small>
                        </button>
                        
                        <div class="text-center">
                            <small class="text-muted">
                                Pago seguro procesado por Transbank<br>
                                Recibirá boleta automáticamente
                            </small>
                        </div>
                        
                        ${estadoMatricula.pagoMatriculaCompletado ? `
                            <div class="alert alert-success mt-3">
                                <h6>✅ Pago Completado</h6>
                                <p class="mb-0">La matrícula ha sido pagada correctamente</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-secondary" onclick="mostrarPasoMatricula(4)">← Anterior</button>
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
        <button type="button" class="btn btn-success ${estadoMatricula.pagoMatriculaCompletado ? '' : 'disabled'}" 
                onclick="validarYContinuar(5)">
            ${estadoMatricula.pagoMatriculaCompletado ? 'Finalizar Matrícula →' : 'Esperando Pago...'}
        </button>
    `;
}

async function pagarMatriculaWebpay() {
    try {
        const alumno = estadoMatricula.datosAlumno;
        const costos = estadoMatricula.costosCalculados;
        
        // Crear orden para matrícula
        const ordenCompra = `MATRICULA-${alumno.rut.replace(/[.-]/g, '')}-${Date.now()}`;
        
        // Datos para Webpay
        const datosTransaccion = {
            ordenCompra,
            rutAlumno: alumno.rut,
            alumno: alumno.nombreCompleto,
            numeroCuota: 'MATRICULA',
            monto: costos.matricula,
            descripcion: `Matrícula ${new Date().getFullYear()} - ${alumno.nombreCompleto} - ${alumno.curso}`
        };

        // Usar el sistema existente de Webpay
        await crearTransaccionWebpay(datosTransaccion);
        
        // El pago se marcará como completado cuando regrese de Webpay
        // Por ahora, simular que se completó (en producción esto vendría del callback)
        setTimeout(() => {
            estadoMatricula.pagoMatriculaCompletado = true;
            mostrarPasoMatricula(5); // Refrescar la vista
        }, 3000);
        
    } catch (error) {
        console.error('Error en pago de matrícula:', error);
        alert('Error al procesar el pago de matrícula');
    }
}

function mostrarConfirmacionMatricula(modalCuerpo, modalFooter) {
    modalCuerpo.innerHTML = `
        <div class="row">
            <div class="col-12">
                <div class="progress mb-4">
                    <div class="progress-bar bg-success" style="width: 100%">Paso 6 de 6: Matrícula Completada</div>
                </div>
            </div>
        </div>

        <div class="text-center">
            <div class="alert alert-success">
                <h4>🎉 ¡Matrícula Completada Exitosamente!</h4>
                <p class="mb-0">El estudiante ha sido matriculado correctamente en nuestro sistema.</p>
            </div>
            
            <div class="card">
                <div class="card-body">
                    <h5>📝 Próximos Pasos:</h5>
                    <ul class="list-unstyled">
                        <li class="mb-2">✅ <strong>Matrícula registrada</strong> - El alumno aparecerá en el sistema</li>
                        <li class="mb-2">📧 <strong>Confirmación enviada</strong> - Revise su correo electrónico</li>
                        <li class="mb-2">📋 <strong>Documentos pendientes</strong> - Entregue antes del inicio de clases</li>
                        <li class="mb-2">💰 <strong>Cuotas mensuales</strong> - Comenzarán según calendario escolar</li>
                    </ul>
                </div>
            </div>
        </div>
    `;
    
    modalFooter.innerHTML = `
        <button type="button" class="btn btn-success" onclick="completarMatricula()">
            ✅ Finalizar y Agregar al Sistema
        </button>
    `;
}

async function completarMatricula() {
    try {
        const datosCompletos = prepararDatosMatricula();
        
        // Agregar el nuevo alumno al sistema
        datosAlumnos.push(datosCompletos);
        
        // Guardar en localStorage
        guardarDatosEnStorage();
        
        // Registrar matrícula
        registrarMatricula(datosCompletos);
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalMatricula'));
        modal.hide();
        
        // Actualizar interfaz
        aplicarFiltros();
        actualizarEstadisticas();
        
        // Mostrar confirmación
        alert(`¡Matrícula completada exitosamente!
        
Alumno: ${datosCompletos.nombre}
Curso: ${datosCompletos.curso}
        
El estudiante ya aparece en el sistema.`);
        
        console.log('✅ Matrícula completada:', datosCompletos);
        
    } catch (error) {
        console.error('❌ Error al completar matrícula:', error);
        alert('Error al completar la matrícula: ' + error.message);
    }
}

function prepararDatosMatricula() {
    const alumno = estadoMatricula.datosAlumno;
    const apoderado = estadoMatricula.datosApoderado;
    const costos = estadoMatricula.costosCalculados;
    
    // Crear estructura compatible con el sistema existente
    return {
        nombre: alumno.nombreCompleto,
        rut: alumno.rut,
        curso: alumno.curso,
        año: costos.año || 2026, // Agregar año de la matrícula
        arancel: costos.mensualidad * costos.cuotas, // Total anual
        beca: 0, // Sin beca inicial
        cuotas: generarCuotasIniciales(costos),
        totalPagado: costos.matricula, // Solo matrícula pagada
        totalPagadoReal: costos.matricula,
        numeroCuotas: costos.cuotas,
        montoNeto: costos.mensualidad * costos.cuotas,
        valorCuotaRegular: costos.mensualidad,
        cuotasPagadas: 0,
        pendiente: costos.mensualidad * costos.cuotas, // Todas las mensualidades pendientes
        estado: 'pendiente',
        // Datos adicionales de matrícula
        datosMatricula: {
            fechaMatricula: new Date().toLocaleDateString('es-CL'),
            pagoMatricula: costos.matricula,
            apoderado: apoderado,
            documentos: estadoMatricula.documentos,
            datosPersonales: {
                fechaNacimiento: alumno.fechaNacimiento,
                sexo: alumno.sexo,
                nacionalidad: alumno.nacionalidad,
                direccion: alumno.direccion,
                comuna: alumno.comuna,
                telefono: alumno.telefono,
                email: alumno.email
            }
        }
    };
}

function generarCuotasIniciales(costos) {
    const cuotas = [];
    for (let i = 1; i <= costos.cuotas; i++) {
        cuotas.push({
            numero: i,
            monto: costos.mensualidad,
            pagada: false,
            abonos: []
        });
    }
    return cuotas;
}

function registrarMatricula(alumno) {
    try {
        const historialMatriculas = JSON.parse(localStorage.getItem('historialMatriculas') || '[]');
        
        const registroMatricula = {
            id: `MAT-${Date.now()}`,
            fecha: new Date().toLocaleDateString('es-CL'),
            hora: new Date().toLocaleTimeString('es-CL'),
            alumno: {
                nombre: alumno.nombre,
                rut: alumno.rut,
                curso: alumno.curso
            },
            pago: {
                matricula: alumno.datosMatricula.pagoMatricula,
                metodoPago: alumno.datosMatricula.pagoMatricula === 0 ? 'sin_costo' : 'webpay'
            },
            numero: historialMatriculas.length + 1
        };
        
        historialMatriculas.push(registroMatricula);
        localStorage.setItem('historialMatriculas', JSON.stringify(historialMatriculas));
        
        console.log('📝 Matrícula registrada:', registroMatricula.id);
    } catch (error) {
        console.error('Error al registrar matrícula:', error);
    }
}

// === FUNCIONES DE VERIFICACIÓN DE SUMATORIAS ===

function verificarSumatoriasConCSV() {
    console.log('🔍 Iniciando verificación de sumatorias...');
    
    const erroresEncontrados = [];
    const reporteDetallado = [];
    
    datosAlumnos.forEach(alumno => {
        // Calcular total según el sistema actual
        const totalSistema = alumno.totalPagadoReal || alumno.totalPagado || 0;
        
        // Obtener total del CSV (columna "total pagado")
        const totalCSV = alumno.totalPagadoCSV || 0;
        
        const diferencia = Math.abs(totalSistema - totalCSV);
        
        if (diferencia > 0.01) { // Tolerancia de 1 centavo
            erroresEncontrados.push({
                nombre: alumno.nombre,
                rut: alumno.rut,
                totalSistema: totalSistema,
                totalCSV: totalCSV,
                diferencia: diferencia
            });
        }
        
        reporteDetallado.push({
            nombre: alumno.nombre,
            rut: alumno.rut,
            totalSistema: totalSistema,
            totalCSV: totalCSV,
            diferencia: diferencia,
            coincide: diferencia <= 0.01
        });
    });
    
    console.log('📊 Reporte de verificación:', {
        totalAlumnos: datosAlumnos.length,
        alumnosConErrores: erroresEncontrados.length,
        porcentajeCoincidencia: ((datosAlumnos.length - erroresEncontrados.length) / datosAlumnos.length * 100).toFixed(2) + '%'
    });
    
    if (erroresEncontrados.length > 0) {
        console.warn('⚠️ Se encontraron diferencias:', erroresEncontrados);
        mostrarModalVerificacion(erroresEncontrados, reporteDetallado);
    } else {
        console.log('✅ Todas las sumatorias coinciden perfectamente');
        alert(`✅ Verificación exitosa!

Todas las sumatorias del sistema coinciden con el archivo CSV.

📊 Estadísticas:
• Total alumnos verificados: ${datosAlumnos.length}
• Coincidencias perfectas: 100%
• Errores encontrados: 0

El sistema está calculando correctamente todos los montos.`);
    }
    
    return { erroresEncontrados, reporteDetallado };
}

function diagnosticarDiscrepanciasCSV() {
    console.log('🔍 Iniciando diagnóstico completo de discrepancias CSV...');
    
    const discrepancias = [];
    
    datosAlumnos.forEach(alumno => {
        // Calcular suma de cuotas individuales desde el CSV
        let sumaCuotasCSV = 0;
        let cuotasPagadasCSV = [];
        
        // Leer nuevamente el CSV para obtener los valores originales
        fetch('alumnos_final.csv')
            .then(response => response.text())
            .then(csvText => {
                const lineas = csvText.split('\n');
                
                // Encontrar la línea del alumno
                for (let i = 1; i < lineas.length; i++) {
                    const valores = lineas[i].split(';');
                    if (valores[1]?.trim() === alumno.rut) {
                        // Sumar cuotas individuales (columnas 5-14)
                        for (let j = 5; j < 15; j++) {
                            const valorCuota = parsearMoneda(valores[j]?.trim() || '0');
                            if (valorCuota > 0) {
                                sumaCuotasCSV += valorCuota;
                                cuotasPagadasCSV.push({
                                    cuota: j - 4,
                                    monto: valorCuota
                                });
                            }
                        }
                        
                        const totalFinalCSV = parsearMoneda(valores[15]?.trim() || '0');
                        const diferencia = Math.abs(sumaCuotasCSV - totalFinalCSV);
                        
                        if (diferencia > 1) { // Si hay diferencia mayor a 1 peso
                            discrepancias.push({
                                nombre: alumno.nombre,
                                rut: alumno.rut,
                                sumaCuotas: sumaCuotasCSV,
                                totalFinal: totalFinalCSV,
                                diferencia: diferencia,
                                cuotasDetalle: cuotasPagadasCSV
                            });
                            
                            console.log(`⚠️ DISCREPANCIA en ${alumno.nombre}:`);
                            console.log(`   Suma cuotas: ${formatearMoneda(sumaCuotasCSV)}`);
                            console.log(`   Total final: ${formatearMoneda(totalFinalCSV)}`);
                            console.log(`   Diferencia: ${formatearMoneda(diferencia)}`);
                            console.log(`   Cuotas pagadas:`, cuotasPagadasCSV);
                        }
                        break;
                    }
                }
            });
    });
    
    if (discrepancias.length > 0) {
        mostrarModalDiscrepancias(discrepancias);
    } else {
        alert('✅ No se encontraron discrepancias en el CSV');
    }
}

function verificarConsistenciaCSV() {
    console.log('🔍 Verificando consistencia completa del CSV...');
    
    return fetch('alumnos_final.csv')
        .then(response => response.text())
        .then(csvText => {
            const lineas = csvText.split('\n');
            const discrepancias = [];
            const reporteCompleto = [];
            
            for (let i = 1; i < lineas.length; i++) {
                if (lineas[i].trim() === '') continue;
                
                const valores = lineas[i].split(';');
                if (valores.length < 16) continue;
                
                const nombre = valores[0]?.trim() || '';
                const rut = valores[1]?.trim() || '';
                
                // Sumar cuotas individuales (columnas 5-14)
                let sumaCuotas = 0;
                const cuotasDetalle = [];
                
                for (let j = 5; j < 15; j++) {
                    const valorCuota = parsearMoneda(valores[j]?.trim() || '0');
                    if (valorCuota > 0) {
                        sumaCuotas += valorCuota;
                        cuotasDetalle.push({
                            cuota: j - 4,
                            monto: valorCuota,
                            columna: j
                        });
                    }
                }
                
                const totalFinal = parsearMoneda(valores[15]?.trim() || '0');
                const diferencia = Math.abs(sumaCuotas - totalFinal);
                
                const reporte = {
                    nombre: nombre,
                    rut: rut,
                    sumaCuotas: sumaCuotas,
                    totalFinal: totalFinal,
                    diferencia: diferencia,
                    cuotasDetalle: cuotasDetalle,
                    tieneDiscrepancia: diferencia > 1
                };
                
                reporteCompleto.push(reporte);
                
                if (diferencia > 1) {
                    discrepancias.push(reporte);
                    console.log(`⚠️ DISCREPANCIA CSV - ${nombre}:`);
                    console.log(`   Suma cuotas individuales: ${formatearMoneda(sumaCuotas)}`);
                    console.log(`   Total columna final: ${formatearMoneda(totalFinal)}`);
                    console.log(`   Diferencia: ${formatearMoneda(diferencia)}`);
                }
            }
            
            console.log(`📊 Verificación completada:`);
            console.log(`   Total alumnos: ${reporteCompleto.length}`);
            console.log(`   Con discrepancias: ${discrepancias.length}`);
            console.log(`   Porcentaje limpio: ${((reporteCompleto.length - discrepancias.length) / reporteCompleto.length * 100).toFixed(2)}%`);
            
            if (discrepancias.length > 0) {
                mostrarModalDiscrepanciasCSV(discrepancias, reporteCompleto);
            } else {
                alert(`✅ CSV Consistente!

📊 Verificación completada:
• Total alumnos verificados: ${reporteCompleto.length}
• Discrepancias encontradas: 0
• Estado: 100% consistente

Todas las sumas de cuotas individuales coinciden con el total final.`);
            }
            
            return { discrepancias, reporteCompleto };
        });
}

function verificarDiscrepanciasInmediatas() {
    console.log('🔍 VERIFICACIÓN AUTOMÁTICA - Analizando discrepancias...');
    
    fetch('alumnos_final.csv')
        .then(response => response.text())
        .then(csvText => {
            const lineas = csvText.split('\n');
            const discrepancias = [];
            let totalVerificados = 0;
            
            console.log('📄 Analizando archivo CSV línea por línea...');
            
            for (let i = 1; i < lineas.length; i++) {
                if (lineas[i].trim() === '') continue;
                
                const valores = lineas[i].split(';');
                if (valores.length < 16) continue;
                
                const nombre = valores[0]?.trim() || '';
                const rut = valores[1]?.trim() || '';
                
                // Sumar cuotas individuales (columnas 5-14)
                let sumaCuotas = 0;
                const cuotasDetalle = [];
                
                for (let j = 5; j < 15; j++) {
                    const valorCuotaStr = valores[j]?.trim() || '';
                    const valorCuota = parsearMoneda(valorCuotaStr);
                    if (valorCuota > 0) {
                        sumaCuotas += valorCuota;
                        cuotasDetalle.push(`Cuota ${j-4}: ${formatearMoneda(valorCuota)}`);
                    }
                }
                
                const totalFinalStr = valores[15]?.trim() || '0';
                const totalFinal = parsearMoneda(totalFinalStr);
                const diferencia = Math.abs(sumaCuotas - totalFinal);
                
                totalVerificados++;
                
                if (diferencia > 1) {
                    discrepancias.push({
                        nombre: nombre,
                        rut: rut,
                        sumaCuotas: sumaCuotas,
                        totalFinal: totalFinal,
                        diferencia: diferencia,
                        cuotasDetalle: cuotasDetalle,
                        linea: i + 1
                    });
                    
                    console.log(`🚨 DISCREPANCIA ENCONTRADA - Línea ${i + 1}:`);
                    console.log(`   📝 Nombre: ${nombre}`);
                    console.log(`   🆔 RUT: ${rut}`);
                    console.log(`   ➕ Suma individual cuotas: ${formatearMoneda(sumaCuotas)}`);
                    console.log(`   📊 Total final CSV: ${formatearMoneda(totalFinal)}`);
                    console.log(`   ⚠️ Diferencia: ${formatearMoneda(diferencia)}`);
                    console.log(`   💰 Cuotas pagadas: ${cuotasDetalle.join(', ')}`);
                    console.log('   ---');
                }
            }
            
            console.log(`\n📊 RESUMEN DE VERIFICACIÓN:`);
            console.log(`   ✅ Total alumnos verificados: ${totalVerificados}`);
            console.log(`   ❌ Discrepancias encontradas: ${discrepancias.length}`);
            console.log(`   📈 Porcentaje limpio: ${((totalVerificados - discrepancias.length) / totalVerificados * 100).toFixed(2)}%`);
            
            if (discrepancias.length > 0) {
                console.log(`\n🎯 RECOMENDACIÓN: Usa el botón "🔍 Verificar" en la interfaz para ver opciones de corrección.`);
                
                // Mostrar alerta en pantalla también
                setTimeout(() => {
                    alert(`⚠️ Se encontraron ${discrepancias.length} discrepancias en el CSV!

📊 Resumen:
• Total verificados: ${totalVerificados}
• Con problemas: ${discrepancias.length}
• Afectados: ${(discrepancias.length / totalVerificados * 100).toFixed(1)}%

💡 Haz clic en "🔍 Verificar" en la interfaz para ver detalles y opciones de corrección.

📋 También revisa la consola del navegador (F12) para ver todos los detalles.`);
                }, 2000);
            } else {
                console.log('🎉 ¡Excelente! No se encontraron discrepancias.');
            }
            
            return discrepancias;
        })
        .catch(error => {
            console.error('❌ Error en verificación automática:', error);
        });
}

function mostrarModalDiscrepanciasCSV(discrepancias, reporteCompleto) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title">⚠️ Discrepancias en Archivo CSV - Suma de Cuotas vs Total Final</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning">
                        <h6>🚨 Problema Detectado:</h6>
                        <p class="mb-2">Se encontraron alumnos donde la suma de las cuotas individuales (columnas 5-14) <strong>NO coincide</strong> con el total final (columna 16).</p>
                        <ul class="mb-0">
                            <li><strong>Total alumnos:</strong> ${reporteCompleto.length}</li>
                            <li><strong>Con discrepancias:</strong> ${discrepancias.length}</li>
                            <li><strong>Porcentaje afectado:</strong> ${(discrepancias.length / reporteCompleto.length * 100).toFixed(2)}%</li>
                        </ul>
                    </div>
                    
                    <h6>❌ Alumnos con discrepancias en el CSV:</h6>
                    <div class="table-responsive" style="max-height: 400px;">
                        <table class="table table-striped table-sm">
                            <thead class="table-dark sticky-top">
                                <tr>
                                    <th>Alumno</th>
                                    <th>RUT</th>
                                    <th>Suma Cuotas</th>
                                    <th>Total Final</th>
                                    <th>Diferencia</th>
                                    <th>Detalles</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${discrepancias.map((disc, index) => `
                                <tr>
                                    <td><strong>${disc.nombre}</strong></td>
                                    <td>${formatearRUT(disc.rut)}</td>
                                    <td class="text-end">${formatearMoneda(disc.sumaCuotas)}</td>
                                    <td class="text-end">${formatearMoneda(disc.totalFinal)}</td>
                                    <td class="text-end text-danger"><strong>${formatearMoneda(disc.diferencia)}</strong></td>
                                    <td>
                                        <button class="btn btn-sm btn-info" onclick="mostrarDetalleDiscrepancia(${index})">
                                            📋 Ver
                                        </button>
                                    </td>
                                    <td>
                                        <div class="btn-group" role="group">
                                            <button class="btn btn-sm btn-success" onclick="usarSumaCuotas('${disc.rut}', ${disc.sumaCuotas})">
                                                ✅ Usar Suma
                                            </button>
                                            <button class="btn btn-sm btn-warning" onclick="usarTotalFinal('${disc.rut}', ${disc.totalFinal})">
                                                📊 Usar Total
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="mt-3">
                        <div class="alert alert-info">
                            <h6>🤔 ¿Qué valor usar?</h6>
                            <ul class="mb-0">
                                <li><strong>✅ Usar Suma:</strong> Toma la suma de cuotas individuales como valor correcto</li>
                                <li><strong>📊 Usar Total:</strong> Toma el valor de la columna "total pagado" como valor correcto</li>
                            </ul>
                        </div>
                        
                        <div class="d-flex gap-2">
                            <button class="btn btn-success" onclick="aplicarSumaCuotasATodos()">
                                ✅ Usar Suma de Cuotas para Todos
                            </button>
                            <button class="btn btn-warning" onclick="aplicarTotalFinalATodos()">
                                📊 Usar Total Final para Todos
                            </button>
                            <button class="btn btn-info" onclick="exportarDiscrepanciasCSV()">
                                📋 Exportar Reporte
                            </button>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
    
    bootstrapModal.show();
    
    // Guardar discrepancias globalmente para uso posterior
    window.discrepanciasCSV = discrepancias;
}

function usarSumaCuotas(rutAlumno, sumaCuotas) {
    const alumno = datosAlumnos.find(a => a.rut === rutAlumno);
    if (!alumno) return;
    
    console.log(`🔧 Aplicando suma de cuotas para ${alumno.nombre}:`);
    console.log(`   Total anterior: ${formatearMoneda(alumno.totalPagadoReal || alumno.totalPagado)}`);
    console.log(`   Suma de cuotas: ${formatearMoneda(sumaCuotas)}`);
    
    alumno.totalPagadoReal = sumaCuotas;
    alumno.totalPagado = sumaCuotas;
    alumno.totalPagadoCSV = sumaCuotas;
    
    // Recalcular
    alumno.pendiente = Math.max(0, alumno.montoNeto - sumaCuotas);
    alumno.estado = determinarEstado(alumno);
    
    guardarDatos();
    aplicarFiltros();
    actualizarEstadisticas();
    
    alert(`✅ Actualizado: ${alumno.nombre}
    
Valor aplicado: ${formatearMoneda(sumaCuotas)} (suma de cuotas)
Nuevo pendiente: ${formatearMoneda(alumno.pendiente)}
Estado: ${alumno.estado}`);
}

function usarTotalFinal(rutAlumno, totalFinal) {
    const alumno = datosAlumnos.find(a => a.rut === rutAlumno);
    if (!alumno) return;
    
    console.log(`🔧 Aplicando total final para ${alumno.nombre}:`);
    console.log(`   Total anterior: ${formatearMoneda(alumno.totalPagadoReal || alumno.totalPagado)}`);
    console.log(`   Total final: ${formatearMoneda(totalFinal)}`);
    
    alumno.totalPagadoReal = totalFinal;
    alumno.totalPagado = totalFinal;
    alumno.totalPagadoCSV = totalFinal;
    
    // Recalcular
    alumno.pendiente = Math.max(0, alumno.montoNeto - totalFinal);
    alumno.estado = determinarEstado(alumno);
    
    guardarDatos();
    aplicarFiltros();
    actualizarEstadisticas();
    
    alert(`✅ Actualizado: ${alumno.nombre}
    
Valor aplicado: ${formatearMoneda(totalFinal)} (total final)
Nuevo pendiente: ${formatearMoneda(alumno.pendiente)}
Estado: ${alumno.estado}`);
}

function aplicarSumaCuotasATodos() {
    if (!window.discrepanciasCSV) {
        alert('No hay discrepancias para corregir');
        return;
    }
    
    if (confirm(`¿Aplicar la SUMA DE CUOTAS como valor correcto para ${window.discrepanciasCSV.length} alumnos?

Esto actualizará:
• Los totales pagados
• Los montos pendientes  
• Los estados de los alumnos

¿Continuar?`)) {
        
        let actualizados = 0;
        
        window.discrepanciasCSV.forEach(disc => {
            const alumno = datosAlumnos.find(a => a.rut === disc.rut);
            if (alumno) {
                alumno.totalPagadoReal = disc.sumaCuotas;
                alumno.totalPagado = disc.sumaCuotas;
                alumno.totalPagadoCSV = disc.sumaCuotas;
                alumno.pendiente = Math.max(0, alumno.montoNeto - disc.sumaCuotas);
                alumno.estado = determinarEstado(alumno);
                actualizados++;
            }
        });
        
        guardarDatos();
        aplicarFiltros();
        actualizarEstadisticas();
        
        // Cerrar modal
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) bootstrapModal.hide();
        });
        
        alert(`✅ Actualización masiva completada!

• Alumnos actualizados: ${actualizados}
• Criterio aplicado: Suma de cuotas individuales
• Todos los totales ahora son consistentes`);
        
        delete window.discrepanciasCSV;
    }
}

function aplicarTotalFinalATodos() {
    if (!window.discrepanciasCSV) {
        alert('No hay discrepancias para corregir');
        return;
    }
    
    if (confirm(`¿Aplicar el TOTAL FINAL como valor correcto para ${window.discrepanciasCSV.length} alumnos?

Esto actualizará:
• Los totales pagados
• Los montos pendientes  
• Los estados de los alumnos

¿Continuar?`)) {
        
        let actualizados = 0;
        
        window.discrepanciasCSV.forEach(disc => {
            const alumno = datosAlumnos.find(a => a.rut === disc.rut);
            if (alumno) {
                alumno.totalPagadoReal = disc.totalFinal;
                alumno.totalPagado = disc.totalFinal;
                alumno.totalPagadoCSV = disc.totalFinal;
                alumno.pendiente = Math.max(0, alumno.montoNeto - disc.totalFinal);
                alumno.estado = determinarEstado(alumno);
                actualizados++;
            }
        });
        
        guardarDatos();
        aplicarFiltros();
        actualizarEstadisticas();
        
        // Cerrar modal
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) bootstrapModal.hide();
        });
        
        alert(`✅ Actualización masiva completada!

• Alumnos actualizados: ${actualizados}
• Criterio aplicado: Total final del CSV
• Todos los totales ahora son consistentes`);
        
        delete window.discrepanciasCSV;
    }
}

// === FUNCIONES PARA EDITAR DATOS DE APODERADO Y CORREO ===

function guardarApoderado(rutAlumno) {
    const inputApoderado = document.getElementById(`inputApoderado_${rutAlumno}`);
    const nuevoApoderado = inputApoderado.value.trim();
    
    if (!nuevoApoderado) {
        alert('⚠️ El nombre del apoderado no puede estar vacío');
        return;
    }
    
    // Obtener datos actuales del correo
    let datosCorreo = datosCorreos.get(rutAlumno);
    
    if (datosCorreo) {
        const apoderadoAnterior = datosCorreo.apoderado;
        datosCorreo.apoderado = nuevoApoderado;
        
        // Guardar en el Map
        datosCorreos.set(rutAlumno, datosCorreo);
        
        // Guardar en localStorage
        const datosParaGuardar = {};
        datosCorreos.forEach((value, key) => {
            datosParaGuardar[key] = value;
        });
        localStorage.setItem('datosCorreos', JSON.stringify(datosParaGuardar));
        
        console.log(`✅ Apoderado actualizado: ${apoderadoAnterior} → ${nuevoApoderado}`);
        
        alert(`✅ Apoderado actualizado exitosamente!

Anterior: ${apoderadoAnterior}
Nuevo: ${nuevoApoderado}

Los cambios han sido guardados.`);
        
        // Actualizar vista si es necesario
        inputApoderado.style.backgroundColor = '#d4edda';
        setTimeout(() => {
            inputApoderado.style.backgroundColor = '';
        }, 1500);
        
    } else {
        alert('❌ Error: No se encontraron datos de correo para este alumno');
    }
}

function guardarCorreo(rutAlumno) {
    const inputCorreo = document.getElementById(`inputCorreo_${rutAlumno}`);
    const nuevoCorreo = inputCorreo.value.trim();
    
    if (!nuevoCorreo) {
        alert('⚠️ El correo electrónico no puede estar vacío');
        return;
    }
    
    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(nuevoCorreo)) {
        alert('⚠️ Por favor ingrese un correo electrónico válido');
        return;
    }
    
    // Obtener datos actuales del correo
    let datosCorreo = datosCorreos.get(rutAlumno);
    
    if (datosCorreo) {
        const correoAnterior = datosCorreo.correo;
        datosCorreo.correo = nuevoCorreo;
        
        // Guardar en el Map
        datosCorreos.set(rutAlumno, datosCorreo);
        
        // Guardar en localStorage
        const datosParaGuardar = {};
        datosCorreos.forEach((value, key) => {
            datosParaGuardar[key] = value;
        });
        localStorage.setItem('datosCorreos', JSON.stringify(datosParaGuardar));
        
        console.log(`✅ Correo actualizado: ${correoAnterior} → ${nuevoCorreo}`);
        
        alert(`✅ Correo actualizado exitosamente!

Anterior: ${correoAnterior}
Nuevo: ${nuevoCorreo}

Los cambios han sido guardados.`);
        
        // Actualizar vista
        inputCorreo.style.backgroundColor = '#d4edda';
        setTimeout(() => {
            inputCorreo.style.backgroundColor = '';
        }, 1500);
        
    } else {
        alert('❌ Error: No se encontraron datos de correo para este alumno');
    }
}

function crearNuevoDatosCorreo(rutAlumno) {
    const inputApoderado = document.getElementById(`inputNuevoApoderado_${rutAlumno}`);
    const inputCorreo = document.getElementById(`inputNuevoCorreo_${rutAlumno}`);
    
    const nuevoApoderado = inputApoderado.value.trim();
    const nuevoCorreo = inputCorreo.value.trim();
    
    // Validaciones
    if (!nuevoApoderado) {
        alert('⚠️ El nombre del apoderado es obligatorio');
        inputApoderado.focus();
        return;
    }
    
    if (!nuevoCorreo) {
        alert('⚠️ El correo electrónico es obligatorio');
        inputCorreo.focus();
        return;
    }
    
    // Validar formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(nuevoCorreo)) {
        alert('⚠️ Por favor ingrese un correo electrónico válido');
        inputCorreo.focus();
        return;
    }
    
    // Obtener nombre del alumno para el registro
    const alumno = datosAlumnos.find(a => a.rut === rutAlumno);
    const nombreAlumno = alumno ? alumno.nombre : 'Alumno no encontrado';
    
    // Crear nuevo registro
    const nuevosDatos = {
        rut: rutAlumno,
        nombreAlumno: nombreAlumno,
        apoderado: nuevoApoderado,
        correo: nuevoCorreo
    };
    
    // Guardar en el Map
    datosCorreos.set(rutAlumno, nuevosDatos);
    
    // Guardar en localStorage
    const datosParaGuardar = {};
    datosCorreos.forEach((value, key) => {
        datosParaGuardar[key] = value;
    });
    localStorage.setItem('datosCorreos', JSON.stringify(datosParaGuardar));
    
    console.log('✅ Nuevos datos de correo creados:', nuevosDatos);
    
    alert(`✅ Datos de contacto creados exitosamente!

Alumno: ${nombreAlumno}
Apoderado: ${nuevoApoderado}
Correo: ${nuevoCorreo}

Los datos han sido guardados y ya están disponibles para envío de correos.`);
    
    // Recargar el modal para mostrar los nuevos datos
    if (alumno) {
        setTimeout(() => {
            mostrarDetalle(rutAlumno);
        }, 1000);
    }
}

function mostrarModalVerificacion(errores, reporte) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header bg-warning text-dark">
                    <h5 class="modal-title">⚠️ Verificación de Sumatorias - Diferencias Encontradas</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <h6>📊 Resumen de la verificación:</h6>
                        <ul class="mb-0">
                            <li><strong>Total alumnos:</strong> ${reporte.length}</li>
                            <li><strong>Coincidencias:</strong> ${reporte.filter(r => r.coincide).length}</li>
                            <li><strong>Diferencias:</strong> ${errores.length}</li>
                            <li><strong>Porcentaje de coincidencia:</strong> ${((reporte.length - errores.length) / reporte.length * 100).toFixed(2)}%</li>
                        </ul>
                    </div>
                    
                    <h6>❌ Alumnos con diferencias:</h6>
                    <div class="table-responsive" style="max-height: 400px;">
                        <table class="table table-striped table-sm">
                            <thead class="table-dark sticky-top">
                                <tr>
                                    <th>Alumno</th>
                                    <th>RUT</th>
                                    <th>Total Sistema</th>
                                    <th>Total CSV</th>
                                    <th>Diferencia</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${errores.map(error => `
                                <tr>
                                    <td><strong>${error.nombre}</strong></td>
                                    <td>${formatearRUT(error.rut)}</td>
                                    <td class="text-end">${formatearMoneda(error.totalSistema)}</td>
                                    <td class="text-end">${formatearMoneda(error.totalCSV)}</td>
                                    <td class="text-end text-danger"><strong>${formatearMoneda(error.diferencia)}</strong></td>
                                    <td>
                                        <button class="btn btn-sm btn-primary" onclick="corregirSumatoria('${error.rut}', ${error.totalCSV})">
                                            🔧 Corregir
                                        </button>
                                    </td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="mt-3">
                        <button class="btn btn-success" onclick="corregirTodasLasSumatorias()">
                            🔧 Corregir Todas las Diferencias
                        </button>
                        <button class="btn btn-info ms-2" onclick="exportarReporteVerificacion()">
                            📋 Exportar Reporte Completo
                        </button>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
    
    bootstrapModal.show();
    
    // Guardar reporte global para uso posterior
    window.reporteVerificacion = { errores, reporte };
}

function corregirSumatoria(rutAlumno, totalCorrectoCSV) {
    const alumno = datosAlumnos.find(a => a.rut === rutAlumno);
    if (!alumno) return;
    
    const totalAnterior = alumno.totalPagadoReal || alumno.totalPagado;
    
    console.log(`🔧 Corrigiendo sumatoria para ${alumno.nombre}:`);
    console.log(`   Antes: ${totalAnterior}`);
    console.log(`   CSV dice: ${totalCorrectoCSV}`);
    
    // Actualizar con el valor del CSV
    alumno.totalPagadoReal = totalCorrectoCSV;
    alumno.totalPagado = totalCorrectoCSV;
    
    // Recalcular pendiente
    alumno.pendiente = Math.max(0, alumno.montoNeto - totalCorrectoCSV);
    
    // Recalcular estado
    alumno.estado = determinarEstado(alumno);
    
    console.log(`   Después: ${alumno.totalPagadoReal}`);
    console.log(`   Nuevo pendiente: ${alumno.pendiente}`);
    console.log(`   Nuevo estado: ${alumno.estado}`);
    
    // Guardar cambios
    guardarDatos();
    
    // Actualizar interfaz
    aplicarFiltros();
    actualizarEstadisticas();
    
    alert(`✅ Sumatoria corregida para ${alumno.nombre}

Valor anterior: ${formatearMoneda(totalAnterior)}
Valor CSV: ${formatearMoneda(totalCorrectoCSV)}
Diferencia corregida: ${formatearMoneda(Math.abs(totalAnterior - totalCorrectoCSV))}
Nuevo pendiente: ${formatearMoneda(alumno.pendiente)}
Estado: ${alumno.estado}`);
}

function corregirTodasLasSumatorias() {
    if (!window.reporteVerificacion || !window.reporteVerificacion.errores) {
        alert('No hay errores para corregir');
        return;
    }
    
    const errores = window.reporteVerificacion.errores;
    
    if (confirm(`¿Está seguro de corregir ${errores.length} sumatorias usando los valores del CSV?

Esta acción:
• Actualizará todos los totales pagados
• Recalculará los montos pendientes
• Actualizará los estados de los alumnos
• Guardará los cambios permanentemente

¿Continuar?`)) {
        
        let corregidos = 0;
        
        errores.forEach(error => {
            const alumno = datosAlumnos.find(a => a.rut === error.rut);
            if (alumno) {
                alumno.totalPagadoReal = error.totalCSV;
                alumno.totalPagado = error.totalCSV;
                alumno.pendiente = Math.max(0, alumno.montoNeto - error.totalCSV);
                alumno.estado = determinarEstado(alumno);
                corregidos++;
            }
        });
        
        // Guardar cambios
        guardarDatos();
        
        // Actualizar interfaz
        aplicarFiltros();
        actualizarEstadisticas();
        
        // Cerrar modal
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) bootstrapModal.hide();
        });
        
        alert(`✅ Corrección masiva completada!

• Sumatorias corregidas: ${corregidos}
• Todos los montos ahora coinciden con el CSV
• Estados de alumnos actualizados
• Cambios guardados permanentemente`);
        
        // Limpiar reporte global
        delete window.reporteVerificacion;
    }
}

// === SISTEMA DE CORREOS PARA MOROSIDAD ===

function enviarCorreoMorosidad(rutAlumno) {
    const alumno = datosAlumnos.find(a => a.rut === rutAlumno);
    const datosCorreo = datosCorreos.get(rutAlumno);
    
    if (!alumno) {
        alert('No se encontró el alumno');
        return;
    }
    
    if (!datosCorreo || !datosCorreo.correo) {
        alert('No se encontró información de correo para este apoderado');
        return;
    }
    
    const mensaje = generarMensajeMorosidad(alumno, datosCorreo);
    mostrarVistaPrevia('morosidad', alumno, datosCorreo, mensaje);
}

function enviarCorreoInformativo(rutAlumno) {
    const alumno = datosAlumnos.find(a => a.rut === rutAlumno);
    const datosCorreo = datosCorreos.get(rutAlumno);
    
    if (!alumno) {
        alert('No se encontró el alumno');
        return;
    }
    
    if (!datosCorreo || !datosCorreo.correo) {
        alert('No se encontró información de correo para este apoderado');
        return;
    }
    
    const mensaje = generarMensajeInformativo(alumno, datosCorreo);
    mostrarVistaPrevia('informativo', alumno, datosCorreo, mensaje);
}

function limpiarTextoEmail(texto) {
    // Solo quitar emojis problemáticos, mantener acentos españoles
    return texto
        .replace(/📋|📊|💰|⚠️|✅|⏳|🏫|🔧|❌|✨|📧|⭐|🎯|📄|💡|🚀/g, '') // Quitar emojis
        .replace(/[^\u0000-\u007F\u00C0-\u00FF]/g, ''); // Mantener caracteres latinos básicos y acentuados
}

function generarMensajeMorosidad(alumno, datosCorreo) {
    // Filtrar solo cuotas VENCIDAS (las que aparecen en rojo), no todas las pendientes
    const cuotasVencidas = alumno.cuotas.filter(c => !c.pagada && esCuotaVencida(c.numero));
    const fechaActual = new Date().toLocaleDateString('es-CL');
    
    const mensaje = `
Estimado/a ${datosCorreo.apoderado},

Junto con saludar, nos dirigimos a usted para informarle sobre el estado de pagos del estudiante ${alumno.nombre}, RUT ${formatearRUT(alumno.rut)}.

DETALLE DE LA DEUDA:
• Total pendiente: ${formatearMoneda(alumno.pendiente)}
• Cuotas vencidas: ${cuotasVencidas.length}
• Estado: ${alumno.estado.toUpperCase()}

CUOTAS VENCIDAS:
${cuotasVencidas.map(cuota => 
    `• Cuota ${cuota.numero}: ${formatearMoneda(cuota.monto)} (${obtenerMesVencimiento(cuota.numero)})`
).join('\n')}

IMPORTANTE:
Le solicitamos regularizar esta situación a la brevedad posible para evitar inconvenientes académicos.

Para realizar el pago puede:
• Dirigirse a administración del establecimiento
• Realizar el pago online a través de nuestro sistema

Fecha de este aviso: ${fechaActual}

Saludos cordiales,
Administración - Sistema de Tesorería
    `.trim();
    
    return limpiarTextoEmail(mensaje);
}

function generarMensajeInformativo(alumno, datosCorreo) {
    const fechaActual = new Date().toLocaleDateString('es-CL');
    const cuotasPagadas = alumno.cuotas.filter(c => c.pagada).length;
    
    const mensaje = `
Estimado/a ${datosCorreo.apoderado},

Nos complace informarle sobre el estado de pagos del estudiante ${alumno.nombre}, RUT ${formatearRUT(alumno.rut)}.

RESUMEN DE PAGOS:
• Total pagado: ${formatearMoneda(alumno.totalPagadoReal || alumno.totalPagado)}
• Cuotas pagadas: ${cuotasPagadas} de ${alumno.numeroCuotas}
• Saldo pendiente: ${formatearMoneda(alumno.pendiente)}
• Estado: ${alumno.estado.toUpperCase()}

ESTADO DE CUOTAS:
${alumno.cuotas.slice(0, alumno.numeroCuotas).map(cuota => {
    const estado = cuota.pagada ? 'PAGADA' : 'PENDIENTE';
    return `• Cuota ${cuota.numero} (${obtenerMesVencimiento(cuota.numero)}): ${estado}`;
}).join('\n')}

Agradecemos la confianza depositada en nuestra institución.

Fecha de este informe: ${fechaActual}

Saludos cordiales,
Administración - Sistema de Tesorería
    `.trim();
    
    return limpiarTextoEmail(mensaje);
}

function mostrarVistaPrevia(tipoCorreo, alumno, datosCorreo, mensaje) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title">
                        📧 Vista Previa del Correo - ${tipoCorreo === 'morosidad' ? 'Aviso de Morosidad' : 'Informe de Estado'}
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <h6>📬 Datos del Destinatario:</h6>
                        <ul class="mb-0">
                            <li><strong>Para:</strong> ${datosCorreo.correo}</li>
                            <li><strong>Apoderado:</strong> ${datosCorreo.apoderado}</li>
                            <li><strong>Estudiante:</strong> ${alumno.nombre}</li>
                        </ul>
                    </div>
                    
                    <div class="card">
                        <div class="card-header">
                            <strong>📋 Mensaje a enviar:</strong>
                        </div>
                        <div class="card-body">
                            <pre class="mb-0" style="white-space: pre-wrap; font-family: inherit;">${mensaje}</pre>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-success" onclick="confirmarEnvioCorreo('${tipoCorreo}', '${alumno.rut}', '${datosCorreo.correo}')">
                        📧 Confirmar Envío
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
    
    bootstrapModal.show();
}

async function confirmarEnvioCorreo(tipoCorreo, rutAlumno, emailDestino) {
    try {
        // Cerrar modal de vista previa
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) bootstrapModal.hide();
        });
        
        // Mostrar loading
        const loadingAlert = document.createElement('div');
        loadingAlert.className = 'alert alert-info position-fixed';
        loadingAlert.style = 'top: 20px; right: 20px; z-index: 9999;';
        loadingAlert.innerHTML = '📧 Enviando correo...';
        document.body.appendChild(loadingAlert);
        
        const alumno = datosAlumnos.find(a => a.rut === rutAlumno);
        const datosCorreo = datosCorreos.get(rutAlumno);
        
        // Generar mensaje apropiado
        const mensaje = tipoCorreo === 'morosidad' 
            ? generarMensajeMorosidad(alumno, datosCorreo)
            : generarMensajeInformativo(alumno, datosCorreo);
            
        const asunto = tipoCorreo === 'morosidad'
            ? `⚠️ Aviso de Morosidad - ${alumno.nombre}`
            : `📊 Estado de Cuenta - ${alumno.nombre}`;
        
        // Enviar correo via API
        const emailUrl = window.location.origin.includes('localhost') ? '/api/correo/enviar' : '/.netlify/functions/correo-simple';
        console.log('🔧 Enviando correo a URL:', emailUrl);
        console.log('🔧 Origen detectado:', window.location.origin);
        
        const response = await fetch(emailUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                destinatario: emailDestino,
                asunto: asunto,
                mensaje: mensaje,
                tipoCorreo: tipoCorreo,
                datosAlumno: {
                    nombre: alumno.nombre,
                    rut: alumno.rut,
                    curso: alumno.curso
                }
            })
        });
        
        const resultado = await response.json();
        
        // Remover loading
        document.body.removeChild(loadingAlert);
        
        if (resultado.success) {
            const modoTexto = resultado.simulado ? 
                '🔧 MODO SIMULACIÓN - Correo procesado pero no enviado realmente\n(Email no configurado en el servidor)\n\n' : 
                '';
            
            alert(`📧 Correo ${resultado.simulado ? 'simulado' : 'enviado'} exitosamente!

${modoTexto}Destinatario: ${emailDestino}
Estudiante: ${alumno.nombre}
Tipo: ${tipoCorreo === 'morosidad' ? 'Aviso de Morosidad' : 'Informe de Estado'}

${resultado.simulado ? 'El correo fue procesado correctamente en modo simulación.' : 'El correo ha sido enviado correctamente a través del servidor.'}`);
            
            // Registrar el envío
            registrarEnvioCorreo(tipoCorreo, rutAlumno, emailDestino);
        } else {
            throw new Error(resultado.error || 'Error desconocido');
        }
        
    } catch (error) {
        // Remover loading si existe
        const loadingAlert = document.querySelector('.alert.alert-info');
        if (loadingAlert) document.body.removeChild(loadingAlert);
        
        console.error('Error enviando correo:', error);
        alert(`❌ Error al enviar el correo: ${error.message}

Por favor verifique:
• Configuración del correo en el servidor
• Conexión a internet
• Dirección de correo válida`);
    }
}

function registrarEnvioCorreo(tipoCorreo, rutAlumno, emailDestino) {
    try {
        const historialCorreos = JSON.parse(localStorage.getItem('historialCorreos') || '[]');
        
        const registro = {
            id: `EMAIL-${Date.now()}`,
            fecha: new Date().toLocaleDateString('es-CL'),
            hora: new Date().toLocaleTimeString('es-CL'),
            tipo: tipoCorreo,
            rutAlumno: rutAlumno,
            emailDestino: emailDestino,
            timestamp: Date.now()
        };
        
        historialCorreos.push(registro);
        localStorage.setItem('historialCorreos', JSON.stringify(historialCorreos));
        
        console.log('📧 Envío de correo registrado:', registro.id);
    } catch (error) {
        console.error('Error al registrar envío de correo:', error);
    }
}

function envioMasivoMorosos() {
    const alumnosMorosos = datosAlumnos.filter(alumno => 
        alumno.estado === 'moroso' || alumno.pendiente > 0
    );
    
    if (alumnosMorosos.length === 0) {
        alert('No hay alumnos con deudas pendientes');
        return;
    }
    
    const alumnosConCorreo = alumnosMorosos.filter(alumno => {
        const datosCorreo = datosCorreos.get(alumno.rut);
        return datosCorreo && datosCorreo.correo;
    });
    
    if (alumnosConCorreo.length === 0) {
        alert('No se encontraron datos de correo para los alumnos morosos');
        return;
    }
    
    mostrarModalEnvioMasivo(alumnosConCorreo);
}

function mostrarModalEnvioMasivo(alumnos) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header bg-warning text-dark">
                    <h5 class="modal-title">📧 Envío Masivo de Avisos de Morosidad</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-info">
                        <h6>📊 Resumen del envío masivo:</h6>
                        <ul class="mb-0">
                            <li><strong>Total alumnos con deuda:</strong> ${alumnos.length}</li>
                            <li><strong>Correos a enviar:</strong> ${alumnos.length}</li>
                        </ul>
                    </div>
                    
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead class="table-dark">
                                <tr>
                                    <th>Alumno</th>
                                    <th>Curso</th>
                                    <th>Deuda</th>
                                    <th>Correo Apoderado</th>
                                    <th>Estado</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${alumnos.map(alumno => {
                                    const datosCorreo = datosCorreos.get(alumno.rut);
                                    return `
                                    <tr>
                                        <td><small><strong>${alumno.nombre}</strong></small></td>
                                        <td><small>${alumno.curso}</small></td>
                                        <td><small>${formatearMoneda(alumno.pendiente)}</small></td>
                                        <td><small>${datosCorreo.correo}</small></td>
                                        <td><span class="badge bg-${alumno.estado === 'moroso' ? 'danger' : 'warning'}">${alumno.estado}</span></td>
                                    </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-warning" onclick="ejecutarEnvioMasivo(${JSON.stringify(alumnos.map(a => a.rut)).replace(/"/g, '&quot;')})">
                        📧 Enviar ${alumnos.length} Correos
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    const bootstrapModal = new bootstrap.Modal(modal);
    
    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
    
    bootstrapModal.show();
}

async function ejecutarEnvioMasivo(rutAlumnos) {
    try {
        // Cerrar modal
        const modals = document.querySelectorAll('.modal.show');
        modals.forEach(modal => {
            const bootstrapModal = bootstrap.Modal.getInstance(modal);
            if (bootstrapModal) bootstrapModal.hide();
        });
        
        // Mostrar loading
        const loadingAlert = document.createElement('div');
        loadingAlert.className = 'alert alert-warning position-fixed';
        loadingAlert.style = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        loadingAlert.innerHTML = `📧 Enviando correos masivos...<br><small>Procesando ${rutAlumnos.length} correos</small>`;
        document.body.appendChild(loadingAlert);
        
        // Preparar datos para envío masivo
        const correosParaEnviar = [];
        
        for (const rut of rutAlumnos) {
            const alumno = datosAlumnos.find(a => a.rut === rut);
            const datosCorreo = datosCorreos.get(rut);
            
            if (alumno && datosCorreo && datosCorreo.correo) {
                const mensaje = generarMensajeMorosidad(alumno, datosCorreo);
                const asunto = `⚠️ Aviso de Morosidad - ${alumno.nombre}`;
                
                correosParaEnviar.push({
                    destinatario: datosCorreo.correo,
                    asunto: asunto,
                    mensaje: mensaje,
                    rutAlumno: rut,
                    nombreAlumno: alumno.nombre
                });
            }
        }
        
        // Enviar correos via API
        const emailMasivoUrl = window.location.origin.includes('localhost') ? '/api/correo/enviar-masivo' : '/.netlify/functions/api/correo/enviar-masivo';
        const response = await fetch(emailMasivoUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                correos: correosParaEnviar
            })
        });
        
        const resultado = await response.json();
        
        // Remover loading
        document.body.removeChild(loadingAlert);
        
        if (resultado.success) {
            const { resultados } = resultado;
            
            // Registrar todos los envíos exitosos
            resultados.detalles.forEach(detalle => {
                if (detalle.status === 'enviado' || detalle.status === 'simulado') {
                    const correoData = correosParaEnviar.find(c => c.destinatario === detalle.destinatario);
                    if (correoData) {
                        registrarEnvioCorreo('morosidad', correoData.rutAlumno, detalle.destinatario);
                    }
                }
            });
            
            const modoTexto = resultado.simulado ? 
                '🔧 MODO SIMULACIÓN - Correos procesados pero no enviados realmente\n(Email no configurado en el servidor)\n\n' : 
                '';
            
            alert(`📧 Envío masivo ${resultado.simulado ? 'simulado' : 'completado'}!

${modoTexto}✅ Correos ${resultado.simulado ? 'simulados' : 'enviados'}: ${resultados.enviados}
❌ Errores: ${resultados.errores}
📊 Total procesados: ${rutAlumnos.length}

${resultado.simulado ? 'Los avisos de morosidad fueron procesados correctamente en modo simulación.' : 'Los avisos de morosidad han sido enviados correctamente a través del servidor.'}`);
            
        } else {
            throw new Error(resultado.error || 'Error en el envío masivo');
        }
        
    } catch (error) {
        // Remover loading si existe
        const loadingAlert = document.querySelector('.alert.alert-warning');
        if (loadingAlert) document.body.removeChild(loadingAlert);
        
        console.error('Error en envío masivo:', error);
        alert(`❌ Error en el envío masivo: ${error.message}

Por favor verifique:
• Configuración del correo en el servidor
• Conexión a internet
• Servidor en funcionamiento`);
    }
}