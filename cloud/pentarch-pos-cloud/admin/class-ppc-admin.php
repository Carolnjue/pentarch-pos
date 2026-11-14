<?php
/**
 * wp-admin → Pentarch POS (SPEC §7): menu, assets, actions, exports.
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

require_once PPC_DIR . 'admin/class-ppc-admin-ui.php';
require_once PPC_DIR . 'admin/class-ppc-admin-pages.php';

class PPC_Admin {

	const CAP = 'manage_options';

	public static function init() {
		add_action( 'admin_menu', array( __CLASS__, 'menu' ) );
		add_action( 'admin_enqueue_scripts', array( __CLASS__, 'assets' ) );
		add_action( 'admin_post_ppc_do', array( __CLASS__, 'handle' ) );
		add_action( 'admin_post_ppc_export', array( __CLASS__, 'export' ) );
		add_filter( 'admin_body_class', array( __CLASS__, 'body_class' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( PPC_FILE ), array( __CLASS__, 'plugin_links' ) );
		add_action( 'admin_notices', array( __CLASS__, 'global_notices' ) );
	}

	public static function plugin_links( $links ) {
		array_unshift( $links, '<a href="' . esc_url( admin_url( 'admin.php?page=ppc-settings' ) ) . '">Settings</a>' );
		return $links;
	}

	private static function icon() {
		$svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path fill="black" d="M4 2h7.2a5.3 5.3 0 0 1 0 10.6H8V18H4zm4 3.4v3.9h3a1.95 1.95 0 0 0 0-3.9z"/></svg>';
		return 'data:image/svg+xml;base64,' . base64_encode( $svg );
	}

	public static function menu() {
		global $wpdb;
		$pending = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . PPC_Util::t( 'agents' ) . " WHERE status = 'pending'" );
		$new_b   = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . PPC_Util::t( 'demo_bookings' ) . " WHERE status = 'new'" );
		$badge   = function ( $n ) {
			return $n ? ' <span class="awaiting-mod count-' . (int) $n . '"><span class="pending-count">' . (int) $n . '</span></span>' : '';
		};
		$p       = 'PPC_Admin_Pages';
		add_menu_page( 'Pentarch POS', 'Pentarch POS' . $badge( $pending + $new_b ), self::CAP, 'ppc', array( $p, 'dashboard' ), self::icon(), 26 );
		add_submenu_page( 'ppc', 'Dashboard — Pentarch POS', 'Dashboard', self::CAP, 'ppc', array( $p, 'dashboard' ) );
		add_submenu_page( 'ppc', 'Businesses — Pentarch POS', 'Businesses', self::CAP, 'ppc-businesses', array( $p, 'businesses' ) );
		add_submenu_page( 'ppc', 'Agents — Pentarch POS', 'Agents' . $badge( $pending ), self::CAP, 'ppc-agents', array( $p, 'agents' ) );
		add_submenu_page( 'ppc', 'Leads — Pentarch POS', 'Leads', self::CAP, 'ppc-leads', array( $p, 'leads' ) );
		add_submenu_page( 'ppc', 'Demo bookings — Pentarch POS', 'Demo bookings' . $badge( $new_b ), self::CAP, 'ppc-bookings', array( $p, 'bookings' ) );
		add_submenu_page( 'ppc', 'Payments — Pentarch POS', 'Payments', self::CAP, 'ppc-payments', array( $p, 'payments' ) );
		add_submenu_page( 'ppc', 'Commissions — Pentarch POS', 'Commissions', self::CAP, 'ppc-commissions', array( $p, 'commissions' ) );
		add_submenu_page( 'ppc', 'Settings — Pentarch POS', 'Settings', self::CAP, 'ppc-settings', array( $p, 'settings' ) );
		add_submenu_page( 'ppc', 'Tools — Pentarch POS', 'Tools', self::CAP, 'ppc-tools', array( $p, 'tools' ) );
	}

	private static function is_ours() {
		$page = isset( $_GET['page'] ) ? sanitize_key( $_GET['page'] ) : ''; // phpcs:ignore
		return 'ppc' === $page || 0 === strpos( $page, 'ppc-' );
	}

	public static function body_class( $c ) {
		return self::is_ours() ? $c . ' ppc-admin-page' : $c;
	}

	public static function assets() {
		if ( ! self::is_ours() ) {
			return;
		}
		wp_enqueue_style( 'ppc-admin', PPC_URL . 'assets/admin.css', array(), PPC_VERSION );
		wp_enqueue_script( 'ppc-admin', PPC_URL . 'assets/admin.js', array(), PPC_VERSION, true );
		wp_localize_script(
			'ppc-admin',
			'PPC_ADMIN',
			array(
				'ping'   => esc_url_raw( rest_url( PPC_NS . '/public/ping' ) ),
				'prices' => PPC_Payments::types_with_prices(),
			)
		);
	}

	/** Problems worth flagging on our pages. */
	public static function global_notices() {
		if ( ! self::is_ours() || ! current_user_can( self::CAP ) ) {
			return;
		}
		$msgs = array();
		if ( ! PPC_Settings::get( 'paybill' ) ) {
			$msgs[] = 'Set the M-Pesa <strong>Paybill number</strong> in <a href="' . esc_url( admin_url( 'admin.php?page=ppc-settings#payments' ) ) . '">Settings</a> so the POS pay page shows it.';
		}
		$bi = PPC_Static::build_info( 'pos' );
		if ( ! $bi['present'] || $bi['placeholder'] ) {
			$msgs[] = 'The POS app build is not installed yet — <code>/pos/</code> shows a placeholder page.';
		}
		if ( $msgs ) {
			echo '<div class="notice notice-warning ppc-notice"><p>' . implode( '<br>', $msgs ) . '</p></div>'; // phpcs:ignore -- static markup.
		}
	}

	/* ---------------- Flash messages ---------------- */

	public static function flash( $msg, $type = 'success' ) {
		set_transient( 'ppc_flash_' . get_current_user_id(), array( $msg, $type ), 120 );
	}

	public static function take_flash() {
		$k = 'ppc_flash_' . get_current_user_id();
		$f = get_transient( $k );
		if ( $f ) {
			delete_transient( $k );
		}
		return $f;
	}

	private static function back( $fallback = '' ) {
		$to = isset( $_POST['_back'] ) ? esc_url_raw( wp_unslash( $_POST['_back'] ) ) : ''; // phpcs:ignore
		if ( ! $to ) {
			$to = $fallback ? $fallback : admin_url( 'admin.php?page=ppc' );
		}
		wp_safe_redirect( $to );
		exit;
	}

	/* ---------------- Actions ---------------- */

	public static function handle() {
		global $wpdb;
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( 'Not allowed.', 403 );
		}
		check_admin_referer( 'ppc_action' );
		$do  = isset( $_POST['do'] ) ? sanitize_key( $_POST['do'] ) : '';
		$in  = wp_unslash( $_POST ); // phpcs:ignore -- sanitised per field below.
		$tid = isset( $in['tenant_id'] ) ? PPC_Util::text( $in['tenant_id'], 32 ) : '';
		$aid = isset( $in['agent_id'] ) ? (int) $in['agent_id'] : 0;

		switch ( $do ) {
			case 'record_payment':
				$res = PPC_Payments::record( $tid, $in, 'admin' );
				if ( is_wp_error( $res ) ) {
					self::flash( $res->get_error_message(), 'error' );
				} else {
					$c   = array_sum( wp_list_pluck( $res['commissions'], 'amount' ) );
					$msg = 'Payment recorded.' . ( $res['paid_until'] ? ' Paid until ' . PPC_Util::fmt_date( $res['paid_until'] ) . '.' : '' );
					if ( $c ) {
						$msg .= ' Agent commission created: ' . PPC_Util::kes( $c ) . '.';
					}
					self::flash( $msg );
				}
				break;

			case 'extend_trial':
				$days = max( 1, min( 365, (int) $in['days'] ) );
				PPC_Payments::extend_trial( $tid, $days );
				self::flash( 'Trial extended by ' . $days . ' days.' );
				break;

			case 'edit_licence':
				$f = array(
					'max_branches' => max( 1, (int) $in['max_branches'] ),
					'max_devices'  => max( 1, (int) $in['max_devices'] ),
				);
				if ( isset( $in['plan'] ) && array_key_exists( $in['plan'], PPC_Licence::plans() ) ) {
					$f['plan'] = $in['plan'];
				}
				foreach ( array( 'trial_ends', 'paid_until' ) as $k ) {
					if ( isset( $in[ $k ] ) ) {
						$v      = trim( (string) $in[ $k ] );
						$f[ $k ] = preg_match( '/^\d{4}-\d{2}-\d{2}$/', $v ) ? $v . ' 20:59:59' : null; // 23:59 Nairobi.
					}
				}
				PPC_Tenants::update( $tid, $f );
				PPC_DB::event( 'licence.edit', 'Licence edited by admin', $tid );
				self::flash( 'Licence updated.' );
				break;

			case 'suspend':
				PPC_Tenants::update(
					$tid,
					array(
						'suspended'        => 1,
						'suspended_reason' => PPC_Util::text( isset( $in['reason'] ) ? $in['reason'] : '', 190 ),
					)
				);
				PPC_DB::event( 'tenant.suspended', 'Business suspended', $tid );
				self::flash( 'Business suspended. The app will show the suspended notice on next sync; data stays viewable.' );
				break;

			case 'unsuspend':
				PPC_Tenants::update(
					$tid,
					array(
						'suspended'        => 0,
						'suspended_reason' => '',
					)
				);
				self::flash( 'Business reactivated.' );
				break;

			case 'reset_password':
				$t = PPC_Tenants::get( $tid );
				if ( $t ) {
					$pw = PPC_Util::friendly_password();
					PPC_Tenants::update( $tid, array( 'password_hash' => wp_hash_password( $pw ) ) );
					$msg = "Hello {$t->owner_name}, your Pentarch POS password has been reset.\nEmail: {$t->email}\nNew password: {$pw}\nPlease change it after signing in.";
					self::flash( 'New owner password: <code class="ppc-secret">' . esc_html( $pw ) . '</code> — shown once. <a class="ppc-link" target="_blank" rel="noopener" href="' . esc_url( PPC_Util::wa_link( $t->phone, $msg ) ) . '">Send to owner on WhatsApp</a>' );
					PPC_DB::event( 'tenant.password_reset', 'Owner password reset by admin', $tid );
				}
				break;

			case 'revoke_device':
				PPC_Tenants::revoke_device( (int) $in['device_row'], $tid );
				self::flash( 'Device signed out.' );
				break;

			case 'tenant_notes':
				PPC_Tenants::update(
					$tid,
					array(
						'notes'   => PPC_Util::textarea( isset( $in['notes'] ) ? $in['notes'] : '', 5000 ),
						'is_test' => empty( $in['is_test'] ) ? 0 : 1,
					)
				);
				self::flash( 'Saved.' );
				break;

			case 'tenant_agent':
				$new = (int) $in['new_agent_id'];
				PPC_Tenants::update( $tid, array( 'agent_id' => $new ? $new : null ) );
				self::flash( $new ? 'Agent assigned. Future payments create commission for this agent.' : 'Agent removed from this business.' );
				break;

			case 'tenant_mpesa':
				$cfg = array();
				foreach ( array( 'env', 'type', 'shortcode', 'till', 'consumer_key', 'consumer_secret', 'passkey' ) as $k ) {
					$cfg[ $k ] = PPC_Util::text( isset( $in[ 'mp_' . $k ] ) ? $in[ 'mp_' . $k ] : '', 200 );
				}
				$old = json_decode( (string) PPC_Tenants::get( $tid )->mpesa_config, true );
				foreach ( array( 'consumer_secret', 'passkey' ) as $k ) {
					if ( '********' === $cfg[ $k ] && is_array( $old ) && isset( $old[ $k ] ) ) {
						$cfg[ $k ] = $old[ $k ];
					}
				}
				$empty = ! array_filter( array( $cfg['shortcode'], $cfg['consumer_key'], $cfg['consumer_secret'], $cfg['passkey'] ) );
				PPC_Tenants::update( $tid, array( 'mpesa_config' => $empty ? null : wp_json_encode( $cfg ) ) );
				self::flash( $empty ? 'M-Pesa STK settings cleared for this business.' : 'M-Pesa STK settings saved for this business.' );
				break;

			case 'agent_status':
				$st = sanitize_key( $in['status'] );
				PPC_Agents::set_status( $aid, $st );
				self::flash( 'active' === $st ? 'Agent approved — a welcome email has been sent.' : ( 'suspended' === $st ? 'Agent suspended and signed out.' : 'Agent status updated.' ) );
				break;

			case 'agent_rates':
				$rate  = trim( (string) $in['software_rate'] );
				$bonus = trim( (string) $in['bundle_bonus'] );
				$wpdb->update(
					PPC_Util::t( 'agents' ),
					array(
						'software_rate' => '' === $rate ? null : max( 0, min( 100, (float) $rate ) ),
						'bundle_bonus'  => '' === $bonus ? null : max( 0, (int) $bonus ),
						'notes'         => PPC_Util::textarea( isset( $in['notes'] ) ? $in['notes'] : '', 5000 ),
						'mpesa_phone'   => PPC_Util::phone( $in['mpesa_phone'] ) ? PPC_Util::phone( $in['mpesa_phone'] ) : PPC_Agents::get( $aid )->mpesa_phone,
						'updated_at'    => PPC_Util::now(),
					),
					array( 'id' => $aid )
				);
				// $wpdb->update() writes NULL as '' for some drivers; enforce NULLs explicitly.
				if ( '' === $rate ) {
					$wpdb->query( $wpdb->prepare( 'UPDATE ' . PPC_Util::t( 'agents' ) . ' SET software_rate = NULL WHERE id = %d', $aid ) );
				}
				if ( '' === $bonus ) {
					$wpdb->query( $wpdb->prepare( 'UPDATE ' . PPC_Util::t( 'agents' ) . ' SET bundle_bonus = NULL WHERE id = %d', $aid ) );
				}
				self::flash( 'Agent settings saved.' );
				break;

			case 'commission_status':
				$ids = isset( $in['ids'] ) ? array_map( 'intval', (array) $in['ids'] ) : array();
				if ( ! empty( $in['commission_id'] ) ) {
					$ids[] = (int) $in['commission_id'];
				}
				$st  = sanitize_key( $in['status'] );
				$ref = isset( $in['mpesa_ref'] ) ? $in['mpesa_ref'] : '';
				if ( 'paid' === $st && '' === trim( (string) $ref ) ) {
					self::flash( 'Enter the M-Pesa reference used to pay the agent.', 'error' );
					break;
				}
				$n = 0;
				foreach ( array_unique( array_filter( $ids ) ) as $cid ) {
					$n += PPC_Payments::set_commission_status( $cid, $st, $ref ) ? 1 : 0;
				}
				self::flash( $n ? $n . ' commission' . ( 1 === $n ? '' : 's' ) . ' marked ' . $st . '.' : 'Nothing selected.', $n ? 'success' : 'error' );
				break;

			case 'booking_update':
				$bid = (int) $in['booking_id'];
				$f   = array( 'updated_at' => PPC_Util::now() );
				if ( isset( $in['status'] ) && in_array( $in['status'], array( 'new', 'contacted', 'scheduled', 'done', 'cancelled' ), true ) ) {
					$f['status'] = $in['status'];
				}
				if ( isset( $in['assigned_agent_id'] ) ) {
					$f['assigned_agent_id'] = (int) $in['assigned_agent_id'] ? (int) $in['assigned_agent_id'] : null;
				}
				if ( isset( $in['admin_note'] ) ) {
					$f['admin_note'] = PPC_Util::textarea( $in['admin_note'], 5000 );
				}
				$wpdb->update( PPC_Util::t( 'demo_bookings' ), $f, array( 'id' => $bid ) );
				self::assign_booking_lead( $bid );
				self::flash( 'Booking updated.' );
				break;

			case 'save_settings':
				PPC_Settings::save( isset( $in['s'] ) && is_array( $in['s'] ) ? $in['s'] : array() );
				self::flash( 'Settings saved.' );
				break;

			case 'flush_rewrite':
				PPC_Static::add_rules();
				flush_rewrite_rules( false );
				$ok = PPC_Static::write_htaccess( true );
				self::flash( 'Rewrite rules refreshed.' . ( $ok ? ' .htaccess block updated.' : ' (.htaccess not written — not Apache/LiteSpeed or not writable.)' ) );
				break;

			case 'clear_rate_limits':
				PPC_RateLimit::clear_all();
				self::flash( 'Rate-limit counters cleared.' );
				break;

			case 'purge_test':
				$ids = $wpdb->get_col( 'SELECT id FROM ' . PPC_Util::t( 'tenants' ) . ' WHERE is_test = 1' );
				foreach ( $ids as $id ) {
					foreach ( array( 'records', 'devices', 'payments', 'commissions', 'mpesa_requests' ) as $tb ) {
						$wpdb->delete( PPC_Util::t( $tb ), array( 'tenant_id' => $id ) );
					}
					$wpdb->delete( PPC_Util::t( 'tenants' ), array( 'id' => $id ) );
				}
				self::flash( count( $ids ) . ' test/demo business' . ( 1 === count( $ids ) ? '' : 'es' ) . ' and their data deleted.' );
				break;

			case 'test_email':
				$ok = wp_mail( PPC_Settings::admin_email(), 'Pentarch POS test email', 'This is a test email from Pentarch POS Cloud. Notifications are working.' );
				self::flash( $ok ? 'Test email sent to ' . esc_html( PPC_Settings::admin_email() ) . '.' : 'wp_mail() failed. Check the site\'s email (SMTP) setup.', $ok ? 'success' : 'error' );
				break;

			default:
				self::flash( 'Unknown action.', 'error' );
		}
		self::back();
	}

	/** When a booking is assigned to an agent who has no lead for it yet, create one in their pipeline. */
	private static function assign_booking_lead( $bid ) {
		global $wpdb;
		$b = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'demo_bookings' ) . ' WHERE id = %d', $bid ) );
		if ( ! $b || ! $b->assigned_agent_id ) {
			return;
		}
		if ( $b->lead_id && (int) $b->assigned_agent_id === (int) $b->agent_id ) {
			return;
		}
		$exists = $b->lead_id ? $wpdb->get_var( $wpdb->prepare( 'SELECT 1 FROM ' . PPC_Util::t( 'leads' ) . ' WHERE agent_id = %d AND lead_id = %s', $b->assigned_agent_id, $b->lead_id ) ) : null;
		if ( $exists ) {
			return;
		}
		$lead_id = PPC_Util::ulid();
		$ms      = PPC_Util::now_ms();
		$now     = PPC_Util::now();
		$data    = array(
			'id'               => $lead_id,
			'business_name'    => $b->business,
			'contact_name'     => $b->name,
			'phone'            => $b->phone,
			'email'            => $b->email,
			'business_type'    => $b->business_type,
			'town'             => $b->town,
			'stage'            => 'demo_booked',
			'package_interest' => 'unsure',
			'next_follow_up'   => $b->preferred_date,
			'notes'            => trim( 'Demo booking ' . $b->ref . ' assigned by Pentarch. ' . $b->message ),
			'source'           => 'assigned',
			'created_at'       => $ms,
			'updated_at'       => $ms,
		);
		$wpdb->insert(
			PPC_Util::t( 'leads' ),
			array(
				'agent_id'         => $b->assigned_agent_id,
				'lead_id'          => $lead_id,
				'business_name'    => $b->business,
				'contact_name'     => $b->name,
				'phone'            => $b->phone,
				'town'             => $b->town,
				'stage'            => 'demo_booked',
				'package_interest' => 'unsure',
				'next_follow_up'   => $b->preferred_date,
				'data'             => wp_json_encode( $data ),
				'updated_at'       => $ms,
				'deleted'          => 0,
				'created_at'       => $now,
				'received_at'      => $now,
			)
		);
		$wpdb->update( PPC_Util::t( 'demo_bookings' ), array( 'lead_id' => $lead_id ), array( 'id' => $bid ) );
	}

	/* ---------------- CSV exports ---------------- */

	public static function export() {
		global $wpdb;
		if ( ! current_user_can( self::CAP ) ) {
			wp_die( 'Not allowed.', 403 );
		}
		check_admin_referer( 'ppc_export' );
		$what = isset( $_GET['what'] ) ? sanitize_key( $_GET['what'] ) : '';
		$date = gmdate( 'Y-m-d' );
		switch ( $what ) {
			case 'businesses':
				$rows = array();
				foreach ( $wpdb->get_results( 'SELECT t.*, a.code AS agent_code, a.name AS agent_name FROM ' . PPC_Util::t( 'tenants' ) . ' t LEFT JOIN ' . PPC_Util::t( 'agents' ) . ' a ON a.id = t.agent_id ORDER BY t.created_at DESC' ) as $t ) {
					$c      = PPC_Licence::compute( $t );
					$rows[] = array( $t->code, $t->business_name, PPC_Tenants::type_label( $t->business_type ), $t->owner_name, $t->phone, $t->email, $t->town, $t->county, $c['status'], $t->plan, $t->trial_ends, $t->paid_until, $c['days_left'], $t->agent_code, $t->agent_name, $t->source, $t->last_sync_at, $t->created_at, $t->is_test ? 'yes' : '' );
				}
				PPC_Util::csv_download( "pentarch-pos-businesses-$date.csv", array( 'Code', 'Business', 'Type', 'Owner', 'Phone', 'Email', 'Town', 'County', 'Status', 'Plan', 'Trial ends (UTC)', 'Paid until (UTC)', 'Days left', 'Agent code', 'Agent', 'Source', 'Last sync (UTC)', 'Created (UTC)', 'Test' ), $rows );
				break;
			case 'agents':
				$rows = array();
				foreach ( $wpdb->get_results( 'SELECT * FROM ' . PPC_Util::t( 'agents' ) . ' ORDER BY created_at DESC' ) as $a ) {
					$s      = PPC_Agents::stats( $a->id );
					$rows[] = array( $a->code, $a->name, $a->phone, $a->mpesa_phone, $a->email, $a->town, $a->county, $a->status, array_sum( $s['leads_by_stage'] ), $s['commission']['pending'] / 100, $s['commission']['approved'] / 100, $s['commission']['paid'] / 100, $a->heard_from, $a->created_at, $a->approved_at, $a->last_seen );
				}
				PPC_Util::csv_download( "pentarch-pos-agents-$date.csv", array( 'Code', 'Name', 'Phone', 'M-Pesa', 'Email', 'Town', 'County', 'Status', 'Leads', 'Commission pending (KES)', 'Commission approved (KES)', 'Commission paid (KES)', 'Heard from', 'Joined (UTC)', 'Approved (UTC)', 'Last seen (UTC)' ), $rows );
				break;
			case 'leads':
				$rows = array();
				foreach ( $wpdb->get_results( 'SELECT l.*, a.code AS agent_code, a.name AS agent_name FROM ' . PPC_Util::t( 'leads' ) . ' l LEFT JOIN ' . PPC_Util::t( 'agents' ) . ' a ON a.id = l.agent_id WHERE l.deleted = 0 ORDER BY l.created_at DESC' ) as $l ) {
					$d      = json_decode( $l->data, true );
					$d      = is_array( $d ) ? $d : array();
					$rows[] = array( $l->business_name, $l->contact_name, $l->phone, isset( $d['email'] ) ? $d['email'] : '', isset( $d['business_type'] ) ? $d['business_type'] : '', $l->town, isset( $d['current_system'] ) ? $d['current_system'] : '', isset( $d['branches'] ) ? $d['branches'] : '', $l->package_interest, $l->stage, $l->next_follow_up, isset( $d['lost_reason'] ) ? $d['lost_reason'] : '', isset( $d['notes'] ) ? $d['notes'] : '', $l->agent_code, $l->agent_name, $l->created_at );
				}
				PPC_Util::csv_download( "pentarch-pos-leads-$date.csv", array( 'Business', 'Contact', 'Phone', 'Email', 'Type', 'Town', 'Current system', 'Branches', 'Interest', 'Stage', 'Next follow-up', 'Lost reason', 'Notes', 'Agent code', 'Agent', 'Created (UTC)' ), $rows );
				break;
			case 'bookings':
				$rows = array();
				foreach ( $wpdb->get_results( 'SELECT b.*, a.name AS agent_name FROM ' . PPC_Util::t( 'demo_bookings' ) . ' b LEFT JOIN ' . PPC_Util::t( 'agents' ) . ' a ON a.id = b.assigned_agent_id ORDER BY b.created_at DESC' ) as $b ) {
					$rows[] = array( $b->ref, $b->status, $b->name, $b->business, $b->business_type, $b->phone, $b->email, $b->town, $b->preferred_date, $b->preferred_time, $b->message, $b->agent_code, $b->agent_name, $b->source_page, $b->created_at );
				}
				PPC_Util::csv_download( "pentarch-pos-demo-bookings-$date.csv", array( 'Ref', 'Status', 'Name', 'Business', 'Type', 'Phone', 'Email', 'Town', 'Preferred date', 'Preferred time', 'Message', 'Agent code', 'Assigned agent', 'Page', 'Created (UTC)' ), $rows );
				break;
			case 'payments':
				$rows = array();
				foreach ( $wpdb->get_results( 'SELECT p.*, t.code, t.business_name FROM ' . PPC_Util::t( 'payments' ) . ' p LEFT JOIN ' . PPC_Util::t( 'tenants' ) . ' t ON t.id = p.tenant_id ORDER BY p.paid_at DESC' ) as $p ) {
					$rows[] = array( $p->paid_at, $p->code, $p->business_name, PPC_Payments::type_label( $p->type ), $p->bundles, $p->amount / 100, $p->months, $p->method, $p->ref, $p->period_from, $p->period_to, $p->source, $p->note );
				}
				PPC_Util::csv_download( "pentarch-pos-payments-$date.csv", array( 'Paid (UTC)', 'Code', 'Business', 'For', 'Qty', 'Amount (KES)', 'Months', 'Method', 'Ref', 'Period from', 'Period to', 'Source', 'Note' ), $rows );
				break;
			case 'commissions':
				$rows = array();
				foreach ( $wpdb->get_results( 'SELECT c.*, a.code AS agent_code, a.name AS agent_name, a.mpesa_phone, t.business_name, t.code FROM ' . PPC_Util::t( 'commissions' ) . ' c LEFT JOIN ' . PPC_Util::t( 'agents' ) . ' a ON a.id = c.agent_id LEFT JOIN ' . PPC_Util::t( 'tenants' ) . ' t ON t.id = c.tenant_id ORDER BY c.created_at DESC' ) as $c ) {
					$rows[] = array( $c->created_at, $c->agent_code, $c->agent_name, $c->mpesa_phone, $c->code, $c->business_name, $c->kind, $c->base_amount / 100, $c->rate, $c->amount / 100, $c->status, $c->mpesa_ref, $c->paid_at, $c->note );
				}
				PPC_Util::csv_download( "pentarch-pos-commissions-$date.csv", array( 'Created (UTC)', 'Agent code', 'Agent', 'Agent M-Pesa', 'Business code', 'Business', 'Kind', 'Base (KES)', 'Rate %', 'Commission (KES)', 'Status', 'M-Pesa ref', 'Paid (UTC)', 'Note' ), $rows );
				break;
			case 'tenant_records':
				$tid = isset( $_GET['tenant_id'] ) ? PPC_Util::text( wp_unslash( $_GET['tenant_id'] ), 32 ) : '';
				$t   = PPC_Tenants::get( $tid );
				if ( ! $t ) {
					wp_die( 'Business not found.' );
				}
				nocache_headers();
				header( 'Content-Type: application/json; charset=utf-8' );
				header( 'Content-Disposition: attachment; filename="' . sanitize_file_name( 'pentarch-pos-' . $t->code . '-' . $date . '.json' ) . '"' );
				echo '{"tenant_id":' . wp_json_encode( $t->id ) . ',"business_code":' . wp_json_encode( $t->code ) . ',"exported_at":' . wp_json_encode( gmdate( 'c' ) ) . ',"records":[';
				$last  = 0;
				$first = true;
				do {
					$rows = $wpdb->get_results( $wpdb->prepare( 'SELECT server_seq, entity, record_id, data, updated_at, deleted FROM ' . PPC_Util::t( 'records' ) . ' WHERE tenant_id = %s AND server_seq > %d ORDER BY server_seq ASC LIMIT 1000', $t->id, $last ) );
					foreach ( $rows as $r ) {
						echo ( $first ? '' : ',' ) . '{"entity":' . wp_json_encode( $r->entity ) . ',"id":' . wp_json_encode( $r->record_id ) . ',"updated_at":' . (int) $r->updated_at . ',"deleted":' . (int) $r->deleted . ',"data":' . $r->data . '}'; // phpcs:ignore -- stored JSON.
						$first = false;
						$last  = (int) $r->server_seq;
					}
				} while ( count( $rows ) === 1000 );
				echo ']}';
				exit;
			default:
				wp_die( 'Unknown export.' );
		}
	}

	public static function export_url( $what, $args = array() ) {
		return wp_nonce_url( add_query_arg( array_merge( array( 'action' => 'ppc_export', 'what' => $what ), $args ), admin_url( 'admin-post.php' ) ), 'ppc_export' );
	}
}
