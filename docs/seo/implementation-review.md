# SEO implementation review

Changes are local on `seo/amended-optimization`. Nothing has been pushed or deployed. The existing storefront remains React 19, Vite 8 and React Router 8, with Supabase accounts and the existing Stripe/WooCommerce checkout services.

## Routes and indexing

The 143 page validations reconcile to 115 product pages, 21 other indexable public pages and seven private page shells. The sitemap contains only the 136 canonical indexable pages. Product aliases and slash/index.html variants are additional redirect validations, not additional sitemap pages. The static `404.html` error-template asset is separately listed as a nonindexable system document; missing URLs actually return HTTP 404.

See [route-manifest.md](route-manifest.md) and [route-manifest.json](route-manifest.json). They list expected statuses, pre-change observed statuses, canonical destinations, robots policy and sitemap eligibility, plus explicit unknown-route rules and separate API endpoints. Unmeasured pre-change statuses are null; local observations are in `artifacts/seo-validation/http-routes.json`.

All 31 original legacy aliases retain their original encoded identities. The new Semax migration makes 32. Vercel rules return 308, while the retained Netlify implementation uses 301. Slash and index.html aliases target their final canonical destination directly; query parameters survive redirects and never enter canonicals or sitemaps. The local HTTP harness compiles the actual Vercel configuration with `@vercel/routing-utils`; it does not use Vite preview as routing evidence. Deployed CDN behavior still requires the Day 0 checks.

Account, three authentication pages, order tracking, checkout and order confirmation expose `noindex, nofollow` in both initial HTML and X-Robots-Tag, with `private, no-store` caching. Exact trailing-slash header rules supplement prefix rules. Robots.txt permits these public-facing shells to be crawled so Google can see noindex. Their generated HTML contains no customer data; existing authentication and server authorization are unchanged. `/cart/` is a real 404; the existing cart drawer does not change the public page's robots directives.

## Product identity and content

WooCommerce product **25727**, local ID **vials-25727**, is named **N-Acetyl Semax Amidate** by the [source product](https://purehealthpeptides.com/product/n-acetyl-semx-amidate/) and [WooCommerce Store API](https://purehealthpeptides.com/wp-json/wc/store/v1/products/25727). Its source slug still contains `semx`. The approved override corrects the display name, H1, description, metadata, schema, image labels and canonical shop URL to `/product/n-acetyl-semax-amidate/`. The old shop URL redirects permanently to it. Unrelated Semx products and archived source snapshots were not renamed.

A comparison with the baseline commit confirms all 115 product and 181 variant IDs, prices, discounts, inventory, availability and logistics are unchanged. Evidence is in `artifacts/seo-validation/catalog-invariants.json`.

Public React components are rendered at build time into initial HTML, using the same header, footer, product details, policies and related-product selection as the interactive site. The shop includes a complete crawlable product directory. Relevant research-resource links connect shipping, returns, COAs, testing and the priority products. The initial-HTML audit verifies zero orphans and a maximum crawl depth of two links from the homepage for all 136 indexable pages.

Product documents now use a content-derived filename covering both details and independently generated metadata. The catalog version remains the checkout version contract. Previously tracked immutable documents and assets are retained. Catalog and COA versioning schemes are unchanged. Product data embedded in initial HTML matches the corresponding immutable document; navigation uses the current document URL. Loading or failed requests cannot keep the previous product's metadata or render a false product-not-found page.

## Links and structured data

[link-audit.md](link-audit.md) and [link-audit.json](link-audit.json) enumerate the **32 actual failing homepage links from the fresh local Lighthouse baseline**, captured before link edits: page, selector, destination, visible text, accessible name and correction. This is not presented as the unavailable historical Lighthouse report. Visible product links now name the product; image/icon links have accessible names. Navigation links remain crawlable anchors, and action controls and the research-use confirmation remain functional.

The organization describes US-only standard shipping at $10.99 below $175, free at $175 or more after product discounts. Estimated transit is 2-3 business days after processing; no processing time is invented. Order-value thresholds use organization-level shipping conditions. Server pricing shares the policy constants and is tested immediately below, at and above the threshold, including a cart discounted below $175.

Organization-level `hasMerchantReturnPolicy` contains only its type and `merchantReturnLink`. The published case-by-case authorization policy is preserved. No return window, fees, unconditional eligibility, reviews or ratings were invented. Optional product-level shipping/return or review warnings can remain until Google processes the organization policy or verified data exists.

## Delivery and performance

Responsive WebP delivery and intrinsic dimensions cover homepage, product gallery, thumbnail, related-product and supporting images. Product descriptions retain their existing local molecular-structure images. One responsive gallery serves desktop and mobile, avoiding duplicate gallery markup and full-size thumbnail downloads. Secondary images are lazy-loaded. Existing typography is preserved using self-hosted WOFF2 fonts with small Latin subsets and full-font fallbacks for other characters. Home content and CSS load as a separate route bundle; the build includes route CSS in initial HTML.

Hashed application assets, responsive media and versioned product documents use immutable caching. HTML and mutable manifests revalidate; private pages do not cache. See [performance.md](performance.md) for the local Lighthouse comparison and its limitations. Historical PageSpeed numbers are not directly compared with these local measurements.

## Verification and follow-up

Validation commands and final outcomes are recorded in [validation.md](validation.md). Raw HTML tests execute no JavaScript. Browser checks cover priority pages, other product formats, private pages, redirects and missing routes, plus navigation/loading/failure recovery and cart metadata behavior.

The existing catalog reports 115 products awaiting approved logistics. SEO work preserves that baseline state and does not approve or manufacture production logistics. Database, payment-provider and WooCommerce live transaction checks require their configured integration environments; local storefront tests do not create customer orders.

After an approved deployment, follow [post-deployment-checklist.md](post-deployment-checklist.md) at Days 0, 7, 14 and 28. Repository changes cannot guarantee indexing, rankings or external backlinks.

## Technical references

- [Google: noindex and crawler access](https://developers.google.com/search/docs/crawling-indexing/block-indexing).
- [Google: organization shipping policies](https://developers.google.com/search/docs/appearance/structured-data/shipping-policy).
- [Google: merchant return policies](https://developers.google.com/search/docs/appearance/structured-data/return-policy).
- [Vercel: static configuration and redirects](https://vercel.com/docs/project-configuration/vercel-json).
