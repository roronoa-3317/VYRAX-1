@echo off
cd /d "%~dp0"
start "VYRAX backend" "C:\Program Files\nodejs\node.exe" server.js
echo.
echo  Starting public tunnel... The free link appears below in a few seconds.
echo  Keep this window open while sharing. Close it to stop the tunnel.
echo  The backend window can be closed separately.
echo.
cloudflared.exe tunnel --url http://localhost:4711
pause
