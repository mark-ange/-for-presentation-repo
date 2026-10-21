# CityCare CDO

CityCare CDO is a Vue 3 admin portal backed by an Express API and MongoDB.

## Data ownership

Operational records (reports, fleet vehicles, barangays, and collection schedules), administrator profile details, and administrative preferences are served and persisted by the backend. The frontend reads and writes these records through `/api`; it does not contain operational sample records. Analytics are calculated from stored reports, and response-time reporting starts once a report has an assignment timestamp.

Administrators manage collection routes from the Barangays page. Each barangay can have separate routes for named puroks, zones, or streets, with their own biodegradable and non-biodegradable days, collection time, and assigned truck. The resident app prefers an exact match to the resident's registered barangay and location; if there is no match, it can show only an explicitly labeled sample fallback.

## Fleet status tracking

Admins can change a vehicle's status directly from its Fleet inventory row or vehicle details panel; changes save to the backend automatically. Supported statuses are **Idle**, **Dispatching**, **In Transit**, **Maintenance**, and **Out of Service**. Idle vehicles remain in inventory and available for assignment but are hidden from the map. When dispatching an idle vehicle, choose a location directly on the Fleet map; the manually selected location remains until replaced by GPS or the vehicle is returned to Idle. Dispatching and In Transit both count as active route vehicles. Maintenance and Out of Service vehicles are excluded from closest-truck suggestions.

To add the clearly labeled fictional demonstration routes for the six resident sign-up barangays without replacing existing schedules, run `npm --prefix backend run seed:schedules:sample`. The sample records are marked **SAMPLE ONLY — not official or confirmed CLENRO routes** in the admin and resident apps. Exact area routes take precedence over the sample fallback.

