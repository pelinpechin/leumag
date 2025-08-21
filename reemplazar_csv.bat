@echo off
cd "C:\Users\HP\Desktop\Proyecto"
echo Reemplazando archivo CSV...
copy alumnos_final.csv alumnos_final_respaldo.csv
copy alumnos_final_nuevo.csv alumnos_final.csv
echo ✅ Archivo CSV reemplazado exitosamente
echo 📊 Alumnos ahora: 862 (eliminado 1 duplicado)
echo 🔧 Cambios realizados:
echo    - Eliminada: Angelina del 1 MEDIO C
echo    - Cambiada: Angelina del 1 MEDIO A → 1 MEDIO C
pause