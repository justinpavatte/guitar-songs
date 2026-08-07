cd /d C:\code\guitar-songs
git add .
git commit -m "Generic check in."
git push
ssh ha "cd /srv/www/guitar-songs && git pull"