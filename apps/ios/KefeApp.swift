import AVFoundation
import SwiftUI
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
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        private let lockScreen = KefeLockScreenCoordinator()

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "kefeLockScreen", let body = message.body as? [String: Any] else { return }
            Task { @MainActor in await lockScreen.handleBridgeMessage(body) }
        }
    }
}