Public City of Cagayan de Oro reports located during implementation describe temporary clean-up operations, not recurring street-level collection timetables. They do not provide verified recurring pickup days and times for every resident sign-up area, so missing route details must be confirmed by CLENRO before publication. See the [January 2025 Task Force Basura operation](https://cagayandeoro.gov.ph/index.php/item/2428-task-force-basura-special-operations.html) and the [April 2023 city collection announcement](https://cagayandeoro.gov.ph/index.php/item/1704-pagkolekta-sa-basura-istriktong-ipatuman-sa-syudad.html).

The browser keeps only interface preferences such as the selected theme and the authentication token needed for API requests. User profile details and admin preferences are loaded from the API.

## Administrative settings

Settings are stored on the administrator account. The default landing console is used after the next sign-in; the default ticket filter is applied when opening Incidents; and the audit period filters the Reports page's summary metrics and breakdowns. Automatic data refresh controls background updates on the dashboard, incident list, fleet map, barangay list, reports, and sidebar count; manual refresh remains available on those data pages. Notification preferences monitor report changes while the portal is open and show in-app alerts for enabled report events. Optional browser notifications require permission from the browser. **Reset Preferences** restores notification and system preferences only; it does not change the administrator profile or credentials.

## Run locally

1. Configure a reachable MongoDB URI. For this local setup, copy `backend/.env.example` to `backend/.env` and add your private values; the backend also supports MongoDB Atlas-generated `backend/atlas-credentials.env` (gitignored). Never commit `.env` files or real credentials. Set production secrets through the hosting provider's secret settings.
2. Start the API from the repository root:

   ```powershell
   npm --prefix backend run dev
   ```

3. Start the Vue development server in another terminal:

   ```powershell
   npm --prefix frontend run dev
   ```

   Copy `frontend/.env.example` to `frontend/.env.local` and fill in your Firebase web app configuration before starting Vite. Vite embeds `VITE_*` values into the browser bundle; these are public client settings, not secrets. Protect Firebase services with Authentication, Firestore, and Storage rules, and restrict the API key in Google Cloud.

The development server proxies `/api` to `http://localhost:5000`. MongoDB must be available for records and preferences to persist. The local admin and resident app must use the same API/database to see the same incident reports. If the resident app submits to a hosted API, set `VITE_API_URL` in `frontend/.env.local` to that API's `/api` base URL before starting Vite; otherwise the admin uses the local backend and will not see reports stored only by the hosted backend.

For a physical Android phone on the same Wi-Fi, the app's `CITYCARE_API_URL` defaults to this development computer's current LAN address (`http://192.168.0.104:5000/api`). If the address changes, set `CITYCARE_API_URL` in the Gradle user properties or pass `-PCITYCARE_API_URL=http://<computer-lan-ip>:5000/api` when building the app. Allow inbound TCP port 5000 on the computer's private-network firewall. Android Studio emulators should use `-PCITYCARE_API_URL=http://10.0.2.2:5000/api`.

When deploying behind a trusted reverse proxy that forwards `X-Forwarded-For`, set `TRUST_PROXY=1` in the hosting environment if exactly one trusted proxy sits in front of the API. Do not enable it when clients can connect directly to the API; trusting forwarded headers from untrusted clients can undermine IP-based rate limits.

### Facebook sign-in for the resident app

Create a Meta developer app, add the Facebook Login product and Android platform, and register package `com.example.razoproject` plus the signing-key hashes for the builds you will install. While the Meta app is in Development mode, the Facebook account used to test must have an app role. In `%USERPROFILE%\.gradle\gradle.properties`, set `FACEBOOK_APP_ID` and `FACEBOOK_CLIENT_TOKEN`; in the ignored `backend/.env`, set `FACEBOOK_APP_ID` and the private `FACEBOOK_APP_SECRET`. Never place the app secret in Android/Gradle configuration or commit it. Restart the backend and rebuild/reinstall the Android app after configuring these values. The backend validates the access token with Meta before creating a resident account; it does not automatically link a Facebook identity to an existing account just because the email matches.

For local development, if JWT/session secrets are not provided through the process environment, the backend creates and reuses private random secrets in the gitignored `backend/config/developmentSecrets.json` file. Keep that file on this computer; deleting it or changing the environment secrets invalidates existing login tokens, so sign in again. Production deployments must provide strong `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `SESSION_SECRET` values through the hosting provider's secret settings; the local development-secrets file is never used in production.

The Firebase Admin service-account key is optional for local runs. Without `backend/config/serviceAccountKey.json`, backend-only Firebase features such as Firebase ID-token verification and push notifications are unavailable; MongoDB-backed admin functions can still run. Keep any service-account key private and out of version control.

If Node.js cannot resolve Atlas SRV records through the system DNS resolver, set `MONGO_DNS_SERVERS` to a reachable DNS server before starting the backend. For example, in PowerShell:

```powershell
$env:MONGO_DNS_SERVERS = '192.168.0.1'
npm --prefix backend run dev
```

Replace the example DNS address with a resolver available on your network. The backend uses `citycare_db` by default; set `MONGO_DATABASE` to choose a different database name.

Backend Firebase Admin features are optional and require a private service account key at `backend/config/serviceAccountKey.json`; that key file is gitignored and must never be committed. The example environment files contain placeholders only. GitHub Actions/deployment builds should receive any required build-time variables from configured repository or hosting settings, not from committed local `.env` files.

## Resident-app content management

Admins can manage Recycle information, Events, Tips, and Blog posts from **Community Content** in the admin portal. Items can be saved as drafts or published; only published items are returned by the public API. Events require a start date/time and location. Each item can include a source website link and up to five JPEG, PNG, or WebP image uploads (2 MB each, 8 MB total). Collection schedules remain managed per barangay in the Barangays section. Donate and payment features are not included.

To add the prepared example set (10 published posts and 4 drafts for each content type) without replacing existing content, run `npm --prefix backend run seed:community-content:examples`. The command inserts only missing type/title pairs and can be rerun safely. Drafts remain private to administrators. Published demo events are clearly labeled **DEMO ONLY** and are fictional examples, not official announcements.

The resident app can load published content using `GET /api/content?type=recycle`, with `event`, `tip`, or `blog` as the other supported `type` values. Omitting `type` returns all published content. Each item includes an optional `sourceUrl` and an `images` array with URLs relative to the API host; append each image URL to the API host to display it in the resident app. The public image endpoint only serves images for published content. Admin management uses `GET /api/content/manage` and the standard authenticated `POST /api/content`, `PUT /api/content/:id`, and `DELETE /api/content/:id` endpoints. The resident app must call the published-content endpoint to display these records.

In the Android resident app, open `sourceUrl` in an embedded WebView so the user stays in the app. Only navigate to HTTPS URLs, disable file/content access and mixed content, and provide an in-app back/close control. The Android app code is separate from this admin/backend repository and must be wired to the content API and WebView.

For resident testing, the backend can serve the debug APK from `GET /download/citycare.apk` when `CITYCARE_ANDROID_APK_PATH` points to the built APK in the local backend environment. Anyone who can reach the backend can download this test build; the link works only while the backend is running and reachable. Use a properly signed release build and hosted distribution for production.

## Citizen mobile app and live reports

The admin incident table polls the backend every five seconds. Reports are stored in MongoDB, and the admin can inspect evidence, assign a fleet unit, and update a report through the protected status API. The reports API uses database pagination; `GET /api/reports` returns up to 1,000 newest reports by default, and accepts `page` and `limit` parameters (maximum page size: 1,000). Its response includes `count` for the current page, `total`, `totalPages`, `statusCounts`, and `data`.

Citizen submissions can use `POST /api/reports` with JSON fields such as `title`, `category`, `barangay`, `purokZone`, `landmark`, `description`, `gpsCoordinates`, `reporter`, and `userEmail`. Mobile clients can include a JPEG, PNG, or WebP image as base64 in `photoBase64` (maximum decoded size: 4 MB); the API stores it with the report in MongoDB. The admin report table omits image data to keep list responses small and fetches the image when an administrator opens the report. External HTTPS image URLs are also accepted as `photoUrl` (or `imageUrl` / `photoEvidenceUrl`).

`barangay` is required and normalized (for example, `Brgy. Opol` becomes `Opol`). If a submitted report names a barangay that is not registered yet, the backend creates its barangay record automatically, with district marked `Unassigned` until an administrator updates it. The Barangays page calculates its incident totals from stored reports and also synchronizes areas found in older reports. It does not add placeholder sign-up barangays. Incident reports are not auto-seeded or stored in an in-memory sample list; report endpoints require MongoDB so unavailable storage cannot appear as live data.

Stored evidence is part of the MongoDB report document and has no inactivity-based expiry or TTL policy; logging out of the admin or leaving a report unopened does not remove it. It remains available while the report/database is retained. Keep Atlas backups and the account active for long-term retention; no application can guarantee five-year availability if its database is deleted, the Atlas account is closed, or records are manually removed. The configured Firebase Storage bucket is currently unavailable, so uploads use MongoDB rather than relying on Storage. A report marked as having media but with no uploaded image is shown as missing evidence; if the resident still has its locally saved image, opening the resident app online retries the upload and can repair the existing report.

### GIS map, GPS, and closest-truck dispatch

The Fleet page uses Leaflet with OpenStreetMap tiles and plots report locations and trucks from the API. Nearby and coincident pins are grouped into numbered clusters; click a cluster to zoom in, and exact overlaps spiderfy at maximum zoom so each saved marker remains selectable without changing its geographic coordinates or deleting a record. Markers are anchored to geographic coordinates, not the screen, so they move across the viewport as the map is panned while remaining at the same map location. Periodic API refreshes update existing marker instances rather than recreating them. Report submissions remain compatible with the mobile app's `gpsCoordinates` string and may also send numeric `latitude`/`longitude` or GeoJSON `location: { "type": "Point", "coordinates": [longitude, latitude] }`. The backend stores valid points as GeoJSON and retains `gpsCoordinates` for older clients. Report markers are colored by status; select one and choose **Find closest truck** to see the nearest non-maintenance trucks, their spherical distance, and a straight-line connection. **Assign this truck** updates the report's status, assigned unit, and driver/personnel.

`GET /api/fleet/closest?reportId=<report-id>` finds trucks for a report. It also accepts `?latitude=<lat>&longitude=<lng>` or `?gpsCoordinates=<lat>,<lng>`. `PUT /api/fleet/:id/location` accepts the same coordinate formats and requires an authenticated administrator token. Until a truck sends actual GPS, its map pin uses an explicitly labeled approximate barangay-center coordinate. Current seeded/sample points for Carmen, Lapasan, Macasandig, Balulang, Lumbia, Bulua, Nazareth, Kauswagan, and the central depot are estimates—not verified live truck positions. The Fleet page refreshes positions and reports every 15 seconds. OpenStreetMap tiles require internet access and are shown with attribution.

Example GPS update from an authorized administrator/device:

```http
PUT /api/fleet/TRK-042/location
Authorization: Bearer <administrator-token>
Content-Type: application/json

{"latitude":8.4822,"longitude":124.6175}
```

Driver accounts/device credentials are not configured in this project yet, so resident app tokens cannot update truck locations. Keep the endpoint restricted to administrator-authenticated callers until a driver/device authentication flow is added.

To run the focused coordinate and closest-truck API tests from the repository root, use `npm --prefix backend run test:coordinates`. The backend no longer auto-seeds sample incidents on startup. The optional seeder still resets user, barangay, fleet, and schedule collections, so do not run it against an existing database to update map pins or manage incident history.

### Local access from phones on the same Wi-Fi

For local use, run the backend on the computer and point the Android app at that computer's private LAN address:

1. Start the API from the repository root with `npm --prefix backend start` (or, from the `backend` folder, `npm start`). Keep the terminal open.
2. On Windows, run `ipconfig` and find the IPv4 address for the Wi-Fi adapter connected to the same network as the phone (for example, `192.168.1.50`).
3. In the separate Android project, set `CityCareApiService.kt`'s base URL to `http://<COMPUTER_IP>:5000/api/`. For an Android emulator on this computer, use `http://10.0.2.2:5000/api/`.
4. Allow Node.js or inbound TCP port 5000 on the Windows Firewall for **Private networks**. Do not expose this development HTTP server to the public internet.
5. Connect the phone and computer to the same Wi-Fi, then open `http://<COMPUTER_IP>:5000/api/health` in the phone browser. Continue when it returns `ONLINE` and `CONNECTED`.
6. Build/install the Android app with the updated URL. Submit a test report and check the admin portal's **Incidents** page. Keep the computer awake and the backend running while reports need to be received.

The Vue development server is configured to listen on the LAN as well. To open the admin portal from another device on the same Wi-Fi, run `npm --prefix frontend run dev -- --host 0.0.0.0`, then visit `http://<COMPUTER_IP>:5173/`. API calls from this portal are proxied to the backend on the same computer.

Each report receives a unique ID based on its MongoDB document ID. Reports are paginated for the admin UI, which can browse more than 1,000 stored reports without downloading the whole collection each refresh.
