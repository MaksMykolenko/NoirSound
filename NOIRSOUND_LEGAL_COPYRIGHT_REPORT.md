# NoirSound — Legal & Copyright Report (Phase 8)

Date: 2026-06-28

## Pages added (`src/pages/LegalPage.jsx` + `src/constants/legalContent.js`)
Practical, plain-language MVP policy copy (English) with a cross-link nav and a disclaimer on every page.

| Route | Document |
|---|---|
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |
| `/guidelines` | Community Guidelines |
| `/copyright` | Copyright Policy |
| `/dmca` | DMCA / Takedown Policy |
| `/abuse` | Abuse / Report Content |
| `/creator-rules` | Creator Upload Rules |

Routes registered in `src/App.jsx`. A **Footer** (`src/components/layout/Footer.jsx`) with all legal links is rendered app-wide in `AppLayout`.

## Required copyright surfaces
- Upload requires the creator to confirm they own the rights or have permission — enforced server-side (`copyrightConfirmed === true`) and described in Creator Upload Rules + Copyright Policy.
- "No copyrighted uploads without rights" — stated in Terms, Copyright, Creator Rules.
- **Repeat-infringer policy** — stated in Copyright Policy and Terms.
- Platform can remove/hide/suspend content — stated in Terms + Guidelines, and implemented via the moderation tools (Phase 7).
- Report/takedown process + contacts — DMCA page (`copyright@noirsound.app`) and in-app Report flow (Phase 7/9).

## Disclaimer
Every page ends with: *"This document is provided for the NoirSound public beta and is not legal advice. Consult a qualified lawyer before relying on it for a commercial launch."*

## Verification
- Frontend production build includes the legal routes (build passed; `LegalPage`/`Footer` bundled).
- `public-beta-legal.spec.js` (E2E) asserts each policy page renders its heading + the disclaimer, and that footer links navigate.

## Notes / limitations (honest)
- Legal pages are English-only for the beta (UI chrome is localized en/uk/pl/ru; policy text localization is a post-beta task). This is acceptable for a controlled beta and noted in-product via the disclaimer.
- Contact addresses are placeholders (`support@`, `copyright@noirsound.app`) — set real inboxes before launch.

## Status: PASS (MVP) — not legal advice; lawyer review required before commercial launch

## Final verification record

- **What was inspected:** all legal routes, footer navigation, rights confirmation, takedown/report flow, repeat-infringer language, enforcement rights, contacts, and disclaimer.
- **What was implemented:** the listed policy pages, app-wide footer, report flow, and server-enforced upload confirmation.
- **What was tested:** legal Playwright specs passed inside the final 62-test run; production `/terms` returned 200.
- **What could not be tested:** legal sufficiency in each launch jurisdiction and delivery to the named inboxes.
- **Exact commands:** `npm run test:e2e`; `curl -sS -o /dev/null -w '%{http_code}\n' http://localhost/terms`.
- **Exact blockers:** none for public beta.
- **Remaining risks:** obtain lawyer review before commercial launch and verify both inboxes are monitored.
- **Files changed:** `src/constants/legalContent.js`; `src/pages/LegalPage.jsx`; `src/components/layout/Footer.jsx`; `AppLayout.jsx`; `App.jsx`; legal E2E spec.
