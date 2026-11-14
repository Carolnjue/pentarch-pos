<?php
/**
 * Shared helpers.
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Util {

	const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

	/** Table name helper. */
	public static function t( $name ) {
		global $wpdb;
		return $wpdb->prefix . 'ppc_' . $name;
	}

	/** Current UTC time in MySQL format. */
	public static function now() {
		return gmdate( 'Y-m-d H:i:s' );
	}

	/** Milliseconds since epoch. */
	public static function now_ms() {
		return (int) floor( microtime( true ) * 1000 );
	}

	/** UTC MySQL datetime -> unix seconds (0 when empty). */
	public static function ts( $mysql ) {
		if ( empty( $mysql ) || '0000-00-00 00:00:00' === $mysql ) {
			return 0;
		}
		$t = strtotime( $mysql . ' UTC' );
		return $t ? $t : 0;
	}

	/** Unix seconds -> UTC MySQL datetime. */
	public static function dt( $ts ) {
		return gmdate( 'Y-m-d H:i:s', (int) $ts );
	}

	/** Unix seconds -> ISO 8601 (UTC) or null. */
	public static function iso( $mysql_or_ts ) {
		$ts = is_numeric( $mysql_or_ts ) ? (int) $mysql_or_ts : self::ts( $mysql_or_ts );
		return $ts ? gmdate( 'c', $ts ) : null;
	}

	/** Format a UTC MySQL date for display in the site timezone. */
	public static function fmt_date( $mysql, $with_time = false ) {
		$ts = self::ts( $mysql );
		if ( ! $ts ) {
			return '—';
		}
		return wp_date( $with_time ? 'j M Y, H:i' : 'j M Y', $ts );
	}

	/** Relative time ("3 hours ago"). */
	public static function ago( $mysql ) {
		$ts = self::ts( $mysql );
		if ( ! $ts ) {
			return 'never';
		}
		$diff = time() - $ts;
		if ( $diff < 60 ) {
			return 'just now';
		}
		return human_time_diff( $ts, time() ) . ' ago';
	}

	/** Generate a ULID (26 chars, Crockford base32, time-sortable). */
	public static function ulid() {
		$time = (int) floor( microtime( true ) * 1000 );
		$out  = '';
		for ( $i = 9; $i >= 0; $i-- ) {
			$mod  = $time % 32;
			$out  = self::ULID_ALPHABET[ $mod ] . $out;
			$time = ( $time - $mod ) / 32;
		}
		$bytes = random_bytes( 16 );
		for ( $i = 0; $i < 16; $i++ ) {
			$out .= self::ULID_ALPHABET[ ord( $bytes[ $i ] ) % 32 ];
		}
		return $out;
	}

	/** Random code from an unambiguous alphabet. */
	public static function rand_code( $len, $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' ) {
		$out = '';
		$max = strlen( $alphabet ) - 1;
		for ( $i = 0; $i < $len; $i++ ) {
			$out .= $alphabet[ random_int( 0, $max ) ];
		}
		return $out;
	}

	/** New bearer token. */
	public static function new_token( $prefix ) {
		return $prefix . bin2hex( random_bytes( 32 ) );
	}

	/** SHA-256 hash for storage. */
	public static function hash_token( $token ) {
		return hash( 'sha256', (string) $token );
	}

	/**
	 * Normalise a Kenyan phone number to 2547XXXXXXXX / 2541XXXXXXXX.
	 * Returns '' if it cannot be normalised.
	 */
	public static function phone( $raw ) {
		$d = preg_replace( '/\D+/', '', (string) $raw );
		if ( '' === $d ) {
			return '';
		}
		if ( 0 === strpos( $d, '00254' ) ) {
			$d = substr( $d, 2 );
		}
		if ( 10 === strlen( $d ) && '0' === $d[0] ) {
			$d = '254' . substr( $d, 1 );
		} elseif ( 9 === strlen( $d ) && ( '7' === $d[0] || '1' === $d[0] ) ) {
			$d = '254' . $d;
		}
		if ( preg_match( '/^254[17]\d{8}$/', $d ) ) {
			return $d;
		}
		return '';
	}

	/** Pretty phone: +254 712 345 678. */
	public static function phone_pretty( $p ) {
		if ( ! preg_match( '/^254(\d{3})(\d{3})(\d{3})$/', (string) $p, $m ) ) {
			return (string) $p;
		}
		return '+254 ' . $m[1] . ' ' . $m[2] . ' ' . $m[3];
	}

	/** wa.me link. */
	public static function wa_link( $phone, $text = '' ) {
		$p = self::phone( $phone );
		if ( ! $p ) {
			$p = preg_replace( '/\D+/', '', (string) $phone );
		}
		return 'https://wa.me/' . $p . ( '' !== $text ? '?text=' . rawurlencode( $text ) : '' );
	}

	/** Client IP (REMOTE_ADDR unless trust_proxy is on). */
	public static function ip() {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '0.0.0.0';
		if ( PPC_Settings::get( 'trust_proxy' ) ) {
			foreach ( array( 'HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR' ) as $h ) {
				if ( ! empty( $_SERVER[ $h ] ) ) {
					$parts = explode( ',', sanitize_text_field( wp_unslash( $_SERVER[ $h ] ) ) );
					$cand  = trim( $parts[0] );
					if ( filter_var( $cand, FILTER_VALIDATE_IP ) ) {
						return $cand;
					}
				}
			}
		}
		return filter_var( $ip, FILTER_VALIDATE_IP ) ? $ip : '0.0.0.0';
	}

	/** KES cents -> "KES 1,500" */
	public static function kes( $cents, $with_symbol = true ) {
		$v   = ( (int) $cents ) / 100;
		$dec = ( abs( $v - round( $v ) ) > 0.001 ) ? 2 : 0;
		return ( $with_symbol ? 'KES ' : '' ) . number_format( $v, $dec );
	}

	/** Clean single-line text with a length cap. */
	public static function text( $v, $max = 190 ) {
		if ( is_array( $v ) || is_object( $v ) ) {
			return '';
		}
		$v = sanitize_text_field( (string) $v );
		return function_exists( 'mb_substr' ) ? mb_substr( $v, 0, $max ) : substr( $v, 0, $max );
	}

	/** Clean multi-line text with a length cap. */
	public static function textarea( $v, $max = 2000 ) {
		if ( is_array( $v ) || is_object( $v ) ) {
			return '';
		}
		$v = sanitize_textarea_field( (string) $v );
		return function_exists( 'mb_substr' ) ? mb_substr( $v, 0, $max ) : substr( $v, 0, $max );
	}

	/** Valid id for synced records (ULID or similar). */
	public static function valid_id( $id ) {
		return is_string( $id ) && preg_match( '/^[A-Za-z0-9_\-:.]{1,64}$/', $id );
	}

	/** REST error helper. */
	public static function err( $code, $message, $status = 400, $extra = array() ) {
		return new WP_Error( $code, $message, array_merge( array( 'status' => $status ), $extra ) );
	}

	/** Is the active database the SQLite drop-in (local testing only). */
	public static function is_sqlite() {
		return defined( 'SQLITE_DB_DROPIN_VERSION' ) || ( defined( 'DB_ENGINE' ) && 'sqlite' === DB_ENGINE );
	}

	/** First name only. */
	public static function first_name( $name ) {
		$parts = preg_split( '/\s+/', trim( (string) $name ) );
		return $parts && '' !== $parts[0] ? $parts[0] : 'Agent';
	}

	/** Mask an email for public display. */
	public static function mask_email( $email ) {
		$p = explode( '@', (string) $email );
		if ( count( $p ) !== 2 ) {
			return '';
		}
		return substr( $p[0], 0, 2 ) . str_repeat( '•', max( 1, strlen( $p[0] ) - 2 ) ) . '@' . $p[1];
	}

	/** Readable random password for new trial owners. */
	public static function friendly_password() {
		$words = array( 'Simba', 'Duka', 'Jua', 'Mto', 'Nyota', 'Tembo', 'Chui', 'Kifaru', 'Mvua', 'Bahari', 'Mlima', 'Faida' );
		return $words[ random_int( 0, count( $words ) - 1 ) ] . '-' . random_int( 1000, 9999 ) . self::rand_code( 2, 'abcdefghjkmnpqrstuvwxyz' );
	}

	/** CSV download (headers + rows), then exit. */
	public static function csv_download( $filename, $header, $rows ) {
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . sanitize_file_name( $filename ) . '"' );
		$out = fopen( 'php://output', 'w' );
		fwrite( $out, "\xEF\xBB\xBF" ); // UTF-8 BOM for Excel.
		fputcsv( $out, $header, ',', '"', '\\' );
		foreach ( $rows as $r ) {
			$r = array_map(
				function ( $c ) {
					$c = is_scalar( $c ) || null === $c ? (string) $c : wp_json_encode( $c );
					// Neutralise spreadsheet formula injection.
					if ( '' !== $c && in_array( $c[0], array( '=', '+', '-', '@' ), true ) && ! is_numeric( $c ) ) {
						$c = "'" . $c;
					}
					return $c;
				},
				(array) $r
			);
			fputcsv( $out, $r, ',', '"', '\\' );
		}
		fclose( $out );
		exit;
	}
}
