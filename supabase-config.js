// Configuración de Supabase
// IMPORTANTE: Ve a https://supabase.com y crea un nuevo proyecto
// Luego reemplaza estas URLs con las de tu proyecto

console.log('📋 Cargando supabase-config.js...');

const SUPABASE_CONFIG = {
    url: 'https://iajcxlymwqeltfmedmkj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhamN4bHltd3FlbHRmbWVkbWtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYyMzM2MjYsImV4cCI6MjA3MTgwOTYyNn0.tOOiZglUQ5m1xXDLsjxux5HSNQ7AtRk_Hr1Ntdu03yk'
};

// Solo inicializar si tenemos las credenciales reales
let supabase = null;

// Función para inicializar Supabase
function initializeSupabase() {
    if (typeof window !== 'undefined' && window.supabase) {
        try {
            supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log('✅ Supabase inicializado correctamente');
            console.log('🔗 URL:', SUPABASE_CONFIG.url);
            console.log('🔑 Key configurada:', SUPABASE_CONFIG.anonKey ? 'Sí' : 'No');
            
            // Actualizar referencia global
            window.supabaseClient = supabase;
            
            // Probar conexión
            testSupabaseConnection();
            
            return true;
        } catch (error) {
            console.error('❌ Error inicializando Supabase:', error);
            supabase = null;
            window.supabaseClient = null;
            return false;
        }
    } else {
        console.error('❌ Supabase no se cargó desde CDN');
        return false;
    }
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Iniciando carga de Supabase...');
    console.log('📦 window.supabase disponible:', !!window.supabase);
    
    // Esperar a que Supabase se cargue desde el CDN
    setTimeout(() => {
        console.log('⏰ Timeout - verificando Supabase...');
        console.log('📦 window.supabase ahora:', !!window.supabase);
        if (window.supabase) {
            console.log('🎯 Supabase detectado, inicializando...');
            initializeSupabase();
        } else {
            console.error('❌ Supabase no se cargó desde CDN después de 500ms');
            // Intentar de nuevo en 2 segundos
            setTimeout(() => {
                console.log('🔄 Reintentando inicialización...');
                if (window.supabase) {
                    initializeSupabase();
                } else {
                    console.error('❌ Supabase definitivamente no disponible');
                    mostrarEstadoSupabase(false);
                }
            }, 2000);
        }
    }, 500);
});

// También intentar inicializar cuando se llame desde otras funciones
window.initializeSupabase = initializeSupabase;

// Función para probar la conexión
async function testSupabaseConnection() {
    if (!supabase) return;
    
    try {
        console.log('🧪 Probando conexión a Supabase...');
        
        // Intentar hacer una consulta simple para probar la conexión
        const { data, error } = await supabase
            .from('alumnos')
            .select('*')
            .limit(1);
        
        // Si hay error pero no es de tabla vacía o permisos, es problema de conexión
        if (error) {
            console.log('ℹ️ Respuesta de Supabase:', error.message);
            // Si es error de tabla vacía o permisos, la conexión funciona
            if (error.code === 'PGRST116' || error.message.includes('permission') || error.message.includes('relation') || error.message.includes('does not exist')) {
                console.log('✅ Conexión OK - Tabla vacía o nueva');
            } else {
                console.warn('⚠️ Error de conexión:', error.message);
                mostrarEstadoSupabase(false);
                return false;
            }
        }
        
        console.log('✅ Conexión a Supabase exitosa');
        mostrarEstadoSupabase(true);
        return true;
        
    } catch (error) {
        console.error('❌ Error probando conexión:', error);
        mostrarEstadoSupabase(false);
        return false;
    }
}

window.testSupabaseConnection = testSupabaseConnection;

// Función para verificar si Supabase está disponible
function isSupabaseReady() {
    // Intentar inicializar si no está disponible
    if (!supabase && !window.supabaseClient && window.supabase) {
        initializeSupabase();
    }
    return supabase !== null || window.supabaseClient !== null;
}

// Función para mostrar estado de conexión con Supabase
function mostrarEstadoSupabase(conectado) {
    // Crear o actualizar indicador
    let indicador = document.getElementById('indicadorSupabase');
    
    if (!indicador) {
        indicador = document.createElement('div');
        indicador.id = 'indicadorSupabase';
        indicador.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            padding: 8px 15px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            z-index: 1000;
            transition: all 0.3s ease;
        `;
        document.body.appendChild(indicador);
    }

    if (conectado) {
        indicador.innerHTML = '🟢 Supabase Conectado';
        indicador.style.backgroundColor = '#d4edda';
        indicador.style.color = '#155724';
        indicador.style.border = '1px solid #c3e6cb';
    } else {
        indicador.innerHTML = '🟡 Modo Local';
        indicador.style.backgroundColor = '#fff3cd';
        indicador.style.color = '#856404';
        indicador.style.border = '1px solid #ffeaa7';
    }
}

// Exportar configuración
window.SUPABASE_CONFIG = SUPABASE_CONFIG;
window.supabaseClient = supabase;
window.isSupabaseReady = isSupabaseReady;
window.mostrarEstadoSupabase = mostrarEstadoSupabase;