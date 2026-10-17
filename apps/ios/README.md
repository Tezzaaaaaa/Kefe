# KEFE iOS Lock Screen companion — native implementation

This directory contains the ActivityKit/SwiftUI source foundation for the native part of KEFE's iPhone Lock Screen lyrics experience. It is intentionally separate from the browser editor and from every lyric renderer, including the Apple Music effect.

## What is supported

- The web editor publishes track metadata and playback state through the browser Media Session API where Safari/iOS supports it. It provides system play/pause/seek controls and position information; support varies by iOS/browser version and media source.
- The native ActivityKit view can display a current lyric line and track metadata on the Lock Screen and Dynamic Island.
- Native playback must own the audio session to reliably continue audio in the background. A local file selected in Safari is not automatically available to a separate native app; a native playback/import flow or a deliberate WKWebView bridge is required.

## Native app work still required

These source files are not yet a complete, buildable Xcode project. To ship the native part, add them to an iOS app target and a Widget Extension target, configure the shared ActivityAttributes type in both targets, enable Supports Live Activities, configure the audio background mode (audio in UIBackgroundModes), and implement native playback plus a controlled bridge for track/lyric updates. Test on physical iPhones and supported iOS versions.

Live Activities are not a continuously rendered lyric canvas. They can show a current/next line and update when ActivityKit allows, but updates can be throttled and animation is not guaranteed to run continuously while locked. Use the system Now Playing interface for transport controls and metadata.

## Data contract

Call KefeLockScreenCoordinator.start(title:artist:currentLine:nextLine:) when a native playback session starts; call update(currentLine:nextLine:) when a timed line changes; call end() when playback finishes. The app must supply lyric timing from its own playback clock. Do not couple this contract to the Apple Music renderer.
