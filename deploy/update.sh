#!/usr/bin/env bash
# Pull the newest code from GitHub, rebuild and restart. The data/ folder is never touched.
# Run as root:  bash /opt/canada-wine/deploy/update.sh
set -euo pipefail

APP=/opt/canada-wine
cd "$APP"

# Safety first: back up before changing anything (a code update may migrate the database).
bash "$APP/deploy/backup.sh"

sudo -u wine git pull --ff-only
sudo -u wine npm ci --include=dev
sudo -u wine npm run build
systemctl restart canada-wine
sleep 3
systemctl --no-pager --lines=5 status canada-wine
