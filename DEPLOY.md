# 部署指南：Vultr 东京服务器（中文）

English version: [DEPLOY.en.md](DEPLOY.en.md)

**方案：** 东京机房的一台 Ubuntu 服务器，**先用 IP 地址测试**，满意后再买域名、开 HTTPS。
服务器上是**全新的数据库**（本地数据只是测试数据，不上传）。产品照片在第一次启动前从电脑复制上去。

```
浏览器 ──► Caddy（80/443 端口，买域名后自动 HTTPS）──► Node 网站（127.0.0.1:3001）──► data/app.db + data/uploads/
```

下面的命令里，`服务器IP` 换成 Vultr 给你的 IP 地址。代码从公开仓库 https://github.com/aislandmin/canada-wine 下载。
标着 **【服务器】** 的命令在 SSH 登录服务器后执行；标着 **【电脑】** 的在你自己的 Windows PowerShell 里执行。

---

## 1. 创建服务器（Vultr 网站上操作）

1. 登录 vultr.com → **Deploy +** → **Deploy New Server**
2. 类型：**Cloud Compute – Shared CPU**（Regular 即可）
3. 机房位置：**Tokyo（东京）**
4. 系统：**Ubuntu 24.04 LTS x64**
5. 方案：最便宜的 **1 GB 内存** 方案（约 US$5–6/月）。不要选只有 IPv6 的方案。
6. 自动备份（Auto Backups）：可选，每月多约 US$1，建议开启（多一层保险）。
7. 点 **Deploy Now**。几分钟后在服务器详情页可以看到 **IP 地址** 和 **root 密码**。

## 2. 登录服务器

**【电脑】**
```powershell
ssh root@服务器IP
```
第一次会问 `Are you sure you want to continue connecting`，输入 `yes`，然后粘贴 root 密码（输入时不显示，正常）。

## 3. 安装基础软件

**【服务器】** 一段一段复制执行：
```bash
# 系统更新 + 工具
apt update && apt upgrade -y
apt install -y git sqlite3 ufw curl

# 时区（影响"今天"的日期和统计；如果你不在多伦多时区，换成你的城市，例如 America/Vancouver）
timedatectl set-timezone America/Toronto

# 防火墙：只开 SSH、80、443
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# 1GB 交换空间（防止 1GB 内存的服务器在构建网站时内存不够）
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v          # 应显示 v22.13 或更高

# Caddy（网站的"门口"，买域名后自动申请 HTTPS 证书）
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

## 4. 创建网站专用用户，并从 GitHub 下载代码

仓库是**公开**的，服务器可以直接下载，不需要密码或钥匙。

**【服务器】**
```bash
useradd -m -s /bin/bash wine
mkdir /opt/canada-wine && chown wine:wine /opt/canada-wine
sudo -u wine git clone https://github.com/aislandmin/canada-wine.git /opt/canada-wine
ls /opt/canada-wine          # 应看到 server、src、deploy 等文件夹
```

> 仓库公开，所以**永远不要**把密码、`data/` 文件夹或客户资料提交到 GitHub。
> `.gitignore` 已经挡住了 `data/`、`.env` 和 PDF，提交前用 `git status` 看一眼就更放心。

## 5. 复制产品照片到服务器（第一次启动之前）

**【服务器】**
```bash
sudo -u wine mkdir -p /opt/canada-wine/data/uploads
```

**【电脑】** 新开一个 PowerShell 窗口：
```powershell
cd "C:\Centennial College\canada-wine"
scp -r data\uploads\products root@服务器IP:/opt/canada-wine/data/uploads/
```

**【服务器】**
```bash
chown -R wine:wine /opt/canada-wine/data
ls /opt/canada-wine/data/uploads/products | wc -l     # 应显示 30
```

> 只复制照片文件夹，**不要**复制 `data\app.db`（本地是测试数据）。

## 6. 安装、构建、启动网站

**【服务器】**
```bash
cd /opt/canada-wine
sudo -u wine npm ci --include=dev
sudo -u wine npm run build
cp deploy/canada-wine.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now canada-wine
systemctl status canada-wine --no-pager      # 应显示 active (running)
```
第一次启动会自动建好数据库、9 个产品和分类，并按编号（01.jpg、01-2.jpg…）自动挂上照片。

## 7. 创建你的管理员账号

**【服务器】** 注意：命令**前面加一个空格**，这样密码不会被记录在命令历史里。用你**真实的邮箱**和一个**强密码**：
```bash
 cd /opt/canada-wine && sudo -u wine npm run create-admin -- --email 你的邮箱 --name 店主 --password "强密码"
