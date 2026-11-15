# Deployment guide: Vultr Tokyo server (English)

中文版：[DEPLOY.md](DEPLOY.md)

**Plan:** one Ubuntu server in Vultr's Tokyo region. **Test by IP address first**; buy a domain and turn on HTTPS once you're happy.
The server starts with a **fresh database** (local data is test data and is not uploaded). Product photos are copied from your PC before the first start.

```
browser ──► Caddy (ports 80/443, automatic HTTPS once you have a domain) ──► Node app (127.0.0.1:3001) ──► data/app.db + data/uploads/
```

Replace `SERVER_IP` with the IP Vultr gives you and `YOUR_GITHUB_USER` with your GitHub username.
**[server]** commands run after you SSH into the server; **[PC]** commands run in Windows PowerShell on your own computer.

---

## 1. Create the server (on vultr.com)

1. **Deploy +** → **Deploy New Server**
2. Type: **Cloud Compute – Shared CPU** (Regular is fine)
3. Location: **Tokyo**
4. OS: **Ubuntu 24.04 LTS x64**
5. Plan: the cheapest **1 GB RAM** plan (about US$5–6/month). Not an IPv6-only plan.
6. Auto Backups: optional, about US$1/month extra; recommended as an extra safety net.
7. **Deploy Now**. After a few minutes the server page shows its **IP address** and **root password**.

## 2. Log in

