<?php
/**
 * Payments and agent commissions.
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Payments {

	/**
	 * What a payment can be for.
	 * months   = licence months added per unit,
	 * price    = settings key for the default unit price,
	 * software = counts as a software payment for the % commission,
	 * bonus    = settings key for the flat agent bonus per unit,
	 * plan     = plan to set on the tenant (null = unchanged).
	 */
	public static function types() {
		return array(
			'subscription_monthly'   => array(
				'label'    => 'Software subscription — monthly',
				'months'   => 1,
				'price'    => 'software_monthly',
				'software' => true,
				'bonus'    => null,
				'plan'     => 'monthly',
				'unit'     => 'month',
			),
			'subscription_yearly'    => array(
				'label'    => 'Software subscription — yearly',
				'months'   => 12,
				'price'    => 'software_yearly',
				'software' => true,
				'bonus'    => null,
				'plan'     => 'yearly',
				'unit'     => 'year',
			),
			'extra_branch_monthly'   => array(
				'label'    => 'Extra branch — monthly',
				'months'   => 0,
				'price'    => 'extra_branch_monthly',
				'software' => true,
				'bonus'    => null,
				'plan'     => null,
				'unit'     => 'branch-month',
			),
			'extra_branch_yearly'    => array(
				'label'    => 'Extra branch — yearly',
				'months'   => 0,
				'price'    => 'extra_branch_yearly',
				'software' => true,
				'bonus'    => null,
				'plan'     => null,
				'unit'     => 'branch-year',
			),
			'package_complete_till'  => array(
				'label'    => 'Package — Complete Till (incl. 12 months software)',
				'months'   => 12,
				'price'    => 'package_complete_till',
				'software' => false,
				'bonus'    => 'bonus_complete_till',
				'plan'     => 'complete_till',
				'unit'     => 'package',
			),
			'package_software_setup' => array(
				'label'    => 'Package — Software + Setup (incl. 12 months software)',
				'months'   => 12,
				'price'    => 'package_software_setup',
				'software' => false,
				'bonus'    => 'bonus_software_setup',
				'plan'     => 'software_setup',
				'unit'     => 'package',
			),
			'setup_only'             => array(
				'label'    => 'Setup fee only (with monthly billing)',
				'months'   => 0,
				'price'    => 'setup_only_fee',
				'software' => false,
				'bonus'    => null,
				'plan'     => null,
				'unit'     => 'setup',
			),
			'counter_kit'            => array(
				'label'    => 'Counter Kit (hardware add-on)',
				'months'   => 0,
				'price'    => 'counter_kit',
				'software' => false,
				'bonus'    => 'bonus_counter_kit',
				'plan'     => null,
				'unit'     => 'kit',
			),
			'extra_till'             => array(
				'label'    => 'Extra till (second complete till, same branch)',
				'months'   => 0,
				'price'    => 'extra_till',
				'software' => false,
				'bonus'    => null,
				'plan'     => null,
				'unit'     => 'till',
			),
			'other'                  => array(
				'label'    => 'Other',
				'months'   => 0,
				'price'    => null,
				'software' => false,
				'bonus'    => null,
				'plan'     => null,
				'unit'     => 'item',
			),
		);
	}

	/** Types with current unit prices (for the admin form). */
	public static function types_with_prices() {
		$out = array();
		foreach ( self::types() as $k => $d ) {
			$out[ $k ] = array(
				'label'  => $d['label'],
				'price'  => $d['price'] ? (int) PPC_Settings::get( $d['price'] ) : 0,
				'months' => $d['months'],
				'unit'   => $d['unit'],
			);
		}
		return $out;
	}

	public static function type_label( $k ) {
		$t = self::types();
		return isset( $t[ $k ] ) ? $t[ $k ]['label'] : ucwords( str_replace( '_', ' ', (string) $k ) );
	}

	public static function methods() {
		return array(
			'mpesa' => 'M-Pesa',
			'bank'  => 'Bank transfer',
			'cash'  => 'Cash',
			'card'  => 'Card',
			'other' => 'Other',
		);
	}

	/**
	 * Record a payment. Extends paid_until, sets plan, creates commissions.
	 *
	 * @param string $tenant_id Tenant.
	 * @param array  $in        type, qty, amount (KES), months (override), method, ref, paid_at (Y-m-d), note, add_branches.
	 * @param string $source    admin|mpesa.
	 * @return array|WP_Error   ['payment_id'=>, 'commissions'=>[]]
	 */
	public static function record( $tenant_id, $in, $source = 'admin' ) {
		global $wpdb;
		$t = PPC_Tenants::get( $tenant_id );
		if ( ! $t ) {
			return PPC_Util::err( 'not_found', 'Business not found.', 404 );
		}
		$types = self::types();
		$type  = isset( $in['type'] ) && isset( $types[ $in['type'] ] ) ? $in['type'] : 'other';
		$def   = $types[ $type ];
		$qty   = max( 1, min( 100, (int) ( isset( $in['qty'] ) ? $in['qty'] : 1 ) ) );
		$price = $def['price'] ? (int) PPC_Settings::get( $def['price'] ) : 0;

		$amount_kes = isset( $in['amount'] ) && '' !== $in['amount'] ? (float) str_replace( ',', '', (string) $in['amount'] ) : $price * $qty;
		$amount     = (int) round( $amount_kes * 100 );
		if ( $amount <= 0 ) {
			return PPC_Util::err( 'invalid_amount', 'Enter the amount paid.', 422 );
		}
		$months = isset( $in['months'] ) && '' !== $in['months'] ? max( 0, min( 120, (int) $in['months'] ) ) : $def['months'] * $qty;
		$method = isset( $in['method'] ) && array_key_exists( $in['method'], self::methods() ) ? $in['method'] : 'mpesa';
		$ref    = strtoupper( PPC_Util::text( isset( $in['ref'] ) ? $in['ref'] : '', 100 ) );
		$note   = PPC_Util::text( isset( $in['note'] ) ? $in['note'] : '', 255 );

		$paid_ts = time();
		if ( ! empty( $in['paid_at'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}$/', $in['paid_at'] ) ) {
			$d       = strtotime( $in['paid_at'] . ' 12:00:00 UTC' );
			$paid_ts = ( $d && $d < time() ) ? $d : time();
		}

		if ( $ref && 'mpesa' === $method ) {
			$dup = $wpdb->get_var( $wpdb->prepare( 'SELECT id FROM ' . PPC_Util::t( 'payments' ) . ' WHERE ref = %s AND tenant_id = %s', $ref, $t->id ) );
			if ( $dup ) {
				return PPC_Util::err( 'duplicate_ref', 'A payment with this M-Pesa reference is already recorded for this business.', 409 );
			}
		}

		// Extend licence from the later of now, current paid_until and trial end.
		$from = null;
		$to   = null;
		if ( $months > 0 ) {
			$base = max( time(), PPC_Util::ts( $t->paid_until ), PPC_Util::ts( $t->trial_ends ) );
			$from = $base;
			$to   = strtotime( '+' . $months . ' months', $base );
		}

		$wpdb->query( 'START TRANSACTION' );
		$wpdb->insert(
			PPC_Util::t( 'payments' ),
			array(
				'tenant_id'   => $t->id,
				'type'        => $type,
				'amount'      => $amount,
				'months'      => $months,
				'bundles'     => $qty,
				'method'      => $method,
				'ref'         => $ref,
				'paid_at'     => PPC_Util::dt( $paid_ts ),
				'period_from' => $from ? PPC_Util::dt( $from ) : null,
				'period_to'   => $to ? PPC_Util::dt( $to ) : null,
				'source'      => $source,
				'recorded_by' => get_current_user_id(),
				'note'        => $note,
				'created_at'  => PPC_Util::now(),
			)
		);
		$pid = (int) $wpdb->insert_id;

		$upd = array();
		if ( $to ) {
			$upd['paid_until'] = PPC_Util::dt( $to );
		}
		if ( $def['plan'] ) {
			$upd['plan'] = $def['plan'];
		}
		$includes_software = $def['software'] || $months > 0;
		if ( $includes_software && ! $t->first_paid_at ) {
			$upd['first_paid_at']  = PPC_Util::dt( $paid_ts );
			$t->first_paid_at      = $upd['first_paid_at'];
		}
		if ( ! empty( $in['add_branches'] ) && in_array( $type, array( 'extra_branch_monthly', 'extra_branch_yearly' ), true ) ) {
			$upd['max_branches'] = (int) $t->max_branches + $qty;
		}
		if ( $upd ) {
			PPC_Tenants::update( $t->id, $upd );
		}
		$commissions = self::create_commissions( $t, $pid, $type, $qty, $amount, $paid_ts );
		$wpdb->query( 'COMMIT' );

		// First payment: the agent's lead for this business becomes "won".
		if ( ! empty( $upd['first_paid_at'] ) && $t->agent_id && $t->lead_id ) {
			PPC_Agents::touch_lead( (int) $t->agent_id, $t->lead_id, array( 'stage' => 'won' ) );
		}

		PPC_DB::event( 'payment', sprintf( '%s paid %s (%s)', $t->business_name, PPC_Util::kes( $amount ), self::type_label( $type ) ), $t->id, $t->agent_id );
		return array(
			'payment_id'  => $pid,
			'commissions' => $commissions,
			'paid_until'  => $to ? PPC_Util::dt( $to ) : $t->paid_until,
		);
	}

	/** Create agent commissions for a payment per SPEC §6 + pricing decisions. */
	public static function create_commissions( $t, $payment_id, $type, $qty, $amount, $paid_ts ) {
		global $wpdb;
		if ( empty( $t->agent_id ) ) {
			return array();
		}
		$a = PPC_Agents::get( $t->agent_id );
		if ( ! $a ) {
			return array();
		}
		$rates  = PPC_Agents::rates( $a );
		$def    = self::types()[ $type ];
		$status = PPC_Settings::get( 'auto_approve_commission' ) ? 'approved' : 'pending';
		$out    = array();

		// % of software payments within the first N months (counted from the first paid software period).
		$software_base = 0;
		if ( $def['software'] ) {
			$software_base = $amount;
		} elseif ( in_array( $type, array( 'package_complete_till', 'package_software_setup' ), true ) && PPC_Settings::get( 'package_software_commission' ) ) {
			$software_base = min( $amount, (int) PPC_Settings::get( 'software_yearly' ) * 100 * $qty );
		}
		$first  = PPC_Util::ts( $t->first_paid_at );
		$window = $first ? strtotime( '+' . (int) $rates['commission_months'] . ' months', $first ) : 0;
		if ( $software_base > 0 && $rates['software_rate'] > 0 && ( ! $first || $paid_ts < $window ) ) {
			$c = (int) round( $software_base * $rates['software_rate'] / 100 );
			if ( $c > 0 ) {
				$wpdb->insert(
					PPC_Util::t( 'commissions' ),
					array(
						'agent_id'    => $a->id,
						'tenant_id'   => $t->id,
						'payment_id'  => $payment_id,
						'kind'        => 'software',
						'base_amount' => $software_base,
						'rate'        => $rates['software_rate'],
						'amount'      => $c,
						'status'      => $status,
						'note'        => $rates['software_rate'] . '% of ' . self::type_label( $type ),
						'created_at'  => PPC_Util::now(),
						'approved_at' => 'approved' === $status ? PPC_Util::now() : null,
					)
				);
				$out[] = array(
					'kind'   => 'software',
					'amount' => $c,
				);
			}
		}
		// Flat bonus per package / kit.
		if ( $def['bonus'] ) {
			$bonus = (int) $rates[ $def['bonus'] ] * 100 * $qty;
			if ( $bonus > 0 ) {
				$wpdb->insert(
					PPC_Util::t( 'commissions' ),
					array(
						'agent_id'    => $a->id,
						'tenant_id'   => $t->id,
						'payment_id'  => $payment_id,
						'kind'        => 'bonus',
						'base_amount' => $amount,
						'rate'        => 0,
						'amount'      => $bonus,
						'status'      => $status,
						'note'        => 'Bonus: ' . $qty . ' × ' . self::type_label( $type ),
						'created_at'  => PPC_Util::now(),
						'approved_at' => 'approved' === $status ? PPC_Util::now() : null,
					)
				);
				$out[] = array(
					'kind'   => 'bonus',
					'amount' => $bonus,
				);
			}
		}
		if ( $out ) {
			PPC_DB::event( 'commission', sprintf( 'Commission %s for %s (%s)', PPC_Util::kes( array_sum( wp_list_pluck( $out, 'amount' ) ) ), $a->name, $t->business_name ), $t->id, $a->id );
		}
		return $out;
	}

	public static function set_commission_status( $id, $status, $mpesa_ref = '' ) {
		global $wpdb;
		if ( ! in_array( $status, array( 'pending', 'approved', 'paid', 'cancelled' ), true ) ) {
			return false;
		}
		$f = array( 'status' => $status );
		if ( 'approved' === $status ) {
			$f['approved_at'] = PPC_Util::now();
		}
		if ( 'paid' === $status ) {
			$f['paid_at']   = PPC_Util::now();
			$f['mpesa_ref'] = strtoupper( PPC_Util::text( $mpesa_ref, 60 ) );
		}
		return $wpdb->update( PPC_Util::t( 'commissions' ), $f, array( 'id' => (int) $id ) );
	}

	/** Extend the trial by N days (from the later of now / current trial end). */
	public static function extend_trial( $tenant_id, $days ) {
		$t = PPC_Tenants::get( $tenant_id );
		if ( ! $t ) {
			return false;
		}
		$base = max( time(), PPC_Util::ts( $t->trial_ends ) );
		PPC_Tenants::update( $t->id, array( 'trial_ends' => PPC_Util::dt( $base + max( 1, (int) $days ) * DAY_IN_SECONDS ) ) );
		PPC_DB::event( 'trial.extended', sprintf( '%s trial extended by %d days', $t->business_name, $days ), $t->id );
		return true;
	}

	/** Monthly recurring revenue (cents) approximated from active plans. */
	public static function mrr() {
		global $wpdb;
		$tn   = PPC_Util::t( 'tenants' );
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT plan, COUNT(*) AS n FROM $tn WHERE paid_until > %s AND suspended = 0 AND is_test = 0 GROUP BY plan", PPC_Util::now() ) );
		$m    = (int) PPC_Settings::get( 'software_monthly' ) * 100;
		$y    = (int) PPC_Settings::get( 'software_yearly' ) * 100;
		$sum  = 0;
		foreach ( $rows as $r ) {
			$sum += (int) $r->n * ( 'monthly' === $r->plan ? $m : (int) round( $y / 12 ) );
		}
		return $sum;
	}
}
