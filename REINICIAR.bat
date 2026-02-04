@echo off
title REINICIAR RADIO - LIMPIO
color 0E

echo ================================================
echo   REINICIANDO SERVIDOR LIMPIO
echo ================================================
echo.

cd /d "%~dp0"

echo [1/3] Cerrando TODOS los servidores viejos...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo    Limpios!
echo.

echo [2/3] Iniciando servidor con musica NUEVA...
echo.
start /B node backend/server.js
timeout /t 3 /nobreak >nul
echo    Servidor iniciado!
echo.

echo [3/3] Abriendo en navegador...
start "" "http://localhost:3001/frontend/index.html"
echo.

echo ================================================
echo   LISTO! Ahora HAZ CLIC EN PLAY (boton morado)
echo ================================================
echo.
echo Presiona CTRL+C cuando quieras cerrar el servidor
echo.

:: Mantener ventana abierta
timeout /t 999999
