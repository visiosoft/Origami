#!/bin/bash
cd /home/site/wwwroot/backend && npm install --legacy-peer-deps --omit=dev 2>/dev/null

# Auth rollout, stage 1 of 2: the guard logs what it would have rejected and
# lets it through, so a missed route shows up in the log instead of breaking the
# app. Delete this line to enforce -- absent means enforce, so the secure state
# is the default and this is the deliberate exception.
export AUTH_AUDIT=1

cd /home/site/wwwroot && node backend/dist/main.js
