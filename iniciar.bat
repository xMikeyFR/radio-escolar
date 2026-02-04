@echo off
echo ================================================
echo   RADIO WEB ESCOLAR - INICIANDO SERVIDOR
echo ================================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no esta instalado!
    echo Por favor instala Node.js desde: https://nodejs.org/
    pause
    exit /b 1
)
echo    Instalado correctamente!
echo.

echo [2/3] Instalando dependencias (si es necesario)...
if not exist "node_modules" (
    echo    Instalando por primera vez...
    call npm install
) else (
    echo    Ya instaladas!
)
echo.

echo [3/3] Iniciando servidor...
echo.
echo ================================================
echo   SERVIDOR LISTO!
echo   Abre tu navegador en: http://localhost:3000
echo ================================================
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

node backend/server.js

pause
