import ActivityKit
import Foundation

@MainActor
final class KefeLockScreenCoordinator {
    private struct TimedLyric {
        let text: String
        let time: TimeInterval
    }

    private var activity: Activity<KefeLyricsAttributes>?
    private var lyrics: [TimedLyric] = []
    private var playbackTask: Task<Void, Never>?
    private var anchorTime: TimeInterval = 0
    private var anchorDate = Date()
    private var isPlaying = false
    private var title = "KEFE"
    private var artist = ""
    private var lastPublishedIndex = Int.min

    func handleBridgeMessage(_ message: [String: Any]) async {
        let action = message["action"] as? String ?? "update"
        title = (message["title"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "KEFE"
        artist = message["artist"] as? String ?? ""
        let currentLine = message["currentLine"] as? String ?? ""
        let nextLine = message["nextLine"] as? String ?? ""
        let currentTime = max(0, message["currentTime"] as? Double ?? 0)
        let playing = message["isPlaying"] as? Bool ?? false

        if let incoming = message["lines"] as? [[String: Any]] {
            lyrics = incoming.compactMap { item in
                guard let text = item["text"] as? String,
                      let time = item["time"] as? Double,
                      time.isFinite, time >= 0, !text.isEmpty else { return nil }
                return TimedLyric(text: text, time: time)
            }.sorted { $0.time < $1.time }
        }

        if action == "end" {
            playbackTask?.cancel()
            playbackTask = nil
            isPlaying = false
            await end()
            return
        }

        if action == "pause" || !playing {
            isPlaying = false
            playbackTask?.cancel()
            playbackTask = nil
            await update(title: title, artist: artist, currentLine: currentLine, nextLine: nextLine, isPlaying: false)
            return
        }

        // The native clock takes over while the WebView is backgrounded or locked.
        // It advances through the imported lyric schedule without relying on requestAnimationFrame.
        anchorTime = currentTime
        anchorDate = Date()
        isPlaying = true
        lastPublishedIndex = index(at: currentTime)
        if activity == nil {
            await start(title: title, artist: artist, currentLine: currentLine, nextLine: nextLine, isPlaying: true)
        } else {
            await update(title: title, artist: artist, currentLine: currentLine, nextLine: nextLine, isPlaying: true)
        }
        schedulePlaybackUpdates()
    }

    private func index(at time: TimeInterval) -> Int {
        var result = -1
        for (index, lyric) in lyrics.enumerated() {
            if time >= lyric.time { result = index } else { break }
        }
        return result
    }

    private func schedulePlaybackUpdates() {
        playbackTask?.cancel()
        guard isPlaying, activity != nil, !lyrics.isEmpty else { return }
        playbackTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                guard let self, self.isPlaying else { return }
                let elapsed = Date().timeIntervalSince(self.anchorDate)
                let time = max(0, self.anchorTime + elapsed)
                let currentIndex = self.index(at: time)
                if currentIndex != self.lastPublishedIndex {
                    self.lastPublishedIndex = currentIndex
                    let current = currentIndex >= 0 ? self.lyrics[currentIndex].text : ""
                    let nextIndex = currentIndex + 1
                    let next = self.lyrics.indices.contains(nextIndex) ? self.lyrics[nextIndex].text : ""
                    await self.update(title: self.title, artist: self.artist, currentLine: current, nextLine: next, isPlaying: true)
                }
                let nextTime = self.lyrics.first(where: { $0.time > time })?.time
                let wait = min(max((nextTime ?? (time + 10)) - time, 0.15), 30)
                do {
                    try await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
                } catch {
                    return
                }
            }
        }
    }

    private func start(title: String, artist: String, currentLine: String, nextLine: String, isPlaying: Bool) async {
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
        do {
            activity = try Activity.request(
                attributes: attributes,
                content: ActivityContent(state: state, staleDate: Date().addingTimeInterval(60)),
                pushType: nil
            )
        } catch {
            print("[KEFE Live Lyrics] Could not start Live Activity: \(error)")
        }
    }

    private func update(title: String, artist: String, currentLine: String, nextLine: String, isPlaying: Bool) async {
        guard let activity else { return }
        let state = KefeLyricsAttributes.ContentState(
            title: title, artist: artist, currentLine: currentLine,
            nextLine: nextLine, updatedAt: Date(), isPlaying: isPlaying
        )
        await activity.update(ActivityContent(state: state, staleDate: Date().addingTimeInterval(60)))
    }

    private func end() async {
        guard let activity else { return }
        await activity.end(ActivityContent(state: activity.content.state, staleDate: nil), dismissalPolicy: .immediate)
        self.activity = nil
    }
}
