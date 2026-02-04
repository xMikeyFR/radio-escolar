@echo off
echo ==========================================
echo        ACTUALIZANDO PAGINA WEB
echo ==========================================

echo 1. Guardando cambios...
git add .
git commit -m "Correccion de ruta y archivos perdidos"

echo 2. Subiendo a la nube...
echo (Si te pide login, ya sabes que hacer)
git push origin main

echo.
echo ==========================================
echo LISTO! Espera 2 minutos y recarga la pagina
echo ==========================================
pause
