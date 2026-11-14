<?php
/**
 * Fixed-window rate limiter backed by a table (works without object cache).
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_RateLimit {

	/**
	 * Count a hit and report whether the caller is over the limit.
	 *
	 * @param string $name   Bucket name (e.g. 'login').
	 * @param string $key    Discriminator (IP, email...).
	 * @param int    $limit  Allowed hits per window.
	 * @param int    $window Window length in seconds.
	 * @return true|WP_Error
	 */
	public static function hit( $name, $key, $limit, $window ) {
		global $wpdb;
		$limit = (int) apply_filters( 'ppc_rate_limit', (int) $limit, $name );
		if ( $limit <= 0 ) {
			return true;
		}
		$bucket = sha1( $name . '|' . $key );
		$now    = time();
		$start  = $now - ( $now % $window );
		$table  = PPC_Util::t( 'rate_limits' );

		$row = $wpdb->get_row( $wpdb->prepare( "SELECT hits, window_start FROM $table WHERE bucket = %s", $bucket ) );
		if ( ! $row ) {
			$ok = $wpdb->query( $wpdb->prepare( "INSERT INTO $table (bucket, hits, window_start) VALUES (%s, 1, %d)", $bucket, $start ) );
			if ( false === $ok ) {
				// Lost a race with another request: fall through to increment.
				$wpdb->query( $wpdb->prepare( "UPDATE $table SET hits = hits + 1 WHERE bucket = %s", $bucket ) );
			}
			return true;
		}
		if ( (int) $row->window_start !== $start ) {
			$wpdb->query( $wpdb->prepare( "UPDATE $table SET hits = 1, window_start = %d WHERE bucket = %s", $start, $bucket ) );
			return true;
		}
		$wpdb->query( $wpdb->prepare( "UPDATE $table SET hits = hits + 1 WHERE bucket = %s", $bucket ) );
		$hits = (int) $row->hits + 1;
		if ( $hits > $limit ) {
			$retry = max( 1, $start + $window - $now );
			return new WP_Error(
				'rate_limited',
				'Too many attempts. Please wait ' . ( $retry > 90 ? ceil( $retry / 60 ) . ' minutes' : $retry . ' seconds' ) . ' and try again.',
				array(
					'status'      => 429,
					'retry_after' => $retry,
				)
			);
		}
		return true;
	}

	/** Clear a bucket (e.g. after successful login). */
	public static function clear( $name, $key ) {
		global $wpdb;
		$wpdb->delete( PPC_Util::t( 'rate_limits' ), array( 'bucket' => sha1( $name . '|' . $key ) ) );
	}

	public static function clear_all() {
		global $wpdb;
		$wpdb->query( 'DELETE FROM ' . PPC_Util::t( 'rate_limits' ) );
	}
}
