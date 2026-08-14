<?php

final class Pure_Health_Commerce_Bridge_Test extends WP_UnitTestCase {
    private WC_Product_Simple $product;
    private array $order_ids = [];

    public function set_up(): void {
        parent::set_up();
        $this->product = new WC_Product_Simple();
        $this->product->set_name('Bridge stock test');
        $this->product->set_status('publish');
        $this->product->set_catalog_visibility('visible');
        $this->product->set_regular_price('22.00');
        $this->product->set_price('22.00');
        $this->product->set_manage_stock(true);
        $this->product->set_stock_quantity(10);
        $this->product->set_backorders('no');
        $this->product->save();
    }

    public function tear_down(): void {
        foreach ($this->order_ids as $order_id) {
            $order = wc_get_order($order_id);
            if ($order) {
                wc_release_stock_for_order($order);
                $order->delete(true);
            }
        }
        if (isset($this->product) && $this->product->get_id()) {
            $this->product->delete(true);
        }
        parent::tear_down();
    }

    public function test_reservation_creation_and_idempotent_replay(): void {
        $attempt_id = wp_generate_uuid4();
        $first = $this->reserve($attempt_id);
        $second = $this->reserve($attempt_id);

        $this->assertSame(201, $first->get_status());
        $this->assertSame(200, $second->get_status());
        $this->assertSame($first->get_data()['wooOrderId'], $second->get_data()['wooOrderId']);
        $this->assertFalse($first->get_data()['replayed']);
        $this->assertTrue($second->get_data()['replayed']);
        $this->assertSame(1, wc_get_held_stock_quantity($this->product));
    }

    public function test_expiration_releases_reserved_stock(): void {
        $response = $this->reserve(wp_generate_uuid4());
        $order = wc_get_order($response->get_data()['wooOrderId']);
        $order->update_meta_data('_php_reservation_expires_at', time() - 1);
        $order->save();

        Pure_Health_Commerce_Bridge::expire_reservation($order->get_id());

        $order = wc_get_order($order->get_id());
        $this->assertTrue($order->has_status('cancelled'));
        $this->assertSame(0, wc_get_held_stock_quantity($this->product));
    }

    public function test_cancellation_releases_reserved_stock(): void {
        $response = $this->reserve(wp_generate_uuid4());
        $request = $this->order_request($response->get_data()['wooOrderId'], '/cancel', [
            'eventId' => 'evt_cancel_test',
            'reason' => 'PHPUnit cancellation',
        ]);

        $cancelled = Pure_Health_Commerce_Bridge::cancel($request);

        $this->assertSame('cancelled', $cancelled->get_data()['status']);
        $this->assertSame(0, wc_get_held_stock_quantity($this->product));
    }

    public function test_payment_converts_the_hold_to_one_stock_reduction(): void {
        $response = $this->reserve(wp_generate_uuid4());
        $request = $this->order_request($response->get_data()['wooOrderId'], '/payment', [
            'eventId' => 'evt_payment_test',
            'amountTotal' => 2200,
            'paymentIntentId' => 'pi_payment_test',
            'sessionId' => 'cs_payment_test',
        ]);

        $first = Pure_Health_Commerce_Bridge::complete_payment($request);
        $replayed = Pure_Health_Commerce_Bridge::complete_payment($request);
        $this->product = wc_get_product($this->product->get_id());

        $this->assertTrue($first->get_data()['paid']);
        $this->assertTrue($replayed->get_data()['replayed']);
        $this->assertSame(9, $this->product->get_stock_quantity());
        $this->assertSame(0, wc_get_held_stock_quantity($this->product));
    }

    public function test_signed_request_nonce_cannot_be_replayed(): void {
        $timestamp = (string) time();
        $nonce = 'phpunit-replay-nonce-' . wp_generate_password(24, false);
        $request = new WP_REST_Request('POST', '/php-commerce/v1/reservations');
        $request->set_body('{}');
        $canonical = implode("\n", [
            $timestamp,
            $nonce,
            'POST',
            '/php-commerce/v1/reservations',
            hash('sha256', '{}'),
        ]);
        $request->set_header('x-php-timestamp', $timestamp);
        $request->set_header('x-php-nonce', $nonce);
        $request->set_header(
            'x-php-signature',
            base64_encode(hash_hmac('sha256', $canonical, PHP_COMMERCE_BRIDGE_SECRET, true))
        );

        $this->assertTrue(Pure_Health_Commerce_Bridge::authorize($request));
        $replayed = Pure_Health_Commerce_Bridge::authorize($request);
        $this->assertWPError($replayed);
        $this->assertSame('bridge_replay', $replayed->get_error_code());

        Pure_Health_Commerce_Bridge::delete_guard_option('php_commerce_nonce_' . hash('sha256', $nonce));
    }

    private function reserve(string $attempt_id): WP_REST_Response {
        $request = new WP_REST_Request('POST', '/php-commerce/v1/reservations');
        $request->set_header('content-type', 'application/json');
        $request->set_body(wp_json_encode([
            'checkoutAttemptId' => $attempt_id,
            'catalogVersion' => 'phpunit-catalog',
            'currency' => 'usd',
            'subtotalCents' => 2200,
            'shippingCents' => 0,
            'totalCents' => 2200,
            'items' => [[
                'wooProductId' => $this->product->get_id(),
                'wooVariationId' => 0,
                'quantity' => 1,
                'expectedUnitCents' => 2200,
                'subtotalCents' => 2200,
                'totalCents' => 2200,
            ]],
        ]));
        $response = Pure_Health_Commerce_Bridge::reserve($request);
        $this->assertNotWPError($response);
        $order_id = $response->get_data()['wooOrderId'];
        $this->order_ids[$order_id] = $order_id;
        return $response;
    }

    private function order_request(int $order_id, string $suffix, array $body): WP_REST_Request {
        $request = new WP_REST_Request('POST', '/php-commerce/v1/orders/' . $order_id . $suffix);
        $request->set_param('id', $order_id);
        $request->set_header('content-type', 'application/json');
        $request->set_body(wp_json_encode($body));
        return $request;
    }
}
