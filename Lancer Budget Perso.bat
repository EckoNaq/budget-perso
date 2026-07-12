@echo off
chcp 65001 >nul
title Budget Perso
cd /d "%~dp0"

echo ============================================
echo    Budget Perso - demarrage
echo ============================================
echo.

REM Installe les dependances au tout premier lancement
if not exist node_modules (
  echo Premier lancement : installation des dependances...
  call npm install
)

REM Construit l'application si ce n'est pas deja fait
if not exist dist\index.html (
  echo Construction de l'application...
  call npm run build
)

echo.
echo La page va s'ouvrir dans ton navigateur.
echo GARDE CETTE FENETRE OUVERTE tant que tu utilises l'appli.
echo Ferme-la quand tu as fini.
echo.

REM Sert l'appli sur http://localhost:5180 et ouvre le navigateur
call npm run preview -- --port 5180 --strictPort --open

pause
