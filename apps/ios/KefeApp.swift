import AVFoundation
import MediaPlayer
import SwiftUI
import UIKit
import WebKit

@main
struct KefeApp: App {
    init() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [])
            try session.setActive(true)
        } catch {
            print("[KEFE audio session] \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            KefeWebEditor()
                .ignoresSafeArea(.container, edges: .bottom)
                .preferredColorScheme(.dark)
        }
    }
}

struct KefeWebEditor: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let content = WKUserContentController()
        content.add(context.coordinator, name: "kefeLockScreen")
        let configuration = WKWebViewConfiguration()
        configuration.userContentController = content
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        let webView = WKWebView(frame: .zero, configuration: configuration)
        context.coordinator.webView = webView
        context.coordinator.configureRemoteCommands()
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .black
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.load(URLRequest(url: URL(string: "https://tezzaaaaaa.github.io/Kefe/")!))
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "kefeLockScreen")
        coordinator.clearRemoteCommands()
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        private let lockScreen = KefeLockScreenCoordinator()
        weak var webView: WKWebView?
        private var commandTokens: [(MPRemoteCommand, Any)] = []
        private var artworkURL = ""

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "kefeLockScreen", let body = message.body as? [String: Any] else { return }
            syncNowPlaying(body)
            Task { @MainActor in await lockScreen.handleBridgeMessage(body) }
        }

        func configureRemoteCommands() {
            let center = MPRemoteCommandCenter.shared()
            center.playCommand.isEnabled = true
            center.pauseCommand.isEnabled = true
            center.stopCommand.isEnabled = true
            center.skipForwardCommand.isEnabled = true
            center.skipBackwardCommand.isEnabled = true
            center.skipForwardCommand.preferredIntervals = [10]
            center.skipBackwardCommand.preferredIntervals = [10]
            center.changePlaybackPositionCommand.isEnabled = true

            add(center.playCommand) { [weak self] in
                self?.runJavaScript("(async()=>{const g=window.kefeAudioGraph?.context?.();if(g&&g.state==='suspended')await g.resume();const a=document.getElementById('kefeAudio');if(a)await a.play()})()")
            }
            add(center.pauseCommand) { [weak self] in
                self?.runJavaScript("document.getElementById('kefeAudio')?.pause()")
            }
            add(center.stopCommand) { [weak self] in
                self?.runJavaScript("(()=>{const a=document.getElementById('kefeAudio');if(a){a.pause();a.currentTime=0}})()")
            }
            add(center.skipForwardCommand) { [weak self] in
                self?.runJavaScript("(()=>{const a=document.getElementById('kefeAudio');if(a)a.currentTime=Math.min(a.duration||Infinity,a.currentTime+10)})()")
            }
            add(center.skipBackwardCommand) { [weak self] in
                self?.runJavaScript("(()=>{const a=document.getElementById('kefeAudio');if(a)a.currentTime=Math.max(0,a.currentTime-10)})()")
            }
            add(center.changePlaybackPositionCommand) { [weak self] event in
                guard let event = event as? MPChangePlaybackPositionCommandEvent else { return }
                let seconds = max(0, event.positionTime)
                self?.runJavaScript("(()=>{const a=document.getElementById('kefeAudio');if(a)a.currentTime=\(seconds)})()")
            }
        }

        private func add(_ command: MPRemoteCommand, handler: @escaping (MPRemoteCommandEvent?) -> Void) {
            let token = command.addTarget { event in
                handler(event)
                return .success
            }
            commandTokens.append((command, token))
        }

        func clearRemoteCommands() {
            commandTokens.forEach { command, token in command.removeTarget(token) }
            commandTokens.removeAll()
        }

        private func runJavaScript(_ script: String) {
            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript(script) { _, error in
                    if let error { print("[KEFE remote control] \(error)") }
                }
            }
        }

        private func syncNowPlaying(_ message: [String: Any]) {
            let title = message["title"] as? String ?? "KEFE"
            let artist = message["artist"] as? String ?? ""
            let album = message["album"] as? String ?? ""
            let currentTime = max(0, message["currentTime"] as? Double ?? 0)
            let duration = max(0, message["duration"] as? Double ?? 0)
            let isPlaying = message["isPlaying"] as? Bool ?? false
            var info: [String: Any] = [
                MPMediaItemPropertyTitle: title,
                MPMediaItemPropertyArtist: artist,
                MPNowPlayingInfoPropertyElapsedPlaybackTime: currentTime,
                MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0
            ]
            if !album.isEmpty { info[MPMediaItemPropertyAlbumTitle] = album }
            if duration > 0 { info[MPMediaItemPropertyPlaybackDuration] = duration }
            MPNowPlayingInfoCenter.default().nowPlayingInfo = info

            let newArtworkURL = message["artworkURL"] as? String ?? ""
            guard !newArtworkURL.isEmpty, newArtworkURL != artworkURL, let url = URL(string: newArtworkURL) else { return }
            artworkURL = newArtworkURL
            URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
                guard let data, let image = UIImage(data: data) else { return }
                let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
                DispatchQueue.main.async {
                    guard let self, self.artworkURL == newArtworkURL,
                          var latest = MPNowPlayingInfoCenter.default().nowPlayingInfo else { return }
                    latest[MPMediaItemPropertyArtwork] = artwork
                    MPNowPlayingInfoCenter.default().nowPlayingInfo = latest
                }
            }.resume()
        }
    }
}
