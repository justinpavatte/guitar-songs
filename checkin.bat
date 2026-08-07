@echo off
cd /d C:\code\guitar-songs

set "COMMENT="
set /p "COMMENT=Commit comment (Enter for Generic check in.): "

if not defined COMMENT set "COMMENT=Generic check in."

git add .
git commit -m "%COMMENT%"
git push
ssh ha "cd /srv/www/guitar-songs && git pull"

pause