import SwiftUI
import UIKit
import OmniShopShared

@main
struct OmniShopIOSApp: App {
    @Environment(\.scenePhase) private var scenePhase

    init() {
        IosBackgroundSync.register(transport: IosSyncTransport.shared)
    }

    var body: some Scene {
        WindowGroup {
            ComposeView()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { IosBackgroundSync.schedule() }
        }
    }
}

struct ComposeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        let files = DocumentPickerBackupFiles()
        let transport = IosSyncTransport.shared
        return MainViewControllerKt.MainViewController(
            cryptoCallbacks: makeCryptoCallbacks(),
            secretCallbacks: makeSecretCallbacks(),
            backupCallbacks: files.makeCallbacks(),
            syncTransport: transport,
            openUrl: { raw in
                if let url = URL(string: raw) { UIApplication.shared.open(url) }
            }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}
