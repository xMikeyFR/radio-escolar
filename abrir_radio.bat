@echo off
title SERVIDOR RADIO WEB
color 0A

echo ================================================
echo   INICIANDO TU RADIO WEB...
echo ================================================
echo.

cd /d "%~dp0"

:: 1. Verificar si Node existe
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo [ERROR] No tienes Node.js instalado.
    echo Descargalo aqui: https://nodejs.org/
    pause
    exit
)

:: 2. Instalar dependencias si faltan
if not exist "node_modules" (
    echo [INFO] Instalando dependencias necesarias...
    call npm install
)

:: 3. Abrir navegador automaticamente en 3 segundos
start "" "http://localhost:3001/frontend/index.html"

:: 4. Iniciar el servidor
echo.
echo [INFO] Abriendo tu radio en el navegador...
echo [INFO] ¡NO CIERRES ESTA VENTANA!
echo.
node backend/server.js

pause
