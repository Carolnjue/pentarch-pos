<?php
/**
 * Licence engine (SPEC §5).
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Licence {

	/** Plans an admin can set. */
	public static function plans() {
		return array(
			'trial'          => 'Free trial',
			'monthly'        => 'Software — monthly',
			'yearly'         => 'Software — yearly',
			'complete_till'  => 'Complete Till package',
			'software_setup' => 'Software + Setup package',
			'custom'         => 'Custom / partner',
		);
	}

	public static function statuses() {
		return array(
			'trial'     => 'Trial',
			'active'    => 'Active',
			'grace'     => 'Grace',
			'expired'   => 'Expired',
			'suspended' => 'Suspended',
		);
	}

	/**
	 * Compute licence state for a tenant row.
	 *
	 * Rules: suspended overrides all. Paid period (paid_until) in future => active.
	 * Trial period in future => trial. Otherwise, within grace_days after the later of
	 * trial_ends / paid_until => grace. Else expired.
	 *
	 * @param object $t   Tenant row.
	 * @param int    $now Unix time (testing).
	 * @return array
	 */
	public static function compute( $t, $now = null ) {
		$now   = $now ? (int) $now : time();
		$grace = (int) PPC_Settings::get( 'grace_days', 7 );
		$trial = PPC_Util::ts( $t->trial_ends );
		$paid  = PPC_Util::ts( $t->paid_until );
		$end   = max( $trial, $paid );

		if ( ! empty( $t->suspended ) ) {
			$status    = 'suspended';
			$phase_end = 0;
		} elseif ( $paid && $paid > $now ) {
			$status    = 'active';
			$phase_end = $paid;
		} elseif ( $trial && $trial > $now ) {
			$status    = 'trial';
			$phase_end = $trial;
		} elseif ( $end && $now < $end + $grace * DAY_IN_SECONDS ) {
			$status    = 'grace';
			$phase_end = $end + $grace * DAY_IN_SECONDS;
		} else {
			$status    = 'expired';
			$phase_end = 0;
		}
		$days_left = $phase_end ? (int) max( 0, ceil( ( $phase_end - $now ) / DAY_IN_SECONDS ) ) : 0;

		return array(
			'status'    => $status,
			'phase_end' => $phase_end,
			'days_left' => $days_left,
			'end'       => $end,
			'grace_end' => $end ? $end + $grace * DAY_IN_SECONDS : 0,
		);
	}

	/** Account reference for M-Pesa paybill payments. */
	public static function account_ref( $t ) {
		$fmt = (string) PPC_Settings::get( 'account_format', '{code}' );
		if ( '' === $fmt ) {
			$fmt = '{code}';
		}
		return strtr(
			$fmt,
			array(
				'{code}'  => $t->code,
				'{phone}' => $t->phone,
			)
		);
	}

	/** Licence payload per SPEC §4 GET /licence (plus a few additive fields). */
	public static function payload( $t ) {
		$c = self::compute( $t );
		return array(
			'status'        => $c['status'],
			'plan'          => $t->plan,
			'trial_ends'    => PPC_Util::iso( $t->trial_ends ),
			'paid_until'    => PPC_Util::iso( $t->paid_until ),
			'days_left'     => $c['days_left'],
			'max_branches'  => (int) $t->max_branches,
			'max_devices'   => (int) $t->max_devices,
			'pay'           => array(
				'paybill'        => (string) PPC_Settings::get( 'paybill' ),
				'account'        => self::account_ref( $t ),
				'amount_monthly' => (int) PPC_Settings::get( 'software_monthly' ),
				'amount_yearly'  => (int) PPC_Settings::get( 'software_yearly' ),
				'whatsapp'       => (string) PPC_Settings::get( 'whatsapp' ),
			),
			// Additive fields (not in the original contract; safe to ignore).
			'business_code' => $t->code,
			'grace_ends'    => $c['grace_end'] ? PPC_Util::iso( $c['grace_end'] ) : null,
			'grace_days'    => (int) PPC_Settings::get( 'grace_days', 7 ),
			'server_time'   => gmdate( 'c' ),
		);
	}
}
