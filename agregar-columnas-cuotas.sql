-- Script para agregar columnas de cuotas individuales a la tabla alumnos
-- Ejecutar este script en Supabase SQL Editor

-- Agregar las columnas de cuotas (cuota_1 a cuota_10)
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS cuota_1 INTEGER DEFAULT 0;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS cuota_2 INTEGER DEFAULT 0;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS cuota_3 INTEGER DEFAULT 0;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS cuota_4 INTEGER DEFAULT 0;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS cuota_5 INTEGER DEFAULT 0;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS cuota_6 INTEGER DEFAULT 0;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS cuota_7 INTEGER DEFAULT 0;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS cuota_8 INTEGER DEFAULT 0;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS cuota_9 INTEGER DEFAULT 0;
ALTER TABLE alumnos ADD COLUMN IF NOT EXISTS cuota_10 INTEGER DEFAULT 0;

-- Agregar comentarios para claridad
COMMENT ON COLUMN alumnos.cuota_1 IS 'Monto pagado en la cuota 1';
COMMENT ON COLUMN alumnos.cuota_2 IS 'Monto pagado en la cuota 2';
COMMENT ON COLUMN alumnos.cuota_3 IS 'Monto pagado en la cuota 3';
COMMENT ON COLUMN alumnos.cuota_4 IS 'Monto pagado en la cuota 4';
COMMENT ON COLUMN alumnos.cuota_5 IS 'Monto pagado en la cuota 5';
COMMENT ON COLUMN alumnos.cuota_6 IS 'Monto pagado en la cuota 6';
COMMENT ON COLUMN alumnos.cuota_7 IS 'Monto pagado en la cuota 7';
COMMENT ON COLUMN alumnos.cuota_8 IS 'Monto pagado en la cuota 8';
COMMENT ON COLUMN alumnos.cuota_9 IS 'Monto pagado en la cuota 9';
COMMENT ON COLUMN alumnos.cuota_10 IS 'Monto pagado en la cuota 10';

-- Función para recalcular total_pagado basado en las cuotas
CREATE OR REPLACE FUNCTION recalcular_total_pagado()
RETURNS TRIGGER AS $$
BEGIN
    NEW.total_pagado = COALESCE(NEW.cuota_1, 0) + COALESCE(NEW.cuota_2, 0) + COALESCE(NEW.cuota_3, 0) + 
                       COALESCE(NEW.cuota_4, 0) + COALESCE(NEW.cuota_5, 0) + COALESCE(NEW.cuota_6, 0) + 
                       COALESCE(NEW.cuota_7, 0) + COALESCE(NEW.cuota_8, 0) + COALESCE(NEW.cuota_9, 0) + 
                       COALESCE(NEW.cuota_10, 0);
    
    -- Recalcular pendiente
    NEW.pendiente = COALESCE(NEW.arancel, 0) - COALESCE(NEW.beca, 0) - NEW.total_pagado;
    
    -- Actualizar estado basado en el pendiente
    IF NEW.pendiente <= 0 THEN
        NEW.estado = 'Pagado';
    ELSIF NEW.total_pagado > 0 THEN
        NEW.estado = 'Pagando';
    ELSE
        NEW.estado = 'Pendiente';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para recalcular automáticamente cuando se actualicen las cuotas
DROP TRIGGER IF EXISTS trigger_recalcular_total ON alumnos;
CREATE TRIGGER trigger_recalcular_total
    BEFORE UPDATE ON alumnos
    FOR EACH ROW
    EXECUTE FUNCTION recalcular_total_pagado();

-- También aplicar al insertar nuevos registros
DROP TRIGGER IF EXISTS trigger_recalcular_total_insert ON alumnos;
CREATE TRIGGER trigger_recalcular_total_insert
    BEFORE INSERT ON alumnos
    FOR EACH ROW
    EXECUTE FUNCTION recalcular_total_pagado();