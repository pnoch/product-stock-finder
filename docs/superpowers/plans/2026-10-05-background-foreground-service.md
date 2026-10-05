# Background Refresh via a Foreground Service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the process (and the hidden WebView host) alive with an Android foreground service so browser-dependent distributors can refresh while the app is closed.

**Architecture:** A local Expo module (`modules/psf-foreground-service/`) provides a `dataSync` foreground service + notification; a JS controller wraps it (Android-only, idempotent); an opt-in Settings toggle starts/stops it. The existing `expo-background-task` scheduler is unchanged — the service only keeps the process alive.

**Tech Stack:** Expo SDK 54 / RN 0.81, local Expo module (Kotlin + `expo-modules-core`), AsyncStorage, TypeScript strict, vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-background-foreground-service-design.md`

---

## File Structure

- Create `modules/psf-foreground-service/expo-module.config.json`
- Create `modules/psf-foreground-service/index.ts` (JS API)
- Create `modules/psf-foreground-service/android/build.gradle`
- Create `modules/psf-foreground-service/android/src/main/AndroidManifest.xml`
- Create `modules/psf-foreground-service/android/src/main/java/expo/modules/psfforegroundservice/PsfForegroundService.kt`
- Create `modules/psf-foreground-service/android/src/main/java/expo/modules/psfforegroundservice/PsfForegroundServiceModule.kt`
- Create `lib/background-service.ts` (controller)
- Modify `lib/types.ts` + `lib/storage/settings.ts` (the `backgroundServiceEnabled` setting)
- Modify `app/(tabs)/settings.tsx` (the toggle)
- Tests: `tests/background-service.test.ts`, `tests/settings-background-service.test.ts`, `tests/foreground-service-module-guard.test.ts`

---

### Task 1: Local Expo module + foreground service

**Files:** the six `modules/psf-foreground-service/**` files above.

- [ ] **Step 1: Create `modules/psf-foreground-service/expo-module.config.json`**

```json
{
  "platforms": ["android"],
  "android": {
    "modules": ["expo.modules.psfforegroundservice.PsfForegroundServiceModule"]
  }
}
```

- [ ] **Step 2: Create `modules/psf-foreground-service/android/build.gradle`**

```gradle
plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

group = 'expo.modules.psfforegroundservice'
version = '1.0.0'

android {
  namespace "expo.modules.psfforegroundservice"
  defaultConfig {
    versionCode 1
    versionName "1.0.0"
  }
}
```

- [ ] **Step 3: Create `modules/psf-foreground-service/android/src/main/AndroidManifest.xml`**

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
  <application>
    <service
      android:name=".PsfForegroundService"
      android:foregroundServiceType="dataSync"
      android:exported="false" />
  </application>
</manifest>
```

- [ ] **Step 4: Create `PsfForegroundService.kt`**

```kotlin
package expo.modules.psfforegroundservice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat

class PsfForegroundService : Service() {
  companion object {
    const val CHANNEL_ID = "psf_background_refresh"
    const val NOTIFICATION_ID = 4821
    const val ACTION_STOP = "expo.modules.psfforegroundservice.STOP"

    @Volatile
    var isRunning: Boolean = false
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }
    createChannel()
    val stopIntent = Intent(this, PsfForegroundService::class.java).setAction(ACTION_STOP)
    val stopPending = PendingIntent.getService(
      this,
      0,
      stopIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Product Stock Finder")
      .setContentText("Checking prices in the background")
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .addAction(0, "Stop", stopPending)
      .build()
    startForeground(NOTIFICATION_ID, notification)
    isRunning = true
    return START_STICKY
  }

  override fun onDestroy() {
    isRunning = false
    super.onDestroy()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (manager.getNotificationChannel(CHANNEL_ID) == null) {
        manager.createNotificationChannel(
          NotificationChannel(
            CHANNEL_ID,
            "Background refresh",
            NotificationManager.IMPORTANCE_LOW,
          ),
        )
      }
    }
  }
}
```

- [ ] **Step 5: Create `PsfForegroundServiceModule.kt`**

```kotlin
package expo.modules.psfforegroundservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PsfForegroundServiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PsfForegroundService")

    AsyncFunction("start") {
      val context = appContext.reactContext ?: return@AsyncFunction
      val intent = Intent(context, PsfForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    AsyncFunction("stop") {
      val context = appContext.reactContext ?: return@AsyncFunction
      context.stopService(Intent(context, PsfForegroundService::class.java))
    }

    AsyncFunction("isRunning") {
      PsfForegroundService.isRunning
    }
  }
}
```

- [ ] **Step 6: Create `modules/psf-foreground-service/index.ts`**

```ts
import { Platform } from "react-native";
import { requireNativeModule } from "expo-modules-core";

// Android-only. On other platforms the native module is not registered, so we
// resolve the API to no-ops instead of throwing at import time.
type NativeApi = {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): Promise<boolean>;
};

let native: NativeApi | null = null;
if (Platform.OS === "android") {
  try {
    native = requireNativeModule<NativeApi>("PsfForegroundService");
  } catch {
    native = null;
  }
}

export async function startForegroundService(): Promise<void> {
  await native?.start();
}

export async function stopForegroundService(): Promise<void> {
  await native?.stop();
}

export async function isForegroundServiceRunning(): Promise<boolean> {
  return (await native?.isRunning()) ?? false;
}
```

- [ ] **Step 7: Build-verify the module autolinks and compiles**

Run:
```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64 --no-daemon --console=plain
```
Expected: BUILD SUCCESSFUL. Then confirm the service + permissions merged:
```bash
grep -oE 'PsfForegroundService|FOREGROUND_SERVICE_DATA_SYNC' app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml | sort -u
```
Expected: both strings present.

- [ ] **Step 8: Commit**

```bash
git add modules/psf-foreground-service
git commit -m "feat(android): local foreground-service Expo module"
```

---

### Task 2: JS controller

**Files:** Create `lib/background-service.ts`; Test `tests/background-service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/background-service.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const start = vi.fn(async () => {});
const stop = vi.fn(async () => {});
const isRunning = vi.fn(async () => false);
vi.mock("@/modules/psf-foreground-service", () => ({
  startForegroundService: () => start(),
  stopForegroundService: () => stop(),
  isForegroundServiceRunning: () => isRunning(),
}));

import {
  enableBackgroundService,
  disableBackgroundService,
  isBackgroundServiceEnabled,
} from "@/lib/background-service";

describe("background-service controller", () => {
  beforeEach(() => {
    start.mockClear();
    stop.mockClear();
    isRunning.mockClear();
  });

  it("starts and stops the service", async () => {
    await enableBackgroundService();
    expect(start).toHaveBeenCalledTimes(1);
    await disableBackgroundService();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("reports the running state", async () => {
    isRunning.mockResolvedValueOnce(true);
    expect(await isBackgroundServiceEnabled()).toBe(true);
  });

  it("never throws when the native module fails", async () => {
    start.mockRejectedValueOnce(new Error("no module"));
    await expect(enableBackgroundService()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/background-service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/background-service.ts
import { log } from "@shared/log";
import {
  startForegroundService,
  stopForegroundService,
  isForegroundServiceRunning,
} from "@/modules/psf-foreground-service";

// Thin, Android-guarded wrapper. The native module no-ops off Android, so these
// are safe everywhere; failures are logged, never thrown.
export async function enableBackgroundService(): Promise<void> {
  try {
    await startForegroundService();
  } catch (e) {
    log.warn("[BackgroundService] start failed", e);
  }
}

export async function disableBackgroundService(): Promise<void> {
  try {
    await stopForegroundService();
  } catch (e) {
    log.warn("[BackgroundService] stop failed", e);
  }
}

export async function isBackgroundServiceEnabled(): Promise<boolean> {
  try {
    return await isForegroundServiceRunning();
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/background-service.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/background-service.ts tests/background-service.test.ts
git commit -m "feat(android): background-service controller"
```

---

### Task 3: Settings toggle

**Files:** Modify `lib/types.ts` + `lib/storage/settings.ts`; Modify `app/(tabs)/settings.tsx`; Test `tests/settings-background-service.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/settings-background-service.test.ts
import { describe, expect, it, vi } from "vitest";

const enable = vi.fn(async () => {});
const disable = vi.fn(async () => {});
vi.mock("@/lib/background-service", () => ({
  enableBackgroundService: () => enable(),
  disableBackgroundService: () => disable(),
}));

import { applyBackgroundServiceToggle } from "@/lib/background-service-toggle";

describe("applyBackgroundServiceToggle", () => {
  it("enables when on and disables when off", async () => {
    await applyBackgroundServiceToggle(true);
    expect(enable).toHaveBeenCalledTimes(1);
    await applyBackgroundServiceToggle(false);
    expect(disable).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/settings-background-service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add the setting + toggle helper**

In `lib/types.ts`, add to `AppSettings`:
```ts
  backgroundServiceEnabled: boolean;
```

In `lib/storage/settings.ts`, add `backgroundServiceEnabled: false` to the default settings object (alongside the other booleans).

Create `lib/background-service-toggle.ts`:
```ts
import { enableBackgroundService, disableBackgroundService } from "./background-service";

// Keeps the native side in sync with the persisted toggle value.
export async function applyBackgroundServiceToggle(enabled: boolean): Promise<void> {
  if (enabled) await enableBackgroundService();
  else await disableBackgroundService();
}
```

- [ ] **Step 4: Add the Settings switch**

In `app/(tabs)/settings.tsx`, add a "Background refresh" row (near the notification settings) with a `Switch` bound to `settings.backgroundServiceEnabled`; on change, `update({ backgroundServiceEnabled: value })` then `void applyBackgroundServiceToggle(value)`. Copy: "Keeps checking prices while the app is closed (shows a persistent notification)."

- [ ] **Step 5: Run test + typecheck**

Run: `pnpm exec vitest run tests/settings-background-service.test.ts && pnpm check`
Expected: PASS, 0 type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/storage/settings.ts lib/background-service-toggle.ts "app/(tabs)/settings.tsx" tests/settings-background-service.test.ts
git commit -m "feat(settings): background refresh toggle"
```

---

### Task 4: Device spike (GATING)

**Files:** none (device validation). Do NOT proceed past this task if it fails.

- [ ] **Step 1: Build + install**

```bash
npx expo prebuild --platform android
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=x86_64
adb install -r app/build/outputs/apk/release/app-release.apk
```

- [ ] **Step 2: Start the service and background the app**

Enable **Background refresh** in Settings (the notification should appear), then press Home (`adb shell input keyevent 3`).

- [ ] **Step 3: Trigger a browser-only fetch while backgrounded**

Use `adb shell am broadcast`/`cmd jobscheduler` to run the WorkManager task, or wait for the interval; then check whether a browser-only distributor's price updated (Health shows `working`, or the watchlist price changed).

- [ ] **Step 4: Decide**

- **PASS** (a browser-only distributor rendered while backgrounded) → continue to Task 5.
- **FAIL** (no render; the WebView is throttled) → STOP. Report that the FGS alone is insufficient and the overlay design (`SYSTEM_ALERT_WINDOW`) is required; do not ship a toggle that doesn't work.

- [ ] **Step 5: Stop the service**

Disable the toggle; confirm the notification disappears.

---

### Task 5: Full verification + docs

**Files:** `todo.md`

- [ ] **Step 1: Gate**

Run: `pnpm check && pnpm lint && pnpm verify`
Expected: green.

- [ ] **Step 2: Source guard**

Create `tests/foreground-service-module-guard.test.ts` asserting the module manifest declares `FOREGROUND_SERVICE_DATA_SYNC` and the service uses `foregroundServiceType="dataSync"`.

- [ ] **Step 3: Document**

Add a `todo.md` phase entry: the FGS background refresh, the spike result, and the remaining limit (per-site coverage). Commit `docs: background refresh foreground service (Phase NNNN)`.

---

## Self-Review

- **Spec coverage:** local module + service (Task 1), controller (Task 2), opt-in toggle + setting (Task 3), gating device spike (Task 4), verify/docs (Task 5). Overlay and iOS are explicitly out of scope.
- **Placeholders:** none.
- **Type consistency:** `startForegroundService/stopForegroundService/isForegroundServiceRunning` (module) → `enableBackgroundService/disableBackgroundService/isBackgroundServiceEnabled` (controller) → `applyBackgroundServiceToggle(enabled)` (toggle) → `backgroundServiceEnabled` (setting) are used consistently.
