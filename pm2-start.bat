@echo off
cd /d "D:\VT dashboard\VT-backend"
pm2 start src\server.js --name vt-backend
pm2 save
