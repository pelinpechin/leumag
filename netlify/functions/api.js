const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const nodemailer = require('nodemailer');

// Crear app Express
const app = express();

// Configurar middlewares básicos
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración del transporter de correo
let transporterEmail = null;

// Solo configurar correo si hay credenciales válidas
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    try {
        transporterEmail = nodemailer.createTransporter({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
    } catch (error) {
        console.log('Email transporter could not be configured');
        transporterEmail = null;
    }
}

// === RUTAS PARA ENVÍO DE CORREOS ===

// API para enviar correo individual
app.post('/correo/enviar', async (req, res) => {
    try {
        const { 
            destinatario, 
            asunto, 
            mensaje, 
            tipoCorreo
        } = req.body;

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
                    </div>
                `
            };

            const info = await transporterEmail.sendMail(mailOptions);
            
            res.json({ 
                success: true, 
                messageId: info.messageId,
                message: 'Correo enviado correctamente'
            });
        } else {
            res.json({ 
                success: true, 
                messageId: 'simulado-' + Date.now(),
                message: 'Correo simulado (email no configurado)',
                simulado: true
            });
        }

    } catch (error) {
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
        
        const resultados = {
            enviados: 0,
            errores: 0,
            detalles: []
        };

        if (!transporterEmail) {
            correos.forEach((correoData, index) => {
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

                // Delay entre envíos
                await new Promise(resolve => setTimeout(resolve, 1000));
                
            } catch (error) {
                resultados.errores++;
                resultados.detalles.push({
                    destinatario: correoData.destinatario,
                    status: 'error',
                    error: error.message
                });
            }
        }

        res.json({ 
            success: true, 
            resultados 
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Ruta de prueba
app.get('/test', (req, res) => {
    res.json({ message: 'API funcionando correctamente', timestamp: new Date().toISOString() });
});

// Exportar como función serverless
const handler = serverless(app);

module.exports.handler = async (event, context) => {
    try {
        const result = await handler(event, context);
        return result;
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};