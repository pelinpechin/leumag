const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  try {
    const { destinatario, asunto, mensaje, tipoCorreo } = JSON.parse(event.body);

    // Debug environment variables
    console.log('Environment check:', {
      hasEmailUser: !!process.env.EMAIL_USER,
      hasEmailPass: !!process.env.EMAIL_PASS,
      emailUserLength: process.env.EMAIL_USER ? process.env.EMAIL_USER.length : 0,
      emailUser: process.env.EMAIL_USER ? process.env.EMAIL_USER.substring(0, 5) + '...' : 'NOT SET'
    });

    // Configurar transporter
    let transporterEmail = null;
    
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        transporterEmail = nodemailer.createTransporter({
          service: 'gmail',
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          }
        });
        
        // Test the connection
        await transporterEmail.verify();
        console.log('✅ Email transporter verified successfully');
      } catch (error) {
        console.log('❌ Error configurando/verificando email transporter:', error.message);
        transporterEmail = null;
      }
    } else {
      console.log('❌ Environment variables not set:', {
        EMAIL_USER: process.env.EMAIL_USER ? 'SET' : 'NOT SET',
        EMAIL_PASS: process.env.EMAIL_PASS ? 'SET' : 'NOT SET'
      });
    }

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
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          messageId: info.messageId,
          message: 'Correo enviado correctamente'
        })
      };
    } else {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({
          success: true,
          messageId: 'simulado-' + Date.now(),
          message: 'Correo simulado (email no configurado)',
          simulado: true
        })
      };
    }

  } catch (error) {
    console.error('Error enviando correo:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};