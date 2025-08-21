require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const nodemailer = require('nodemailer');
const { WebpayPlus } = require('transbank-sdk');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Configuración de Webpay Plus
const comercio = process.env.WEBPAY_COMMERCE_CODE || "597055555532";
const apiKey = process.env.WEBPAY_API_KEY || "579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C";
const ambiente = process.env.WEBPAY_ENVIRONMENT || "integration"; // "integration" o "production"

// Configurar el ambiente de Transbank (nueva API v6)
try {
    if (ambiente === "production") {
        WebpayPlus.configureForProduction(comercio, apiKey);
    } else {
        // Usar método alternativo para v6
        WebpayPlus.configureForTesting(comercio, apiKey);
    }
} catch (error) {
    console.log('⚠️ Webpay configuración usando método legacy');
    // Fallback para versiones nuevas
}

console.log(`🔧 Webpay configurado para ambiente: ${ambiente}`);
console.log(`🏪 Código de comercio: ${comercio}`);

// Configuración del transporter de correo
let transporterEmail = null;
let correoConfigurado = false;

// Solo configurar correo si hay credenciales válidas
if (process.env.EMAIL_USER && process.env.EMAIL_PASS && 
    process.env.EMAIL_USER !== 'tu_correo@gmail.com' && 
    process.env.EMAIL_PASS !== 'tu_contraseña_de_aplicacion') {
    
    transporterEmail = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });

    // Verificar configuración de correo
    transporterEmail.verify(function(error, success) {
        if (error) {
            console.log('❌ Error configuración correo:', error.message);
            console.log('📧 Funcionando en modo simulado (sin envío real)');
            correoConfigurado = false;
            transporterEmail = null; // Desactivar transporter cuando falle
        } else {
            console.log('✅ Servidor de correo configurado correctamente');
            correoConfigurado = true;
        }
    });
} else {
    console.log('📧 Correo no configurado - funcionando en modo simulado');
    console.log('💡 Para envío real, configura EMAIL_USER y EMAIL_PASS en .env');
}

// Almacén temporal de transacciones (en producción usar base de datos)
const transaccionesActivas = new Map();

// Ruta principal - servir el frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API para crear una nueva transacción
app.post('/api/webpay/create', async (req, res) => {
    try {
        const { 
            ordenCompra, 
            monto, 
            rutAlumno, 
            alumno, 
            numeroCuota, 
            descripcion 
        } = req.body;

        console.log('📝 Creando transacción Webpay:', {
            ordenCompra,
            monto,
            rutAlumno,
            numeroCuota
        });

        // Validaciones básicas
        if (!ordenCompra || !monto || monto <= 0 || !rutAlumno || !numeroCuota) {
            return res.status(400).json({
                success: false,
                error: 'Datos de transacción incompletos'
            });
        }

        // URLs de retorno
        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;
        const returnUrl = `${baseUrl}/webpay-return`;

        // Crear transacción en Transbank
        const createResponse = await WebpayPlus.Transaction.create(
            ordenCompra,
            req.body.sessionId || `session-${Date.now()}`,
            Math.round(monto), // Transbank requiere monto entero
            returnUrl
        );

        console.log('✅ Transacción creada en Transbank:', {
            token: createResponse.token,
            url: createResponse.url
        });

        // Guardar datos de la transacción para el retorno
        transaccionesActivas.set(createResponse.token, {
            ordenCompra,
            monto: Math.round(monto),
            rutAlumno,
            alumno,
            numeroCuota,
            descripcion,
            fechaCreacion: new Date(),
            sessionId: req.body.sessionId || `session-${Date.now()}`
        });

        res.json({
            success: true,
            token: createResponse.token,
            url: createResponse.url
        });

    } catch (error) {
        console.error('❌ Error creando transacción Webpay:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            details: error.message
        });
    }
});

// Ruta de retorno desde Webpay
app.post('/webpay-return', async (req, res) => {
    try {
        const { token_ws } = req.body;

        if (!token_ws) {
            return res.status(400).send('Token no proporcionado');
        }

        console.log('🔄 Procesando retorno de Webpay, token:', token_ws);

        // Confirmar transacción con Transbank
        const confirmResponse = await WebpayPlus.Transaction.commit(token_ws);
        
        console.log('📋 Respuesta de confirmación:', {
            responseCode: confirmResponse.response_code,
            authorizationCode: confirmResponse.authorization_code,
            amount: confirmResponse.amount
        });

        // Recuperar datos de la transacción
        const datosTransaccion = transaccionesActivas.get(token_ws);
        
        if (!datosTransaccion) {
            console.error('❌ Transacción no encontrada para token:', token_ws);
            return res.status(400).send('Transacción no encontrada');
        }

        // Verificar si el pago fue exitoso
        const pagoExitoso = confirmResponse.response_code === 0;
        
        if (pagoExitoso) {
            console.log('✅ Pago exitoso:', {
                ordenCompra: datosTransaccion.ordenCompra,
                monto: confirmResponse.amount,
                autorizacion: confirmResponse.authorization_code
            });
        } else {
            console.log('❌ Pago rechazado:', {
                ordenCompra: datosTransaccion.ordenCompra,
                responseCode: confirmResponse.response_code
            });
        }

        // Redirigir al frontend con el resultado
        const resultadoUrl = `/webpay-result?` + new URLSearchParams({
            success: pagoExitoso,
            token: token_ws,
            authorization: confirmResponse.authorization_code || '',
            responseCode: confirmResponse.response_code || '',
            amount: confirmResponse.amount || '',
            buyOrder: confirmResponse.buy_order || '',
            card: confirmResponse.card_detail?.card_number || ''
        }).toString();

        res.redirect(resultadoUrl);

    } catch (error) {
        console.error('❌ Error en retorno de Webpay:', error);
        res.redirect(`/webpay-result?success=false&error=${encodeURIComponent(error.message)}`);
    }
});

