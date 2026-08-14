<?php

$wp_tests_dir = getenv('WP_TESTS_DIR') ?: '/tmp/wordpress-tests-lib';
$wc_plugin_file = getenv('WC_PLUGIN_FILE');

if (!is_readable($wp_tests_dir . '/includes/functions.php')) {
    throw new RuntimeException('Set WP_TESTS_DIR to an installed WordPress PHPUnit test library.');
}
if (!$wc_plugin_file || !is_readable($wc_plugin_file)) {
    throw new RuntimeException('Set WC_PLUGIN_FILE to the WooCommerce plugin entry file.');
}

require_once $wp_tests_dir . '/includes/functions.php';

tests_add_filter('muplugins_loaded', static function () use ($wc_plugin_file): void {
    require_once $wc_plugin_file;
    if (!defined('PHP_COMMERCE_BRIDGE_SECRET')) {
        define('PHP_COMMERCE_BRIDGE_SECRET', 'phpunit-commerce-bridge-secret');
    }
    require_once dirname(__DIR__) . '/pure-health-commerce-bridge.php';
});

require $wp_tests_dir . '/includes/bootstrap.php';
