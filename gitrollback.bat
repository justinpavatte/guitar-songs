@echo off
setlocal
cd /d "%~dp0"
for %%I in ("%~dp0.") do set "REPO=%%~nxI"

git revert HEAD --no-edit
git push
ssh ha "cd /srv/www/%REPO% && git pull"

pause