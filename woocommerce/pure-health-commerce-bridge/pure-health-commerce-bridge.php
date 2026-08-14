<?php
/**
 * Plugin Name: Pure Health Commerce Bridge
 * Description: Signed, idempotent WooCommerce stock reservations for the Pure Health Vercel storefront.
 * Version: 1.0.0
 * Requires Plugins: woocommerce
 * Requires PHP: 8.1
 * WC requires at least: 9.2
 * WC tested up to: 10.3
 */

defined('ABSPATH') || exit;

final class Pure_Health_Commerce_Bridge {
    private const NAMESPACE = 'php-commerce/v1';
    private const MAX_BODY_BYTES = 65536;
    private const MAX_CLOCK_SKEW = 300;
    // Stripe exposes a 30-minute checkout. The extra minute prevents a paid event
    // arriving at the boundary from racing the Woo stock-release action.
    private const RESERVATION_MINUTES = 31;
    private const EVENT_META = '_php_processed_event_ids';

    public static function boot(): void {
        add_action('rest_api_init', [self::class, 'register_routes']);
        add_action('php_commerce_expire_reservation', [self::class, 'expire_reservation'], 10, 1);
        add_action('php_commerce_delete_guard_option', [self::class, 'delete_guard_option'], 10, 1);
        add_filter('woocommerce_order_hold_stock_minutes', [self::class, 'hold_stock_minutes'], 10, 3);
        add_action('before_woocommerce_init', static function (): void {
            if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
                \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
                    'custom_order_tables',
                    __FILE__,
                    true
                );
            }
        });
    }

    public static function register_routes(): void {
        register_rest_route(self::NAMESPACE, '/reservations', [
            'methods' => 'POST',
            'callback' => [self::class, 'reserve'],
            'permission_callback' => [self::class, 'authorize'],
        ]);
        register_rest_route(self::NAMESPACE, '/orders/(?P<id>\d+)/payment', [
            'methods' => 'POST',
            'callback' => [self::class, 'complete_payment'],
            'permission_callback' => [self::class, 'authorize'],
        ]);
        register_rest_route(self::NAMESPACE, '/orders/(?P<id>\d+)/cancel', [
            'methods' => 'POST',
            'callback' => [self::class, 'cancel'],
            'permission_callback' => [self::class, 'authorize'],
        ]);
        register_rest_route(self::NAMESPACE, '/orders/(?P<id>\d+)/refund', [
            'methods' => 'POST',
            'callback' => [self::class, 'refund'],
            'permission_callback' => [self::class, 'authorize'],
        ]);
        register_rest_route(self::NAMESPACE, '/orders/(?P<id>\d+)', [
            'methods' => 'GET',
            'callback' => [self::class, 'get_order'],
            'permission_callback' => [self::class, 'authorize'],
        ]);
    }

    public static function authorize(WP_REST_Request $request) {
        $body = $request->get_body();
        if (strlen($body) > self::MAX_BODY_BYTES) {
            return new WP_Error('body_too_large', 'The request body is too large.', ['status' => 413]);
        }

        $timestamp = (string) $request->get_header('x-php-timestamp');
        $nonce = sanitize_text_field((string) $request->get_header('x-php-nonce'));
        $signature = (string) $request->get_header('x-php-signature');
        if (!ctype_digit($timestamp) || strlen($nonce) < 16 || strlen($nonce) > 120 || !$signature) {
            return new WP_Error('invalid_bridge_signature', 'Bridge authentication failed.', ['status' => 401]);
        }
        if (abs(time() - (int) $timestamp) > self::MAX_CLOCK_SKEW) {
            return new WP_Error('expired_bridge_signature', 'Bridge authentication expired.', ['status' => 401]);
        }

        $canonical = implode("\n", [
            $timestamp,
            $nonce,
            strtoupper($request->get_method()),
            $request->get_route(),
            hash('sha256', $body),
        ]);
        $secrets = array_filter([
            defined('PHP_COMMERCE_BRIDGE_SECRET') ? PHP_COMMERCE_BRIDGE_SECRET : '',
            defined('PHP_COMMERCE_BRIDGE_PREVIOUS_SECRET') ? PHP_COMMERCE_BRIDGE_PREVIOUS_SECRET : '',
        ]);
        $valid = false;
        foreach ($secrets as $secret) {
            $expected = base64_encode(hash_hmac('sha256', $canonical, (string) $secret, true));
            if (hash_equals($expected, $signature)) {
                $valid = true;
                break;
            }
        }
        if (!$valid) {
            return new WP_Error('invalid_bridge_signature', 'Bridge authentication failed.', ['status' => 401]);
        }

        $nonce_key = 'php_commerce_nonce_' . hash('sha256', $nonce);
        if (!add_option($nonce_key, (string) time(), '', false)) {
            return new WP_Error('bridge_replay', 'This bridge request was already used.', ['status' => 409]);
        }
        wp_schedule_single_event(time() + 10 * MINUTE_IN_SECONDS, 'php_commerce_delete_guard_option', [$nonce_key]);
        return true;
    }

    public static function reserve(WP_REST_Request $request) {
        if (!function_exists('wc_create_order') || !function_exists('wc_reserve_stock_for_order')) {
            return new WP_Error('woocommerce_unavailable', 'WooCommerce reservation support is unavailable.', ['status' => 503]);
        }
        $input = (array) $request->get_json_params();
        $attempt_id = sanitize_text_field((string) ($input['checkoutAttemptId'] ?? ''));
        $items = isset($input['items']) && is_array($input['items']) ? $input['items'] : [];
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $attempt_id)) {
            return new WP_Error('invalid_attempt', 'A valid checkout attempt is required.', ['status' => 400]);
        }
        if (!$items || count($items) > 25) {
            return new WP_Error('invalid_items', 'The cart must contain between 1 and 25 lines.', ['status' => 400]);
        }

        $existing = wc_get_orders([
            'limit' => 1,
            'return' => 'objects',
            'meta_key' => '_php_checkout_attempt_id',
            'meta_value' => $attempt_id,
        ]);
        if ($existing) {
            return self::reservation_response($existing[0], true);
        }

        $subtotal_cents = self::positive_cents($input['subtotalCents'] ?? null);
        $shipping_cents = self::nonnegative_cents($input['shippingCents'] ?? null);
        $total_cents = self::positive_cents($input['totalCents'] ?? null);
        if ($subtotal_cents === null || $shipping_cents === null || $total_cents === null
            || $subtotal_cents + $shipping_cents !== $total_cents) {
            return new WP_Error('invalid_totals', 'The order totals are invalid.', ['status' => 400]);
        }

        $lock_key = 'php_commerce_attempt_' . hash('sha256', $attempt_id);
        if (!add_option($lock_key, (string) time(), '', false)) {
            $existing = wc_get_orders([
                'limit' => 1,
                'return' => 'objects',
                'meta_key' => '_php_checkout_attempt_id',
                'meta_value' => $attempt_id,
            ]);
            if ($existing) return self::reservation_response($existing[0], true);
            if ((int) get_option($lock_key, 0) < time() - 120) {
                delete_option($lock_key);
                if (add_option($lock_key, (string) time(), '', false)) {
                    wp_schedule_single_event(time() + 2 * MINUTE_IN_SECONDS, 'php_commerce_delete_guard_option', [$lock_key]);
                } else {
                    return new WP_Error('attempt_in_progress', 'This checkout attempt is already being reserved.', ['status' => 409]);
                }
            } else {
                return new WP_Error('attempt_in_progress', 'This checkout attempt is already being reserved.', ['status' => 409]);
            }
        }
        wp_schedule_single_event(time() + 2 * MINUTE_IN_SECONDS, 'php_commerce_delete_guard_option', [$lock_key]);

        $order = null;
        try {
            $order = wc_create_order([
                'status' => 'checkout-draft',
                'created_via' => 'pure-health-vercel',
            ]);
            if (is_wp_error($order)) {
                throw new RuntimeException($order->get_error_message());
            }
            $order->set_currency(strtoupper(sanitize_text_field((string) ($input['currency'] ?? 'usd'))));
            $line_total = 0;
            foreach ($items as $raw_item) {
                $item = (array) $raw_item;
                $product_id = absint($item['wooProductId'] ?? 0);
                $variation_id = absint($item['wooVariationId'] ?? 0);
                $quantity = absint($item['quantity'] ?? 0);
                $expected_price = self::nonnegative_cents($item['expectedUnitCents'] ?? null);
                $subtotal = self::nonnegative_cents($item['subtotalCents'] ?? null);
                $total = self::nonnegative_cents($item['totalCents'] ?? null);
                $product = wc_get_product($variation_id ?: $product_id);
                $parent = $variation_id ? wc_get_product($product_id) : $product;
                if (!$product || $quantity < 1 || $quantity > 100 || $expected_price === null || $subtotal === null || $total === null) {
                    throw new Pure_Health_Bridge_Exception('catalog_changed', 'A product is no longer available.', 409);
                }
                if (!$parent || $parent->get_status('edit') !== 'publish'
                    || $parent->get_catalog_visibility('edit') === 'hidden' || !$parent->is_purchasable()) {
                    throw new Pure_Health_Bridge_Exception('catalog_changed', 'A product is no longer published or visible.', 409);
                }
                if ($variation_id && (int) $product->get_parent_id() !== $product_id) {
                    throw new Pure_Health_Bridge_Exception('catalog_changed', 'A product variation changed.', 409);
                }
                $live_price = (int) round((float) $product->get_price('edit') * 100);
                if ($product->get_status('edit') !== 'publish' || !$product->is_purchasable() || $live_price !== $expected_price) {
                    throw new Pure_Health_Bridge_Exception('catalog_changed', 'A product price or availability changed.', 409);
                }
                if (!$product->is_in_stock() || (!$product->backorders_allowed() && !$product->has_enough_stock($quantity))) {
                    throw new Pure_Health_Bridge_Exception('out_of_stock', 'There is not enough stock for this cart.', 409);
                }
                $order->add_product($product, $quantity, [
                    'subtotal' => wc_format_decimal($subtotal / 100, wc_get_price_decimals()),
                    'total' => wc_format_decimal($total / 100, wc_get_price_decimals()),
                ]);
                $line_total += $total;
            }
            if ($line_total !== $subtotal_cents) {
                throw new Pure_Health_Bridge_Exception('invalid_totals', 'The line totals do not match.', 400);
            }
            if ($shipping_cents > 0) {
                $shipping = new WC_Order_Item_Shipping();
                $shipping->set_method_title('USPS Priority Mail');
                $shipping->set_method_id('pure_health_flat_rate');
                $shipping->set_total(wc_format_decimal($shipping_cents / 100, wc_get_price_decimals()));
                $order->add_item($shipping);
            }
            $expires_at = time() + self::RESERVATION_MINUTES * MINUTE_IN_SECONDS;
            $order->update_meta_data('_php_checkout_attempt_id', $attempt_id);
            $order->update_meta_data('_php_catalog_version', sanitize_text_field((string) ($input['catalogVersion'] ?? '')));
            $order->update_meta_data('_php_reservation_expires_at', $expires_at);
            $order->update_meta_data('_php_expected_total_cents', $total_cents);
            $order->calculate_totals(false);
            if ((int) round((float) $order->get_total('edit') * 100) !== $total_cents) {
                throw new Pure_Health_Bridge_Exception('invalid_totals', 'WooCommerce rejected the order totals.', 409);
            }
            $order->save();
            wc_reserve_stock_for_order($order);
            if (function_exists('as_schedule_single_action')) {
                as_schedule_single_action($expires_at, 'php_commerce_expire_reservation', [$order->get_id()], 'pure-health-commerce');
            }
            $order->add_order_note('Stock reserved by the Pure Health storefront checkout bridge.');
            delete_option($lock_key);
            return self::reservation_response($order, false);
        } catch (Throwable $error) {
            delete_option($lock_key);
            if ($order instanceof WC_Order) {
                wc_release_stock_for_order($order);
                $order->delete(true);
            }
            if ($error instanceof Pure_Health_Bridge_Exception) {
                return new WP_Error($error->error_code, $error->getMessage(), ['status' => $error->http_status]);
            }
            if ($error instanceof \Automattic\WooCommerce\Checkout\Helpers\ReserveStockException) {
                return new WP_Error('out_of_stock', 'There is not enough stock for this cart.', ['status' => 409]);
            }
            error_log('Pure Health reservation failed: ' . $error->getMessage());
            return new WP_Error('reservation_failed', 'The inventory reservation service is unavailable.', ['status' => 503]);
        }
    }

    public static function complete_payment(WP_REST_Request $request) {
        $order = self::order_from_request($request);
        if (is_wp_error($order)) return $order;
        $input = (array) $request->get_json_params();
        $event_id = sanitize_text_field((string) ($input['eventId'] ?? ''));
        if (!$event_id) return new WP_Error('invalid_event', 'A Stripe event ID is required.', ['status' => 400]);
        if (self::event_seen($order, $event_id)) return self::order_response($order, true);
        $amount = self::positive_cents($input['amountTotal'] ?? null);
        if ($amount === null || $amount !== (int) round((float) $order->get_total('edit') * 100)) {
            return new WP_Error('amount_mismatch', 'The paid amount does not match the order.', ['status' => 409]);
        }
        if ($order->has_status(['cancelled', 'refunded', 'failed'])) {
            return new WP_Error('order_closed', 'The WooCommerce order is closed.', ['status' => 409]);
        }
        self::apply_customer($order, (array) ($input['customer'] ?? []));
        $payment_intent = sanitize_text_field((string) ($input['paymentIntentId'] ?? ''));
        $order->set_payment_method('stripe');
        $order->set_payment_method_title('Stripe Checkout');
        if ($payment_intent) $order->set_transaction_id($payment_intent);
        $order->update_meta_data('_php_stripe_session_id', sanitize_text_field((string) ($input['sessionId'] ?? '')));
        $order->save();
        if (!$order->is_paid()) $order->payment_complete($payment_intent);
        if (!$order->is_paid()) return new WP_Error('payment_incomplete', 'WooCommerce did not complete the payment.', ['status' => 503]);
        self::remember_event($order, $event_id);
        $order->save();
        return self::order_response($order, false);
    }

    public static function cancel(WP_REST_Request $request) {
        $order = self::order_from_request($request);
        if (is_wp_error($order)) return $order;
        $input = (array) $request->get_json_params();
        $event_id = sanitize_text_field((string) ($input['eventId'] ?? ''));
        if ($event_id && self::event_seen($order, $event_id)) return self::order_response($order, true);
        if ($order->is_paid()) return new WP_Error('paid_order', 'A paid order cannot be cancelled as a reservation.', ['status' => 409]);
        wc_release_stock_for_order($order);
        if ($event_id) self::remember_event($order, $event_id);
        $reason = sanitize_text_field((string) ($input['reason'] ?? 'Checkout reservation cancelled'));
        $order->update_status('cancelled', $reason);
        return self::order_response($order, false);
    }

    public static function refund(WP_REST_Request $request) {
        $order = self::order_from_request($request);
        if (is_wp_error($order)) return $order;
        $input = (array) $request->get_json_params();
        $event_id = sanitize_text_field((string) ($input['eventId'] ?? ''));
        if (!$event_id) return new WP_Error('invalid_event', 'A Stripe event ID is required.', ['status' => 400]);
        if (self::event_seen($order, $event_id)) return self::order_response($order, true);
        $amount_cents = self::positive_cents($input['amountRefunded'] ?? null);
        if ($amount_cents === null || $amount_cents > (int) round((float) $order->get_total('edit') * 100)) {
            return new WP_Error('invalid_refund', 'The refund amount is invalid.', ['status' => 400]);
        }
        $already_refunded_cents = (int) round(abs((float) $order->get_total_refunded()) * 100);
        $delta_cents = max(0, $amount_cents - $already_refunded_cents);
        if ($delta_cents > 0) {
            $refund = wc_create_refund([
                'amount' => wc_format_decimal($delta_cents / 100, wc_get_price_decimals()),
                'reason' => 'Stripe refund ' . $event_id,
                'order_id' => $order->get_id(),
                'refund_payment' => false,
                'restock_items' => false,
            ]);
            if (is_wp_error($refund)) return $refund;
        }
        self::remember_event($order, $event_id);
        $order->save();
        return self::order_response($order, false);
    }

    public static function get_order(WP_REST_Request $request) {
        $order = self::order_from_request($request);
        return is_wp_error($order) ? $order : self::order_response($order, false);
    }

    public static function expire_reservation(int $order_id): void {
        $order = wc_get_order($order_id);
        if (!$order || $order->is_paid() || !$order->has_status(['checkout-draft', 'pending'])) return;
        $expires_at = (int) $order->get_meta('_php_reservation_expires_at', true);
        if (!$expires_at || $expires_at > time()) return;
        wc_release_stock_for_order($order);
        $order->update_status('cancelled', 'The storefront checkout reservation expired.');
    }

    public static function hold_stock_minutes(int $minutes, WC_Order $order): int {
        return $order->get_created_via() === 'pure-health-vercel' ? self::RESERVATION_MINUTES : $minutes;
    }

    public static function delete_guard_option(string $option_name): void {
        if (str_starts_with($option_name, 'php_commerce_nonce_') || str_starts_with($option_name, 'php_commerce_attempt_')) {
            delete_option($option_name);
        }
    }

    private static function order_from_request(WP_REST_Request $request) {
        $order = wc_get_order(absint($request['id']));
        if (!$order) return new WP_Error('order_not_found', 'The WooCommerce order was not found.', ['status' => 404]);
        if ($order->get_created_via() !== 'pure-health-vercel') {
            return new WP_Error('order_not_managed', 'The order is not managed by this bridge.', ['status' => 403]);
        }
        return $order;
    }

    private static function reservation_response(WC_Order $order, bool $replayed): WP_REST_Response {
        return new WP_REST_Response([
            'wooOrderId' => $order->get_id(),
            'expiresAt' => gmdate('c', (int) $order->get_meta('_php_reservation_expires_at', true)),
            'currency' => strtolower($order->get_currency()),
            'totalCents' => (int) round((float) $order->get_total('edit') * 100),
            'status' => $order->get_status(),
            'replayed' => $replayed,
        ], $replayed ? 200 : 201);
    }

    private static function order_response(WC_Order $order, bool $replayed): WP_REST_Response {
        return new WP_REST_Response([
            'wooOrderId' => $order->get_id(),
            'status' => $order->get_status(),
            'paid' => $order->is_paid(),
            'totalCents' => (int) round((float) $order->get_total('edit') * 100),
            'replayed' => $replayed,
        ], 200);
    }

    private static function event_seen(WC_Order $order, string $event_id): bool {
        return in_array($event_id, (array) $order->get_meta(self::EVENT_META, true), true);
    }

    private static function remember_event(WC_Order $order, string $event_id): void {
        $events = array_values(array_unique(array_merge((array) $order->get_meta(self::EVENT_META, true), [$event_id])));
        $order->update_meta_data(self::EVENT_META, array_slice($events, -50));
    }

    private static function apply_customer(WC_Order $order, array $customer): void {
        $billing = (array) ($customer['billing'] ?? []);
        $shipping = (array) ($customer['shipping'] ?? []);
        $allowed = ['first_name', 'last_name', 'company', 'address_1', 'address_2', 'city', 'state', 'postcode', 'country', 'email', 'phone'];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $billing)) {
                $setter = 'set_billing_' . $field;
                if (is_callable([$order, $setter])) $order->{$setter}(sanitize_text_field((string) $billing[$field]));
            }
            if (array_key_exists($field, $shipping) && !in_array($field, ['email', 'phone'], true)) {
                $setter = 'set_shipping_' . $field;
                if (is_callable([$order, $setter])) $order->{$setter}(sanitize_text_field((string) $shipping[$field]));
            }
        }
    }

    private static function positive_cents($value): ?int {
        $parsed = filter_var($value, FILTER_VALIDATE_INT);
        return $parsed !== false && $parsed > 0 ? $parsed : null;
    }

    private static function nonnegative_cents($value): ?int {
        $parsed = filter_var($value, FILTER_VALIDATE_INT);
        return $parsed !== false && $parsed >= 0 ? $parsed : null;
    }
}

final class Pure_Health_Bridge_Exception extends RuntimeException {
    public function __construct(public string $error_code, string $message, public int $http_status) {
        parent::__construct($message);
    }
}

Pure_Health_Commerce_Bridge::boot();
