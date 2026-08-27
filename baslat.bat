@echo off
title DJS Team Bot V2 (Anti-Crash)
color 0b
echo ==========================================
echo    Moduller Yukleniyor (Discord.js)...
echo ==========================================
call npm install
cls
:loop
echo ==========================================
echo    DJS Bot Baslatiliyor...
echo ==========================================
node index.js
echo ==========================================
echo    [UYARI] Bot kapandi veya coktu!
echo    5 saniye icinde yeniden baslatiliyor...
echo ==========================================
timeout /t 5
goto loop