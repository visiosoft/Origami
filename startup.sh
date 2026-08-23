#!/bin/bash
# NOTE: Azure App Service does not run this file — the startup command is
# configured on the App Service itself. Setting environment variables here has
# no effect; use the portal's Application Settings instead. Kept because the
# deployment references it.
#
# AUTH_AUDIT=1 makes the auth guard log what it would have rejected instead of
# rejecting it. Absent means enforce, which is the deployed state.
cd /home/site/wwwroot/backend && npm install --legacy-peer-deps --omit=dev 2>/dev/null
cd /home/site/wwwroot && node backend/dist/main.js
