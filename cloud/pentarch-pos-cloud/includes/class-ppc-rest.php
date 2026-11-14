<?php
/**
 * REST API: namespace pentarch-pos/v1 (SPEC §4 and §6).
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_REST {

	/** @var array|null [tenant, device] for the current request */
	private static $device = null;
	/** @var array|null [agent, token_row] for the current request */
	private static $agent = null;

	public static function register() {
		$ns = PPC_NS;

		// --- POS app -----------------------------------------------------
		self::route( '/auth/register', 'POST', 'pos_register', 'public' );
		self::route( '/auth/login', 'POST', 'pos_login', 'public' );
		self::route( '/auth/logout', 'POST', 'pos_logout', 'device' );
		self::route( '/me', 'GET', 'pos_me', 'device' );
		self::route( '/licence', 'GET', 'pos_licence', 'device' );
		self::route( '/sync/push', 'POST', 'sync_push', 'device' );
		self::route( '/sync/pull', 'GET', 'sync_pull', 'device' );
		self::route( '/mpesa/stk', 'POST', 'mpesa_stk', 'device' );
		self::route( '/mpesa/stk/(?P<id>[A-Za-z0-9_\-]{4,80})', 'GET', 'mpesa_stk_status', 'device' );
		self::route( '/mpesa/callback/(?P<secret>[a-z0-9]{8,64})', 'POST', 'mpesa_callback', 'public' );
		self::route( '/backup', 'POST', 'backup', 'device' );

		// --- Public ------------------------------------------------------
		self::route( '/public/config', 'GET', 'public_config', 'public' );
		self::route( '/public/demo-booking', 'POST', 'public_demo_booking', 'public' );
		self::route( '/public/ping', 'GET', 'public_ping', 'public' );

		// --- Agents ------------------------------------------------------
		self::route( '/agents/auth/register', 'POST', 'agent_register', 'public' );
		self::route( '/agents/auth/login', 'POST', 'agent_login', 'public' );
		self::route( '/agents/auth/logout', 'POST', 'agent_logout', 'agent_any' );
		self::route( '/agents/me', 'GET', 'agent_me', 'agent_any' );
		self::route( '/agents/me', 'POST', 'agent_me_update', 'agent_any' );
		self::route( '/agents/leads/push', 'POST', 'agent_leads_push', 'agent' );
		self::route( '/agents/leads/pull', 'GET', 'agent_leads_pull', 'agent' );
		self::route( '/agents/leads/check-phone', 'GET', 'agent_check_phone', 'agent' );
		self::route( '/agents/trials', 'POST', 'agent_start_trial', 'agent' );
		self::route( '/agents/trials', 'GET', 'agent_trials', 'agent' );
		self::route( '/agents/demo-bookings', 'POST', 'agent_demo_booking', 'agent' );
		self::route( '/agents/commissions', 'GET', 'agent_commissions', 'agent' );
		self::route( '/agents/leaderboard', 'GET', 'agent_leaderboard', 'agent' );
		self::route( '/agents/resources', 'GET', 'agent_resources', 'agent_any' );

		add_filter( 'rest_post_dispatch', array( __CLASS__, 'headers' ), 10, 3 );
		add_filter( 'rest_pre_serve_request', array( __CLASS__, 'cors' ), 20, 4 );
	}

	private static function route( $path, $method, $cb, $auth ) {
		$perm = 'public' === $auth ? '__return_true' : array( __CLASS__, 'perm_' . $auth );
		register_rest_route(
			PPC_NS,
			$path,
			array(
				'methods'             => $method,
				'callback'            => array( __CLASS__, $cb ),
				'permission_callback' => $perm,
			)
		);
	}

	/* ---------------- Auth helpers ---------------- */

	private static function bearer( WP_REST_Request $r ) {
		$h = $r->get_header( 'authorization' );
		if ( ! $h && isset( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
			$h = sanitize_text_field( wp_unslash( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) );
		}
		if ( $h && preg_match( '/^Bearer\s+(\S+)$/i', trim( $h ), $m ) ) {
			return $m[1];
		}
		// Fallback for hosts that strip the Authorization header.
		$x = $r->get_header( 'x_ppc_token' );
		return $x ? trim( $x ) : '';
	}

	public static function perm_device( WP_REST_Request $r ) {
		$res = PPC_Tenants::auth_token( self::bearer( $r ) );
		if ( ! $res ) {
			return PPC_Util::err( 'unauthorized', 'Your session has expired. Please sign in again.', 401 );
		}
		self::$device = $res;
		return true;
	}

	public static function perm_agent_any( WP_REST_Request $r ) {
		$res = PPC_Agents::auth_token( self::bearer( $r ) );
		if ( ! $res ) {
			return PPC_Util::err( 'unauthorized', 'Please sign in again.', 401 );
		}
		if ( 'suspended' === $res[0]->status ) {
			return PPC_Util::err( 'agent_suspended', 'Your agent account is suspended. Please contact Pentarch.', 403 );
		}
		self::$agent = $res;
		return true;
	}

	public static function perm_agent( WP_REST_Request $r ) {
		$ok = self::perm_agent_any( $r );
		if ( true !== $ok ) {
			return $ok;
		}
		if ( 'active' !== self::$agent[0]->status ) {
			return PPC_Util::err( 'agent_pending', 'Your agent account is waiting for approval by Pentarch.', 403 );
		}
		return true;
	}

	private static function json( WP_REST_Request $r ) {
		$p = $r->get_json_params();
		if ( ! is_array( $p ) ) {
			$p = $r->get_body_params();
		}
		return is_array( $p ) ? $p : array();
	}

	private static function limited( $name, $key, $limit, $window ) {
		$res = PPC_RateLimit::hit( $name, $key, $limit, $window );
		return is_wp_error( $res ) ? $res : null;
	}

	/* ---------------- Headers / CORS ---------------- */

	private static function is_ours( $route ) {
		return 0 === strpos( (string) $route, '/' . PPC_NS );
	}

	public static function headers( $response, $server, $request ) {
		if ( ! self::is_ours( $request->get_route() ) ) {
			return $response;
		}
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		$response->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0' );
		$response->header( 'Pragma', 'no-cache' );
		$response->header( 'X-LiteSpeed-Cache-Control', 'no-cache' );
		$response->header( 'X-Content-Type-Options', 'nosniff' );
		$response->header( 'Referrer-Policy', 'same-origin' );
		if ( $response instanceof WP_REST_Response && $response->is_error() ) {
			$data = $response->get_data();
			if ( isset( $data['data']['retry_after'] ) ) {
				$response->header( 'Retry-After', (string) (int) $data['data']['retry_after'] );
			}
		}
		return $response;
	}

	/** Same-origin CORS only for our namespace (WordPress echoes any Origin by default). */
	public static function cors( $served, $result, $request, $server ) {
		if ( ! self::is_ours( $request->get_route() ) || headers_sent() ) {
			return $served;
		}
		header_remove( 'Access-Control-Allow-Origin' );
		header_remove( 'Access-Control-Allow-Credentials' );
		$origin = get_http_origin();
		$allow  = apply_filters( 'ppc_allowed_origins', array( PPC_Settings::origin() ) );
		if ( $origin && in_array( $origin, $allow, true ) ) {
			header( 'Access-Control-Allow-Origin: ' . $origin );
			header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-PPC-Token' );
			header( 'Vary: Origin', false );
		}
		return $served;
	}

	/* =================================================================== */
	/* POS app                                                              */
	/* =================================================================== */

	public static function pos_register( WP_REST_Request $r ) {
		$ip = PPC_Util::ip();
		if ( $e = self::limited( 'register', $ip, (int) PPC_Settings::get( 'rate_register', 5 ), HOUR_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		$d = PPC_Tenants::validate_registration( self::json( $r ) );
		if ( is_wp_error( $d ) ) {
			return $d;
		}
		$t = PPC_Tenants::create( $d );
		if ( is_wp_error( $t ) ) {
			return $t;
		}
		list( $uid, $token ) = PPC_Tenants::issue_device( $t->id, $d['device_name'] ? $d['device_name'] : 'Main till' );
		return new WP_REST_Response(
			array(
				'tenant_id'     => $t->id,
				'device_id'     => $uid,
				'device_token'  => $token,
				'licence'       => PPC_Licence::payload( $t ),
				'business_code' => $t->code,
			),
			201
		);
	}

	public static function pos_login( WP_REST_Request $r ) {
		$p     = self::json( $r );
		$email = strtolower( sanitize_email( isset( $p['email'] ) ? $p['email'] : '' ) );
		$ip    = PPC_Util::ip();
		$lim   = (int) PPC_Settings::get( 'rate_login', 10 );
		if ( $e = self::limited( 'login_ip', $ip, $lim * 3, 15 * MINUTE_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		if ( $e = self::limited( 'login_email', $email, $lim, 15 * MINUTE_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		$pass = isset( $p['password'] ) && is_string( $p['password'] ) ? $p['password'] : '';
		$t    = $email ? PPC_Tenants::get_by_email( $email ) : null;
		if ( ! $t || ! wp_check_password( $pass, $t->password_hash ) ) {
			return PPC_Util::err( 'invalid_credentials', 'The email or password is incorrect.', 401 );
		}
		if ( PPC_Settings::get( 'enforce_device_limit' ) && PPC_Tenants::active_device_count( $t->id ) >= (int) $t->max_devices ) {
			return PPC_Util::err( 'device_limit', 'This business has reached its device limit (' . (int) $t->max_devices . '). Sign out on another device or contact Pentarch.', 403 );
		}
		PPC_RateLimit::clear( 'login_email', $email );
		list( $uid, $token ) = PPC_Tenants::issue_device( $t->id, PPC_Util::text( isset( $p['device_name'] ) ? $p['device_name'] : '', 100 ) );
		return array(
			'tenant_id'     => $t->id,
			'device_id'     => $uid,
			'device_token'  => $token,
			'licence'       => PPC_Licence::payload( $t ),
			'business_code' => $t->code,
		);
	}

	public static function pos_logout( WP_REST_Request $r ) {
		list( $t, $dev ) = self::$device;
		PPC_Tenants::revoke_device( $dev->id, $t->id );
		return array( 'ok' => true );
	}

	public static function pos_me( WP_REST_Request $r ) {
		list( $t, $dev ) = self::$device;
		return array(
			'tenant_id'     => $t->id,
			'business_code' => $t->code,
			'business_name' => $t->business_name,
			'owner_name'    => $t->owner_name,
			'email'         => $t->email,
			'phone'         => $t->phone,
			'device_id'     => $dev->device_uid,
			'device_name'   => $dev->name,
			'licence'       => PPC_Licence::payload( $t ),
		);
	}

	public static function pos_licence( WP_REST_Request $r ) {
		return PPC_Licence::payload( self::$device[0] );
	}

	public static function sync_push( WP_REST_Request $r ) {
		list( $t, $dev ) = self::$device;
		$p = self::json( $r );
		return PPC_Sync::push( $t, $dev, isset( $p['changes'] ) ? $p['changes'] : null );
	}

	public static function sync_pull( WP_REST_Request $r ) {
		return PPC_Sync::pull( self::$device[0], $r->get_param( 'since' ), $r->get_param( 'limit' ) );
	}

	public static function mpesa_stk( WP_REST_Request $r ) {
		list( $t ) = self::$device;
		if ( $e = self::limited( 'stk', $t->id, 20, MINUTE_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		$p = self::json( $r );
		return PPC_Mpesa::stk( $t, isset( $p['phone'] ) ? $p['phone'] : '', isset( $p['amount'] ) ? $p['amount'] : 0, isset( $p['ref'] ) ? $p['ref'] : '' );
	}

	public static function mpesa_stk_status( WP_REST_Request $r ) {
		return PPC_Mpesa::status( self::$device[0], (string) $r['id'] );
	}

	public static function mpesa_callback( WP_REST_Request $r ) {
		if ( ! hash_equals( (string) PPC_Settings::get( 'mpesa_callback_secret' ), (string) $r['secret'] ) ) {
			return PPC_Util::err( 'forbidden', 'Forbidden', 403 );
		}
		PPC_Mpesa::callback( self::json( $r ) );
		return array(
			'ResultCode' => 0,
			'ResultDesc' => 'Accepted',
		);
	}

	/** Optional snapshot backup (JSON, optionally gzip). Keeps the 5 newest per tenant. */
	public static function backup( WP_REST_Request $r ) {
		list( $t ) = self::$device;
		if ( $e = self::limited( 'backup', $t->id, 12, HOUR_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		$body = $r->get_body();
		if ( '' === $body ) {
			return PPC_Util::err( 'empty', 'Empty backup.', 400 );
		}
		if ( strlen( $body ) > 25 * MB_IN_BYTES ) {
			return PPC_Util::err( 'too_large', 'Backup is larger than 25 MB.', 413 );
		}
		$is_gz = "\x1f\x8b" === substr( $body, 0, 2 );
		if ( ! $is_gz && null === json_decode( $body ) ) {
			return PPC_Util::err( 'invalid_backup', 'Backup must be JSON or gzip-compressed JSON.', 400 );
		}
		$up  = wp_upload_dir();
		$dir = trailingslashit( $up['basedir'] ) . 'ppc-backups/' . $t->id;
		if ( ! wp_mkdir_p( $dir ) ) {
			return PPC_Util::err( 'storage', 'Could not store backup.', 500 );
		}
		$root = dirname( $dir );
		if ( ! file_exists( $root . '/.htaccess' ) ) {
			file_put_contents( $root . '/.htaccess', "Require all denied\nDeny from all\n" ); // phpcs:ignore
			file_put_contents( $root . '/index.php', "<?php // Silence.\n" ); // phpcs:ignore
		}
		$name = gmdate( 'Ymd-His' ) . '-' . PPC_Util::rand_code( 10, 'abcdefghijkmnpqrstuvwxyz23456789' ) . ( $is_gz ? '.json.gz' : '.json' );
		file_put_contents( $dir . '/' . $name, $body ); // phpcs:ignore
		$files = glob( $dir . '/*.json*' );
		rsort( $files );
		foreach ( array_slice( $files, 5 ) as $old ) {
			wp_delete_file( $old );
		}
		return array(
			'ok'        => true,
			'size'      => strlen( $body ),
			'stored_at' => gmdate( 'c' ),
			'kept'      => min( 5, count( $files ) ),
		);
	}

	/* =================================================================== */
	/* Public                                                               */
	/* =================================================================== */

	public static function public_config( WP_REST_Request $r ) {
		if ( $e = self::limited( 'config', PPC_Util::ip(), 120, MINUTE_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		return array(
			'trial_days'     => (int) PPC_Settings::get( 'trial_days' ),
			'grace_days'     => (int) PPC_Settings::get( 'grace_days' ),
			'prices'         => PPC_Settings::prices(),
			'whatsapp'       => (string) PPC_Settings::get( 'whatsapp' ),
			'phone'          => (string) PPC_Settings::get( 'phone' ),
			'email'          => (string) PPC_Settings::get( 'email' ),
			'paybill'        => (string) PPC_Settings::get( 'paybill' ),
			'business_types' => PPC_Tenants::business_types(),
			'mpesa_stk'      => PPC_Settings::mpesa_configured(),
			'agent_terms_url' => (string) PPC_Settings::get( 'agent_terms_url' ),
			'agent_commission' => array(
				'software_rate'        => (float) PPC_Settings::get( 'software_rate' ),
				'commission_months'    => (int) PPC_Settings::get( 'commission_months' ),
				'bonus_complete_till'  => (int) PPC_Settings::get( 'bonus_complete_till' ),
				'bonus_software_setup' => (int) PPC_Settings::get( 'bonus_software_setup' ),
				'bonus_counter_kit'    => (int) PPC_Settings::get( 'bonus_counter_kit' ),
			),
		);
	}

	/** Health check; also reports whether the Authorization header reaches PHP (shared-hosting diagnostic). */
	public static function public_ping( WP_REST_Request $r ) {
		if ( $e = self::limited( 'ping', PPC_Util::ip(), 60, MINUTE_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		return array(
			'ok'                   => true,
			'version'              => PPC_VERSION,
			'time'                 => gmdate( 'c' ),
			'auth_header_received' => '' !== self::bearer( $r ),
		);
	}

	/** Validate + create a demo booking. */
	public static function create_booking( $p, $agent = null, $lead_id = null ) {
		global $wpdb;
		$d      = array(
			'name'           => PPC_Util::text( isset( $p['name'] ) ? $p['name'] : '', 190 ),
			'business'       => PPC_Util::text( isset( $p['business'] ) ? $p['business'] : '', 190 ),
			'business_type'  => sanitize_key( isset( $p['business_type'] ) ? $p['business_type'] : '' ),
			'phone'          => PPC_Util::phone( isset( $p['phone'] ) ? $p['phone'] : '' ),
			'email'          => strtolower( sanitize_email( isset( $p['email'] ) ? $p['email'] : '' ) ),
			'town'           => PPC_Util::text( isset( $p['town'] ) ? $p['town'] : '', 100 ),
			'preferred_date' => isset( $p['preferred_date'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', (string) $p['preferred_date'] ) ? $p['preferred_date'] : '',
			'preferred_time' => PPC_Util::text( isset( $p['preferred_time'] ) ? $p['preferred_time'] : '', 20 ),
			'message'        => PPC_Util::textarea( isset( $p['message'] ) ? $p['message'] : '', 2000 ),
			'agent_code'     => strtoupper( PPC_Util::text( isset( $p['agent_code'] ) ? $p['agent_code'] : '', 12 ) ),
			'source_page'    => esc_url_raw( PPC_Util::text( isset( $p['source_page'] ) ? $p['source_page'] : '', 255 ) ),
		);
		$errors = array();
		if ( strlen( $d['name'] ) < 2 ) {
			$errors['name'] = 'Enter your name.';
		}
		if ( ! $d['phone'] ) {
			$errors['phone'] = 'Enter a valid phone number, e.g. 0712 345 678.';
		}
		if ( strlen( $d['business'] ) < 2 ) {
			$errors['business'] = 'Enter the business name.';
		}
		if ( ! empty( $p['email'] ) && ! is_email( $d['email'] ) ) {
			$errors['email'] = 'Enter a valid email address or leave it blank.';
		}
		if ( $errors ) {
			return PPC_Util::err( 'invalid_input', reset( $errors ), 422, array( 'fields' => $errors ) );
		}
		if ( ! $agent && $d['agent_code'] ) {
			$a = PPC_Agents::get_by_code( $d['agent_code'] );
			if ( $a && 'active' === $a->status ) {
				$agent = $a;
			}
		}
		$table = PPC_Util::t( 'demo_bookings' );
		do {
			$ref = 'DB-' . PPC_Util::rand_code( 6, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' );
		} while ( $wpdb->get_var( $wpdb->prepare( "SELECT 1 FROM $table WHERE ref = %s", $ref ) ) );
		$now = PPC_Util::now();

		// A booking that came in through an agent's link becomes a lead in that agent's pipeline.
		if ( $agent && ! $lead_id ) {
			$lead_id = PPC_Util::ulid();
			$ms      = PPC_Util::now_ms();
			$data    = array(
				'id'               => $lead_id,
				'business_name'    => $d['business'],
				'contact_name'     => $d['name'],
				'phone'            => $d['phone'],
				'email'            => $d['email'],
				'business_type'    => $d['business_type'],
				'town'             => $d['town'],
				'stage'            => 'demo_booked',
				'package_interest' => 'unsure',
				'next_follow_up'   => $d['preferred_date'],
				'notes'            => trim( 'Booked a demo on the website (' . $ref . '). ' . $d['message'] ),
				'source'           => 'website',
				'created_at'       => $ms,
				'updated_at'       => $ms,
			);
			$wpdb->insert(
				PPC_Util::t( 'leads' ),
				array(
					'agent_id'         => $agent->id,
					'lead_id'          => $lead_id,
					'business_name'    => $d['business'],
					'contact_name'     => $d['name'],
					'phone'            => $d['phone'],
					'town'             => $d['town'],
					'stage'            => 'demo_booked',
					'package_interest' => 'unsure',
					'next_follow_up'   => $d['preferred_date'],
					'data'             => wp_json_encode( $data ),
					'updated_at'       => $ms,
					'deleted'          => 0,
					'created_at'       => $now,
					'received_at'      => $now,
				)
			);
		}

		$wpdb->insert(
			$table,
			array_merge(
				$d,
				array(
					'ref'               => $ref,
					'agent_id'          => $agent ? $agent->id : null,
					'assigned_agent_id' => $agent ? $agent->id : null,
					'agent_code'        => $agent ? $agent->code : $d['agent_code'],
					'lead_id'           => $lead_id,
					'status'            => 'new',
					'ip_hash'           => hash( 'sha256', PPC_Util::ip() . wp_salt() ),
					'created_at'        => $now,
					'updated_at'        => $now,
				)
			)
		);
		$b = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE ref = %s", $ref ) );
		PPC_DB::event( 'booking.new', sprintf( 'Demo booking %s from %s (%s)', $ref, $d['business'], $d['town'] ? $d['town'] : 'no town' ), null, $agent ? $agent->id : null );
		PPC_Notify::demo_booking( $b );
		return $b;
	}

	public static function public_demo_booking( WP_REST_Request $r ) {
		$p = self::json( $r );
		if ( $e = self::limited( 'booking', PPC_Util::ip(), (int) PPC_Settings::get( 'rate_booking', 5 ), HOUR_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		// Honeypot: bots fill the hidden "website" field. Pretend success, store nothing.
		if ( ! empty( $p['website'] ) ) {
			return array(
				'ok'  => true,
				'ref' => 'DB-' . PPC_Util::rand_code( 6, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' ),
			);
		}
		$b = self::create_booking( $p );
		if ( is_wp_error( $b ) ) {
			return $b;
		}
		return array(
			'ok'       => true,
			'ref'      => $b->ref,
			'whatsapp' => (string) PPC_Settings::get( 'whatsapp' ),
		);
	}

	/* =================================================================== */
	/* Agents                                                               */
	/* =================================================================== */

	public static function agent_register( WP_REST_Request $r ) {
		if ( $e = self::limited( 'agent_register', PPC_Util::ip(), (int) PPC_Settings::get( 'rate_register', 5 ), HOUR_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		$p = self::json( $r );
		$a = PPC_Agents::create( $p );
		if ( is_wp_error( $a ) ) {
			return $a;
		}
		$token = PPC_Agents::issue_token( $a->id, PPC_Util::text( isset( $p['device_name'] ) ? $p['device_name'] : '', 100 ) );
		return new WP_REST_Response(
			array(
				'ok'     => true,
				'status' => $a->status,
				'token'  => $token,
				'agent'  => PPC_Agents::payload( $a ),
			),
			201
		);
	}

	public static function agent_login( WP_REST_Request $r ) {
		$p     = self::json( $r );
		$login = PPC_Util::text( isset( $p['email'] ) ? $p['email'] : ( isset( $p['login'] ) ? $p['login'] : ( isset( $p['phone'] ) ? $p['phone'] : '' ) ), 190 );
		$lim   = (int) PPC_Settings::get( 'rate_login', 10 );
		if ( $e = self::limited( 'agent_login_ip', PPC_Util::ip(), $lim * 3, 15 * MINUTE_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		if ( $e = self::limited( 'agent_login', strtolower( $login ), $lim, 15 * MINUTE_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		$a    = PPC_Agents::get_by_login( $login );
		$pass = isset( $p['password'] ) && is_string( $p['password'] ) ? $p['password'] : '';
		if ( ! $a || ! wp_check_password( $pass, $a->password_hash ) ) {
			return PPC_Util::err( 'invalid_credentials', 'The email/phone or password is incorrect.', 401 );
		}
		if ( 'suspended' === $a->status ) {
			return PPC_Util::err( 'agent_suspended', 'Your agent account is suspended. Please contact Pentarch.', 403 );
		}
		PPC_RateLimit::clear( 'agent_login', strtolower( $login ) );
		$token = PPC_Agents::issue_token( $a->id, PPC_Util::text( isset( $p['device_name'] ) ? $p['device_name'] : '', 100 ) );
		return array(
			'token'  => $token,
			'status' => $a->status,
			'agent'  => PPC_Agents::payload( $a ),
		);
	}

	public static function agent_logout( WP_REST_Request $r ) {
		global $wpdb;
		$wpdb->update( PPC_Util::t( 'agent_tokens' ), array( 'revoked_at' => PPC_Util::now() ), array( 'id' => self::$agent[1]->id ) );
		return array( 'ok' => true );
	}

	public static function agent_me( WP_REST_Request $r ) {
		$a = self::$agent[0];
		return array(
			'agent'   => PPC_Agents::payload( $a ),
			'stats'   => 'active' === $a->status ? PPC_Agents::stats( $a->id ) : null,
			'contact' => array(
				'whatsapp' => (string) PPC_Settings::get( 'whatsapp' ),
				'phone'    => (string) PPC_Settings::get( 'phone' ),
				'email'    => (string) PPC_Settings::get( 'email' ),
			),
		);
	}

	public static function agent_me_update( WP_REST_Request $r ) {
		global $wpdb;
		$a = self::$agent[0];
		$p = self::json( $r );
		$f = array();
		if ( isset( $p['mpesa_phone'] ) ) {
			$mp = PPC_Util::phone( $p['mpesa_phone'] );
			if ( ! $mp ) {
				return PPC_Util::err( 'invalid_input', 'Enter a valid M-Pesa number.', 422, array( 'fields' => array( 'mpesa_phone' => 'Invalid number.' ) ) );
			}
			$f['mpesa_phone'] = $mp;
		}
		if ( isset( $p['lang'] ) ) {
			$f['lang'] = 'sw' === $p['lang'] ? 'sw' : 'en';
		}
		if ( isset( $p['town'] ) ) {
			$f['town'] = PPC_Util::text( $p['town'], 100 );
		}
		if ( isset( $p['county'] ) ) {
			$f['county'] = PPC_Util::text( $p['county'], 100 );
		}
		if ( ! empty( $p['new_password'] ) ) {
			if ( empty( $p['current_password'] ) || ! wp_check_password( (string) $p['current_password'], $a->password_hash ) ) {
				return PPC_Util::err( 'invalid_credentials', 'Your current password is incorrect.', 401 );
			}
			if ( strlen( (string) $p['new_password'] ) < 8 ) {
				return PPC_Util::err( 'invalid_input', 'New password must be at least 8 characters.', 422 );
			}
			$f['password_hash'] = wp_hash_password( (string) $p['new_password'] );
		}
		if ( $f ) {
			$f['updated_at'] = PPC_Util::now();
			$wpdb->update( PPC_Util::t( 'agents' ), $f, array( 'id' => $a->id ) );
		}
		return array( 'agent' => PPC_Agents::payload( PPC_Agents::get( $a->id ) ) );
	}

	public static function agent_leads_push( WP_REST_Request $r ) {
		$p = self::json( $r );
		return PPC_Sync::push_leads( self::$agent[0], isset( $p['changes'] ) ? $p['changes'] : null );
	}

	public static function agent_leads_pull( WP_REST_Request $r ) {
		return PPC_Sync::pull_leads( self::$agent[0], $r->get_param( 'since' ), $r->get_param( 'limit' ) );
	}

	/** Is this phone already a lead (any agent) or a customer? No other agent's identity is revealed. */
	public static function agent_check_phone( WP_REST_Request $r ) {
		global $wpdb;
		$a     = self::$agent[0];
		$phone = PPC_Util::phone( $r->get_param( 'phone' ) );
		if ( ! $phone ) {
			return array(
				'exists' => false,
			);
		}
		$exclude = PPC_Util::text( (string) $r->get_param( 'exclude' ), 64 );
		$mine    = $wpdb->get_row( $wpdb->prepare( 'SELECT lead_id, business_name, stage FROM ' . PPC_Util::t( 'leads' ) . ' WHERE agent_id = %d AND phone = %s AND deleted = 0 AND lead_id <> %s LIMIT 1', $a->id, $phone, $exclude ) );
		$other   = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . PPC_Util::t( 'leads' ) . ' WHERE agent_id <> %d AND phone = %s AND deleted = 0', $a->id, $phone ) );
		$client  = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . PPC_Util::t( 'tenants' ) . ' WHERE phone = %s', $phone ) );
		return array(
			'exists'          => (bool) ( $mine || $other || $client ),
			'mine'            => $mine ? array(
				'id'            => $mine->lead_id,
				'business_name' => $mine->business_name,
				'stage'         => $mine->stage,
			) : null,
			'other_agent'     => $other > 0,
			'existing_client' => $client > 0,
		);
	}

	private static function trial_message( $t, $password, $lang ) {
		$url = PPC_Settings::pos_url();
		if ( 'sw' === $lang ) {
			return "Habari {$t->owner_name},\n\nAkaunti yako ya Pentarch POS ({$t->business_name}) iko tayari. Una siku " . (int) PPC_Settings::get( 'trial_days' ) . " za majaribio bila malipo.\n\nFungua kwenye Chrome: {$url}\nBarua pepe: {$t->email}\nNenosiri: {$password}\nNambari ya biashara: {$t->code}\n\nBadilisha nenosiri baada ya kuingia. Msaada: " . PPC_Settings::get( 'phone' ) . ' (WhatsApp).';
		}
		return "Hello {$t->owner_name},\n\nYour Pentarch POS account for {$t->business_name} is ready. You have a free " . (int) PPC_Settings::get( 'trial_days' ) . "-day trial.\n\nOpen in Chrome: {$url}\nEmail: {$t->email}\nPassword: {$password}\nBusiness code: {$t->code}\n\nPlease change the password after signing in. Support: " . PPC_Settings::get( 'phone' ) . ' (WhatsApp).';
	}

	public static function agent_start_trial( WP_REST_Request $r ) {
		global $wpdb;
		$a = self::$agent[0];
		if ( $e = self::limited( 'agent_trial', (string) $a->id, 30, DAY_IN_SECONDS ) ) { // phpcs:ignore
			return $e;
		}
		$p = self::json( $r );
		$generated = false;
		if ( empty( $p['password'] ) ) {
			$p['password'] = PPC_Util::friendly_password();
			$generated     = true;
		}
		$p['source'] = 'agent';
		$d           = PPC_Tenants::validate_registration( $p );
		if ( is_wp_error( $d ) ) {
			return $d;
		}
		$lead_id = isset( $p['lead_id'] ) && PPC_Util::valid_id( $p['lead_id'] ) ? $p['lead_id'] : null;
		$t       = PPC_Tenants::create( $d, (int) $a->id, $lead_id );
		if ( is_wp_error( $t ) ) {
			return $t;
		}
		if ( $lead_id ) {
			$cur_stage = $wpdb->get_var( $wpdb->prepare( 'SELECT stage FROM ' . PPC_Util::t( 'leads' ) . ' WHERE agent_id = %d AND lead_id = %s', $a->id, $lead_id ) );
			PPC_Agents::touch_lead(
				$a->id,
				$lead_id,
				array(
					'stage'     => 'won' === $cur_stage ? 'won' : 'trial',
					'tenant_id' => $t->id,
				)
			);
			$wpdb->query(
				$wpdb->prepare(
					'INSERT IGNORE INTO ' . PPC_Util::t( 'lead_activities' ) . ' (agent_id, activity_id, lead_id, type, note, at, data, created_at) VALUES (%d, %s, %s, %s, %s, %d, %s, %s)',
					$a->id,
					PPC_Util::ulid(),
					$lead_id,
					'trial',
					'Started ' . (int) PPC_Settings::get( 'trial_days' ) . '-day trial (' . $t->code . ')',
					PPC_Util::now_ms(),
					'{}',
					PPC_Util::now()
				)
			);
			PPC_Agents::touch_lead( $a->id, $lead_id );
		}
		$lang = isset( $p['lang'] ) && 'sw' === $p['lang'] ? 'sw' : $a->lang;
		$msg  = self::trial_message( $t, $d['password'], $lang );
		return new WP_REST_Response(
			array(
				'tenant_id'          => $t->id,
				'business_code'      => $t->code,
				'licence'            => PPC_Licence::payload( $t ),
				'login'              => array(
					'url'                => PPC_Settings::pos_url(),
					'email'              => $t->email,
					'password'           => $d['password'],
					'password_generated' => $generated,
				),
				'whatsapp_message'   => $msg,
				'whatsapp_url'       => PPC_Util::wa_link( $t->phone, $msg ),
			),
			201
		);
	}

	public static function agent_trials( WP_REST_Request $r ) {
		global $wpdb;
		$a    = self::$agent[0];
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'tenants' ) . ' WHERE agent_id = %d ORDER BY created_at DESC LIMIT 500', $a->id ) );
		$out  = array();
		foreach ( $rows as $t ) {
			$c     = PPC_Licence::compute( $t );
			$out[] = array(
				'tenant_id'     => $t->id,
				'business_code' => $t->code,
				'business_name' => $t->business_name,
				'owner_name'    => $t->owner_name,
				'phone'         => $t->phone,
				'town'          => $t->town,
				'plan'          => $t->plan,
				'status'        => $c['status'],
				'days_left'     => $c['days_left'],
				'trial_ends'    => PPC_Util::iso( $t->trial_ends ),
				'paid_until'    => PPC_Util::iso( $t->paid_until ),
				'last_sync_at'  => PPC_Util::iso( $t->last_sync_at ),
				'created_at'    => PPC_Util::iso( $t->created_at ),
				'lead_id'       => $t->lead_id,
			);
		}
		return array( 'items' => $out );
	}

	public static function agent_demo_booking( WP_REST_Request $r ) {
		global $wpdb;
		$a       = self::$agent[0];
		$p       = self::json( $r );
		$lead_id = isset( $p['lead_id'] ) && PPC_Util::valid_id( $p['lead_id'] ) ? $p['lead_id'] : null;
		if ( $lead_id ) {
			$row = $wpdb->get_row( $wpdb->prepare( 'SELECT data FROM ' . PPC_Util::t( 'leads' ) . ' WHERE agent_id = %d AND lead_id = %s', $a->id, $lead_id ) );
			$ld  = $row ? json_decode( $row->data, true ) : array();
			if ( is_array( $ld ) ) {
				$defaults = array(
					'name'          => isset( $ld['contact_name'] ) ? $ld['contact_name'] : '',
					'business'      => isset( $ld['business_name'] ) ? $ld['business_name'] : '',
					'business_type' => isset( $ld['business_type'] ) ? $ld['business_type'] : '',
					'phone'         => isset( $ld['phone'] ) ? $ld['phone'] : '',
					'email'         => isset( $ld['email'] ) ? $ld['email'] : '',
					'town'          => isset( $ld['town'] ) ? $ld['town'] : '',
				);
				foreach ( $defaults as $k => $v ) {
					if ( empty( $p[ $k ] ) ) {
						$p[ $k ] = $v;
					}
				}
			}
		}
		$p['source_page'] = home_url( '/pos/agents/' );
		$b                = self::create_booking( $p, $a, $lead_id );
		if ( is_wp_error( $b ) ) {
			return $b;
		}
		if ( $lead_id ) {
			PPC_Agents::touch_lead(
				$a->id,
				$lead_id,
				array(
					'stage'          => 'demo_booked',
					'next_follow_up' => $b->preferred_date,
				)
			);
		}
		return new WP_REST_Response(
			array(
				'ok'  => true,
				'ref' => $b->ref,
			),
			201
		);
	}

	public static function agent_commissions( WP_REST_Request $r ) {
		global $wpdb;
		$a    = self::$agent[0];
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT c.*, t.business_name, t.code AS business_code FROM ' . PPC_Util::t( 'commissions' ) . ' c LEFT JOIN ' . PPC_Util::t( 'tenants' ) . ' t ON t.id = c.tenant_id WHERE c.agent_id = %d ORDER BY c.created_at DESC LIMIT 500', $a->id ) );
		$tot  = array(
			'pending'  => 0,
			'approved' => 0,
			'paid'     => 0,
		);
		$out  = array();
		foreach ( $rows as $c ) {
			if ( isset( $tot[ $c->status ] ) ) {
				$tot[ $c->status ] += (int) $c->amount;
			}
			$out[] = array(
				'id'            => (int) $c->id,
				'business_name' => $c->business_name,
				'business_code' => $c->business_code,
				'kind'          => $c->kind,
				'base_amount'   => (int) $c->base_amount,
				'rate'          => (float) $c->rate,
				'amount'        => (int) $c->amount,
				'status'        => $c->status,
				'mpesa_ref'     => $c->mpesa_ref,
				'note'          => $c->note,
				'created_at'    => PPC_Util::iso( $c->created_at ),
				'paid_at'       => PPC_Util::iso( $c->paid_at ),
			);
		}
		$tot['earned'] = $tot['pending'] + $tot['approved'] + $tot['paid'];
		return array(
			'items'    => $out,
			'totals'   => $tot,
			'currency' => 'KES',
			'unit'     => 'cents',
		);
	}

	public static function agent_leaderboard( WP_REST_Request $r ) {
		global $wpdb;
		$me    = self::$agent[0];
		$month = gmdate( 'Y-m-01 00:00:00' );
		$ag    = PPC_Util::t( 'agents' );
		$tn    = PPC_Util::t( 'tenants' );
		$ld    = PPC_Util::t( 'leads' );
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT a.id, a.name,
				(SELECT COUNT(*) FROM $tn t WHERE t.agent_id = a.id AND t.first_paid_at >= %s) AS won,
				(SELECT COUNT(*) FROM $tn t2 WHERE t2.agent_id = a.id AND t2.created_at >= %s) AS trials,
				(SELECT COUNT(*) FROM $ld l WHERE l.agent_id = a.id AND l.created_at >= %s AND l.deleted = 0) AS leads
				FROM $ag a WHERE a.status = 'active'",
				$month,
				$month,
				$month
			)
		);
		$items = array();
		foreach ( $rows as $x ) {
			$score   = (int) $x->won * 10 + (int) $x->trials * 3 + (int) $x->leads;
			$items[] = array(
				'name'   => PPC_Util::first_name( $x->name ),
				'won'    => (int) $x->won,
				'trials' => (int) $x->trials,
				'leads'  => (int) $x->leads,
				'score'  => $score,
				'is_me'  => (int) $x->id === (int) $me->id,
			);
		}
		usort(
			$items,
			function ( $a, $b ) {
				return $b['score'] - $a['score'] ? $b['score'] - $a['score'] : strcmp( $a['name'], $b['name'] );
			}
		);
		$out  = array();
		$mine = null;
		foreach ( $items as $i => $it ) {
			$it['rank'] = $i + 1;
			if ( $i < 10 ) {
				$out[] = $it;
			}
			if ( $it['is_me'] ) {
				$mine = $it;
			}
		}
		return array(
			'period' => gmdate( 'Y-m' ),
			'items'  => $out,
			'me'     => $mine,
			'scoring' => 'won ×10 + trials ×3 + new leads ×1 (this month)',
		);
	}

	public static function agent_resources( WP_REST_Request $r ) {
		return array(
			'items'     => PPC_Settings::resources(),
			'prices'    => PPC_Settings::prices(),
			'trial_days' => (int) PPC_Settings::get( 'trial_days' ),
			'terms_url' => (string) PPC_Settings::get( 'agent_terms_url' ),
			'contact'   => array(
				'whatsapp' => (string) PPC_Settings::get( 'whatsapp' ),
				'phone'    => (string) PPC_Settings::get( 'phone' ),
				'email'    => (string) PPC_Settings::get( 'email' ),
			),
			'commission' => PPC_Agents::rates( self::$agent[0] ),
		);
	}
}