```

## 8. 打开网站

**【服务器】**
```bash
cp /opt/canada-wine/deploy/Caddyfile /etc/caddy/Caddyfile
systemctl reload caddy
```
在浏览器打开 `http://服务器IP`，应该看到产品目录。

> ⚠️ **IP 测试阶段是 http（不加密）**，登录密码在网络上是明文传输。这个阶段只用来测试，
> **先不要邀请真实客户注册**；你自己的管理员密码测试完后，开了 HTTPS 再改一次（个人资料 → 修改密码）。

登录后检查：
- [ ] 产品目录和每个产品的照片都正常
- [ ] **No.06 的照片顺序**：服务器上默认是 06 → 06-2（奖牌）→ 06-3（礼盒）。如果要礼盒排第二，到 管理后台 → 产品 → No.06 → 照片 用 ↑↓ 调整
- [ ] 管理后台 → **网站设置**：填写**联系方式**文字
- [ ] 用另一个邮箱注册一个测试客户，录入一笔交易，看客户页面的累计和折扣是否正确，测试完可以在 客户 页面停用它

## 9. 测试中国大陆访问速度

- 打开 **17ce.com** 或 **ping.chinaz.com**，输入 `服务器IP`，看各省份的速度和丢包。
- **晚上 8–11 点（北京时间）** 再测一次——这是国际线路最拥挤的时候。
- 最好请一两位国内的朋友用**手机 4G/5G** 和**家里宽带**分别打开试试。
- 如果国内很慢：Vultr 可以在同一账户里换新加坡或首尔再试（新建服务器、重复本指南即可，旧的删掉就不再收费）。

## 10. 每日自动备份

**【服务器】**
```bash
chmod +x /opt/canada-wine/deploy/*.sh
bash /opt/canada-wine/deploy/backup.sh               # 先手动运行一次，确认成功
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/canada-wine/deploy/backup.sh >> /var/log/canada-wine-backup.log 2>&1") | crontab -
```
每天凌晨 3 点备份数据库和照片到 `/opt/canada-wine-backups/`，保留 14 天。

**建议每个月下载一份到自己电脑**（服务器整个坏掉时也不丢数据）。**【电脑】**
```powershell
mkdir "$HOME\Documents\wine-backups" -Force
scp root@服务器IP:/opt/canada-wine-backups/* "$HOME\Documents\wine-backups\"
```

## 11. 以后更新网站代码

1. 在电脑上改好代码、测试好，然后推送：`git push`
2. **【服务器】** `bash /opt/canada-wine/deploy/update.sh`

这个脚本会先自动备份，再下载新代码、构建、重启。`data/` 文件夹（数据库和照片）不会被改动。

## 12. 测试满意后：买域名 + 开 HTTPS

1. 买一个域名（建议 `.com`，在 Namecheap、Cloudflare、GoDaddy 等买都可以）。服务器在日本，**不需要 ICP 备案**。
2. 在域名的 DNS 设置里加两条 **A 记录**：`@` → `服务器IP`，`www` → `服务器IP`。等 10 分钟到几小时生效。
3. **【服务器】** 编辑 Caddy 配置：`nano /etc/caddy/Caddyfile`
   删掉 `:80 { ... }` 那一段，把下面那段注释（`#`）去掉，`example.com` 换成你的域名。
   保存：`Ctrl+O` 回车，退出：`Ctrl+X`。
4. **【服务器】** `systemctl reload caddy`
5. 打开 `https://你的域名`，看到小锁图标就成功了（证书会自动续期）。
6. 用 HTTPS 登录，**修改一次管理员密码**。之后就可以邀请客户注册了。

---

## 常见问题

| 情况 | 命令（服务器） |
|---|---|
| 看网站的运行日志 / 报错 | `journalctl -u canada-wine -n 50 --no-pager` |
| 重启网站 | `systemctl restart canada-wine` |
| 打开网站显示 502 | 网站没在运行：`systemctl status canada-wine` 看原因 |
| Caddy 的状态 / 证书问题 | `systemctl status caddy` 和 `journalctl -u caddy -n 50 --no-pager` |
| 管理员列表 / 停用管理员 | `cd /opt/canada-wine && sudo -u wine npm run admins` |
| 忘记管理员密码 | 用第 7 步同样的命令（同一个邮箱 + 新密码）会重设密码 |
| 从备份恢复 | `systemctl stop canada-wine` → 把备份的 `app_日期.db.gz` 解压（`gunzip`）后覆盖 `/opt/canada-wine/data/app.db` → `chown wine:wine` → `systemctl start canada-wine` |
