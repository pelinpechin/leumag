# 🚀 Configuración de Supabase

## Paso 1: Crear Proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com)
2. Haz clic en "Start your project"
3. Inicia sesión con GitHub/Google
4. Crea un nuevo proyecto:
   - **Nombre**: `tesoreria`
   - **Base de datos password**: tyte1317
   - **Región**: EEUU - más cercana a Chile

## Paso 2: Obtener Credenciales

1. Una vez creado el proyecto, ve a **Settings** > **API**
2. Copia estos valores:
   - **Project URL**: `https://xxxxxxxxx.supabase.co`
   - **Anon public key**: `eeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk`

## Paso 3: Configurar el Proyecto Local

1. Abre el archivo `supabase-config.js`
2. Reemplaza las líneas:
   ```javascript
   const SUPABASE_CONFIG = {
       url: 'https://iajcxlymwqeltfmedmkj.supabase.co',
       anonKey: 'eeyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk`

   };
   ```

## Paso 4: Crear las Tablas

1. En Supabase, ve a **SQL Editor**
2. Copia todo el contenido de `database-schema.sql`
3. Pégalo en el editor y ejecuta (botón "Run")

## Paso 5: Verificar Instalación

1. Ve a **Table Editor** en Supabase
2. Deberías ver las tablas:
   - `alumnos`
   - `cuotas` 
   - `apoderados`
   - `pagos`
   - `usuarios`

## Paso 6: Configurar Autenticación (Opcional)

1. Ve a **Authentication** > **Settings**
2. Configura providers de login (Email, Google, etc.)

## 🎯 ¿Qué obtienes con Supabase?

- ✅ **Base de datos PostgreSQL** profesional
- ✅ **API REST automática** para todas las tablas
- ✅ **Sincronización en tiempo real** entre usuarios
- ✅ **Autenticación integrada** por roles
- ✅ **Backups automáticos** diarios
- ✅ **Escalabilidad** para múltiples colegios
- ✅ **Dashboard de administración**

## 📊 Costo

- **Plan Gratuito**: Hasta 500MB de DB + 5GB transferencia/mes
- **Plan Pro**: $25/mes - Para uso profesional
- **Más info**: [supabase.com/pricing](https://supabase.com/pricing)

## ⚡ Próximos Pasos

Una vez configurado, el sistema podrá:

1. **Guardar datos** en la nube en lugar de localStorage
2. **Sincronizar** cambios entre múltiples computadores
3. **Permitir acceso** a apoderados desde sus celulares
4. **Generar reportes** avanzados con SQL
5. **Integrar pagos online** con mayor seguridad

## 🆘 ¿Necesitas Ayuda?

Si tienes problemas:
1. Revisa que las credenciales estén correctas
2. Verifica que las tablas se crearon bien
3. Chequea la consola del navegador por errores

**¡Una vez configurado, el sistema será mucho más potente! 🎓**