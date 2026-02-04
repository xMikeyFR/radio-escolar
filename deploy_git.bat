@echo off
echo ==========================================
echo    ACTUALIZANDO A MODO RADIO (AUTO)
echo ==========================================

echo 1. Guardando cambios...
git add .
git commit -m "Modo Radio: Sin barra de progreso + Autoplay agresivo"

echo 2. Subiendo a GitHub...
git push origin main

echo.
echo ==========================================
echo LISTO! Espera 2 minutos y recarga.
echo ==========================================
pause
