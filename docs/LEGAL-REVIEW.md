# KEFE legal review (first pass)

Engineering audit and remediation log, not legal advice. See [LEGAL-REMEDIATION-STATUS.md](LEGAL-REMEDIATION-STATUS.md) for the current release blockers. The automatic LRCLIB lookup has since been disabled in the `legal-remediation-2026-10` branch pending rights clearance; this does not resolve the remaining blockers. Have an Australian lawyer review before commercial launch.

## 1. Lyrics sources (highest risk; partly addressed)

Originally `apps/web/app/editor.js` auto-fetched lyrics from LRCLIB, BetterLyrics, binimum and four LyricsPlus mirrors. LyricsPlus was asked for lyrics sourced from Apple, Musixmatch and Spotify (`source=apple,lyricsplus,musixmatch,spotify,musixmatch-word`), whose terms do not allow this use.

**Mitigation in branch `legal-remediation-2026-10`:** BetterLyrics, binimum and LyricsPlus were removed previously. Automatic LRCLIB lookup is now disabled pending rights clearance; user-supplied lyrics remain supported. This is a risk reduction, not a determination that all lyric uses are lawful.

**Still open:**
- Lyrics are copyrighted (the words, separately from the music). Displaying and exporting them in videos without a licence is infringement risk. LRCLIB is community-contributed and, as far as I know, does not claim to hold licences for the lyrics; its terms need a written check.
- Wording in the terms must put lyric rights on the user (drafted in `apps/web/legal/terms.html`).
- Because automatic catalogue retrieval is paused in this branch, KEFE no longer obtains catalogue lyric timing through LRCLIB. User-supplied LRC/SRT/JSON or manually entered lyrics remain available; imported timing still needs regression testing.

Further options if you want to go beyond LRCLIB, strongest first:
1. **Current branch mitigation:** keep automatic catalogue retrieval disabled. Users load their own lyrics (LRC, SRT, JSON, paste); KEFE does not host a lyrics catalogue.
2. Auto-time user-supplied lyrics against the audio in the browser, or draft lyrics from the audio with an on-device speech model. Neither stores lyric text on a KEFE service.
3. If catalogue lookup is a required product feature, obtain a written licence from a provider and verify it covers timed display and user video exports before re-enabling it.

Do not build a KEFE-hosted lyric database: storing and serving lyrics makes KEFE the host.

## 2. User media and exported videos

Users load their own audio/video and export lyric videos. Copyright in the music and lyrics stays with the rightsholders, and posting an export to YouTube/Instagram/TikTok may need sync and master licences. KEFE is not the uploader, but:
- Terms of Use must put responsibility for rights on the user (draft in `apps/web/legal/terms.html`).
- **Implemented in this branch:** the export flow asks users to confirm they own or have permission to use the included audio, lyrics, artwork and other material, and that their intended sharing/commercial use is allowed. This is a reminder, not a licence or legal defence.
- If accounts, cloud storage or sharing are added, KEFE starts hosting user content: that needs a takedown process (Australian Copyright Act safe-harbour requirements for carriage service providers) and a designated contact.

## 3. Third-party artwork and metadata

- iTunes Search API (`itunes.apple.com`) is used for song and album search and artwork. Apple's terms restrict use of artwork and metadata; check the current API terms and attribution requirements. Artwork shown inside a user's own export is the user's responsibility, but KEFE should not redistribute or cache it server-side.
- Album art and track titles in the title card are third-party copyright and trademarks.

## 4. Trademarks and brand references

Effect labels and descriptions name third-party brands: "Apple" (Apple Music-style), "Instagram" (Story-style), "Barbie", "Brat" (album-cover style), plus SF Pro Display as a system-font fallback. Risks are low if the effects are original code that only evoke a style, but:
- Rename or soften brand names in the UI (for example "Focus Lines", "Story Stack", "Pink Glow", "Edge Type").
- Do not use brand logos or imply affiliation. Add a non-affiliation line to the footer/terms (drafted).
- Check that no effect copies trade dress, fonts that are not licensed, or protected artwork.

## 5. Privacy

