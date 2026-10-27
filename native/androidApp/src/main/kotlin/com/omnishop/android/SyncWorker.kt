package com.omnishop.android

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.omnishop.data.OrderPrivateService
import com.omnishop.data.ReceiptService
import com.omnishop.data.ShoppingStore
import com.omnishop.data.SyncResult
import com.omnishop.data.openAndroid
import com.omnishop.data.security.JcaBackupCrypto
import com.omnishop.sync.TlsSyncService
import java.util.UUID
import java.util.concurrent.TimeUnit

class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result {
        val store = ShoppingStore.openAndroid(applicationContext)
        val crypto = JcaBackupCrypto()
        val secrets = AndroidSecretStore(applicationContext)
        val privateService = OrderPrivateService(store, secrets, crypto)
        val receipts = ReceiptService(privateService, store, { UUID.randomUUID().toString() })
        val service = runCatching {
            TlsSyncService(
                store, secrets, crypto, receipts,
                displayName = "Android", enableDiscovery = false, enableServer = false,
            )
        }.getOrNull() ?: run {
            store.close()
            return Result.success()
        }
        return try {
            var failed = false
            service.peers().forEach { peer ->
                if (service.sync(peer.deviceId) is SyncResult.Failure) failed = true
            }
            if (failed) Result.retry() else Result.success()
        } finally {
            service.close()
            store.close()
        }
    }
}

object SyncWorkScheduler {
    private const val WORK_NAME = "omnishop-peer-sync"

    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<SyncWorker>(6, TimeUnit.HOURS)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build(),
            )
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request,
        )
    }
}
