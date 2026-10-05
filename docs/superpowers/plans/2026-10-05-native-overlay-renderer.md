# Native Overlay WebView Renderer (hybrid) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render browser-dependent distributor pages while the app is backgrounded, by extracting HTML in a native Kotlin `WebView` on an offscreen overlay window (no RN JS bridge).

**Architecture:** A local Expo module (`modules/psf-webview-renderer/`) owns a 1×1 `TYPE_APPLICATION_OVERLAY` WebView and extracts `outerHTML` via native `evaluateJavascript`. `browser-native.ts` uses the React host when present (foreground) and the overlay renderer otherwise (background). The `SYSTEM_ALERT_WINDOW` permission is restored and granted via Settings.

**Tech Stack:** Expo SDK 54 / RN 0.81, local Expo module (Kotlin + `expo-modules-core`), `react-native-webview` (foreground host, unchanged), TypeScript strict, vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-native-overlay-renderer-design.md`

**Base:** the foreground-service module + toggle are already on `main` (Phase 1101).

---

## File Structure

- Create `modules/psf-webview-renderer/expo-module.config.json`
- Create `modules/psf-webview-renderer/index.ts`
- Create `modules/psf-webview-renderer/android/build.gradle`
- Create `modules/psf-webview-renderer/android/src/main/AndroidManifest.xml`
- Create `modules/psf-webview-renderer/android/src/main/java/expo/modules/psfwebviewrenderer/OverlayRenderer.kt`
- Create `modules/psf-webview-renderer/android/src/main/java/expo/modules/psfwebviewrenderer/PsfWebViewRendererModule.kt`
- Modify `lib/scrapers/browser-native.ts` (hybrid dispatch)
- Modify `plugins/with-android-hardening.js` (stop removing `SYSTEM_ALERT_WINDOW`)
- Modify `lib/background-service-toggle.ts` + `app/(tabs)/settings.tsx` (overlay grant flow)
- Tests: `tests/scrapers/browser-native-overlay.test.ts`, `tests/android-hardening.test.ts` (update), `tests/settings-background-service.test.ts` (extend), `tests/foreground-service-module-guard.test.ts` (extend)

---

### Task 1: Local Expo module + overlay renderer

**Files:** the six `modules/psf-webview-renderer/**` files above.

- [ ] **Step 1: Create `modules/psf-webview-renderer/expo-module.config.json`**

```json
{
  "platforms": ["android"],
  "android": {
    "modules": ["expo.modules.psfwebviewrenderer.PsfWebViewRendererModule"]
  }
}
```

- [ ] **Step 2: Create `modules/psf-webview-renderer/android/build.gradle`**

```gradle
plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

group = 'expo.modules.psfwebviewrenderer'
version = '1.0.0'

android {
  namespace "expo.modules.psfwebviewrenderer"
  defaultConfig {
    versionCode 1
    versionName "1.0.0"
  }
}
```

- [ ] **Step 3: Create `modules/psf-webview-renderer/android/src/main/AndroidManifest.xml`**

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
</manifest>
```

- [ ] **Step 4: Create `OverlayRenderer.kt`**

```kotlin
package expo.modules.psfwebviewrenderer

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject

// One hidden WebView attached to a real (invisible) overlay window so its JS
// keeps running while the app is backgrounded. Extraction happens natively via
// evaluateJavascript, so the frozen React Native JS bridge cannot stall it.
@SuppressLint("SetJavaScriptEnabled")
class OverlayRenderer(private val context: Context) {
  private val main = Handler(Looper.getMainLooper())
  private var webView: WebView? = null
  private var added = false
  private var busy = false

  private fun ensureWebView(): WebView {
    webView?.let { return it }
    val wv = WebView(context)
    wv.settings.javaScriptEnabled = true
    wv.settings.domStorageEnabled = true
    wv.webViewClient = WebViewClient()
    webView = wv
    return wv
  }

  private fun attach(wv: WebView) {
    if (added) return
    val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    val params = WindowManager.LayoutParams(
      1,
      1,
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
      PixelFormat.TRANSLUCENT,
    )
    params.gravity = Gravity.TOP or Gravity.START
    params.x = -2
    params.y = -2
    wm.addView(wv, params)
    added = true
  }

  fun render(
    url: String,
    waitForSelector: String?,
    timeoutMs: Long,
    onResult: (String?, String?) -> Unit,
  ) {
    main.post {
      if (busy) {
        onResult(null, "renderer busy")
        return@post
      }
      busy = true
      val wv = ensureWebView()
      try {
        attach(wv)
      } catch (e: Exception) {
        busy = false
        onResult(null, "overlay not permitted: ${e.message}")
        return@post
      }
      val deadline = System.currentTimeMillis() + timeoutMs
      wv.loadUrl(url)
      poll(wv, waitForSelector, deadline, onResult)
    }
  }

  private fun poll(
    wv: WebView,
    waitForSelector: String?,
    deadline: Long,
    onResult: (String?, String?) -> Unit,
  ) {
    val ready = waitForSelector == null
    if (!ready && System.currentTimeMillis() < deadline) {
      val sel = JSONObject.quote(waitForSelector)
      wv.evaluateJavascript("!!document.querySelector($sel)") { value ->
        if (value == "true") {
          main.postDelayed({ extract(wv, onResult) }, 500)
        } else {
          main.postDelayed({ poll(wv, waitForSelector, deadline, onResult) }, 250)
        }
      }
      return
    }
    if (System.currentTimeMillis() >= deadline) {
      busy = false
      onResult(null, "render timed out")
      return
    }
    main.postDelayed({ extract(wv, onResult) }, 500)
  }

  private fun extract(wv: WebView, onResult: (String?, String?) -> Unit) {
    wv.evaluateJavascript("document.documentElement.outerHTML") { value ->
      busy = false
      onResult(unescapeJsonString(value), null)
    }
  }

  // evaluateJavascript returns a JSON-encoded string literal; decode it.
  private fun unescapeJsonString(value: String?): String {
    if (value == null || value == "null") return ""
    return try {
      JSONObject("{\"v\":$value}").getString("v")
    } catch (e: Exception) {
      value
    }
  }
}
```

- [ ] **Step 5: Create `PsfWebViewRendererModule.kt`**

```kotlin
package expo.modules.psfwebviewrenderer

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PsfWebViewRendererModule : Module() {
  private var renderer: OverlayRenderer? = null

  override fun definition() = ModuleDefinition {
    Name("PsfWebViewRenderer")

    AsyncFunction("render") { url: String, waitForSelector: String?, timeoutMs: Double, promise: Promise ->
      val context = appContext.reactContext ?: run {
        promise.reject("no_context", "no react context", null)
        return@AsyncFunction
      }
      val r = renderer ?: OverlayRenderer(context).also { renderer = it }
      r.render(url, waitForSelector, timeoutMs.toLong()) { html, error ->
        if (error != null) promise.reject("render_failed", error, null)
        else promise.resolve(html)
      }
    }

    AsyncFunction("isOverlayGranted") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      Settings.canDrawOverlays(context)
    }

    AsyncFunction("requestOverlay") {
      val context = appContext.reactContext ?: return@AsyncFunction
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}"),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }
}
```

- [ ] **Step 6: Create `modules/psf-webview-renderer/index.ts`**

```ts
import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

type NativeApi = {
  render(url: string, waitForSelector: string | null, timeoutMs: number): Promise<string>;
  isOverlayGranted(): Promise<boolean>;
  requestOverlay(): Promise<void>;
};

let native: NativeApi | null = null;
if (Platform.OS === "android") {
  try {
    native = requireNativeModule<NativeApi>("PsfWebViewRenderer");
  } catch {
    native = null;
  }
}

export async function renderOverlay(
  url: string,
  opts?: { waitForSelector?: string; timeoutMs?: number },
): Promise<string> {
  if (!native) throw new Error("overlay renderer unavailable");
  return native.render(url, opts?.waitForSelector ?? null, opts?.timeoutMs ?? 20000);
}

export async function isOverlayGranted(): Promise<boolean> {
  return (await native?.isOverlayGranted()) ?? false;
}

export async function requestOverlay(): Promise<void> {
  await native?.requestOverlay();
}
```

- [ ] **Step 7: Build-verify**

Run:
```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64 --no-daemon --console=plain
```
Expected: BUILD SUCCESSFUL. Then:
```bash
grep -oE 'SYSTEM_ALERT_WINDOW' app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml | sort -u
```
Expected: `SYSTEM_ALERT_WINDOW` present.

- [ ] **Step 8: Commit**

```bash
git add modules/psf-webview-renderer
git commit -m "feat(android): native overlay WebView renderer module"
```

---

### Task 2: Hybrid dispatch in `browser-native.ts`

**Files:** Modify `lib/scrapers/browser-native.ts`; Test `tests/scrapers/browser-native-overlay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/scrapers/browser-native-overlay.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const load = vi.fn(async () => "<html>react</html>");
let hostPresent = true;
vi.mock("@/lib/scrapers/webview-host", async (orig) => {
  const actual = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...actual,
    getWebViewHost: () => (hostPresent ? { load, clearStorage: async () => {} } : null),
  };
});

const renderOverlay = vi.fn(async () => "<html>overlay</html>");
vi.mock("@/modules/psf-webview-renderer", () => ({
  renderOverlay: (...a: unknown[]) => renderOverlay(...(a as [])),
}));

import { fetchWithBrowser } from "@/lib/scrapers/browser-native";
import { BrowserUnavailableError } from "@/lib/scrapers/resilient";

describe("browser-native hybrid dispatch", () => {
  beforeEach(() => {
    load.mockClear();
    renderOverlay.mockClear();
    hostPresent = true;
  });

  it("uses the React host when present (foreground)", async () => {
    await expect(fetchWithBrowser("https://x.test")).resolves.toBe("<html>react</html>");
    expect(load).toHaveBeenCalledTimes(1);
    expect(renderOverlay).not.toHaveBeenCalled();
  });

  it("uses the overlay renderer when the host is absent (background)", async () => {
    hostPresent = false;
    await expect(fetchWithBrowser("https://x.test")).resolves.toBe("<html>overlay</html>");
    expect(renderOverlay).toHaveBeenCalledTimes(1);
  });

  it("throws BrowserUnavailableError when the overlay renderer fails", async () => {
    hostPresent = false;
    renderOverlay.mockRejectedValueOnce(new Error("overlay not permitted"));
    await expect(fetchWithBrowser("https://x.test")).rejects.toBeInstanceOf(
      BrowserUnavailableError,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/scrapers/browser-native-overlay.test.ts`
Expected: FAIL — overlay path not implemented.

- [ ] **Step 3: Implement the hybrid dispatch**

In `lib/scrapers/browser-native.ts`, replace `fetchWithBrowser`:

```ts
import { getWebViewHost, type WebViewLoadOptions } from "./webview-host";
import { renderOverlay } from "@/modules/psf-webview-renderer";

export async function fetchWithBrowser(
  url: string,
  options?: WebViewLoadOptions,
): Promise<string> {
  const host = getWebViewHost();
  if (host) return host.load(url, options);
  // Background: the RN bridge is throttled, so use the native overlay renderer.
  try {
    return await renderOverlay(url, options);
  } catch (e) {
    throw new BrowserUnavailableError(
      e instanceof Error ? e.message : WEBVIEW_UNAVAILABLE_MESSAGE,
    );
  }
}
```

Keep `browserPool` and `teardownBrowserSession` unchanged. Remove the now-unused `requireWebViewHost` import if it becomes unused.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/scrapers/browser-native-overlay.test.ts tests/scrapers/browser-native.test.ts tests/scrapers/webview-chain.test.ts`
Expected: PASS (the existing browser-native tests still pass — no host → `BrowserUnavailableError`).

- [ ] **Step 5: Commit**

```bash
git add lib/scrapers/browser-native.ts tests/scrapers/browser-native-overlay.test.ts
git commit -m "feat(scrapers): hybrid React-host / native-overlay browser dispatch"
```

---

### Task 3: Restore `SYSTEM_ALERT_WINDOW` in the hardening plugin

**Files:** Modify `plugins/with-android-hardening.js`; Test `tests/android-hardening.test.ts`

- [ ] **Step 1: Update the test**

In `tests/android-hardening.test.ts`, change the assertion that `SYSTEM_ALERT_WINDOW` is removed to assert it is **preserved**:

```ts
  it("keeps SYSTEM_ALERT_WINDOW (needed by the overlay renderer)", async () => {
    const manifest = await runMod({
      application: [{ $: {} }],
      "uses-permission": [
        perm("android.permission.SYSTEM_ALERT_WINDOW"),
        perm("android.permission.POST_NOTIFICATIONS"),
      ],
    });
    const names = manifest["uses-permission"]!.map((p) => p.$["android:name"]);
    expect(names).toContain("android.permission.SYSTEM_ALERT_WINDOW");
    expect(names).toContain("android.permission.POST_NOTIFICATIONS");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/android-hardening.test.ts`
Expected: FAIL (the plugin currently removes it).

- [ ] **Step 3: Update the plugin**

In `plugins/with-android-hardening.js`, set `REMOVED_PERMISSIONS = []` and update the header comment:

```js
// - SYSTEM_ALERT_WINDOW is now REQUIRED by the native overlay renderer
//   (modules/psf-webview-renderer) for background price refresh, so it is no
//   longer removed. The overlay is 1x1, non-focusable, non-touchable.
const REMOVED_PERMISSIONS = [];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/android-hardening.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add plugins/with-android-hardening.js tests/android-hardening.test.ts
git commit -m "feat(android): keep SYSTEM_ALERT_WINDOW for the overlay renderer"
```

---

### Task 4: Overlay grant flow in Settings

**Files:** Modify `lib/background-service-toggle.ts`; Test `tests/settings-background-service.test.ts` (extend)

- [ ] **Step 1: Extend the test**

```ts
const isOverlayGranted = vi.fn(async () => false);
const requestOverlay = vi.fn(async () => {});
vi.mock("@/modules/psf-webview-renderer", () => ({
  isOverlayGranted: () => isOverlayGranted(),
  requestOverlay: () => requestOverlay(),
}));

// add:
  it("requests the overlay permission when enabling without it", async () => {
    isOverlayGranted.mockResolvedValueOnce(false);
    requestOverlay.mockClear();
    await applyBackgroundServiceToggle(true);
    expect(requestOverlay).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/settings-background-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `lib/background-service-toggle.ts`:

```ts
import { enableBackgroundService, disableBackgroundService } from "./background-service";
import { isOverlayGranted, requestOverlay } from "@/modules/psf-webview-renderer";

// Keeps the native side in sync with the persisted toggle value. Background
// rendering needs the overlay permission, so prompt for it when enabling.
export async function applyBackgroundServiceToggle(enabled: boolean): Promise<void> {
  if (enabled) {
    try {
      if (!(await isOverlayGranted())) await requestOverlay();
    } catch {
      // module unavailable — foreground rendering still works
    }
    await enableBackgroundService();
  } else {
    await disableBackgroundService();
  }
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm exec vitest run tests/settings-background-service.test.ts && pnpm check`
Expected: PASS, 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add lib/background-service-toggle.ts tests/settings-background-service.test.ts
git commit -m "feat(settings): request overlay permission for background refresh"
```

---

### Task 5: Device spike (GATING)

**Files:** none (device validation). Do NOT proceed to Task 6 if it fails.

- [ ] **Step 1: Build + install**

```bash
npx expo prebuild --platform android
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64
adb install -r app/build/outputs/apk/release/app-release.apk
```

- [ ] **Step 2: Grant the overlay permission**

Enable **Background refresh** in Settings (the app opens the "draw over other apps" screen); grant it via `adb shell appops set com.app.stocktrackerpro SYSTEM_ALERT_WINDOW allow` if the UI is awkward.

- [ ] **Step 3: Background + trigger a browser-only fetch**

Start a Health "Test All" in the foreground, press Home, and let it run. Then check whether a browser-only distributor (Aerial.net / MiRO / Link Technologies) rendered.

- [ ] **Step 4: Decide**

- **PASS** (browser-only distributor rendered while backgrounded, via the overlay) → continue.
- **FAIL** → STOP; report that the overlay renderer didn't work and do not ship the toggle.

- [ ] **Step 5: Stop**

Disable the toggle; confirm the notification disappears.

---

### Task 6: Full verification + docs

**Files:** `todo.md`, `tests/foreground-service-module-guard.test.ts`

- [ ] **Step 1: Create the module guard**

Create `tests/foreground-service-module-guard.test.ts` asserting:
- `modules/psf-webview-renderer/android/src/main/AndroidManifest.xml` declares `SYSTEM_ALERT_WINDOW`;
- `modules/psf-webview-renderer/android/src/main/java/expo/modules/psfwebviewrenderer/OverlayRenderer.kt` uses `TYPE_APPLICATION_OVERLAY`;
- `modules/psf-foreground-service/android/src/main/AndroidManifest.xml` declares `FOREGROUND_SERVICE_DATA_SYNC`.

- [ ] **Step 2: Gate**

Run: `pnpm check && pnpm lint && pnpm verify`
Expected: green.

- [ ] **Step 3: Document**

Add a `todo.md` phase entry: the native overlay renderer, the spike result, and the remaining limit (per-site coverage). Commit `docs: native overlay renderer (Phase NNNN)`.

---

## Self-Review

- **Spec coverage:** module + overlay renderer (Task 1), hybrid dispatch (Task 2), permission restore (Task 3), grant flow (Task 4), gating spike (Task 5), verify/docs (Task 6). Foreground React host unchanged; iOS/overlay-everywhere out of scope.
- **Placeholders:** none.
- **Type consistency:** `renderOverlay(url, opts)`, `isOverlayGranted()`, `requestOverlay()` (module) → used by `browser-native.ts` and `background-service-toggle.ts`; `fetchWithBrowser` keeps its `(url, options?)` signature.
