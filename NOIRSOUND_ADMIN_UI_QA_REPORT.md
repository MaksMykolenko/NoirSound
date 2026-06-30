# NoirSound Admin UI QA Report

Date: 2026-06-30

## Surfaces checked

- Sign-in-required state at `/admin`.
- Admin-only navigation and automatic `/admin` → `/admin/overview` redirect.
- Overview stats, health cards, and quick actions.
- Users list, search, role/status filters, and detail danger zone.
- Required-reason confirmation modal and disabled confirm state.
- System page configuration redaction.
- Desktop at 1440×900.
- Mobile at 390×844.

## Findings

- The layout follows the active NoirSound theme tokens; no fixed pink accent was introduced.
- Desktop uses a compact secondary admin sidebar and dense operational cards/tables.
- Mobile uses horizontally scrollable admin navigation and data tables, with fixed app navigation remaining clear of content.
- Status badges, empty/loading/error states, and dangerous actions are visually distinct.
- The initial QA pass found visible filter selects clipped by an `sr-only` wrapper. The wrapper was corrected, search received an explicit accessible name, and mobile role/status filters were reverified.
- Confirmation remains disabled until a non-empty reason is supplied.
- The system page rendered only safe values such as `Configured`, `Disabled`, and `Redacted`; no secret values or connection URLs appeared.

## Automated coverage

Frontend component tests cover:

- non-admin access denied;
- admin navigation;
- overview cards;
- users table;
- required-reason confirmation;
- correct suspend API call.

Targeted browser E2E covers admin login and routed overview. Existing moderation E2E covers suspension/session revocation and the report-hide-public-removal workflow when the complete media infrastructure is available.

## Remaining UI QA

- Repeat the report → hide → public disappearance flow against real storage/worker services.
- Run production smoke on the deployed domain.
- Validate long translated admin descriptions on physical small-screen devices; navigation and core labels are localized in English, Ukrainian, Polish, and Russian, with English fallback for secondary descriptive strings.

Verdict: **ADMIN CONSOLE PARTIAL**
