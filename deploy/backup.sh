#!/usr/bin/env bash
# Daily backup of the database and product photos. Keeps the last 14 days.
# Run as root. Cron (3 a.m. every day):
#   0 3 * * * /opt/canada-wine/deploy/backup.sh >> /var/log/canada-wine-backup.log 2>&1
set -euo pipefail

APP=/opt/canada-wine
OUT=/opt/canada-wine-backups
KEEP_DAYS=14
STAMP=$(date +%F_%H%M)

mkdir -p "$OUT"
# .backup makes a consistent copy even while the website is running
sqlite3 "$APP/data/app.db" ".backup '$OUT/app_$STAMP.db'"
gzip "$OUT/app_$STAMP.db"
tar -czf "$OUT/uploads_$STAMP.tar.gz" -C "$APP/data" uploads

find "$OUT" -type f -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') backup ok: $OUT/*_$STAMP.*"
