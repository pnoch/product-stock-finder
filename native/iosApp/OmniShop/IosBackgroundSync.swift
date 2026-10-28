import BackgroundTasks
import Foundation

enum IosBackgroundSync {
    static let identifier = "com.omnishop.ios.sync"

    static func register(transport: IosSyncTransport?) {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: identifier, using: nil) { task in
            guard let task = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }
            schedule()
            task.expirationHandler = { task.setTaskCompleted(success: false) }
            transport?.backgroundSync { success in
                task.setTaskCompleted(success: success)
            }
        }
    }

    static func schedule() {
        let request = BGAppRefreshTaskRequest(identifier: identifier)
        request.earliestBeginDate = Date(timeIntervalSinceNow: 6 * 60 * 60)
        try? BGTaskScheduler.shared.submit(request)
    }
}
