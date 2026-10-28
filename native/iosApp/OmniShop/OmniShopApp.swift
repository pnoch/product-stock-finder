import SwiftUI
import UIKit
import OmniShopShared

@main
struct OmniShopIOSApp: App {
    var body: some Scene {
        WindowGroup {
            ComposeView()
        }
    }
}

struct ComposeView: UIViewControllerRepresentable {
    func makeUIViewController(context: Context) -> UIViewController {
        let files = DocumentPickerBackupFiles()
        return MainViewControllerKt.MainViewController(
            cryptoCallbacks: makeCryptoCallbacks(),
            secretCallbacks: makeSecretCallbacks(),
            backupCallbacks: files.makeCallbacks(),
            syncTransport: nil,
            openUrl: { raw in
                if let url = URL(string: raw) { UIApplication.shared.open(url) }
            }
        )
    }

    func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}
