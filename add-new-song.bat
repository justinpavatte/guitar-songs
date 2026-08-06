cd /d C:\code\guitar-songs
git add .
git commit -m "Add new songs"
git push
ssh ha "cd /srv/www/guitar-songs && git pull"
pause