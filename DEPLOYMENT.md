# Deployment

**URL:** https://on24.ansell.com  
**Host:** Azure VM `EUAZUON24` (Ubuntu 24.04 LTS) · Australia East · Resource Group `rg-on24-dashboard`  
**Access:** Corporate VPN / Ansell office network only (NSG blocks internet)

## Architecture

```
User (VPN/office)
  ↓
Azure NSG — AllowVnetInBound only (port 443)
  ↓
Nginx :443 — HTTPS + Ansell wildcard SSL  (/etc/nginx/sites-available/on24)
  ↓
oauth2-proxy :4180 — Azure AD authentication
  ↓
on24-dashboard :8080 — Next.js app (bound to 127.0.0.1 only)
  ↓            ↓
Redis         ~/reports/  — xlsx files (host volume, persists across container restarts)
(sessions)
```

**Docker network:** `on24-net` (internal bridge — containers communicate by name)

## Running containers

| Name | Port binding | Purpose |
|---|---|---|
| `on24-dashboard` | `127.0.0.1:8080→8080` | Next.js app |
| `oauth2-proxy` | `0.0.0.0:4180→4180` | Azure AD auth |
| `redis` | `6379` (internal only) | Session storage |

## Azure AD (Entra ID)

| Setting | Value |
|---|---|
| App Registration | `on24-dashboard-auth` |
| Client ID | `783bab4f-2cc4-471c-95c2-b46c163c3cd2` |
| Redirect URI | `https://on24.ansell.com/oauth2/callback` |
| Account type | Single tenant (Ansell only — `@ansell.com`) |
| Secret created | ~2026-04-25 |
| Secret expiry | 24 months → renew by ~2028-04-25 |
| Session storage | Redis |
| Session duration | 168 hours (7 days) |

**Auth flow:** User → Nginx → oauth2-proxy checks Redis session → if none, redirect to Microsoft login → Azure AD validates `@ansell.com` + group assignment → session saved in Redis → redirect to `/insights`.

**Manage user access:** Entra ID → Enterprise Applications → `on24-dashboard-auth` → Users and Groups

## Key file locations on VM

| Path | Contents |
|---|---|
| `/etc/nginx/sites-available/on24` | Nginx config |
| `/etc/nginx/ssl/wildcard.crt` | SSL certificate |
| `/etc/nginx/ssl/wildcard.key` | SSL private key |
| `/var/www/html/logo.svg` | Ansell logo (login page) |
| `~/.env.local` | On24 API credentials |
| `~/reports/` | Uploaded xlsx files (Revenue & Marketo) |

## Nginx config

```nginx
server {
    listen 80;
    server_name on24.ansell.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name on24.ansell.com;

    ssl_certificate /etc/nginx/ssl/wildcard.crt;
    ssl_certificate_key /etc/nginx/ssl/wildcard.key;

    location = /logo.svg {
        root /var/www/html;
    }

    location / {
        proxy_pass http://localhost:4180;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Maintenance

**View logs:**
```bash
docker logs on24-dashboard --tail 50
docker logs oauth2-proxy --tail 50
```

**Restart services:**
```bash
docker restart on24-dashboard
docker restart oauth2-proxy
sudo systemctl restart nginx
```

**Monthly OS update:**
```bash
sudo apt update && sudo apt upgrade -y
```

**Build the image locally** (run from project root, requires Docker Desktop):
```bash
docker build -t on24-dashboard:local .
docker save on24-dashboard:local -o on24-dashboard.tar
```
Then transfer `on24-dashboard.tar` to the VM via WinSCP (`/home/on24admin/`).

**Deploy a new app version** (on the VM, after transferring the tar):
```bash
docker stop on24-dashboard && docker rm on24-dashboard
docker load < on24-dashboard.tar
docker run -d --name on24-dashboard \
  --env-file ~/.env.local \
  --restart always \
  --network on24-net \
  -e HOSTNAME=0.0.0.0 \
  -p 127.0.0.1:8080:8080 \
  -v /home/on24admin/reports:/app/reports \
  on24-dashboard:local
```

**Renew Azure AD client secret** (every 24 months):  
Entra ID → App Registrations → `on24-dashboard-auth` → Certificates & Secrets → + New client secret  
Then recreate the `oauth2-proxy` container with the new `CLIENT_SECRET`.

## Deployment issues resolved

| Issue | Root cause | Fix |
|---|---|---|
| Docker install failed | Corporate proxy blocking curl | Used `apt install docker.io` instead |
| On24 API fetch failed | Corporate proxy blocking outbound | Configured `HTTPS_PROXY` |
| oauth2-proxy cookie >4KB | Azure AD JWT token too large | Added Redis session store |
| 502 after auth | Next.js bound to localhost only | Added `-e HOSTNAME=0.0.0.0` |
| Script line continuation | Windows paste breaks `\` in bash | Used variables in script |
| xlsx upload not persisting | No persistent volume | Mounted `~/reports` host volume |
