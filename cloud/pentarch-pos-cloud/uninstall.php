<?php
/**
 * Uninstall: data is kept unless "Delete all data on uninstall" is ticked in Settings.
 *
 * @package PentarchPOSCloud
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

$ppc_settings = get_option( 'ppc_settings', array() );
if ( is_array( $ppc_settings ) && ! empty( $ppc_settings['delete_on_uninstall'] ) ) {
	global $wpdb;
	foreach ( array( 'tenants', 'devices', 'records', 'payments', 'agents', 'agent_tokens', 'leads', 'lead_activities', 'commissions', 'demo_bookings', 'mpesa_requests', 'rate_limits', 'events' ) as $ppc_t ) {
		$wpdb->query( 'DROP TABLE IF EXISTS ' . $wpdb->prefix . 'ppc_' . $ppc_t ); // phpcs:ignore
	}
	delete_option( 'ppc_settings' );
	delete_option( 'ppc_db_version' );
	delete_option( 'ppc_flush_rewrite' );
}
wp_clear_scheduled_hook( 'ppc_daily' );
