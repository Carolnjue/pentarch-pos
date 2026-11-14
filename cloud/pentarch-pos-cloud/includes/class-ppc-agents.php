<?php
/**
 * Sales agents, their tokens and leads.
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Agents {

	const STAGES = array( 'new', 'contacted', 'demo_booked', 'demo_done', 'trial', 'won', 'lost' );

	public static function stage_labels() {
		return array(
			'new'         => 'New',
			'contacted'   => 'Contacted',
			'demo_booked' => 'Demo booked',
			'demo_done'   => 'Demo done',
			'trial'       => 'On trial',
			'won'         => 'Won',
			'lost'        => 'Lost',
		);
	}

	public static function get( $id ) {
		global $wpdb;
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'agents' ) . ' WHERE id = %d', $id ) );
	}

	public static function get_by_code( $code ) {
		global $wpdb;
		$code = strtoupper( trim( (string) $code ) );
		if ( '' === $code ) {
			return null;
		}
		return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'agents' ) . ' WHERE code = %s', $code ) );
	}

	public static function get_by_login( $login ) {
		global $wpdb;
		$login = trim( (string) $login );
		if ( is_email( $login ) ) {
			return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'agents' ) . ' WHERE email = %s', strtolower( $login ) ) );
		}
		$phone = PPC_Util::phone( $login );
		if ( $phone ) {
			return $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'agents' ) . ' WHERE phone = %s ORDER BY id ASC LIMIT 1', $phone ) );
		}
		return null;
	}

	/** Unique agent code AG-XXXX (no ambiguous characters). */
	public static function new_code() {
		global $wpdb;
		for ( $i = 0; $i < 60; $i++ ) {
			$code = 'AG-' . PPC_Util::rand_code( $i < 40 ? 4 : 5, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' );
			if ( ! $wpdb->get_var( $wpdb->prepare( 'SELECT 1 FROM ' . PPC_Util::t( 'agents' ) . ' WHERE code = %s', $code ) ) ) {
				return $code;
			}
		}
		return 'AG-' . strtoupper( substr( md5( uniqid( '', true ) ), 0, 6 ) );
	}

	public static function create( $in ) {
		global $wpdb;
		$d = array(
			'name'       => PPC_Util::text( isset( $in['name'] ) ? $in['name'] : ( isset( $in['full_name'] ) ? $in['full_name'] : '' ), 190 ),
			'phone'      => PPC_Util::phone( isset( $in['phone'] ) ? $in['phone'] : '' ),
			'email'      => strtolower( sanitize_email( isset( $in['email'] ) ? $in['email'] : '' ) ),
			'password'   => isset( $in['password'] ) && is_string( $in['password'] ) ? $in['password'] : '',
			'town'       => PPC_Util::text( isset( $in['town'] ) ? $in['town'] : '', 100 ),
			'county'     => PPC_Util::text( isset( $in['county'] ) ? $in['county'] : '', 100 ),
			'heard_from' => PPC_Util::text( isset( $in['heard_from'] ) ? $in['heard_from'] : '', 190 ),
			'lang'       => ( isset( $in['lang'] ) && 'sw' === $in['lang'] ) ? 'sw' : 'en',
		);
		$mp     = PPC_Util::phone( isset( $in['mpesa_phone'] ) ? $in['mpesa_phone'] : '' );
		$errors = array();
		if ( strlen( $d['name'] ) < 3 ) {
			$errors['name'] = 'Enter your full name.';
		}
		if ( ! $d['phone'] ) {
			$errors['phone'] = 'Enter a valid Kenyan phone number (M-Pesa).';
		}
		if ( ! is_email( $d['email'] ) ) {
			$errors['email'] = 'Enter a valid email address.';
		}
		if ( strlen( $d['password'] ) < 8 || strlen( $d['password'] ) > 200 ) {
			$errors['password'] = 'Password must be at least 8 characters.';
		}
		if ( empty( $in['agree_terms'] ) ) {
			$errors['agree_terms'] = 'Please accept the agent terms.';
		}
		if ( $errors ) {
			return PPC_Util::err( 'invalid_input', reset( $errors ), 422, array( 'fields' => $errors ) );
		}
		if ( self::get_by_login( $d['email'] ) ) {
			return PPC_Util::err( 'email_exists', 'This email is already registered. Please sign in.', 409, array( 'fields' => array( 'email' => 'Already registered.' ) ) );
		}
		$now = PPC_Util::now();
		$ok  = $wpdb->insert(
			PPC_Util::t( 'agents' ),
			array(
				'code'              => self::new_code(),
				'name'              => $d['name'],
				'phone'             => $d['phone'],
				'mpesa_phone'       => $mp ? $mp : $d['phone'],
				'email'             => $d['email'],
				'password_hash'     => wp_hash_password( $d['password'] ),
				'town'              => $d['town'],
				'county'            => $d['county'],
				'heard_from'        => $d['heard_from'],
				'lang'              => $d['lang'],
				'status'            => 'pending',
				'terms_accepted_at' => $now,
				'created_at'        => $now,
				'updated_at'        => $now,
			)
		);
		if ( ! $ok ) {
			return PPC_Util::err( 'db_error', 'Could not create your account. Please try again.', 500 );
		}
		$a = self::get( $wpdb->insert_id );
		PPC_DB::event( 'agent.signup', sprintf( '%s (%s) signed up as an agent', $a->name, $a->town ? $a->town : 'no town' ), null, $a->id );
		PPC_Notify::agent_signup( $a );
		return $a;
	}

	public static function issue_token( $agent_id, $device_name = '' ) {
		global $wpdb;
		$token = PPC_Util::new_token( 'ppa_' );
		$wpdb->insert(
			PPC_Util::t( 'agent_tokens' ),
			array(
				'agent_id'    => (int) $agent_id,
				'token_hash'  => PPC_Util::hash_token( $token ),
				'device_name' => $device_name,
				'created_at'  => PPC_Util::now(),
				'last_seen'   => PPC_Util::now(),
			)
		);
		return $token;
	}

	/** Resolve agent token -> [agent, token_row] or null. */
	public static function auth_token( $token ) {
		global $wpdb;
		if ( ! is_string( $token ) || 0 !== strpos( $token, 'ppa_' ) ) {
			return null;
		}
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'agent_tokens' ) . ' WHERE token_hash = %s AND revoked_at IS NULL', PPC_Util::hash_token( $token ) ) );
		if ( ! $row ) {
			return null;
		}
		$a = self::get( $row->agent_id );
		if ( ! $a ) {
			return null;
		}
		if ( PPC_Util::ts( $row->last_seen ) < time() - 60 ) {
			$wpdb->update( PPC_Util::t( 'agent_tokens' ), array( 'last_seen' => PPC_Util::now() ), array( 'id' => $row->id ) );
			$wpdb->update( PPC_Util::t( 'agents' ), array( 'last_seen' => PPC_Util::now() ), array( 'id' => $a->id ) );
		}
		return array( $a, $row );
	}

	public static function revoke_all_tokens( $agent_id ) {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( 'UPDATE ' . PPC_Util::t( 'agent_tokens' ) . ' SET revoked_at = %s WHERE agent_id = %d AND revoked_at IS NULL', PPC_Util::now(), $agent_id ) );
	}

	/** Effective commission rates for an agent. */
	public static function rates( $a ) {
		return array(
			'software_rate'        => ( null !== $a->software_rate && '' !== $a->software_rate ) ? (float) $a->software_rate : (float) PPC_Settings::get( 'software_rate', 20 ),
			'bonus_complete_till'  => ( null !== $a->bundle_bonus && '' !== $a->bundle_bonus ) ? (int) $a->bundle_bonus : (int) PPC_Settings::get( 'bonus_complete_till', 3000 ),
			'bonus_software_setup' => (int) PPC_Settings::get( 'bonus_software_setup', 1500 ),
			'bonus_counter_kit'    => (int) PPC_Settings::get( 'bonus_counter_kit', 1000 ),
			'commission_months'    => (int) PPC_Settings::get( 'commission_months', 12 ),
		);
	}

	/** Public agent payload (for the PWA). */
	public static function payload( $a ) {
		$rates = self::rates( $a );
		return array(
			'id'          => (int) $a->id,
			'code'        => $a->code,
			'name'        => $a->name,
			'first_name'  => PPC_Util::first_name( $a->name ),
			'phone'       => $a->phone,
			'mpesa_phone' => $a->mpesa_phone,
			'email'       => $a->email,
			'town'        => $a->town,
			'county'      => $a->county,
			'status'      => $a->status,
			'lang'        => $a->lang,
			'rates'       => $rates,
			'created_at'  => PPC_Util::iso( $a->created_at ),
			'approved_at' => PPC_Util::iso( $a->approved_at ),
			'links'       => array(
				'demo'    => PPC_Settings::pos_url(
					array(
						'demo' => 1,
						'ref'  => $a->code,
					)
				),
				'website' => PPC_Settings::website_url( array( 'ref' => $a->code ) ),
				'trial'   => PPC_Settings::pos_url( array( 'ref' => $a->code ) ),
			),
		);
	}

	public static function set_status( $id, $status ) {
		global $wpdb;
		$a = self::get( $id );
		if ( ! $a || ! in_array( $status, array( 'pending', 'active', 'suspended' ), true ) ) {
			return false;
		}
		$fields = array(
			'status'     => $status,
			'updated_at' => PPC_Util::now(),
		);
		if ( 'active' === $status && ! $a->approved_at ) {
			$fields['approved_at'] = PPC_Util::now();
		}
		$wpdb->update( PPC_Util::t( 'agents' ), $fields, array( 'id' => $a->id ) );
		if ( 'suspended' === $status ) {
			self::revoke_all_tokens( $a->id );
		}
		if ( 'active' === $status && 'active' !== $a->status ) {
			PPC_DB::event( 'agent.approved', $a->name . ' was approved (' . $a->code . ')', null, $a->id );
			PPC_Notify::agent_approved( self::get( $a->id ) );
		}
		return true;
	}

	/** Re-sequence a lead row (delete + insert keeps auto-increment seq monotonic). */
	public static function touch_lead( $agent_id, $lead_id, $changes = array() ) {
		global $wpdb;
		$t   = PPC_Util::t( 'leads' );
		$row = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $t WHERE agent_id = %d AND lead_id = %s", $agent_id, $lead_id ), ARRAY_A );
		if ( ! $row ) {
			return false;
		}
		$data = json_decode( $row['data'], true );
		if ( ! is_array( $data ) ) {
			$data = array();
		}
		if ( $changes ) {
			$data              = array_merge( $data, $changes );
			$data['updated_at'] = PPC_Util::now_ms();
			$row['updated_at'] = $data['updated_at'];
			foreach ( array( 'stage', 'tenant_id' ) as $k ) {
				if ( isset( $changes[ $k ] ) ) {
					$row[ $k ] = $changes[ $k ];
				}
			}
		}
		$row['data']        = wp_json_encode( $data );
		$row['received_at'] = PPC_Util::now();
		unset( $row['server_seq'] );
		$wpdb->query( 'START TRANSACTION' );
		$wpdb->delete(
			$t,
			array(
				'agent_id' => $agent_id,
				'lead_id'  => $lead_id,
			)
		);
		$wpdb->insert( $t, $row );
		$wpdb->query( 'COMMIT' );
		return true;
	}

	/** Activities for a set of leads, grouped by lead id. */
	public static function activities_for( $agent_id, $lead_ids ) {
		global $wpdb;
		if ( ! $lead_ids ) {
			return array();
		}
		$ph   = implode( ',', array_fill( 0, count( $lead_ids ), '%s' ) );
		$args = array_merge( array( (int) $agent_id ), array_values( $lead_ids ) );
		$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT activity_id, lead_id, type, note, at, data FROM ' . PPC_Util::t( 'lead_activities' ) . " WHERE agent_id = %d AND lead_id IN ($ph) ORDER BY at ASC", $args ) );
		$out  = array();
		foreach ( $rows as $r ) {
			$extra = json_decode( (string) $r->data, true );
			$item  = array_merge(
				is_array( $extra ) ? $extra : array(),
				array(
					'id'      => $r->activity_id,
					'lead_id' => $r->lead_id,
					'type'    => $r->type,
					'note'    => (string) $r->note,
					'at'      => (int) $r->at,
				)
			);
			$out[ $r->lead_id ][] = $item;
		}
		return $out;
	}

	/** Dashboard stats for one agent. */
	public static function stats( $agent_id ) {
		global $wpdb;
		$l        = PPC_Util::t( 'leads' );
		$c        = PPC_Util::t( 'commissions' );
		$tn       = PPC_Util::t( 'tenants' );
		$by_stage = $wpdb->get_results( $wpdb->prepare( "SELECT stage, COUNT(*) AS n FROM $l WHERE agent_id = %d AND deleted = 0 GROUP BY stage", $agent_id ), OBJECT_K );
		$com      = $wpdb->get_results( $wpdb->prepare( "SELECT status, SUM(amount) AS s FROM $c WHERE agent_id = %d GROUP BY status", $agent_id ), OBJECT_K );
		$month    = gmdate( 'Y-m-01 00:00:00' );
		$won_m    = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $tn WHERE agent_id = %d AND first_paid_at >= %s", $agent_id, $month ) );
		$stages   = array();
		foreach ( self::STAGES as $s ) {
			$stages[ $s ] = isset( $by_stage[ $s ] ) ? (int) $by_stage[ $s ]->n : 0;
		}
		$get = function ( $k ) use ( $com ) {
			return isset( $com[ $k ] ) ? (int) $com[ $k ]->s : 0;
		};
		return array(
			'leads_by_stage'  => $stages,
			'won_this_month'  => $won_m,
			'commission'      => array(
				'pending'  => $get( 'pending' ),
				'approved' => $get( 'approved' ),
				'paid'     => $get( 'paid' ),
				'earned'   => $get( 'pending' ) + $get( 'approved' ) + $get( 'paid' ),
			),
		);
	}
}
