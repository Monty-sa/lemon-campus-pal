@echo off
setlocal
cd /d "D:\Projects\your pal lemon"
node "node_modules\tsx\dist\cli.mjs" "scripts\kfu-worker.ts" >> "logs\kfu-worker.log" 2>&1
exit /b %ERRORLEVEL%