// API para obtener el resultado de una transacción
app.get('/api/webpay/result/:token', async (req, res) => {
    try {
        const { token } = req.params;
        
        const datosTransaccion = transaccionesActivas.get(token);
        if (!datosTransaccion) {
            return res.status(404).json({
                success: false,
                error: 'Transacción no encontrada'
            });
        }

        res.json({
            success: true,
            transaccion: datosTransaccion
        });

        // Limpiar transacción procesada después de un tiempo
        setTimeout(() => {
            transaccionesActivas.delete(token);
            console.log('🧹 Transacción limpiada:', token);
        }, 10 * 60 * 1000); // 10 minutos

    } catch (error) {
        console.error('❌ Error obteniendo resultado:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Ruta para manejar el resultado final (página de confirmación)
app.get('/webpay-result', (req, res) => {
    const { success, authorization, amount, buyOrder, card, error, responseCode } = req.query;
    
    const resultadoHtml = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Resultado del Pago - Webpay</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
        .result-container {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .result-card {
            max-width: 500px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
    </style>
</head>
<body>
    <div class="result-container">
        <div class="card result-card">
            <div class="card-header bg-${success === 'true' ? 'success' : 'danger'} text-white text-center">
                <h4 class="mb-0">
                    ${success === 'true' ? '✅ Pago Exitoso' : '❌ Pago Rechazado'}
                </h4>
            </div>
            <div class="card-body text-center">
                ${success === 'true' ? `
                    <div class="alert alert-success">
                        <h5>¡Pago procesado correctamente!</h5>
                        <p class="mb-0">Su transacción ha sido aprobada.</p>
                    </div>
                    <table class="table table-borderless">
                        <tr>
                            <td><strong>Código de Autorización:</strong></td>
                            <td>${authorization}</td>
                        </tr>
                        <tr>
                            <td><strong>Monto:</strong></td>
                            <td>$${parseInt(amount).toLocaleString('es-CL')}</td>
                        </tr>
                        <tr>
                            <td><strong>Orden de Compra:</strong></td>
                            <td>${buyOrder}</td>
                        </tr>
                        ${card ? `
                        <tr>
                            <td><strong>Tarjeta:</strong></td>
                            <td>**** **** **** ${card.slice(-4)}</td>
                        </tr>
                        ` : ''}
                    </table>
                ` : `
                    <div class="alert alert-danger">
                        <h5>El pago no pudo ser procesado</h5>
                        <p class="mb-0">
                            ${error ? error : 
                              responseCode === '1' ? 'Fondos insuficientes' :
                              responseCode === '2' ? 'Tarjeta bloqueada' :
                              responseCode === '3' ? 'Tarjeta vencida' :
                              'Transacción rechazada por el banco'}
                        </p>
                    </div>
                `}
                
                <div class="mt-4">
                    <button class="btn btn-primary" onclick="cerrarYNotificar()">
                        Continuar
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        function cerrarYNotificar() {
            // Notificar al opener (ventana principal) sobre el resultado
            if (window.opener) {
                window.opener.postMessage({
                    type: 'webpayResult',
                    success: ${success === 'true'},
                    authorization: '${authorization || ''}',
                    amount: ${amount || 0},
                    buyOrder: '${buyOrder || ''}',
                    card: '${card || ''}',
                    responseCode: '${responseCode || ''}',
                    error: '${error || ''}'
                }, '*');
                window.close();
            } else {
                // Si no hay opener, redirigir al portal principal
                window.location.href = '/';
            }
        }

        // Auto-cerrar después de 30 segundos si no se hace clic
        setTimeout(cerrarYNotificar, 30000);
    </script>
</body>
</html>`;

    res.send(resultadoHtml);
});

// API de estado del servidor
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: ambiente,
        transaccionesActivas: transaccionesActivas.size
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
    console.log(`🌐 Frontend disponible en: http://localhost:${PORT}`);
    console.log(`🔗 API disponible en: http://localhost:${PORT}/api`);
    
    if (ambiente === "integration") {
        console.log(`⚠️  Modo INTEGRACIÓN - usando credenciales de prueba`);
        console.log(`💳 Tarjetas de prueba:`);
        console.log(`   VISA: 4051 8856 0000 0005`);
        console.log(`   Mastercard: 5186 0595 5959 0568`);
    } else {
        console.log(`🔒 Modo PRODUCCIÓN - usando credenciales reales`);
    }
});

// === RUTAS PARA ENVÍO DE CORREOS ===

// API para enviar correo individual
app.post('/api/correo/enviar', async (req, res) => {
    try {
        const { 
            destinatario, 
            asunto, 
            mensaje, 
            tipoCorreo,
            datosAlumno 
        } = req.body;

        console.log('📧 Enviando correo:', { destinatario, asunto, tipoCorreo });

        const mailOptions = {
            from: `"Sistema de Tesorería" <${process.env.EMAIL_USER}>`,
            to: destinatario,
            subject: asunto,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #007bff; color: white; padding: 20px; text-align: center;">
                        <h2>🏫 Sistema de Tesorería Escolar</h2>
                        <p>${tipoCorreo === 'morosidad' ? '⚠️ Aviso de Morosidad' : '📊 Estado de Cuenta'}</p>
                    </div>
                    <div style="padding: 20px; background-color: #f8f9fa;">
                        <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; background-color: white; padding: 15px; border-left: 4px solid #007bff;">${mensaje}</pre>
                    </div>
                    <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px;">
                        <p>Este correo fue enviado automáticamente desde nuestro Sistema de Tesorería</p>
                        <p>Por favor no responda a este correo</p>
                    </div>
                </div>
            `
        };

        if (transporterEmail) {
            const info = await transporterEmail.sendMail(mailOptions);
            console.log('✅ Correo enviado exitosamente:', info.messageId);
            
            res.json({ 
                success: true, 
                messageId: info.messageId,
                message: 'Correo enviado correctamente'
            });
        } else {
            console.log('📧 SIMULACIÓN: Correo que se habría enviado:');
            console.log(`   📫 Para: ${destinatario}`);
            console.log(`   📝 Asunto: ${asunto}`);
            console.log(`   📄 Tipo: ${tipoCorreo}`);
            
            res.json({ 
                success: true, 
                messageId: 'simulado-' + Date.now(),
                message: 'Correo simulado (email no configurado)',
                simulado: true
            });
        }

    } catch (error) {
        console.error('❌ Error enviando correo:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// API para envío masivo de correos
app.post('/api/correo/enviar-masivo', async (req, res) => {
    try {
        const { correos } = req.body;
        
        console.log('📧 Iniciando envío masivo de correos:', correos.length);
        
        const resultados = {
            enviados: 0,
            errores: 0,
            detalles: []
        };

        if (!transporterEmail) {
            console.log('📧 SIMULACIÓN: Envío masivo que se habría realizado:');
            console.log(`   📨 Total correos: ${correos.length}`);
            
            correos.forEach((correoData, index) => {
                console.log(`   ${index + 1}. Para: ${correoData.destinatario} - Asunto: ${correoData.asunto}`);
                resultados.enviados++;
                resultados.detalles.push({
                    destinatario: correoData.destinatario,
                    status: 'simulado',
                    messageId: 'simulado-' + Date.now() + '-' + index
                });
            });
            
            res.json({ 
                success: true, 
                resultados,
                simulado: true,
                message: 'Envío masivo simulado (email no configurado)'
            });
            return;
        }

        for (const correoData of correos) {
            try {
                const mailOptions = {
                    from: `"Sistema de Tesorería" <${process.env.EMAIL_USER}>`,
                    to: correoData.destinatario,
                    subject: correoData.asunto,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <div style="background-color: #ffc107; color: black; padding: 20px; text-align: center;">
                                <h2>🏫 Sistema de Tesorería Escolar</h2>
                                <p>⚠️ Aviso de Morosidad</p>
                            </div>
                            <div style="padding: 20px; background-color: #f8f9fa;">
                                <pre style="font-family: Arial, sans-serif; white-space: pre-wrap; background-color: white; padding: 15px; border-left: 4px solid #ffc107;">${correoData.mensaje}</pre>
                            </div>
                            <div style="background-color: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px;">
                                <p>Este correo fue enviado automáticamente desde nuestro Sistema de Tesorería</p>
                                <p>Por favor no responda a este correo</p>
                            </div>
                        </div>
                    `
                };

                const info = await transporterEmail.sendMail(mailOptions);
                resultados.enviados++;
                resultados.detalles.push({
                    destinatario: correoData.destinatario,
                    status: 'enviado',
                    messageId: info.messageId
                });

                // Delay entre envíos para evitar spam
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                resultados.errores++;
                resultados.detalles.push({
                    destinatario: correoData.destinatario,
                    status: 'error',
                    error: error.message
                });
                console.error(`❌ Error enviando a ${correoData.destinatario}:`, error.message);
            }
        }

        console.log('📊 Envío masivo completado:', resultados);
        
        res.json({ 
            success: true, 
            resultados 
        });

    } catch (error) {
        console.error('❌ Error en envío masivo:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Manejo de errores no capturados
process.on('uncaughtException', (error) => {
    console.error('❌ Error no capturado:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Promise rechazada:', error);
});

module.exports = app;