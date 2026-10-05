package expo.modules.psfforegroundservice

import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PsfForegroundServiceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PsfForegroundService")

    AsyncFunction("start") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      val intent = Intent(context, PsfForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    AsyncFunction("stop") {
      val context = appContext.reactContext ?: return@AsyncFunction null
      context.stopService(Intent(context, PsfForegroundService::class.java))
    }

    AsyncFunction("isRunning") {
      PsfForegroundService.isRunning
    }
  }
}