KEFE runs in the browser, but external requests and third-party code still need production network verification. In this branch, automatic LRCLIB lyric lookup is disabled and should not send track details to LRCLIB. The draft privacy policy has been updated to reflect this branch, but is not final until actual network behaviour is checked:
- iTunes Search (search text)
- Google Fonts (`fonts.googleapis.com`), only when a user picks a custom Google font (`lyric-inspiration-pack.js`)
- jsDelivr, on every editor load: `gif.js` (`editor.html`) and `@uimaxbai/am-lyrics` (`editor.js`, the Apple-style lyric component). These run third-party code in the page from a CDN. Pin versions and add Subresource Integrity, or bundle them. I have not verified what `am-lyrics` requests over the network (likely lyrics for the current track); check before publishing the privacy policy.
- GitHub Pages hosting (visitor IP, logged by GitHub)
- AudD song recognition, only when the operator sets `KEFE_AUDIO_RECOGNITION_*`. This uploads the user's audio file to a third party. Do not enable it without a consent prompt, and prefer a server-side proxy so the API token is not in the page.

Local storage holds editor settings only. No analytics, cookies or accounts today.

To reduce exposure: bundle `gif.js` and `am-lyrics` instead of loading them from jsDelivr, and either bundle the custom Google fonts or drop the "custom Google font" option.

When accounts and billing arrive (`apps/api`, `packages/db`, Stripe packages in the workspace config) these become required: privacy policy update, Australian Privacy Act and APPs if turnover or data handling triggers it (the small-business exemption has limits), GDPR/UK GDPR and CCPA for overseas users, a data-deletion path, a payments processor agreement, refund policy under Australian Consumer Law, and GST/ABN details on invoices.

## 6. Licences and notices

- `LICENSE` is MIT for KEFE-authored code. Fine.
- `THIRD_PARTY_NOTICES.md` says Three.js is loaded from jsDelivr, but `editor.html` does not load Three.js. The libraries actually loaded from jsDelivr are `gif.js@0.2.0` and `@uimaxbai/am-lyrics`; neither is listed. Fix the notice and add their licences (confirm each licence from the packages; I have not).
- `THIRD_PARTY_NOTICES.md` lists 17 bundled Google fonts with OFL/Apache licence files, plus Three.js. Checked: every one of the 17 has its licence file in its font directory. Good.
- The six "KEFE original merged fonts" (AuraSerif, BlockParty, Boulder, BubblegumDisplay, Kefe Tracklist Cursive, VogueNoir) are the real gap. Their `LICENSE.txt` files and `fonts/CUSTOM-FONTS-LICENSE.md` do not name the two source fonts each was built from, and none contains a Reserved Font Name statement. Under the OFL, a modified font must keep the original copyright notices, stay under the OFL, and not use a Reserved Font Name. Fix: record the two source fonts, their licences and copyright lines for each merged font, check Reserved Font Names, and rename or drop any that cannot be shipped. This needs your original build notes; I can't derive them from the font files with certainty.
- iOS app: Apple developer terms, App Store review (hosted-web-wrapper apps can be rejected under guideline 4.2), and Live Activity usage need review before distribution.
- PWA (PR #55): no new licensing impact; icons are derived from the KEFE logo.

## 7. Other

- The separate `Kefe-X-Downloader` repo downloads video from X. Downloading may breach X's terms and copyright law. Keep it clearly separate from KEFE, do not link it from KEFE, and do not ship it in any store.
- Australian Consumer Law: public claims must be accurate. The README says features are "under active development"; keep marketing consistent with what works.
- Accessibility (WCAG) is not a legal requirement for a hobby project but is for many commercial customers.

## Decisions needed from the owner

1. Keep automatic catalogue lookup disabled, or pursue a written commercial lyrics licence before considering re-enablement? (item 1)
2. Operator identity for Terms and Privacy: legal name or business name, ABN if any, contact email.
3. Will accounts or payments ship? (changes items 2 and 5)
4. Are you happy to rename the brand-named effects? (item 4)

## What is in this change

- `apps/web/legal/privacy.html`: draft privacy policy, updated to describe the disabled LRCLIB lookup and explicitly note that network behaviour still needs verification.
- `apps/web/legal/terms.html`: draft terms of use, updated to describe the paused automatic lyrics-catalogue feature.
- Export-time rights confirmation added in `apps/web/app/editor.js`.
- This review.

Both pages still have `[PLACEHOLDER]` fields and a draft banner. They must not be treated as final legal documents; operator identity and contact details must be supplied, network behaviour verified, and the pages linked from the editor before launch.
