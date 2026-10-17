import ActivityKit
import Foundation

@MainActor
final class KefeLockScreenCoordinator {
    private var activity: Activity<KefeLyricsAttributes>?

    func start(title: String, artist: String, currentLine: String, nextLine: String = "", isPlaying: Bool = true) async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        if activity != nil {
            await update(title: title, artist: artist, currentLine: currentLine, nextLine: nextLine, isPlaying: isPlaying)
            return
        }
        let attributes = KefeLyricsAttributes(sessionID: UUID().uuidString)
        let state = KefeLyricsAttributes.ContentState(
            title: title, artist: artist, currentLine: currentLine,
            nextLine: nextLine, updatedAt: Date(), isPlaying: isPlaying
        )
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(60))
        do {
            activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
        } catch {
            print("[KEFE Live Lyrics] Could not start Live Activity: \(error)")
        }
    }

    func update(title: String? = nil, artist: String? = nil, currentLine: String, nextLine: String = "", isPlaying: Bool = true) async {
        guard let activity else {
            if let title {
                await start(title: title, artist: artist ?? "", currentLine: currentLine, nextLine: nextLine, isPlaying: isPlaying)
            }
            return
        }
        let old = activity.content.state
        let state = KefeLyricsAttributes.ContentState(
            title: title ?? old.title, artist: artist ?? old.artist,
            currentLine: currentLine, nextLine: nextLine,
            updatedAt: Date(), isPlaying: isPlaying
        )
        await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(60)))
    }

    func handleBridgeMessage(_ message: [String: Any]) async {
        let action = message["action"] as? String ?? "update"
        let title = (message["title"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "KEFE"
        let artist = message["artist"] as? String ?? ""
        let currentLine = message["currentLine"] as? String ?? ""
        let nextLine = message["nextLine"] as? String ?? ""
        let isPlaying = message["isPlaying"] as? Bool ?? false
        switch action {
        case "start":
            await start(title: title, artist: artist, currentLine: currentLine, nextLine: nextLine, isPlaying: isPlaying)
        case "pause":
            await update(title: title, artist: artist, currentLine: currentLine, nextLine: nextLine, isPlaying: false)
        case "end":
            await end()
        default:
            await update(title: title, artist: artist, currentLine: currentLine, nextLine: nextLine, isPlaying: isPlaying)
        }
    }

    func end() async {
        guard let activity else { return }
        await activity.end(ActivityContent(state: activity.content.state, staleDate: nil), dismissalPolicy: .immediate)
        self.activity = nil
    }
}
