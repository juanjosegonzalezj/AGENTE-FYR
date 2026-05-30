@echo off
title Find Your Rival - Servidor IA
color 0A

cd /d "%~dp0"
echo.
echo  ================================================
echo    FIND YOUR RIVAL - Servidor IA + WhatsApp
echo  ================================================
echo  Carpeta: %CD%
echo  ================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js no esta instalado o no esta en el PATH.
  echo Descargalo en https://nodejs.org
  pause
  exit /b 1
)

echo Node.js encontrado:
node --version

if not exist "node_modules" (
  echo.
  echo Instalando dependencias por primera vez...
  npm install
)

echo.
echo Iniciando servidor... El QR de WhatsApp aparecera abajo.
echo Para detener: Ctrl + C
echo.

node_modules\.bin\tsx.cmd server.ts

echo.
echo El servidor se detuvo.
pause
