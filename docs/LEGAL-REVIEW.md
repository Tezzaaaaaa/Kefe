# KEFE legal review (first pass)

Engineering audit of the repo as of `372ec41`, not legal advice. Have a lawyer (an Australian one, since the operator is in Queensland) review before launch, especially items 1 and 2. Items are ordered by exposure.

## 1. Lyrics from unlicensed sources (highest risk)

`apps/web/app/editor.js` auto-fetches lyrics from third-party services:

| Source | Where | Concern |
|---|---|---|
| LRCLIB (`lrclib.net`) | `tryLrclib*` | Community database; licensing of the lyrics is not guaranteed by the service |
| BetterLyrics (`api.betterlyrics.org`) | `tryBetterLyrics` | Unofficial aggregator |
| LyricsPlus mirrors (4 hosts) | `tryLyricsPlus` | Requested with `source=apple,lyricsplus,musixmatch,spotify,musixmatch-word`, i.e. lyrics originating from Apple, Musixmatch and Spotify, whose terms do not allow this use |

Lyrics are copyrighted (words and, separately, the musical work). Fetching, storing, displaying and exporting them in videos without a licence is infringement risk, and using unofficial mirrors of licensed catalogues also breaches those platforms' terms. The mirrors are not under KEFE's control and can disappear.

Options, strongest first:
1. Remove the auto-fetch. The user loads their own lyrics (LRC, SRT, JSON, paste). KEFE is then a tool, and the user supplies the content.
2. Keep only sources whose terms permit it, and show attribution. Needs a written check of each service's terms.
3. License lyrics through a provider (Musixmatch and LyricFind both run commercial APIs).

Recommendation: option 1 now, option 3 if auto-fetch is a core feature.

## 2. User media and exported videos

Users load their own audio/video and export lyric videos. Copyright in the music and lyrics stays with the rightsholders, and posting an export to YouTube/Instagram/TikTok may need sync and master licences. KEFE is not the uploader, but:
- Terms of Use must put responsibility for rights on the user (draft in `apps/web/legal/terms.html`).
- Add a short notice at export: "Only export media you have the right to use."
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

KEFE runs in the browser. Data leaves the device only through these requests, which the privacy policy discloses:
- iTunes Search (search text)
- Lyric services (title, artist, album, duration)
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

1. Remove lyrics auto-fetch, or license lyrics? (item 1)
2. Operator identity for Terms and Privacy: legal name or business name, ABN if any, contact email.
3. Will accounts or payments ship? (changes items 2 and 5)
4. Are you happy to rename the brand-named effects? (item 4)

## What is in this change

- `apps/web/legal/privacy.html`: draft privacy policy matching today's behaviour.
- `apps/web/legal/terms.html`: draft terms of use.
- This review.

Both pages have `[PLACEHOLDER]` fields and a draft banner. They are not linked from the editor yet.
