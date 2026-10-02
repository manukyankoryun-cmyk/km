# KM Desktop — LAN Client-Server Setup Guide

## Architecture

```
┌──────────────────── SERVER PC (Hub) ────────────────────┐
│  KM Desktop + updateServer=true                         │
│  HTTP  :18094  (km_net.js — file transfer, sync API)    │
│  UDP   :18095  (peer discovery)                         │
│  WS    :18096  (real-time file-changed events)          │
│  Bind  : 0.0.0.0 (all interfaces)                      │
│  UserData: %LOCALAPPDATA%\KM\UserData                   │
└───────────────────────────┬─────────────────────────────┘
                            │ LAN (Wi‑Fi / Ethernet)
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   Client PC 1          Client PC 2          Client PC N
   role=client         role=client         role=client
   SERVER_URL          SERVER_URL          SERVER_URL
   auto-reconnect      auto-reconnect      auto-reconnect
```

### Sync flow

1. **Client** changes a file (Library, photos, `database_snapshot.json`, …)
2. **File watcher** detects change → **POST** `/km/sync/push` → **Server**
3. **Server** saves file → **WebSocket broadcast** `file-changed` to all clients
4. **Other clients** receive event → **GET** `/km/sync/file?rel=…` → local UserData
5. **Schedule DB** (`KM_SYNC.json`) continues via existing `kmNetShareDbAfterSave` pipeline

### Key files

| File | Role |
|------|------|
| `app/km_net.js` | HTTP/UDP peer transfer (existing) |
| `app/km_lan_sync.js` | WebSocket + file watcher + sync API |
| `app/km_lan_config.json` | Client/server URL config (in UserData) |
| `app/js/km-lan-client.js` | Renderer auto-reconnect + UI hooks |
| `app/js/km-net-ui.js` | Network UI (enable Hub server) |

---

## Step 1 — Server: Static IP (Windows)

### Option A — GUI

1. **Settings → Network & Internet → Ethernet/Wi‑Fi → IP assignment → Edit**
2. Set **Manual**, IPv4 **On**
3. Example:
   - IP address: `192.168.1.100`
   - Subnet mask: `255.255.255.0`
   - Gateway: `192.168.1.1`
   - DNS: `192.168.1.1` (or `8.8.8.8`)
4. Save

### Option B — PowerShell (Administrator)

```powershell
# Replace interface name, IP, gateway
$if = "Ethernet"
New-NetIPAddress -InterfaceAlias $if -IPAddress 192.168.1.100 -PrefixLength 24 -DefaultGateway 192.168.1.1
Set-DnsClientServerAddress -InterfaceAlias $if -ServerAddresses 192.168.1.1
```

Or run: `app\scripts\setup-lan-server.ps1 -StaticIp 192.168.1.100`

---

## Step 2 — Firewall (Server PC)

Open ports for LAN (run PowerShell **as Administrator**):

```powershell
New-NetFirewallRule -DisplayName "KM LAN HTTP"  -Direction Inbound -Protocol TCP -LocalPort 18094 -Action Allow -Profile Private,Domain
New-NetFirewallRule -DisplayName "KM LAN UDP"   -Direction Inbound -Protocol UDP -LocalPort 18095 -Action Allow -Profile Private,Domain
New-NetFirewallRule -DisplayName "KM LAN WS"    -Direction Inbound -Protocol TCP -LocalPort 18096 -Action Allow -Profile Private,Domain
```

> Use **Private** profile for office LAN. Avoid Public unless needed.

---

## Step 3 — Enable Server (Hub) in KM

1. Open **KM Desktop** on the **server PC**
2. Go to **Ցանց / Network** section
3. Click **Start listening** (սկսել լսել)
4. Enable **Hub սերվեր (այս համակարգիչ)** checkbox (Administrator only)
5. Note server IP: e.g. `192.168.1.100`

Server binds HTTP to `0.0.0.0:18094` automatically.

---

## Step 4 — Configure Clients

### Option A — Config file

Create/edit `%LOCALAPPDATA%\KM\UserData\km_lan_config.json`:

```json
{
  "role": "client",
  "serverUrl": "http://192.168.1.100:18094",
  "wsUrl": "ws://192.168.1.100:18096",
  "autoReconnect": true,
  "reconnectBaseMs": 3000,
  "reconnectMaxMs": 60000,
  "realtimeSync": true
}
```

### Option B — Environment variable

```powershell
setx KM_SERVER_URL "http://192.168.1.100:18094"
```

### Option C — JavaScript (DevTools console on client)

```javascript
await kmLanClient.configureClient('http://192.168.1.100:18094');
await kmLanClient.ensureStarted();
```

---

## Step 5 — Verify connection

On client PC (PowerShell):

```powershell
curl http://192.168.1.100:18094/km/hello
curl http://192.168.1.100:18094/km/sync/manifest
```

Expected: JSON `{ "ok": true, ... }`

---

## Ports summary

| Port | Protocol | Purpose |
|------|----------|---------|
| 18094 | TCP | HTTP — files, sync API, hello |
| 18095 | UDP | Peer discovery broadcast |
| 18096 | TCP | WebSocket — real-time `file-changed` |

---

## Synced paths (default)

- `database_snapshot.json`
- `Library/`
- `PeoplePhotos/`
- `Fonts/`
- `DisciplineOrders/`, person doc folders
- `km_settings.json`, `km_templates.json`
- `BotKnowledge/` — `knowledge.db`, `qa.jsonl` (atomic snapshot via WebSocket `bot-knowledge-updated`)

**Excluded from client overwrite:** `BotKnowledge/*.tmp`, `*.snapshot` (internal), `Backups/`, `km_owner_vault.json`, `km_license.json`, `conversations.txt`, `Conversations/`, `RetentionVault/`

### Centralized conversations (hub only)

1. Every Help Bot Q&A is appended to `%LOCALAPPDATA%\KM\UserData\conversations.txt` and `Conversations/conversations.jsonl`.
2. Client stations POST `/km/hub/conversation` so the hub keeps the full LAN log.
3. Only Super Admin can open **Ադմին վահանակ → Զրույցներն ու պահոցը**. Regular users cannot delete this log.
4. Rows older than **6 months** are pruned automatically.

### 6-month file retention (hub only)

1. When a user deletes a Library/Laws file, KM copies it to `RetentionVault/{section}/{id}/` before unlink.
2. Clients also POST `/km/hub/retain` so the server copy survives local delete.
3. Super Admin can restore or purge after 6 months. Regular users have no vault UI.

### BotKnowledge atomic sync flow

1. **Server (Hub)** watches `BotKnowledge/` — on change, WAL checkpoint + copy to `knowledge.db.snapshot.tmp` → rename.
2. WebSocket broadcasts `{ type: "bot-knowledge-updated" }` to all clients.
3. **Client** downloads snapshot → writes `knowledge.db.tmp` → atomic rename (closes SQLite first).
4. Auto-triggers FTS rebuild (`rebuildFtsUntilComplete` or background `npm run bot:fts`).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Client cannot connect | Check Static IP, firewall, same subnet (192.168.1.x) |
| Connection drops | Auto-reconnect enabled by default; check `wsUrl` |
| Files not syncing | Ensure **Network → Start listening** on both sides |
| Hub not redistributing | Server must have **Hub սերվեր** enabled |
| `database is locked` | Only one reindex at a time; close extra KM instances |

---

## npm / scripts (optional)

From `app/` folder:

```powershell
# No extra install — uses built-in `ws` from node_modules
# Server: enable Hub in UI
# Client: edit km_lan_config.json then restart KM
```
