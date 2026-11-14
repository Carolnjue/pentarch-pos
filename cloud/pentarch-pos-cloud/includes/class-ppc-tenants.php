<?php
/**
 * Tenants (businesses) and their devices.
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Tenants {

	/** Business types (SPEC §8 presets). */
	public static function business_types() {
		return array(
			'duka'        => 'General shop / duka',
			'minimart'    => 'Minimart & supermarket',
			'hardware'    => 'Hardware & building materials',
			'agrovet'     => 'Agrovet',
			'pharmacy'    => 'Pharmacy / chemist',
			'boutique'    => 'Boutique, fashion & shoes',
			'electronics' => 'Electronics & phone shop',
			'cosmetics'   => 'Cosmetics & beauty shop',
			'butchery'    => 'Butchery',
			'bakery'      => 'Bakery & cake shop',
			'restaurant'  => 'Restaurant, café & hotel',
			'bar'         => 'Bar & liquor store',
			'salon'       => 'Salon, barber & spa',
			'stationery'  => 'Stationery, bookshop & cyber',
			'wholesale'   => 'Wholesale & distribution',
			'autospares'  => 'Auto spares',
			'gas_water'   => 'LPG gas & water refill',
			'other'       => 'Other / services',
		);
	}

	public static function type_label( $k ) {
		$t = self::business_types();
		return isset( $t[ $k ] ) ? $t[ $k ] : ( $k ? ucwords( str_replace( '_', ' ', $k ) ) : '—' );
	}

	public static function get( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'tenants' ) . ' WHERE id = %s', $id ) );
	}

	public static function get_by_email( $email ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'tenants' ) . ' WHERE email = %s', strtolower( trim( $email ) ) ) );
	}

	public static function get_by_code( $code ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'tenants' ) . ' WHERE code = %s', strtoupper( trim( $code ) ) ) );
	}

	/** Unique business code: PP + 5 digits. */
	public static function new_code() {
		global $wpdb;
		$table = PPC_Util::t( 'tenants' );
		for ( $i = 0; $i < 50; $i++ ) {
			$code = 'PP' . random_int( 10000, 99999 );
			if ( ! $wpdb->get_var( $wpdb->prepare( "SELECT 1 FROM $table WHERE code = %s", $code ) ) ) {
				return $code;
			}
		}
		return 'PP' . substr( (string) time(), -5 );
	}

	/**
	 * Validate registration input. Returns sanitised array or WP_Error.
	 *
	 * @param array $in Raw params.
	 * @param bool  $require_password Whether password is required.
	 */
	public static function validate_registration( $in, $require_password = true ) {
		$d = array(
			'business_name' => PPC_Util::text( isset( $in['business_name'] ) ? $in['business_name'] : '', 190 ),
			'business_type' => sanitize_key( isset( $in['business_type'] ) ? $in['business_type'] : 'duka' ),
			'owner_name'    => PPC_Util::text( isset( $in['owner_name'] ) ? $in['owner_name'] : '', 190 ),
			'phone'         => PPC_Util::phone( isset( $in['phone'] ) ? $in['phone'] : '' ),
			'email'         => strtolower( sanitize_email( isset( $in['email'] ) ? $in['email'] : '' ) ),
			'password'      => isset( $in['password'] ) && is_string( $in['password'] ) ? $in['password'] : '',
			'town'          => PPC_Util::text( isset( $in['town'] ) ? $in['town'] : '', 100 ),
			'county'        => PPC_Util::text( isset( $in['county'] ) ? $in['county'] : '', 100 ),
			'agent_code'    => strtoupper( PPC_Util::text( isset( $in['agent_code'] ) ? $in['agent_code'] : '', 12 ) ),
			'device_name'   => PPC_Util::text( isset( $in['device_name'] ) ? $in['device_name'] : '', 100 ),
			'source'        => in_array( isset( $in['source'] ) ? $in['source'] : '', array( 'app', 'agent', 'web' ), true ) ? $in['source'] : 'app',
		);
		$errors = array();
		if ( strlen( $d['business_name'] ) < 2 ) {
			$errors['business_name'] = 'Enter the business name.';
		}
		if ( strlen( $d['owner_name'] ) < 2 ) {
			$errors['owner_name'] = 'Enter the owner\'s name.';
		}
		if ( '' === $d['phone'] ) {
			$errors['phone'] = 'Enter a valid Kenyan phone number, e.g. 0712 345 678.';
		}
		if ( ! is_email( $d['email'] ) ) {
			$errors['email'] = 'Enter a valid email address.';
		}
		if ( $require_password && ( strlen( $d['password'] ) < 6 || strlen( $d['password'] ) > 200 ) ) {
			$errors['password'] = 'Password must be at least 6 characters.';
		}
		if ( ! $d['business_type'] ) {
			$d['business_type'] = 'duka';
		}
		if ( $errors ) {
			return PPC_Util::err( 'invalid_input', reset( $errors ), 422, array( 'fields' => $errors ) );
		}
		return $d;
	}

	/**
	 * Create tenant with trial. Returns tenant row or WP_Error.
	 *
	 * @param array    $d        Validated data.
	 * @param int|null $agent_id Attributed agent.
	 */
	public static function create( $d, $agent_id = null, $lead_id = null ) {
		global $wpdb;
		if ( self::get_by_email( $d['email'] ) ) {
			return PPC_Util::err( 'email_exists', 'An account with this email already exists. Please sign in instead.', 409, array( 'fields' => array( 'email' => 'Email already registered.' ) ) );
		}
		if ( ! $agent_id && ! empty( $d['agent_code'] ) ) {
			$agent = PPC_Agents::get_by_code( $d['agent_code'] );
			if ( $agent && 'active' === $agent->status ) {
				$agent_id = (int) $agent->id;
			}
		}
		$now     = time();
		$trial   = (int) PPC_Settings::get( 'trial_days', 30 );
		$id      = PPC_Util::ulid();
		$row     = array(
			'id'            => $id,
			'code'          => self::new_code(),
			'business_name' => $d['business_name'],
			'business_type' => $d['business_type'],
			'owner_name'    => $d['owner_name'],
			'phone'         => $d['phone'],
			'email'         => $d['email'],
			'password_hash' => wp_hash_password( $d['password'] ),
			'town'          => $d['town'],
			'county'        => $d['county'],
			'source'        => $d['source'],
			'agent_id'      => $agent_id ? (int) $agent_id : null,
			'lead_id'       => $lead_id,
			'plan'          => 'trial',
			'trial_ends'    => PPC_Util::dt( $now + $trial * DAY_IN_SECONDS ),
			'max_branches'  => (int) PPC_Settings::get( 'default_max_branches', 1 ),
			'max_devices'   => (int) PPC_Settings::get( 'default_max_devices', 3 ),
			'last_ip'       => PPC_Util::ip(),
			'created_at'    => PPC_Util::dt( $now ),
			'updated_at'    => PPC_Util::dt( $now ),
		);
		$ok = $wpdb->insert( PPC_Util::t( 'tenants' ), $row );
		if ( ! $ok ) {
			// Unique race on email/code.
			if ( self::get_by_email( $d['email'] ) ) {
				return PPC_Util::err( 'email_exists', 'An account with this email already exists. Please sign in instead.', 409 );
			}
			return PPC_Util::err( 'db_error', 'Could not create the account. Please try again.', 500 );
		}
		$t = self::get( $id );
		if ( 'app' !== $d['source'] ) {
			self::seed_business_record( $t );
		}
		PPC_DB::event( 'tenant.signup', sprintf( '%s (%s) started a trial via %s', $t->business_name, $t->town ? $t->town : 'no town', $t->source ), $t->id, $agent_id );
		PPC_Notify::tenant_signup( $t );
		return $t;
	}

	/**
	 * For trials started by agents or the website, seed a minimal `business` record
	 * (updated_at = 1 so any edit made in the app wins under LWW).
	 */
	public static function seed_business_record( $t ) {
		global $wpdb;
		$data = array(
			'id'         => $t->id,
			'name'       => $t->business_name,
			'type'       => $t->business_type,
			'phone'      => $t->phone,
			'email'      => $t->email,
			'town'       => $t->town,
			'county'     => $t->county,
			'currency'   => 'KES',
			'created_at' => PPC_Util::ts( $t->created_at ) * 1000,
			'updated_at' => 1,
		);
		$wpdb->query(
			$wpdb->prepare(
				'INSERT INTO ' . PPC_Util::t( 'records' ) . ' (tenant_id, entity, record_id, branch_id, data, updated_at, deleted, device_id, received_at) VALUES (%s, %s, %s, NULL, %s, %d, 0, %s, %s)',
				$t->id,
				'business',
				$t->id,
				wp_json_encode( $data ),
				1,
				'server',
				PPC_Util::now()
			)
		);
	}

	/** Issue a device token. Returns [device_uid, token]. */
	public static function issue_device( $tenant_id, $device_name ) {
		global $wpdb;
		$uid   = PPC_Util::ulid();
		$token = PPC_Util::new_token( 'ppd_' );
		$ua    = isset( $_SERVER['HTTP_USER_AGENT'] ) ? substr( sanitize_text_field( wp_unslash( $_SERVER['HTTP_USER_AGENT'] ) ), 0, 255 ) : '';
		$wpdb->insert(
			PPC_Util::t( 'devices' ),
			array(
				'tenant_id'  => $tenant_id,
				'device_uid' => $uid,
				'name'       => $device_name ? $device_name : 'Device',
				'token_hash' => PPC_Util::hash_token( $token ),
				'user_agent' => $ua,
				'last_ip'    => PPC_Util::ip(),
				'created_at' => PPC_Util::now(),
				'last_seen'  => PPC_Util::now(),
			)
		);
		return array( $uid, $token );
	}

	/** Count active (non-revoked) devices seen in the last 60 days. */
	public static function active_device_count( $tenant_id ) {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . PPC_Util::t( 'devices' ) . ' WHERE tenant_id = %s AND revoked_at IS NULL AND last_seen > %s', $tenant_id, PPC_Util::dt( time() - 60 * DAY_IN_SECONDS ) ) );
	}

	/** Resolve a bearer token to [tenant, device] or null. */
	public static function auth_token( $token ) {
		global $wpdb;
		if ( ! is_string( $token ) || 0 !== strpos( $token, 'ppd_' ) ) {
			return null;
		}
		$dev = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'devices' ) . ' WHERE token_hash = %s AND revoked_at IS NULL', PPC_Util::hash_token( $token ) ) );
		if ( ! $dev ) {
			return null;
		}
		$t = self::get( $dev->tenant_id );
		if ( ! $t ) {
			return null;
		}
		// Throttle last-seen writes to once a minute.
		if ( PPC_Util::ts( $dev->last_seen ) < time() - 60 ) {
			$wpdb->update(
				PPC_Util::t( 'devices' ),
				array(
					'last_seen' => PPC_Util::now(),
					'last_ip'   => PPC_Util::ip(),
				),
				array( 'id' => $dev->id )
			);
		}
		return array( $t, $dev );
	}

	public static function revoke_device( $device_row_id, $tenant_id = null ) {
		global $wpdb;
		$where = array( 'id' => (int) $device_row_id );
		if ( $tenant_id ) {
			$where['tenant_id'] = $tenant_id;
		}
		return $wpdb->update( PPC_Util::t( 'devices' ), array( 'revoked_at' => PPC_Util::now() ), $where );
	}

	public static function devices( $tenant_id ) {
		global $wpdb;
		return $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'devices' ) . ' WHERE tenant_id = %s ORDER BY revoked_at IS NULL DESC, last_seen DESC', $tenant_id ) );
	}

	public static function update( $id, $fields ) {
		global $wpdb;
		$fields['updated_at'] = PPC_Util::now();
		return $wpdb->update( PPC_Util::t( 'tenants' ), $fields, array( 'id' => $id ) );
	}

	/** Lightweight usage summary for the admin detail page. */
	public static function usage( $tenant_id ) {
		global $wpdb;
		$r      = PPC_Util::t( 'records' );
		$counts = $wpdb->get_results( $wpdb->prepare( "SELECT entity, COUNT(*) AS n FROM $r WHERE tenant_id = %s AND deleted = 0 GROUP BY entity", $tenant_id ), OBJECT_K );
		$since  = ( time() - 30 * DAY_IN_SECONDS ) * 1000;
		$rows   = $wpdb->get_col( $wpdb->prepare( "SELECT data FROM $r WHERE tenant_id = %s AND entity = 'sales' AND updated_at >= %d ORDER BY server_seq DESC LIMIT 5000", $tenant_id, $since ) );
		$total  = 0;
		$n      = 0;
		foreach ( $rows as $json ) {
			$s = json_decode( $json, true );
			if ( ! is_array( $s ) || ( isset( $s['status'] ) && 'void' === $s['status'] ) ) {
				continue;
			}
			$total += isset( $s['total'] ) ? (int) $s['total'] : 0;
			$n++;
		}
		$branches = array();
		foreach ( $wpdb->get_col( $wpdb->prepare( "SELECT data FROM $r WHERE tenant_id = %s AND entity = 'branches' AND deleted = 0 LIMIT 100", $tenant_id ) ) as $json ) {
			$b = json_decode( $json, true );
			if ( is_array( $b ) ) {
				$branches[] = $b;
			}
		}
		return array(
			'counts'      => array_map( 'intval', wp_list_pluck( $counts, 'n' ) ),
			'sales_30d_n' => $n,
			'sales_30d'   => $total,
			'branches'    => $branches,
			'records'     => (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $r WHERE tenant_id = %s", $tenant_id ) ),
		);
	}
}
