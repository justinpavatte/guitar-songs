@echo off
setlocal
cd /d "%~dp0"
for %%I in ("%~dp0.") do set "REPO=%%~nxI"

git add .
git commit -m "no comment"
git push
ssh ha "cd /srv/www/%REPO% && git pull"

pause