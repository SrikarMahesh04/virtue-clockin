# Google Maps office location picker

System Settings uses Google Maps to choose the office pin and preview the attendance radius in meters. Search by address, click on the map, drag the pin, or explicitly request your current device location. Review the pin and radius before saving. Coordinates are submitted to the existing audited office settings API; the Maps browser key never belongs in the database or API payload.

## Configure your Google project

1. Create/select a Google Cloud project and attach your billing account. Enable **Maps JavaScript API** and **Geocoding API**. The latter supports the explicit address search button; search does not run for each keystroke.
2. Create an API key with **Websites** application restrictions. Allow `http://localhost:3000/*`, `http://127.0.0.1:3000/*` for local development and your exact HTTPS application domain for deployment. Use separate development/production keys. Restrict the key to those two APIs. Set quotas and billing alerts in your own project.
3. Create a **JavaScript map ID** in Google Maps Platform → Map Management. Advanced draggable markers require a map ID. Use your own map ID rather than a demonstration ID.
4. Add the following to the ignored `frontend/.env.local` file:

```dotenv
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=YOUR_RESTRICTED_BROWSER_KEY
NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=YOUR_JAVASCRIPT_MAP_ID
```

5. Restart `pnpm dev`; for a production frontend, rebuild and restart. These public variables are compiled into the browser bundle. They are expected to be visible in the browser and must be protected by Google website/API restrictions, not treated as server secrets. Do not paste a server/service-account credential here.
6. Sign in as Super Administrator and open System Settings. Find the office, adjust its pin, enter the radius and maximum accepted location accuracy, and save with a reason. Password reauthentication may be required for administrative changes.

## Behavior and verification

- The frontend uses `strict-origin-when-cross-origin` and Google's origin-only authentication referrer option, allowing website-restricted keys to work without sending page paths to Google. Avoid changing the page policy to `no-referrer`, which would prevent that restriction check.
- Without key/map ID, the UI reports that Maps is not configured. It neither fabricates a map nor substitutes a sample office. Previously saved coordinates and radius remain available for saving other policy changes.
- An unconfigured office cannot be saved without selecting a real location. The initial world view is only a map viewport; it is not a selected office.
- Script/network/authentication failures are visible. Check Google billing, API enablement, key restrictions, and the browser's Google error details; reload after correcting configuration. Address-search errors do not erase a chosen pin.
- Location permission is requested only through **Use my current location**. Device location sets a draft pin; it never saves automatically.
- Clicking/dragging the pin and changing the radius update the draft circle. Changes reach the backend only through **Save office configuration**, with the existing required audit reason.
- The backend remains authoritative for both Punch In and Punch Out: measured distance plus reported accuracy must fit within the configured radius, and the request must arrive from an approved office network. Google Maps is an administration tool, not a replacement for punch validation.
- Automated tests cover picker interactions using an explicitly mocked Google SDK, missing/failing integration states, and the real persisted geofence API. A live Google map/search test requires your configured project/key; it has not been claimed without those services.

Official references: [API setup](https://developers.google.com/maps/documentation/javascript/get-api-key), [map IDs and advanced markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/start), [geocoding](https://developers.google.com/maps/documentation/javascript/geocoding), [key restrictions](https://developers.google.com/maps/api-security-best-practices).
