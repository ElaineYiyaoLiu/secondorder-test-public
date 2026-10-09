This is SecondOrder Test, a bilingual market research workspace built around persistent homology.

Version: **v0.1**.

Structure shows the selected basket's filtration network, finite H₀/H₁ diagrams, barcodes, first persistence landscape and rolling structural changes. Historical analogues retrieves earlier windows with the same asset set. Validation compares topology, H₀-only, H₁-only and labelled correlation retrieval on common scored dates. Seven supporting observations describe relationships, risk, scales, price paths, distributions, candles and price–volume order.

All views use the same real history, selection and robust correlation geometry. Test receives history from the existing public Stock adapter and its cache, with no provider credential or cross-project browser connection. CSV and explicitly selected synthetic data are also available, with their source labels preserved.

Twenty-, sixty- and 120-session windows count completed prices, giving 19, 59 and 119 log returns. Persistence uses F₂ Vietoris–Rips H₀/H₁ and exact diagonal-aware W₂ with an L∞ ground norm. The default retrieval weights are 70/30 robust Pearson/Spearman and 50/50 H₀/H₁. Method contains definitions, assumptions, formulas and validation rules, with local KaTeX assets and print support.

```bash
npm test
npm run build
npm run dev
```

Node 22 or later. Numerical calculations run in cancellable module workers. Exports include source, adjustment, selected diagrams, rolling profiles, historical cohorts and validation records.

Development: `secondorder-test-private/v0.1`. Public mirror: `secondorder-test-public/main`. Production: https://test.secondorder.tools, embedded at https://secondorder.tools/test.

Test is independent of Stock v0.22 and Homology v0.4. Their repositories and deployments are preserved. Useful chart forms from earlier Homology releases are recomputed from the current basket; the unavailable 30-stock fitted forecasts are not used. Archived Stock engines remain in source for inherited numerical regression tests and are excluded from the production build.

Validation is exploratory. It reports coverage, abstentions and measured common-origin errors. Paired uncertainty estimates, an independent holdout and alternate point-in-time universes remain further research.
