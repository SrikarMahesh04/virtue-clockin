# Open ClockIn from a phone on the same network

1. Connect the computer and phone to the same Wi-Fi network. Guest networks/client isolation may prevent devices from communicating.
2. From the project folder, run `./scripts/start-backend.ps1` and `./scripts/start-frontend.ps1` in separate terminals. The backend launcher prints the current phone URL and allows those exact private IPv4 browser origins during development/test. Both servers listen on all local interfaces.
3. Open the printed URL on the phone, for example `http://192.168.88.8:3000/login`. Do not use `localhost` or `127.0.0.1` on the phone: those refer to the phone itself. For local/private browser hosts, a loopback API setting automatically follows the computer hostname and browser protocol, keeping cookies same-site. An explicit remote API URL is preserved.
4. If the page/API is blocked by Windows Firewall, run the following once in **Administrator PowerShell**:

```powershell
& 'C:\Code\Virtue-ClockIn\scripts\enable-lan-firewall.ps1'
```

This permits only local-subnet TCP access on ports 3000/8000 for Private/Public network profiles. It does not disable the firewall or change the network's trust profile. No router port forwarding is required. The script prints the command to remove its rule.

For manual startup instead of the launchers: run Uvicorn with `--host 0.0.0.0 --port 8000`, and set `FRONTEND_ADDITIONAL_ORIGINS=http://YOUR_COMPUTER_IP:3000` in `backend/.env`. Multiple explicit origins can be comma-separated. Restart after changes. The primary `FRONTEND_ORIGIN` still works; production/staging ignore development additional origins. Next.js derives allowed development asset hosts from the computer's network interfaces. Restart both launchers after a DHCP address change.

## Location-based punching on phones

Login, dashboards and other browsing work over local HTTP. Geolocation and secure browser APIs require HTTPS on phones. ClockIn now permits mobile attendance when the page is a secure context, location permission is granted, and the existing backend geofence/accuracy/network rules pass. It reports the HTTPS requirement directly when opened over LAN HTTP.

For HTTPS development, obtain a certificate covering the computer's LAN IP or local DNS name and install/trust its issuing CA on the phone. Keep all private keys on the development computer. Merely clicking through a self-signed certificate warning is not sufficient assurance that geolocation APIs will be available.

Use the same trusted certificate for the frontend and direct backend (ports 3000 and 8000), with the certificate covering the address used in the phone URL:

```powershell
# Backend terminal, from backend/. Set exact secure origins and secure cookies.
$env:FRONTEND_ORIGIN='https://YOUR_COMPUTER_IP:3000'
$env:APP_BASE_URL='https://YOUR_COMPUTER_IP:3000'
$env:COOKIE_SECURE='true'
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --ssl-certfile PATH_TO_CERT.pem --ssl-keyfile PATH_TO_KEY.pem

# Frontend terminal, from frontend/.
pnpm exec next dev --hostname 0.0.0.0 --experimental-https --experimental-https-cert PATH_TO_CERT.pem --experimental-https-key PATH_TO_KEY.pem
```

Open `https://YOUR_COMPUTER_IP:3000/login`. With the default loopback API setting, requests follow the same hostname/protocol on port 8000. If you set an explicit LAN API URL, make it HTTPS too. For a deployed environment, use properly trusted HTTPS infrastructure rather than development certificates. No transparent Next.js API proxy is used: the backend must observe the employee's actual network address for attendance verification.

Add the LAN/HTTPS frontend origin to your Google Maps key's website restrictions if using Maps from that address. Real office CIDRs remain an audited company setting; LAN availability does not automatically approve a phone/network for punches.

## Connection checks

On the phone, open `http://YOUR_COMPUTER_IP:8000/health` (or HTTPS when configured). A response means the API port is reachable. `/ready` additionally checks the configured database/migrations. If only the frontend works, inspect port 8000 firewall access and restart the backend with the launcher. If neither works, check the computer address, Wi-Fi isolation, and both server terminals.

References: [MDN Geolocation secure-context requirement](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API), [Next.js development HTTPS](https://nextjs.org/docs/app/api-reference/cli/next#using-https-during-development).
