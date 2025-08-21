# 📧 Configuración del Sistema de Correos

## Para vincular tu correo personal y enviar emails reales, sigue estos pasos:

### 1. Configurar Gmail (Recomendado)

#### Paso 1: Habilitar verificación en 2 pasos
1. Ve a tu cuenta de Google: https://myaccount.google.com/
2. Selecciona "Seguridad"
3. Activa "Verificación en 2 pasos"

#### Paso 2: Generar contraseña de aplicación
1. En la misma sección de Seguridad
2. Busca "Contraseñas de aplicaciones"
3. Genera una nueva contraseña para "Correo"
4. **Guarda esta contraseña de 16 caracteres**

#### Paso 3: Configurar variables de entorno
Edita el archivo `.env` y reemplaza:

```env
EMAIL_USER=pagoarancel@liceoexperimental.cl
EMAIL_PASS=pagos753159
```

**Ejemplo:**
```env
EMAIL_USER=tesoreria.colegio@gmail.com
EMAIL_PASS=abcd efgh ijkl mnop
```

### 2. Otros proveedores de correo

#### Outlook/Hotmail
```env
EMAIL_USER=tu_correo@outlook.com
EMAIL_PASS=tu_contraseña
```

En `server.js`, cambiar la configuración:
```javascript
service: 'outlook'  // en lugar de 'gmail'
```

#### Yahoo
```env
EMAIL_USER=tu_correo@yahoo.com
EMAIL_PASS=tu_contraseña
```

En `server.js`:
```javascript
service: 'yahoo'  // en lugar de 'gmail'
```

#### Servidor SMTP personalizado
En `server.js`, reemplazar la configuración completa:
```javascript
const transporterEmail = nodemailer.createTransporter({
    host: 'smtp.tu-servidor.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});
```

### 3. Reiniciar el servidor

Después de configurar las variables de entorno:

```bash
# Detener el servidor (Ctrl+C)
# Luego reiniciar:
npm run dev
```

### 4. Verificar funcionamiento

Al iniciar el servidor, deberías ver:
```
✅ Servidor de correo configurado correctamente
```

Si ves un error, verifica:
- Las credenciales en el archivo `.env`
- La contraseña de aplicación de Gmail
- Conexión a internet

### 5. Probar el sistema

1. Ve a la vista de Administración
2. Busca un alumno con deuda
3. Haz clic en "Ver Detalle"
4. Usa el botón "📧 Enviar Aviso de Morosidad"
5. O usa el botón "📧 Correos" para envío masivo

### 🔒 Seguridad

- **NUNCA** subas el archivo `.env` a repositorios públicos
- Usa contraseñas de aplicación, no tu contraseña principal
- Las contraseñas de aplicación son más seguras y específicas

### ❓ Solución de problemas

#### Error: "Invalid login"
- Verifica que la contraseña de aplicación esté correcta
- Asegúrate de que la verificación en 2 pasos esté activa

#### Error: "Connection timeout"
- Verifica tu conexión a internet
- Algunos antivirus bloquean conexiones SMTP

#### Error: "Service not found"
- Verifica que el servicio esté escrito correctamente ('gmail', 'outlook', 'yahoo')

### 📧 Personalizar plantillas de correo

Las plantillas se pueden modificar en `server.js` en las rutas:
- `/api/correo/enviar` - Correos individuales
- `/api/correo/enviar-masivo` - Correos masivos

---

¡Con esta configuración podrás enviar correos reales desde tu sistema de tesorería!