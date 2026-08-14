# Pure Health Commerce Bridge

This plugin is the WooCommerce-side authority for storefront stock reservations.

1. Copy this directory into `wp-content/plugins/` and activate it in staging first.
2. Define `PHP_COMMERCE_BRIDGE_SECRET` in `wp-config.php` with the same value as the Vercel `WOO_BRIDGE_SECRET_CURRENT` secret.
3. During rotation, define `PHP_COMMERCE_BRIDGE_PREVIOUS_SECRET` until all callers use the new value.
4. Keep `COMMERCE_RESERVATIONS_ENABLED=false` in Vercel until the staging reservation, payment, expiry, cancellation, and concurrency suites pass.

The plugin uses WooCommerce CRUD APIs, declares HPOS compatibility, and delegates atomic stock holds to WooCommerce's `wc_reserve_stock_for_order` implementation.

## PHPUnit

The native suite covers reservation creation/replay, expiration, cancellation, payment-to-stock conversion, and HMAC nonce replay rejection. Run it in a WordPress test database with WooCommerce available:

```sh
WP_TESTS_DIR=/path/to/wordpress-tests-lib \
WC_PLUGIN_FILE=/path/to/woocommerce/woocommerce.php \
vendor/bin/phpunit -c phpunit.xml.dist
```
