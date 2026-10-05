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
      val context = appContext.reactContext ?: return@AsyncFunction null
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}"),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }
}
