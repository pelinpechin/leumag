-- ==================================================
-- ESQUEMA DE BASE DE DATOS PARA SISTEMA DE TESORERÍA
-- ==================================================

-- 1. TABLA DE ALUMNOS
-- ==================================================
CREATE TABLE IF NOT EXISTS alumnos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rut VARCHAR(12) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    curso VARCHAR(50) NOT NULL,
    arancel INTEGER NOT NULL,
    beca INTEGER DEFAULT 0,
    monto_neto INTEGER GENERATED ALWAYS AS (arancel - beca) STORED,
    total_pagado INTEGER DEFAULT 0,
    pendiente INTEGER DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente',
    año_escolar INTEGER NOT NULL DEFAULT 2025,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABLA DE CUOTAS
-- ==================================================
CREATE TABLE IF NOT EXISTS cuotas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL CHECK (numero >= 1 AND numero <= 10),
    monto INTEGER NOT NULL DEFAULT 0,
    pagada BOOLEAN DEFAULT FALSE,
    fecha_vencimiento DATE,
    fecha_pago DATE,
    metodo_pago VARCHAR(50),
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para evitar duplicados
    UNIQUE(alumno_id, numero)
);

-- 3. TABLA DE APODERADOS
-- ==================================================
CREATE TABLE IF NOT EXISTS apoderados (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    nombre VARCHAR(255),
    email VARCHAR(255),
    telefono VARCHAR(20),
    relacion VARCHAR(50) DEFAULT 'apoderado', -- apoderado, madre, padre, tutor
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABLA DE PAGOS (HISTORIAL)
-- ==================================================
CREATE TABLE IF NOT EXISTS pagos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alumno_id UUID NOT NULL REFERENCES alumnos(id) ON DELETE CASCADE,
    cuota_id UUID REFERENCES cuotas(id) ON DELETE CASCADE,
    monto INTEGER NOT NULL,
    fecha_pago TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metodo_pago VARCHAR(50) NOT NULL, -- efectivo, transferencia, webpay, etc
    referencia VARCHAR(100), -- número de transferencia, etc
    usuario VARCHAR(100), -- quien registró el pago
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABLA DE USUARIOS (PARA AUTENTICACIÓN)
-- ==================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    rol VARCHAR(20) DEFAULT 'apoderado' CHECK (rol IN ('admin', 'tesorero', 'apoderado')),
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================
-- ÍNDICES PARA MEJORAR RENDIMIENTO
-- ==================================================

-- Índices en alumnos
CREATE INDEX IF NOT EXISTS idx_alumnos_rut ON alumnos(rut);
CREATE INDEX IF NOT EXISTS idx_alumnos_curso ON alumnos(curso);
CREATE INDEX IF NOT EXISTS idx_alumnos_estado ON alumnos(estado);
CREATE INDEX IF NOT EXISTS idx_alumnos_año ON alumnos(año_escolar);

-- Índices en cuotas
CREATE INDEX IF NOT EXISTS idx_cuotas_alumno_id ON cuotas(alumno_id);
CREATE INDEX IF NOT EXISTS idx_cuotas_numero ON cuotas(numero);
CREATE INDEX IF NOT EXISTS idx_cuotas_pagada ON cuotas(pagada);

-- Índices en apoderados
CREATE INDEX IF NOT EXISTS idx_apoderados_alumno_id ON apoderados(alumno_id);
CREATE INDEX IF NOT EXISTS idx_apoderados_email ON apoderados(email);

-- Índices en pagos
CREATE INDEX IF NOT EXISTS idx_pagos_alumno_id ON pagos(alumno_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha ON pagos(fecha_pago);

-- ==================================================
-- FUNCIONES Y TRIGGERS PARA ACTUALIZAR TOTALES
-- ==================================================

-- Función para actualizar totales del alumno
CREATE OR REPLACE FUNCTION actualizar_totales_alumno()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar total_pagado y pendiente del alumno
    UPDATE alumnos SET 
        total_pagado = (
            SELECT COALESCE(SUM(monto), 0) 
            FROM cuotas 
            WHERE alumno_id = COALESCE(NEW.alumno_id, OLD.alumno_id) 
            AND pagada = TRUE
        ),
        pendiente = monto_neto - (
            SELECT COALESCE(SUM(monto), 0) 
            FROM cuotas 
            WHERE alumno_id = COALESCE(NEW.alumno_id, OLD.alumno_id) 
            AND pagada = TRUE
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.alumno_id, OLD.alumno_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar totales cuando cambian las cuotas
CREATE OR REPLACE TRIGGER trigger_actualizar_totales_alumno
    AFTER INSERT OR UPDATE OR DELETE ON cuotas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_totales_alumno();

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE OR REPLACE TRIGGER trigger_alumnos_updated_at
    BEFORE UPDATE ON alumnos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE OR REPLACE TRIGGER trigger_cuotas_updated_at
    BEFORE UPDATE ON cuotas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

CREATE OR REPLACE TRIGGER trigger_apoderados_updated_at
    BEFORE UPDATE ON apoderados
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_updated_at();

-- ==================================================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ==================================================

-- Habilitar RLS en las tablas principales
ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE apoderados ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- Política para administradores (acceso completo)
CREATE POLICY "Admin full access" ON alumnos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.email = auth.email() 
            AND usuarios.rol IN ('admin', 'tesorero')
            AND usuarios.activo = TRUE
        )
    );

CREATE POLICY "Admin full access" ON cuotas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios 
            WHERE usuarios.email = auth.email() 
            AND usuarios.rol IN ('admin', 'tesorero')
            AND usuarios.activo = TRUE
        )
    );

-- Política para apoderados (solo sus hijos)
CREATE POLICY "Apoderados own students" ON alumnos
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM apoderados a
            JOIN usuarios u ON u.email = a.email
            WHERE a.alumno_id = alumnos.id 
            AND u.email = auth.email()
            AND u.activo = TRUE
        )
    );

CREATE POLICY "Apoderados own students cuotas" ON cuotas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM alumnos al
            JOIN apoderados a ON a.alumno_id = al.id
            JOIN usuarios u ON u.email = a.email
            WHERE al.id = cuotas.alumno_id 
            AND u.email = auth.email()
            AND u.activo = TRUE
        )
    );

-- ==================================================
-- DATOS DE EJEMPLO (OPCIONAL)
-- ==================================================

-- Insertar usuario admin de ejemplo
-- INSERT INTO usuarios (email, nombre, rol) 
-- VALUES ('admin@colegio.cl', 'Administrador Sistema', 'admin')
-- ON CONFLICT (email) DO NOTHING;

-- ==================================================
-- COMENTARIOS SOBRE EL ESQUEMA
-- ==================================================

COMMENT ON TABLE alumnos IS 'Información básica de los estudiantes matriculados';
COMMENT ON TABLE cuotas IS 'Cuotas mensuales por alumno (máximo 10 por año)';
COMMENT ON TABLE apoderados IS 'Información de contacto de apoderados';
COMMENT ON TABLE pagos IS 'Historial de pagos realizados';
COMMENT ON TABLE usuarios IS 'Usuarios del sistema con diferentes roles';

COMMENT ON COLUMN alumnos.monto_neto IS 'Calculado automáticamente como arancel - beca';
COMMENT ON COLUMN cuotas.numero IS 'Número de cuota del 1 al 10';
COMMENT ON COLUMN usuarios.rol IS 'admin, tesorero o apoderado';