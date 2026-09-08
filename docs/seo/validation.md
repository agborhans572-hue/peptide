# Validation results

Validation was run on 2026-09-08 from the local `seo/amended-optimization` branch. Nothing was pushed or deployed.

| Check | Result |
|---|---|
| `npm.cmd run check` | Passed |
| Catalog validation | 115 products, 181 variants; commercial invariants preserved |
| Deployment route budget | 546 of 1,800 generated rules; 143 page validations and 32 product redirects |
| TypeScript and ESLint | Passed with zero lint warnings |
| Server tests | 25 passed |
| React component tests | 6 passed |
| Vite production build | Passed |
| JavaScript bundle budgets | Initial 134.3 KB gzip; shop 140.2 KB; product 139.9 KB |
| Raw initial-HTML QA | 143 pages passed with JavaScript never executed |
| Sitemap and crawl depth | 136 canonical URLs; zero initial-HTML orphans; maximum depth two |
| Host-aware HTTP QA | 758 requests passed |
| Redirect QA | All 31 original aliases plus Semax migration are single-hop and query-preserving |
| Private-route QA | Seven shells return noindex/nofollow headers and metadata with private/no-store caching |
| Missing-route QA | `/cart/` and unknown paths return genuine 404 responses |
| Browser SEO QA | 42 JavaScript enabled/disabled, mobile, navigation, failure and cart-metadata checks passed |
| Full browser release QA | Passed shop, 115 product routes, images, footer, about, support, peptide info and COA library checks |
| Client secret scan | Passed |
| `npm.cmd audit --audit-level=high` | Passed; 0 vulnerabilities |
| Lighthouse | Final results recorded in `performance.md`; all audited links pass |

Raw HTML assertions cover HTTP status, a unique title and description, one H1, canonical URL, robots directive, substantive route content, crawlable links, route-specific JSON-LD, metadata consistency and soft-404 prevention. Private page source is checked for customer-data markers. Product initial state is checked against its content-derived immutable document.

The host-aware harness compiles the checked-in Vercel routing configuration using `@vercel/routing-utils`. It verifies headers and redirects without treating Vite preview as deployment evidence. It covers slash and `index.html` variants, original encoded aliases, query strings, canonical termination, cache classes, private wildcards and fallback 404 behavior.

The browser release suite confirms responsive layout, all 115 canonical product round trips, four product formats, product gallery behavior, cart quantity and discount behavior, navigation and history, support-form behavior with a local API fixture, COA pagination/search/PDF links, image loading, and unexpected console/page errors.

The final build still emits Vite's advisory warning that the main minified chunk exceeds 500 KB; its initial compressed route payload remains below the repository's 160 KB budget. The local mobile Lighthouse target is not met on six of seven priority routes, as detailed in `performance.md`. Production CDN behavior, live provider integrations, Search Console indexing, structured-data processing, PageSpeed field data and backlinks require post-deployment observation.
