import Foundation
import OmniShopShared
import UIKit
import UniformTypeIdentifiers

final class DocumentPickerBackupFiles: NSObject, UIDocumentPickerDelegate {
    private var pendingSave: ((Bool) -> Void)?
    private var pendingOpen: ((KotlinByteArray?) -> Void)?

    func makeCallbacks() -> IosBackupCallbacks {
        IosBackupCallbacks(
            save: { name, bytes, result in
                let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
                do {
                    try bytes.toData().write(to: url, options: .atomic)
                } catch {
                    result(false)
                    return
                }
                self.pendingSave = result
                self.present(UIDocumentPickerViewController(forExporting: [url], asCopy: true))
            },
            open: { result in
                self.pendingOpen = result
                self.present(UIDocumentPickerViewController(
                    forOpeningContentTypes: [UTType.data],
                    asCopy: true
                ))
            }
        )
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if let save = pendingSave {
            pendingSave = nil
            save(true)
            return
        }
        guard let open = pendingOpen, let url = urls.first else { return }
        pendingOpen = nil
        let accessing = url.startAccessingSecurityScopedResource()
        defer { if accessing { url.stopAccessingSecurityScopedResource() } }
        open(KotlinByteArray.from((try? Data(contentsOf: url)) ?? Data()))
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        pendingSave?(false)
        pendingOpen?(nil)
        pendingSave = nil
        pendingOpen = nil
    }

    private func present(_ picker: UIDocumentPickerViewController) {
        picker.delegate = self
        guard let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first,
            let root = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else { return }
        var controller = root
        while let presented = controller.presentedViewController { controller = presented }
        controller.present(picker, animated: true)
    }
}
