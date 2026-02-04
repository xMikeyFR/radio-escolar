@echo off
echo ==========================================
echo    PREPARANDO SUBIDA A GITHUB (INTENTO 3)
echo ==========================================

echo 1. Inicializando Git...
git init

echo 1.5 Configurando usuario temporal de Git...
git config user.email "radio@escolar.com"
git config user.name "Radio Escolar"

git add .
git commit -m "Mi Radio Web Lista"

echo 2. Conectando con GitHub...
git branch -M main
git remote remove origin
git remote add origin https://github.com/xMikeyFR/radio-escolar.git

echo 3. Subiendo archivos...
echo (Si te pide login, usa tu cuenta de GitHub)
git push -u origin main

echo.
echo ==========================================
echo Ojala ahora si :)
echo ==========================================
pause
