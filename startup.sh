#!/bin/bash
cd /home/site/wwwroot/backend && npm install --legacy-peer-deps --omit=dev 2>/dev/null
cd /home/site/wwwroot && node backend/dist/main.js
