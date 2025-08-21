const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { WebpayPlus } = require('transbank-sdk');

// Crear app Express
const app = express();

// Configurar middlewares
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configuración de Webpay
const comercio = process.env.WEBPAY_COMMERCE_CODE || '597055555532';
const apiKey = process.env.WEBPAY_API_KEY || '579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C';
const ambiente = process.env.WEBPAY_ENVIRONMENT || 'integration';

WebpayPlus.configureForTesting(comercio, apiKey);

console.log(`🔧 Webpay configurado para ambiente: ${ambiente}`);
console.log(`🏪 Código de comercio: ${comercio}`);

// Configuración del transporter de correo
let transporterEmail = null;

// Solo configurar correo si hay credenciales válidas
if (process.env.EMAIL_USER && process.env.EMAIL_PASS && 
    process.env.EMAIL_USER !== 'tu_correo@gmail.com' && 
    process.env.EMAIL_PASS !== 'tu_contraseña_de_aplicacion') {
    
    transporterEmail = nodemailer.createTransporter({
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
            transporterEmail = null;
        } else {
            console.log('✅ Servidor de correo configurado correctamente');
        }
    });
} else {
    console.log('📧 Correo no configurado - funcionando en modo simulado');
}

// Almacenar transacciones en memoria (en producción usar base de datos)
const transaccionesActivas = new Map();

// === RUTAS WEBPAY ===

// Iniciar transacción
app.post('/webpay/iniciar', async (req, res) => {
    try {
        const { 
            monto, 
            ordenCompra, 
            rutAlumno, 
            nombreAlumno, 
            cuotasSeleccionadas,
            emailNotificacion 
        } = req.body;

        console.log('💳 Iniciando transacción Webpay:', { 
            monto, 
            ordenCompra, 
            rutAlumno, 
            nombreAlumno 
        });

        const baseUrl = process.env.URL || 'https://your-netlify-site.netlify.app';
        const returnUrl = `${baseUrl}/.netlify/functions/api/webpay/retorno`;

        const response = await WebpayPlus.Transaction.create(
            ordenCompra,
            'CL',
            monto,
            returnUrl
        );

        // Guardar datos de la transacción
        transaccionesActivas.set(response.token, {
            token: response.token,
            ordenCompra: ordenCompra,
            monto: monto,
            rutAlumno: rutAlumno,
            nombreAlumno: nombreAlumno,
            cuotasSeleccionadas: cuotasSeleccionadas,
            emailNotificacion: emailNotificacion,
            fechaCreacion: new Date(),
            estado: 'iniciada'
        });

        console.log('✅ Transacción iniciada exitosamente:', response.token);

        res.json({
            success: true,
            token: response.token,
            url: response.url
        });

    } catch (error) {
        console.error('❌ Error iniciando transacción:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Retorno de Webpay
app.post('/webpay/retorno', async (req, res) => {
    try {
        const { token_ws } = req.body;
        
        console.log('🔄 Procesando retorno de Webpay:', token_ws);

        const confirmResponse = await WebpayPlus.Transaction.commit(token_ws);
        const datosTransaccion = transaccionesActivas.get(token_ws);

        if (!datosTransaccion) {
            throw new Error('Transacción no encontrada');
        }

        const pagoExitoso = confirmResponse.response_code === 0;

        // Actualizar datos de la transacción
        datosTransaccion.estado = pagoExitoso ? 'aprobada' : 'rechazada';
        datosTransaccion.codigoRespuesta = confirmResponse.response_code;
        datosTransaccion.codigoAutorizacion = confirmResponse.authorization_code;
        datosTransaccion.fechaProceso = new Date();

        if (pagoExitoso) {
            console.log('✅ Pago aprobado:', {
                ordenCompra: datosTransaccion.ordenCompra,
                monto: confirmResponse.amount,
                authorization: confirmResponse.authorization_code
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

// === RUTAS PARA ENVÍO DE CORREOS ===

// API para enviar correo individual
app.post('/correo/enviar', async (req, res) => {
    try {
        const { 
            destinatario, 
            asunto, 
            mensaje, 
            tipoCorreo,
            datosAlumno 
        } = req.body;

        console.log('📧 Enviando correo:', { destinatario, asunto, tipoCorreo });

        if (transporterEmail) {
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
app.post('/correo/enviar-masivo', async (req, res) => {
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

// Exportar como función serverless
const handler = serverless(app);
module.exports.handler = async (event, context) => {
    // Para debugging
    console.log('Event:', JSON.stringify(event, null, 2));
    
    const result = await handler(event, context);
    return result;
};