import ActivityKit
import Foundation

struct KefeLyricsAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var artist: String
        var currentLine: String
        var nextLine: String
        var updatedAt: Date
        var isPlaying: Bool
    }
    var sessionID: String
}
