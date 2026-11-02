# Night of 2026-11-02 → 03: design and UX pass (done by 08:00 IST = 02:30 UTC)

Owner's ask: make Paper & ink the default look for new users; follow Apple's design system (HIG) for spacing and
alignment on every page; more home screen layouts that people can customise by hand; review the UX and fix whatever
is wrong. Auto-deploy (every push to `main` deploys), never ask, keep `main` green. Rules and recipes are the same as
`docs/OVERNIGHT.md` (additive migrations only, bump sw `VERSION` + `src/lib/version.ts` together, no secrets).

If a session picks this up half-way: read the ledger below, `git pull`, continue the first task that is not done.

## Tasks
1. **Default style.** New devices start on Paper & ink (`landing`); devices that already used the app keep what they
   had (Clean is stored explicitly). The landing page never downloads `themes.css`.
2. **Apple HIG spacing.** 4/8 pt grid tokens, 16 pt side margins on phones (20 on wider), 44 pt targets, type scale
   (Large Title 34 / Title 28 / Headline 17 / Body 17 / Subhead 15 / Footnote 13 / Caption 12), inset-grouped lists with
   leading-aligned separators, one rhythm for gaps between sections. `scripts/align-check.mjs` audits every page.
3. **Home screens.** Settings > Home screen: more layouts and a "Customise" list (show / hide / reorder sections and
   shortcuts), saved per device.
4. **UX review.** Every page and flow at 360/390 px, light/dark, Hindi, lite mode; fix what is wrong.
5. **Verify + deploy + report.** tsc, vitest, smoke test, contrast + a11y + alignment audits, live check.

## Ledger (newest first)
- 22:55 UTC task 3 (home screens) shipped as v35: 6 layouts + customise lists + shortcuts. Next: UX review (task 4).
- 22:20 UTC task 2 (HIG spacing) shipped as v34: grid snap, margins, type ramp, nav bar, targets, separators, align-check.mjs. Next: home screens (task 3).
- 21:25 UTC task 1 done (v33): default style for new devices, boot test.
- Check-ins scheduled into this session: trig_01JJsNehpPZv3roTYB27drZ9 (23:20 UTC), trig_01C5up4pX5Jbv7XjbP1DmarP (01:00), trig_01CPRwK933LTiivC7yxaFN1o (02:05). Cancel the rest once everything is done.
- 21:10 UTC plan written.
