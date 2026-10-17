import ActivityKit
import Foundation

struct KefeLyricsAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var artist: String
        var currentLine: String
        var nextLine: String
        var updatedAt: Date
    }
    var sessionID: String
}

@MainActor
final class KefeLockScreenCoordinator {
    private var activity: Activity<KefeLyricsAttributes>?

    func start(title: String, artist: String, currentLine: String, nextLine: String = "") async {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        let attributes = KefeLyricsAttributes(sessionID: UUID().uuidString)
        let state = KefeLyricsAttributes.ContentState(
            title: title, artist: artist, currentLine: currentLine,
            nextLine: nextLine, updatedAt: Date()
        )
        let content = ActivityContent(state: state, staleDate: Date().addingTimeInterval(30))
        do {
            activity = try Activity.request(attributes: attributes, content: content, pushType: nil)
        } catch {
            print("[KEFE Live Lyrics] Could not start Live Activity: \(error)")
        }
    }

    func update(currentLine: String, nextLine: String = "") async {
        guard let activity else { return }
        let old = activity.content.state
        let state = KefeLyricsAttributes.ContentState(
            title: old.title, artist: old.artist, currentLine: currentLine,
            nextLine: nextLine, updatedAt: Date()
        )
        await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(30)))
    }

    func end() async {
        guard let activity else { return }
        await activity.end(ActivityContent(state: activity.content.state, staleDate: nil), dismissalPolicy: .immediate)
        self.activity = nil
    }
}
