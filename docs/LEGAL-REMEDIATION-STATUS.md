# KEFE legal remediation status

Last checked: 2026-10-17

This is an engineering remediation record, not legal advice or a legal clearance certificate.

## Implemented in this branch

- Disabled KEFE's automatic LRCLIB lyric lookup in `apps/web/app/editor.js` pending documented rights clearance.
- Left manual lyric entry and user-imported lyric files available.
- Added an in-product notice explaining why automatic lookup is paused and directing users to lyrics they have permission to use.

## Release blockers that cannot honestly be marked resolved by code changes alone

1. **Lyrics licensing:** Obtain written permission for every lyric source and intended use, including timed display and video export, or keep catalogue retrieval disabled. A community database and user-responsibility notice do not prove that the necessary rights are granted.
2. **Apple-style lyrics effect:** `apps/web/app/editor.js` dynamically loads `@uimaxbai/am-lyrics@1.8.2` from jsDelivr. Its network behaviour, data transfers, licence terms and permission to display any retrieved lyrics have not been verified here. Do not claim privacy or copyright clearance until these are reviewed. The effect has deliberately not been changed in this remediation because its behaviour is a separate product feature and needs a targeted review.
3. **Operator details:** Terms and privacy policy still need the operator's correct legal/business name, contact email, applicable ABN, effective date and verified contact/complaints process. Do not invent these details.
4. **Privacy accuracy:** Verify actual network requests from the production build, including the Apple-style component, and reconcile the privacy policy with observed behaviour. Confirm whether any optional song-recognition integration is enabled in each deployment.
5. **Third-party dependencies:** Verify the actual licences and required notices for `gif.js@0.2.0`, `@uimaxbai/am-lyrics@1.8.2`, all dependencies, and any CDN-delivered code. Pinning versions and using Subresource Integrity or bundling should be assessed.
6. **Merged fonts:** Identify the two upstream source fonts and preserve the required copyright/licence notices for each of the six merged fonts; check Reserved Font Names and rename or remove fonts where necessary.
7. **Artwork and metadata:** Verify current Apple iTunes Search API terms, attribution and artwork-use limits; do not redistribute or cache artwork unless permitted.
8. **Exports:** Add and verify an export-time rights reminder. Review the applicable rights for audio recordings, compositions, lyrics, artwork and target platforms. The warning is not a substitute for licences.
9. **Policies and consumer law:** Complete and publish the terms and privacy policy, make them accessible from the editor, and have Australian counsel review them before commercial launch. Reassess obligations before adding accounts, cloud storage, sharing or payments.
10. **Brand references:** Review effect names and visuals for misleading affiliation, trademark issues, trade dress and font restrictions; update notices if needed.

## Release decision

**Not cleared for commercial launch.** Automatic catalogue lyric lookup is disabled in this branch, but the other blockers above remain open. Do not describe KEFE as fully legally compliant until evidence supports each applicable requirement and a qualified Australian lawyer has reviewed the release.

## Verification required

- Test that the automatic lyric search control no longer makes LRCLIB requests.
- Test manual lyric entry and LRC/SRT/JSON imports remain functional.
- Inspect browser network traffic for all supported workflows.
- Run the project's typecheck/build and automated tests.
- Review the exact release build, legal pages and third-party notices.
