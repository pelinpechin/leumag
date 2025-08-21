# 🏫 Sistema de Tesorería Escolar - Chile

Sistema completo de gestión de pagos escolares con integración real de **Webpay Plus (Transbank)** para colegios chilenos.

## 🚀 Características

### 💰 **Portal de Apoderados**
- Consulta de estado de cuotas por RUT y apellido
- **Pago directo con Webpay Plus** (tarjetas de crédito/débito)
- Visualización de abonos parciales y saldos pendientes
- Generación automática de boletas PDF

### 🔧 **Portal Administrativo**
- Gestión completa de alumnos y cuotas
- **Eliminación de alumnos** con motivos específicos (retiro/no matriculado)
- **Historial de eliminaciones** con registro completo
- Filtros dinámicos (curso, estado, nombre)
- Estadísticas en tiempo real
- Sistema de boletas con numeración correlativa
- Múltiples medios de pago (efectivo, tarjetas, cheques, Webpay)

### 📋 **Sistema de Cuotas**
- Manejo de abonos parciales
- Cálculo automático de vencimientos (cuota 6 = 5 de agosto)
- Reglas específicas por curso (4° medio = 9 cuotas, otros = 10)
- Soporte para becas completas y parciales

## 🛠️ Instalación

### Prerrequisitos
- Node.js 14+ 
- NPM o Yarn

### 1. Clonar e instalar dependencias
```bash
cd "C:\Users\HP\Desktop\Proyecto"
npm install
```

### 2. Configurar variables de entorno
Copiar `.env.example` a `.env` y ajustar según necesidad:

```env
# Para pruebas (ya configurado)
WEBPAY_ENVIRONMENT=integration
WEBPAY_COMMERCE_CODE=597055555532

# Para producción (configurar con datos reales)
# WEBPAY_ENVIRONMENT=production
# WEBPAY_COMMERCE_CODE=tu_codigo_real
# WEBPAY_API_KEY=tu_api_key_real
```

### 3. Iniciar el servidor
```bash
npm run dev
```

El sistema estará disponible en: **http://localhost:3001**

## 💳 Webpay Plus - Datos de Prueba

### Tarjetas de Prueba (Ambiente Integración)
- **VISA**: `4051 8856 0000 0005`
- **Mastercard**: `5186 0595 5959 0568`
- **CVV**: Cualquier número (ej: 123)
- **Fecha**: Cualquier fecha futura

### Flujo de Pago
1. Portal Apoderados → Ingresar RUT y apellido
2. Seleccionar cuota pendiente → "💳 Pagar con Webpay"
3. Confirmar datos → Redirigir a Webpay real
4. Completar pago → Recibir boleta automática

## 🗑️ Eliminación de Alumnos

### Motivos Válidos
- **🚪 Retiro del estudiante**: El alumno se retiró durante el año escolar
- **❌ No se matriculó**: El alumno no completó su matrícula

### Proceso de Eliminación
1. Vista Administrativa → Botón "🗑️ Eliminar" en tabla de alumnos
2. Modal de confirmación → Seleccionar motivo obligatorio
3. Observaciones opcionales → Registro con fecha y hora
4. Confirmación final → Eliminación permanente

### Registro y Auditoría
- **📝 Historial completo**: Todas las eliminaciones quedan registradas
- **Datos preservados**: Se mantiene información del alumno eliminado
- **Trazabilidad**: Fecha, hora, motivo y observaciones
- **Acceso**: Botón "📝 Historial" en vista administrativa

⚠️ **Importante**: La eliminación es permanente y no se puede deshacer.

## 📁 Estructura del Proyecto

```
├── server.js           # Backend Express + Transbank SDK
├── script.js           # Frontend JavaScript
├── index.html          # Interfaz principal
├── styles.css          # Estilos CSS
├── alumnos_final.csv   # Datos de estudiantes
├── .env                # Variables de entorno
└── README.md           # Este archivo
```

## 🔐 Configuración para Producción

### 1. Obtener credenciales reales de Transbank
- Registrarse en [Transbank](https://www.transbank.cl)
- Obtener código de comercio y API Key
- Completar proceso de certificación

### 2. Actualizar variables de entorno
```env
WEBPAY_ENVIRONMENT=production
WEBPAY_COMMERCE_CODE=tu_codigo_real
WEBPAY_API_KEY=tu_api_key_real
BASE_URL=https://tu-dominio.cl
```

### 3. Configurar HTTPS
- El ambiente de producción requiere HTTPS
- Configurar certificados SSL válidos
- Actualizar URLs de retorno

## 📊 APIs Disponibles

### Crear Transacción
```bash
POST /api/webpay/create
{
  "ordenCompra": "CUOTA-123456789-1-1692547200000",
  "monto": 126500,
  "rutAlumno": "12.345.678-9",
  "numeroCuota": 1,
  "descripcion": "Cuota 1 - Juan Pérez"
}
```

### Estado del Servidor
```bash
GET /api/health
```

## 🎯 Características Técnicas

- **Backend**: Node.js + Express + Transbank SDK oficial
- **Frontend**: Vanilla JavaScript + Bootstrap 5
- **Persistencia**: localStorage (frontend) + Map (backend temporal)
- **PDFs**: jsPDF para boletas
- **Moneda**: Formateo chileno (CLP)
- **RUT**: Validación y formato chileno

## ⚠️ Notas Importantes

### Ambiente Integración
- ✅ Listo para usar inmediatamente
- ✅ Transacciones seguras con Transbank
- ✅ No se procesan pagos reales
- ✅ Ideal para pruebas y desarrollo

### Ambiente Producción
- ⚠️ Requiere certificación con Transbank
- ⚠️ Necesita HTTPS obligatorio
- ⚠️ Procesará pagos reales
- ⚠️ Cumplir normas PCI DSS

## 🆘 Soporte

### Logs del Servidor
```bash
# Ver logs en tiempo real
npm run dev

# Logs incluyen:
# - Creación de transacciones
# - Respuestas de Transbank  
# - Errores y debugging
```

### Debugging Frontend
- Abrir Developer Tools (F12)
- Revisar Console para logs de transacciones
- Network tab para revisar llamadas API

## 📞 Contacto Técnico

- **Transbank Soporte**: https://www.transbank.cl/soporte
- **Documentación SDK**: https://github.com/TransbankDevelopers/transbank-sdk-nodejs

---

## ✅ Estado del Proyecto

**🎉 COMPLETAMENTE FUNCIONAL**
- ✅ Integración real con Webpay Plus
- ✅ Backend Node.js con Transbank SDK oficial
- ✅ Frontend con experiencia de usuario completa
- ✅ Sistema de boletas PDF automático
- ✅ Manejo de abonos parciales
- ✅ Filtros dinámicos y estadísticas
- ✅ Ambiente de pruebas configurado
- ✅ Preparado para producción

**🚀 Listo para usar en ambiente de integración!**# leumag
