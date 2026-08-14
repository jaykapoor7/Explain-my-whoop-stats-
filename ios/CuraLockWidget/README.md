# CURA iPhone Lock Screen widget

A tiny native iOS widget (SwiftUI + WidgetKit) that shows your **Recovery**,
**Energy** and **Sleep** on your Lock Screen. It pulls your latest scores from
your existing CURA backend using a private, read-only token — no Supabase
service-role keys, no duplicated health math (the server runs CURA's own
`computeScoredDays`). Values are cached on-device for offline display, and
tapping the widget opens CURA.

This is for your **personal iPhone** (free Apple ID sideload). Nothing here is
published to the App Store, and none of it changes the CURA web app.

---

## What's in this folder

| File | What it is |
|------|------------|
| `CuraConfig.swift` | The only file you edit — your CURA URL + widget token. |
| `CuraLockWidget.swift` | The widget: fetch, cache, and the Lock Screen views. |
| `CuraApp.swift` | A minimal host app (a widget must belong to an app). |

---

## Step 1 — Get your token (in CURA)

1. Open CURA in your browser and **sign in**.
2. Go to **Settings → iPhone Lock Screen widget → Generate widget token**.
3. Copy the **Widget token** and the **Summary URL**.

> Keep the token private. It's read-only (only your three scores) and can't
> write anything, but treat it like a password.

## Step 2 — Create the Xcode project

You need a Mac with **Xcode 15+**.

1. Open Xcode → **File → New → Project… → iOS → App**. Next.
2. Product Name: **Cura**. Interface: **SwiftUI**. Language: **Swift**.
   Uncheck Core Data / Tests. Choose a folder and **Create**.
3. Delete the auto-generated `ContentView.swift` and `CuraApp.swift` from the
   new project (move to Trash) — you'll replace them with the ones here.
4. Drag **`CuraApp.swift`** and **`CuraConfig.swift`** from this folder into the
   Xcode project navigator. Tick **"Copy items if needed"** and add them to the
   **Cura** app target.

## Step 3 — Add the Widget Extension

1. **File → New → Target… → iOS → Widget Extension**. Next.
2. Product Name: **CuraLockWidget**. **Uncheck** "Include Configuration
   Intent". Finish. If asked to activate the scheme, click **Activate**.
3. In the new **CuraLockWidget** group, delete the template
   `CuraLockWidget.swift` Xcode created.
4. Drag **`CuraLockWidget.swift`** from this folder into the project, and add it
   to the **CuraLockWidget extension** target (not the app).
5. Select **`CuraConfig.swift`** in the navigator → open the **File Inspector**
   (right panel) → under **Target Membership**, tick **both** `Cura` and
   `CuraLockWidget` so both targets can read your config.

## Step 4 — Paste your token

Open **`CuraConfig.swift`** and fill in the three values from Step 1:

```swift
static let appURL      = "https://your-cura-domain.com"
static let summaryURL  = "https://your-cura-domain.com/api/widget/summary"
static let widgetToken = "eyJ...your token..."
```

## Step 5 — Sign with your Apple ID (free)

1. Select the **Cura** project (blue icon) → **Signing & Capabilities**.
2. For **both** targets (`Cura` and `CuraLockWidget`):
   - Check **Automatically manage signing**.
   - **Team:** add your personal Apple ID (Add an Account…) and select it.
   - Xcode assigns a bundle id like `com.yourname.Cura` and
     `com.yourname.Cura.CuraLockWidget`. Make them unique if it complains.

## Step 6 — Run it on your iPhone

1. Plug your iPhone into the Mac (or use wireless debugging). Unlock it.
2. In the Xcode toolbar, pick your **iPhone** as the run destination and choose
   the **Cura** app scheme.
3. Press **▶ Run**. First time, on the phone:
   **Settings → General → VPN & Device Management → (your Apple ID) → Trust**.
4. The Cura app launches once. You can close it.

## Step 7 — Add the widget to your Lock Screen

1. Lock the phone, then **long-press the Lock Screen → Customize → Lock Screen**.
2. Tap the widget area **below the clock** → find **CURA** → add the
   **rectangular** widget. Done.
   - (You can also add the small colour version to your **Home Screen**:
     long-press Home Screen → **+** → CURA → Small.)

---

## Notes & limits (free Apple ID)

- **7-day resign:** apps sideloaded with a *free* Apple ID stop working after 7
  days. Just press **▶ Run** from Xcode again to refresh another 7 days. (A paid
  Apple Developer account lasts a year.)
- **Refresh cadence:** iOS decides when widgets refresh (typically every
  15–30 min); the widget asks for ~30-minute updates. It won't be real-time.
- **Offline:** if a fetch fails, the last successful values are shown with a
  small "no-signal" glyph.
- **Security:** the token is a signed, read-only bearer credential for your
  account only. To revoke it, rotate `AUTH_SECRET` on your deployment (this also
  signs everyone out) — or we can add per-token revocation later if you want.
- **Requires cross-device sync to be on:** the widget reads the same cloud
  snapshot your phone/laptop sync to, so `DATABASE_URL` must be configured on
  your deployment (which you're setting up).
