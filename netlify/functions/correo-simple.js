const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ message: 'Función de correo activa' })
    };
  }

  try {
    const { destinatario, asunto, mensaje, tipoCorreo } = JSON.parse(event.body);

    // Verificar y limpiar variables de entorno
    const emailUser = process.env.EMAIL_USER ? process.env.EMAIL_USER.trim() : null;
    const emailPass = process.env.EMAIL_PASS ? process.env.EMAIL_PASS.trim() : null;
    
    console.log('🔍 Debug variables:', {
      emailUser: emailUser ? emailUser.substring(0, 5) + '...' : 'NULL',
      emailUserLength: emailUser ? emailUser.length : 0,
      emailPass: emailPass ? '***' + emailPass.slice(-4) : 'NULL',
      emailPassLength: emailPass ? emailPass.length : 0,
      originalUser: process.env.EMAIL_USER ? process.env.EMAIL_USER.length : 'undefined',
      originalPass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.length : 'undefined'
    });

    if (!emailUser || !emailPass) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          simulado: true,
          message: 'Variables no encontradas en Netlify',
          debug: {
            hasUser: !!emailUser,
            hasPass: !!emailPass,
            userLength: emailUser ? emailUser.length : 0,
            passLength: emailPass ? emailPass.length : 0
          }
        })
      };
    }

    // Crear transporter con variables limpiadas
    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    // Verificar transporter
    try {
      await transporter.verify();
      console.log('✅ Transporter verificado correctamente');
    } catch (verifyError) {
      console.log('❌ Error verificando transporter:', verifyError.message);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: false,
          simulado: true,
          message: 'Error de configuración de email',
          error: verifyError.message,
          debug: {
            userLength: emailUser ? emailUser.length : 0,
            passLength: emailPass ? emailPass.length : 0
          }
        })
      };
    }

    // Enviar correo
    const info = await transporter.sendMail({
      from: `"Sistema Tesorería" <${emailUser}>`,
      to: destinatario,
      subject: asunto,
      html: `
        <h2>🏫 Sistema de Tesorería</h2>
        <p><strong>${tipoCorreo === 'morosidad' ? 'Aviso de Morosidad' : 'Estado de Cuenta'}</strong></p>
        <div style="padding:15px; background:#f5f5f5; border-left:4px solid #007bff;">
          <pre>${mensaje}</pre>
        </div>
      `
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        messageId: info.messageId,
        message: 'Correo enviado desde Netlify exitosamente!'
      })
    };

  } catch (error) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: false,
        error: error.message,
        message: 'Error: ' + error.message
      })
    };
  }
};