package expo.modules.psfwebviewrenderer

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.PixelFormat
import android.os.Handler
import android.os.Looper
import android.view.Gravity
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
