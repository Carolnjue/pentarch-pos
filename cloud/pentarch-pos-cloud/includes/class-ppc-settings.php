<?php
/**
 * Plugin settings (single option array).
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Settings {

	const OPTION = 'ppc_settings';

	private static $cache = null;

	/** Defaults. Prices are whole KES. */
	public static function defaults() {
		return array(
			// Licence.
			'trial_days'            => 30,
			'grace_days'            => 7,
			'offline_trial_days'    => 45,
			'default_max_branches'  => 1,
			'default_max_devices'   => 3,
			'enforce_device_limit'  => 0,
			// Prices (KES, whole). Placeholders — to be finalised by Pentarch.
			'software_monthly'       => 1200,
			'software_yearly'        => 12000,
			'extra_branch_monthly'   => 1000,
			'extra_branch_yearly'    => 10000,
			'package_software_setup' => 15000,
			'setup_only_fee'         => 3500,
			'package_complete_till'  => 69900,
			'counter_kit'            => 21900,
			'extra_till'             => 44900,
			// Agent commission.
			'software_rate'          => 20,
			'commission_months'      => 12,
			'bonus_complete_till'    => 3000,
			'bonus_software_setup'   => 1500,
			'bonus_counter_kit'      => 1000,
			'package_software_commission' => 0,
			'auto_approve_commission' => 0,
			// Payments.
			'paybill'               => '',
			'account_format'        => '{code}',
			'mpesa_env'             => 'sandbox',
			'mpesa_consumer_key'    => '',
			'mpesa_consumer_secret' => '',
			'mpesa_shortcode'       => '',
			'mpesa_passkey'         => '',
			'mpesa_type'            => 'paybill',
			'mpesa_callback_secret' => '',
			'mpesa_auto_record'     => 1,
			// Contact.
			'whatsapp'              => '254729455912',
			'phone'                 => '+254 729 455 912',
			'email'                 => 'info@pentarchsystemssolutions.co.ke',
			'admin_email'           => '',
			// Agent resources (URLs).
			'res_sales_guide'       => '',
			'res_price_list'        => '',
			'res_demo_script'       => '',
			'res_objections'        => '',
			'res_faqs'              => '',
			'res_one_pager'         => '',
			'agent_terms_url'       => '',
			// Paths.
			'website_pos_path'      => 'https://pentarchsystemssolutions.co.ke/pos/',
			// Security / housekeeping.
			'trust_proxy'           => 0,
			'rate_register'         => 5,
			'rate_login'            => 10,
			'rate_booking'          => 5,
			'delete_on_uninstall'   => 0,
		);
	}

	/** Field types used for sanitising on save. */
	public static function types() {
		$int  = array( 'trial_days', 'grace_days', 'offline_trial_days', 'default_max_branches', 'default_max_devices', 'software_monthly', 'software_yearly', 'extra_branch_monthly', 'extra_branch_yearly', 'package_software_setup', 'setup_only_fee', 'package_complete_till', 'counter_kit', 'extra_till', 'commission_months', 'bonus_complete_till', 'bonus_software_setup', 'bonus_counter_kit', 'rate_register', 'rate_login', 'rate_booking' );
		$bool = array( 'enforce_device_limit', 'auto_approve_commission', 'package_software_commission', 'mpesa_auto_record', 'trust_proxy', 'delete_on_uninstall' );
		$url  = array( 'res_sales_guide', 'res_price_list', 'res_demo_script', 'res_objections', 'res_faqs', 'res_one_pager', 'agent_terms_url' );
		$t    = array();
		foreach ( array_keys( self::defaults() ) as $k ) {
			$t[ $k ] = in_array( $k, $int, true ) ? 'int' : ( in_array( $k, $bool, true ) ? 'bool' : ( in_array( $k, $url, true ) ? 'url' : 'text' ) );
		}
		$t['software_rate'] = 'float';
		$t['admin_email']   = 'email';
		$t['email']         = 'email';
		return $t;
	}

	public static function all() {
		if ( null === self::$cache ) {
			$saved       = get_option( self::OPTION, array() );
			self::$cache = array_merge( self::defaults(), is_array( $saved ) ? $saved : array() );
		}
		return self::$cache;
	}

	public static function get( $key, $default = null ) {
		$all = self::all();
		return array_key_exists( $key, $all ) ? $all[ $key ] : $default;
	}

	/** Sanitise and save submitted values (only known keys). */
	public static function save( $input ) {
		$types = self::types();
		$cur   = self::all();
		foreach ( $types as $k => $type ) {
			if ( 'bool' === $type ) {
				$cur[ $k ] = empty( $input[ $k ] ) ? 0 : 1;
				continue;
			}
			if ( ! array_key_exists( $k, $input ) ) {
				continue;
			}
			$v = wp_unslash( $input[ $k ] );
			switch ( $type ) {
				case 'int':
					$cur[ $k ] = max( 0, (int) $v );
					break;
				case 'float':
					$cur[ $k ] = max( 0, min( 100, round( (float) $v, 2 ) ) );
					break;
				case 'url':
					$cur[ $k ] = esc_url_raw( trim( (string) $v ) );
					break;
				case 'email':
					$cur[ $k ] = sanitize_email( (string) $v );
					break;
				default:
					$cur[ $k ] = sanitize_text_field( (string) $v );
			}
		}
		// Keep secrets when the field is left as the mask.
		foreach ( array( 'mpesa_consumer_secret', 'mpesa_passkey' ) as $secret ) {
			if ( isset( $input[ $secret ] ) && '********' === $input[ $secret ] ) {
				$saved = get_option( self::OPTION, array() );
				$cur[ $secret ] = isset( $saved[ $secret ] ) ? $saved[ $secret ] : '';
			}
		}
		$cur['whatsapp']    = preg_replace( '/\D+/', '', (string) $cur['whatsapp'] );
		$cur['trial_days']  = max( 1, min( 365, (int) $cur['trial_days'] ) );
		$cur['grace_days']  = max( 0, min( 60, (int) $cur['grace_days'] ) );
		$cur['mpesa_env']   = 'production' === $cur['mpesa_env'] ? 'production' : 'sandbox';
		$cur['mpesa_type']  = 'till' === $cur['mpesa_type'] ? 'till' : 'paybill';
		if ( '' === $cur['mpesa_callback_secret'] ) {
			$cur['mpesa_callback_secret'] = PPC_Util::rand_code( 24, 'abcdefghijkmnpqrstuvwxyz23456789' );
		}
		update_option( self::OPTION, $cur, false );
		self::$cache = null;
		return $cur;
	}

	/** Ensure a callback secret exists (called on activation). */
	public static function ensure_secrets() {
		$saved = get_option( self::OPTION, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		if ( empty( $saved['mpesa_callback_secret'] ) ) {
			$saved['mpesa_callback_secret'] = PPC_Util::rand_code( 24, 'abcdefghijkmnpqrstuvwxyz23456789' );
			update_option( self::OPTION, $saved, false );
			self::$cache = null;
		}
	}

	/** Admin notification email. */
	public static function admin_email() {
		$e = self::get( 'admin_email' );
		return $e ? $e : get_option( 'admin_email' );
	}

	/** Prices block used by public config and licence pay info (whole KES). */
	public static function prices() {
		$out = array();
		foreach ( array( 'software_monthly', 'software_yearly', 'extra_branch_monthly', 'extra_branch_yearly', 'package_software_setup', 'setup_only_fee', 'package_complete_till', 'counter_kit', 'extra_till' ) as $k ) {
			$out[ $k ] = (int) self::get( $k );
		}
		$out['currency'] = 'KES';
		return $out;
	}

	/** Agent resource links. */
	public static function resources() {
		$map = array(
			'sales_guide' => array( 'Sales guide', 'Mwongozo wa mauzo', 'pdf' ),
			'price_list'  => array( 'Price list', 'Orodha ya bei', 'pdf' ),
			'demo_script' => array( 'Demo script', 'Hati ya maonyesho', 'doc' ),
			'objections'  => array( 'Objection answers', 'Majibu ya pingamizi', 'doc' ),
			'faqs'        => array( 'FAQs', 'Maswali ya mara kwa mara', 'doc' ),
			'one_pager'   => array( 'Product one-pager', 'Muhtasari wa bidhaa', 'pdf' ),
		);
		$out = array();
		foreach ( $map as $k => $m ) {
			$url   = (string) self::get( 'res_' . $k );
			$out[] = array(
				'key'      => $k,
				'title'    => $m[0],
				'title_sw' => $m[1],
				'type'     => $m[2],
				'url'      => $url,
			);
		}
		return $out;
	}

	public static function mpesa_configured() {
		return '' !== self::get( 'mpesa_consumer_key' ) && '' !== self::get( 'mpesa_consumer_secret' ) && '' !== self::get( 'mpesa_shortcode' ) && '' !== self::get( 'mpesa_passkey' );
	}

	/** Site origin (scheme://host[:port]). */
	public static function origin() {
		$p = wp_parse_url( home_url() );
		return $p['scheme'] . '://' . $p['host'] . ( isset( $p['port'] ) ? ':' . $p['port'] : '' );
	}

	public static function pos_url( $args = array() ) {
		return add_query_arg( $args, home_url( '/pos/' ) );
	}

	public static function website_url( $args = array() ) {
		$path = (string) self::get( 'website_pos_path', 'https://pentarchsystemssolutions.co.ke/pos/' );
		$base = preg_match( '#^https?://#i', $path ) ? $path : home_url( $path );
		return add_query_arg( $args, $base );
	}
}
