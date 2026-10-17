# KEFE iOS Lock Screen companion

The native companion wraps the hosted KEFE editor in a WKWebView and connects it to iOS Now Playing controls and an ActivityKit Live Activity. The bridge is separate from all lyric renderers; `apps/web/app/effects/lyric-apple.js` is not part of this integration.

## Implemented in this repository

- XcodeGen project specification for the KEFE iOS app and Live Activity Widget Extension.
- Background audio session configuration and the `audio` background mode.
- Native Now Playing title, artist, album, artwork, elapsed time, and transport commands.
- Web-to-native bridge that sends timed lyric lines and metadata.
- Native timed-line scheduler so line changes do not depend on WebView animation frames continuing while the phone is locked.
- Lock Screen and Dynamic Island presentation for the current and next lyric.

## Generate and build on a Mac

Requirements: macOS, Xcode with an iOS Simulator SDK, and XcodeGen.

```sh
brew install xcodegen
cd apps/ios
xcodegen generate
open KEFE.xcodeproj
```

Select the `KEFE` scheme, set your Apple development team in Signing & Capabilities, then build for an iPhone or simulator. For a device build, use a real iPhone to test background playback, Lock Screen controls, Live Activity authorization, and lyric updates. The bundle identifiers in `project.yml` are placeholders and can be changed before distribution.

## Important platform limits

- Live Activities are not continuously animated lyric canvases. iOS controls update frequency and may throttle frequent updates; the UI shows the current/next line when the system accepts an update.
- Background audio depends on iOS, the audio source, app lifecycle and device settings. Test the actual imported formats and interruptions (calls, headphones, route changes) on a physical device.
- The app currently loads the hosted GitHub Pages editor. Audio files chosen inside the WebView remain in that WebView session; they are not imported into a separate native media library.
- Native build and physical-device testing are still required before claiming end-to-end verification. This environment cannot run Xcode or validate iPhone behavior.

## Data flow

The editor sends a minimal payload through the `kefeLockScreen` WKScriptMessageHandler: track metadata, artwork URL, playback position, current/next lyric and the timed line schedule. The native coordinator uses the playback position as an anchor and schedules line transitions independently while playback continues. It does not inspect, invoke or modify the Apple Music lyric renderer.
