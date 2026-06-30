# Genre UI — Design QA screenshots

These screenshots are produced by the Playwright spec **`tests/e2e/genre-design.spec.js`**.
They could not be captured in the headless QA sandbox (no browser binaries / missing
host libraries), so generate them in your environment:

```bash
npm run test:e2e -- genre-design
# or run the full suite
npm run test:e2e
```

Playwright writes the PNGs into this folder. Expected files:

| File | Viewport | What it shows |
|---|---|---|
| `desktop-discover-genres-1440x900.png` | 1440×900 | Discover quick genre tabs (wrapped, no overflow) |
| `desktop-discover-more-picker-1440x900.png` | 1440×900 | "More" grouped/searchable picker dropdown |
| `desktop-upload-genre-picker-1440x900.png` | 1440×900 | Upload form genre picker open |
| `mobile-discover-genres-390x844.png` | 390×844 | Discover tabs wrapping on mobile |
| `mobile-discover-more-picker-390x844.png` | 390×844 | "More" picker as a bottom sheet (above nav/player) |
| `mobile-discover-genres-uk-390x844.png` | 390×844 | Ukrainian quick tabs (long-label stress) |
| `mobile-upload-genre-picker-390x844.png` | 390×844 | Upload picker bottom sheet on mobile |
| `mobile-upload-genre-search-results-360x800.png` | 360×800 | Upload picker search results, smallest width |

The Upload screenshots require an ARTIST session; start the backend and seed it
(`cd backend && npm run db:seed`) before running, otherwise those two tests fall
back to asserting the sign-in state.