**[PC]**
```powershell
ssh root@SERVER_IP
```
Type `yes` at the first-connection question, then paste the root password (nothing is shown while typing; that's normal).

## 3. Install the basics

**[server]** Copy and run one block at a time:
```bash
apt update && apt upgrade -y
apt install -y git sqlite3 ufw curl

# Time zone (affects "today" and statistics; use your city, e.g. America/Vancouver, if not Toronto)
timedatectl set-timezone America/Toronto

# Firewall: SSH, 80, 443 only
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# 1 GB swap so the 1 GB server doesn't run out of memory while building
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v          # should be v22.13 or newer

# Caddy (web server in front of the app; gets HTTPS certificates automatically)
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

## 4. Create the app user and download the code from GitHub

The repo is **private**, so give the server a read-only deploy key.

**[server]**
```bash
useradd -m -s /bin/bash wine
sudo -u wine ssh-keygen -t ed25519 -N "" -f /home/wine/.ssh/id_ed25519
cat /home/wine/.ssh/id_ed25519.pub
```
Copy the printed line (starts with `ssh-ed25519`). On GitHub: repo → **Settings** → **Deploy keys** → **Add deploy key** → Title `vultr`, paste the key, leave **Allow write access unchecked** → **Add key**.

**[server]**
```bash
mkdir /opt/canada-wine && chown wine:wine /opt/canada-wine
sudo -u wine git clone git@github.com:YOUR_GITHUB_USER/canada-wine.git /opt/canada-wine
```
(type `yes` at the host-key question)

## 5. Copy the product photos (before the first start)

**[server]**
```bash
sudo -u wine mkdir -p /opt/canada-wine/data/uploads
```

**[PC]** in a new PowerShell window:
```powershell
cd "C:\Centennial College\canada-wine"
scp -r data\uploads\products root@SERVER_IP:/opt/canada-wine/data/uploads/
```

**[server]**
```bash
chown -R wine:wine /opt/canada-wine/data
ls /opt/canada-wine/data/uploads/products | wc -l     # should print 30
```

> Copy only the photos folder. **Don't** copy `data\app.db` (it's test data).

## 6. Install, build, start

**[server]**
```bash
cd /opt/canada-wine
sudo -u wine npm ci --include=dev
sudo -u wine npm run build
cp deploy/canada-wine.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now canada-wine
systemctl status canada-wine --no-pager      # should say active (running)
```
The first start creates the database, the 9 products and categories, and links the photos by catalog number (01.jpg, 01-2.jpg, …).

## 7. Create your admin account

**[server]** Start the command with **a space** so the password isn't saved in shell history. Use your **real email** and a **strong password**:
```bash
 cd /opt/canada-wine && sudo -u wine npm run create-admin -- --email YOUR_EMAIL --name 店主 --password "STRONG_PASSWORD"
```

## 8. Open the site

**[server]**
```bash
cp /opt/canada-wine/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```
Open `http://SERVER_IP` in a browser; you should see the product catalogue.

> ⚠️ **The IP stage is plain http**: passwords travel unencrypted. Use it for testing only and
> **don't invite real customers yet**. Change your admin password again after HTTPS is on (个人资料 → 修改密码).

Checklist after logging in:
- [ ] Catalogue and every product's photos look right
- [ ] **No.06 photo order**: on the server it defaults to 06 → 06-2 (medals) → 06-3 (gift box). To put the gift box second, use ↑↓ in 管理后台 → 产品 → No.06 → photos
- [ ] 管理后台 → **网站设置**: fill in the **contact** text
- [ ] Sign up a test customer with another email, record a transaction, check the customer's totals and discount; disable it afterwards on the 客户 page

## 9. Test speed from mainland China

- Use **17ce.com** or **ping.chinaz.com** with `SERVER_IP` to see speed and packet loss by province.
- Test again **8–11 p.m. Beijing time**, when international links are busiest.
- Ideally ask a friend in China to try on **mobile data** and **home broadband**.
- If China is slow: create a server in Singapore or Seoul in the same Vultr account and repeat this guide (delete the old one and its billing stops).

## 10. Daily automatic backup

**[server]**
```bash
chmod +x /opt/canada-wine/deploy/*.sh
bash /opt/canada-wine/deploy/backup.sh               # run once by hand to make sure it works
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/canada-wine/deploy/backup.sh >> /var/log/canada-wine-backup.log 2>&1") | crontab -
```
Every day at 3 a.m. the database and photos are saved to `/opt/canada-wine-backups/`, kept for 14 days.

**Download a copy to your PC once a month** (protects you if the whole server is lost). **[PC]**
```powershell
mkdir "$HOME\Documents\wine-backups" -Force
scp root@SERVER_IP:/opt/canada-wine-backups/* "$HOME\Documents\wine-backups\"
```

## 11. Updating the code later

1. Change and test the code on your PC, then `git push`
2. **[server]** `bash /opt/canada-wine/deploy/update.sh`

The script backs up first, then pulls, builds and restarts. The `data/` folder (database and photos) is never touched.

## 12. When testing is done: domain + HTTPS

1. Buy a domain (`.com` recommended; Namecheap, Cloudflare, GoDaddy, …). The server is in Japan, so **no ICP filing** is needed.
2. In the domain's DNS settings add two **A records**: `@` → `SERVER_IP` and `www` → `SERVER_IP`. Wait 10 minutes to a few hours.
3. **[server]** `nano /etc/caddy/Caddyfile`: delete the `:80 { ... }` block, uncomment the block below it (remove the `#`s) and replace `example.com` with your domain. Save with `Ctrl+O` Enter, exit with `Ctrl+X`.
4. **[server]** `systemctl reload caddy`
5. Open `https://your-domain`; the padlock means it worked (certificates renew automatically).
6. Log in over HTTPS and **change your admin password once**. Now you can invite customers.

---

## Troubleshooting

| Situation | Command (server) |
|---|---|
| App logs / errors | `journalctl -u canada-wine -n 50 --no-pager` |
| Restart the app | `systemctl restart canada-wine` |
| Browser shows 502 | App isn't running: `systemctl status canada-wine` |
| Caddy status / certificate problems | `systemctl status caddy` and `journalctl -u caddy -n 50 --no-pager` |
| List / disable admins | `cd /opt/canada-wine && sudo -u wine npm run admins` |
| Forgot admin password | Run the step 7 command again (same email + new password) |
| Restore from backup | `systemctl stop canada-wine` → `gunzip` the `app_DATE.db.gz` and copy it over `/opt/canada-wine/data/app.db` → `chown wine:wine` it → `systemctl start canada-wine` |
