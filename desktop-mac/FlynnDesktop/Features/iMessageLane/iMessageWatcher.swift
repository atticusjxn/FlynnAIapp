import Foundation

/// Watches ~/Library/Messages/chat.db for write events using a kqueue-backed
/// DispatchSource. Notifies the callback when the database changes.
final class iMessageWatcher: @unchecked Sendable {
    private var source: DispatchSourceFileSystemObject?
    private var fd: Int32 = -1

    var onDatabaseChanged: (() -> Void)?

    deinit { stop() }

    func start() {
        let path = iMessagePermission.chatDBPath
        fd = open(path, O_EVTONLY)
        guard fd >= 0 else { return }

        source = DispatchSource.makeFileSystemObjectSource(
            fileDescriptor: fd,
            eventMask: .write,
            queue: DispatchQueue.global(qos: .utility)
        )

        source?.setEventHandler { [weak self] in
            self?.onDatabaseChanged?()
        }

        source?.setCancelHandler { [weak self] in
            if let fd = self?.fd, fd >= 0 { close(fd) }
            self?.fd = -1
        }

        source?.resume()
    }

    func stop() {
        source?.cancel()
        source = nil
    }
}
