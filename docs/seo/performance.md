# Local performance comparison

The before and after runs used Lighthouse 13.4.1, the same Windows host, Chrome binary, Lighthouse mobile/desktop profiles, built-site server, gzip simulation, route order, and seven priority URLs. These are controlled local lab measurements. They are not interchangeable with the historical PageSpeed scores supplied for the live site, and they do not predict field Core Web Vitals.

## Mobile

| Route | Performance before | Performance after | LCP before | LCP after | LCP change | CLS after | TBT after |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 0.71 | 0.80 | 5,784 ms | 3,847 ms | 34% faster | 0.000 | 210 ms |
| `/shipping-policy/` | 0.75 | 0.94 | 5,308 ms | 2,470 ms | 53% faster | 0.001 | 177 ms |
| `/product/n-acetyl-semax-amidate/` | 0.46 | 0.83 | 6,994 ms | 3,724 ms | 47% faster | 0.004 | 173 ms |
| `/coa-library/` | 0.63 | 0.81 | 9,545 ms | 3,110 ms | 67% faster | 0.196 | 80 ms |
| `/shop/` | 0.64 | 0.80 | 5,380 ms | 3,782 ms | 30% faster | 0.001 | 235 ms |
| `/product/bpc-157/` | 0.46 | 0.89 | 7,000 ms | 3,345 ms | 52% faster | 0.002 | 110 ms |
| `/product/bpc-157-tb-500/` | 0.46 | 0.86 | 7,005 ms | 3,550 ms | 49% faster | 0.001 | 160 ms |

Shipping reaches the 2.5 second lab target. The other six routes remain above it in this throttled local run, although their LCP improves by 30–67%. The COA page's mobile CLS is 0.196, compared with 0.148 in the baseline run; this is the only material lab regression and should be checked against the deployed host and field data. Lighthouse attributes it to movement in the hero carrier-button area. A temporary route-preload and reserved-spacing experiment was rejected because results were inconsistent and main-thread blocking increased.

## Desktop

| Route | Performance before | Performance after | LCP before | LCP after | LCP change | CLS after | TBT after |
|---|---:|---:|---:|---:|---:|---:|---:|
| `/` | 0.95 | 0.99 | 1,430 ms | 874 ms | 39% faster | 0.000 | 5 ms |
| `/shipping-policy/` | 0.86 | 1.00 | 981 ms | 601 ms | 39% faster | 0.000 | 0 ms |
| `/product/n-acetyl-semax-amidate/` | 0.79 | 1.00 | 1,051 ms | 805 ms | 23% faster | 0.003 | 8 ms |
| `/coa-library/` | 0.74 | 1.00 | 1,681 ms | 776 ms | 54% faster | 0.006 | 2 ms |
| `/shop/` | 0.79 | 0.99 | 978 ms | 995 ms | 2% slower | 0.005 | 27 ms |
| `/product/bpc-157/` | 0.79 | 1.00 | 1,023 ms | 781 ms | 24% faster | 0.001 | 10 ms |
| `/product/bpc-157-tb-500/` | 0.79 | 1.00 | 1,021 ms | 726 ms | 29% faster | 0.001 | 1 ms |

Desktop performance is 0.99–1.00. The 17 ms shop LCP difference is within normal single-run lab variance; its performance score improves from 0.79 to 0.99 and CLS falls from 0.429 to 0.005.

Every final route scores 1.00 for Lighthouse SEO and passes the descriptive-link audit. The original homepage baseline had 32 failing link entries; the final reports have none. Image-delivery and render-blocking audits pass on the final homepage. Product pages can still report image-delivery savings for source artwork whose aspect ratio and detail justify a larger candidate.

Raw Lighthouse reports and summaries are stored locally in `artifacts/seo-before-gzip/` and `artifacts/seo-final-gzip/`. The artifacts directory is intentionally ignored by Git because the reports are large and machine-specific.
