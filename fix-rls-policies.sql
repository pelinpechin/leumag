-- ==================================================
-- SCRIPT PARA CORREGIR POLÍTICAS RLS DE SUPABASE
-- Ejecutar en SQL Editor de Supabase
-- ==================================================

-- Opción 1: Desactivar RLS temporalmente para migración
ALTER TABLE alumnos DISABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas DISABLE ROW LEVEL SECURITY;
ALTER TABLE apoderados DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos DISABLE ROW LEVEL SECURITY;

-- ==================================================
-- POLÍTICAS SIMPLIFICADAS PARA DESARROLLO
-- ==================================================

-- Limpiar políticas existentes
DROP POLICY IF EXISTS "Admin full access" ON alumnos;
DROP POLICY IF EXISTS "Admin full access" ON cuotas;
DROP POLICY IF EXISTS "Apoderados own students" ON alumnos;
DROP POLICY IF EXISTS "Apoderados own students cuotas" ON cuotas;

-- Crear políticas simples que permitan todo por ahora
CREATE POLICY "Allow all operations" ON alumnos
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations" ON cuotas
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations" ON apoderados
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow all operations" ON pagos
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Reactivar RLS con políticas permisivas
ALTER TABLE alumnos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE apoderados ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;

-- ==================================================
-- VERIFICAR QUE FUNCIONA
-- ==================================================

-- Probar inserción de datos
INSERT INTO alumnos (rut, nombre, curso, arancel, beca, año_escolar) 
VALUES ('12.345.678-9', 'Test Usuario', '1 MEDIO A', 500000, 0, 2025)
ON CONFLICT (rut) DO NOTHING;

-- Si funciona, eliminar el registro de prueba
DELETE FROM alumnos WHERE rut = '12.345.678-9';

SELECT 'RLS configurado correctamente - listo para migración' as resultado;