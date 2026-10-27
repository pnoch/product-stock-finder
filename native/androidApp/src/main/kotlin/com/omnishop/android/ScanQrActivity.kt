package com.omnishop.android

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ExperimentalGetImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScannerOptions
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors

class ScanQrActivity : ComponentActivity() {
    private val executor = Executors.newSingleThreadExecutor()
    private val scanner = BarcodeScanning.getClient(
        BarcodeScannerOptions.Builder().setBarcodeFormats(Barcode.FORMAT_QR_CODE).build(),
    )
    private var handled = false
    private val permission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) startCamera()
        else finishWithError("Camera permission is required to scan a pairing QR.")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
            startCamera()
        } else {
            permission.launch(Manifest.permission.CAMERA)
        }
    }

    private fun startCamera() {
        val previewView = PreviewView(this).apply { scaleType = PreviewView.ScaleType.FILL_CENTER }
        val hint = TextView(this).apply {
            text = "Scan the pairing QR code"
            setTextColor(Color.WHITE)
            textSize = 18f
            setPadding(32, 32, 32, 32)
        }
        setContentView(FrameLayout(this).apply {
            addView(previewView)
            addView(hint, FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.TOP or Gravity.CENTER_HORIZONTAL,
            ))
        })
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = future.get()
            val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
            val analysis = ImageAnalysis.Builder()
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
            analysis.setAnalyzer(executor, ::analyze)
            provider.unbindAll()
            provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, preview, analysis)
        }, ContextCompat.getMainExecutor(this))
    }

    @androidx.annotation.OptIn(ExperimentalGetImage::class)
    private fun analyze(imageProxy: ImageProxy) {
        val media = imageProxy.image
        if (media == null) {
            imageProxy.close()
            return
        }
        val image = InputImage.fromMediaImage(media, imageProxy.imageInfo.rotationDegrees)
        scanner.process(image)
            .addOnSuccessListener { barcodes ->
                val value = barcodes.firstOrNull()?.rawValue
                if (value != null && !handled) {
                    handled = true
                    setResult(RESULT_OK, Intent().putExtra(EXTRA_CODE, value))
                    finish()
                }
            }
            .addOnCompleteListener { imageProxy.close() }
    }

    override fun onDestroy() {
        scanner.close()
        executor.shutdown()
        super.onDestroy()
    }

    private fun finishWithError(message: String) {
        setResult(RESULT_CANCELED, Intent().putExtra(EXTRA_ERROR, message))
        finish()
    }

    companion object {
        const val EXTRA_CODE = "code"
        const val EXTRA_ERROR = "error"
    }
}
