# Reviewed product catalog

WooCommerce is the commercial source of truth, but production builds consume only `woocommerce-reviewed.json`. The review flow is:

1. Configure server-only `WOOCOMMERCE_URL`, `WC_CONSUMER_KEY`, and `WC_CONSUMER_SECRET`.
2. Run `npm run catalog:sync`. This writes an ignored candidate snapshot plus the deterministic `woocommerce-sync.diff.json`.
3. Review the candidate and diff. Record removed products in `retired-products.json` with `wooProductId`, `slug`, and any `legacySlugs`.
4. Run `npm run catalog:approve`, inspect the generated changes, then commit the reviewed snapshot and diff together.
5. Populate `product-logistics-master.csv` from the merchant-approved export. Every variant row must use the documented header and `approved=true`.

Product and variant IDs are immutable. Duplicate IDs, SKUs, or slugs are rejected; the synchronizer never invents a `-2` slug. Development snapshots use clearly marked derived Woo IDs as provisional SKUs, but `npm run catalog:validate:production` rejects them and every missing/unapproved logistics value.

`retired-products.json` is the source for HTTP 410 product routes. Unknown, hidden, and non-published products return HTTP 404 at the Netlify edge.
