import ActivityKit
import SwiftUI
import WidgetKit

struct KefeLyricsLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: KefeLyricsAttributes.self) { context in
            VStack(alignment: .leading, spacing: 8) {
                Text(context.state.title).font(.headline).lineLimit(1)
                Text(context.state.artist).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                Text(context.state.currentLine.isEmpty ? "Lyrics will appear here" : context.state.currentLine)
                    .font(.title3.weight(.semibold)).lineLimit(3).multilineTextAlignment(.leading)
                if !context.state.nextLine.isEmpty {
                    Text(context.state.nextLine).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
            }
            .padding(.vertical, 8)
            .activityBackgroundTint(Color.black.opacity(0.9))
            .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: "waveform").foregroundStyle(.primary) }
                DynamicIslandExpandedRegion(.center) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(context.state.title).font(.caption.weight(.semibold)).lineLimit(1)
                        Text(context.state.currentLine).font(.subheadline).lineLimit(2)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if !context.state.nextLine.isEmpty {
                        Text(context.state.nextLine).font(.caption).foregroundStyle(.secondary).lineLimit(1)
                    }
                }
            } compactLeading: { Image(systemName: "waveform") }
              compactTrailing: { Text("KEFE").font(.caption2) }
              minimal: { Image(systemName: "waveform") }
        }
    }
}
