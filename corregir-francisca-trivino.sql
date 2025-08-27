-- Corregir el arancel de FRANCISCA TRIVINO
-- El arancel debe ser $1.016.200 según el CSV, no $812.960

UPDATE alumnos SET 
    arancel = 1016200,
    updated_at = NOW()
WHERE rut = '23.437.771-K' AND nombre = 'TRIVINO OJEDA FRANCISCA';

-- Esto hará que el trigger recalcule automáticamente:
-- pendiente = 1016200 - 0 - 1016200 = 0
-- estado = 'Pagado' (porque pendiente = 0)