# Configuración de Variables de Entorno para Netlify

Para que tu aplicación funcione correctamente en Netlify, necesitas configurar estas variables de entorno en tu sitio:

## 🔧 Cómo configurar en Netlify:

1. Ve a tu dashboard de Netlify: https://app.netlify.com
2. Selecciona tu sitio (leumag)
3. Ve a **Site settings** → **Environment variables**
4. Añade cada una de estas variables:

## 📋 Variables Requeridas:

### Webpay Plus (Transbank)
```
WEBPAY_COMMERCE_CODE=597055555532
WEBPAY_API_KEY=579B532A7440BB0C9079DED94D31EA1615BACEB56610332264630D42D0A36B1C
WEBPAY_ENVIRONMENT=integration
```

### Configuración General
```
NODE_ENV=production
URL=https://tu-sitio.netlify.app
```

### Email (Opcional - para envío real de correos)
```
EMAIL_USER=tu_correo@gmail.com
EMAIL_PASS=tu_contraseña_de_aplicacion
```

## ⚠️ Notas Importantes:

1. **URL**: Reemplaza `https://tu-sitio.netlify.app` con la URL real de tu sitio Netlify

2. **Email**: Si no configuras EMAIL_USER y EMAIL_PASS, la aplicación funcionará en modo simulación (los correos se "envían" pero no realmente)

3. **Webpay**: Las credenciales mostradas son para el ambiente de INTEGRACIÓN/PRUEBAS. Para producción necesitarás las credenciales reales de Transbank.

## 🚀 Después de configurar:

1. Las variables se aplicarán automáticamente en el próximo deploy
2. Puedes hacer un redeploy manual desde Netlify dashboard si es necesario
3. Verifica en los logs que las variables se carguen correctamente

## 🔒 Seguridad:

- Nunca commits credenciales reales al repositorio
- Usa siempre variables de entorno para datos sensibles
- Las credenciales mostradas aquí son solo para pruebas