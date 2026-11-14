<?php
/**
 * Admin screens.
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Admin_Pages {

	private static function q( $k, $default = '' ) {
		return isset( $_GET[ $k ] ) ? sanitize_text_field( wp_unslash( $_GET[ $k ] ) ) : $default; // phpcs:ignore
	}

	/** SQL condition for a licence status (tenant alias t). */
	private static function status_sql( $status ) {
		global $wpdb;
		$now = PPC_Util::now();
		$g   = PPC_Util::dt( time() - (int) PPC_Settings::get( 'grace_days', 7 ) * DAY_IN_SECONDS );
		switch ( $status ) {
			case 'trial':
				return $wpdb->prepare( 't.suspended = 0 AND t.trial_ends > %s AND (t.paid_until IS NULL OR t.paid_until <= %s)', $now, $now );
			case 'active':
				return $wpdb->prepare( 't.suspended = 0 AND t.paid_until > %s', $now );
			case 'grace':
				return $wpdb->prepare( 't.suspended = 0 AND (t.paid_until IS NULL OR t.paid_until <= %s) AND (t.trial_ends IS NULL OR t.trial_ends <= %s) AND (t.trial_ends > %s OR t.paid_until > %s)', $now, $now, $g, $g );
			case 'expired':
				return $wpdb->prepare( 't.suspended = 0 AND (t.paid_until IS NULL OR t.paid_until <= %s) AND (t.trial_ends IS NULL OR t.trial_ends <= %s)', $g, $g );
			case 'suspended':
				return 't.suspended = 1';
			case 'expiring':
				$w = PPC_Util::dt( time() + 7 * DAY_IN_SECONDS );
				return $wpdb->prepare( 't.suspended = 0 AND ((t.paid_until > %s AND t.paid_until <= %s) OR (t.trial_ends > %s AND t.trial_ends <= %s AND (t.paid_until IS NULL OR t.paid_until <= %s)))', $now, $w, $now, $w, $now );
		}
		return '1=1';
	}

	private static function licence_cell( $t ) {
		$c    = PPC_Licence::compute( $t );
		$hint = '';
		if ( in_array( $c['status'], array( 'trial', 'active', 'grace' ), true ) ) {
			$hint = $c['days_left'] . ' day' . ( 1 === $c['days_left'] ? '' : 's' ) . ' left';
		}
		return PPC_Admin_UI::badge( $c['status'] ) . ( $hint ? '<span class="ppc-cell-hint' . ( $c['days_left'] <= 7 ? ' is-warn' : '' ) . '">' . esc_html( $hint ) . '</span>' : '' );
	}

	/* =================================================================== */
	/* Dashboard                                                            */
	/* =================================================================== */

	public static function dashboard() {
		global $wpdb;
		$tn  = PPC_Util::t( 'tenants' );
		$cnt = function ( $where ) use ( $wpdb, $tn ) {
			return (int) $wpdb->get_var( "SELECT COUNT(*) FROM $tn t WHERE t.is_test = 0 AND $where" ); // phpcs:ignore
		};
		$trials   = $cnt( self::status_sql( 'trial' ) );
		$expiring = $cnt( self::status_sql( 'expiring' ) );
		$paying   = $cnt( self::status_sql( 'active' ) );
		$total    = $cnt( '1=1' );
		$mrr      = PPC_Payments::mrr();
		$d30      = PPC_Util::dt( time() - 30 * DAY_IN_SECONDS );
		$leads30  = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COUNT(*) FROM ' . PPC_Util::t( 'leads' ) . ' WHERE deleted = 0 AND created_at >= %s', $d30 ) );
		$book_new = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . PPC_Util::t( 'demo_bookings' ) . " WHERE status = 'new'" );
		$ag_pend  = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . PPC_Util::t( 'agents' ) . " WHERE status = 'pending'" );
		$ag_act   = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . PPC_Util::t( 'agents' ) . " WHERE status = 'active'" );
		$owed     = (int) $wpdb->get_var( 'SELECT COALESCE(SUM(amount),0) FROM ' . PPC_Util::t( 'commissions' ) . " WHERE status IN ('pending','approved')" );
		$rev30    = (int) $wpdb->get_var( $wpdb->prepare( 'SELECT COALESCE(SUM(amount),0) FROM ' . PPC_Util::t( 'payments' ) . ' WHERE paid_at >= %s', $d30 ) );

		$actions = PPC_Admin_UI::link_btn( PPC_Admin_UI::url( 'ppc-payments', array( 'new' => 1 ) ), 'Record payment', 'primary' ) . PPC_Admin_UI::link_btn( home_url( '/pos/' ), 'Open POS', 'secondary', 'target="_blank" rel="noopener"' );
		PPC_Admin_UI::open( 'Dashboard', 'Trials, paying businesses, agents and demo requests at a glance.', $actions );

		echo '<div class="ppc-kpis">';
		PPC_Admin_UI::kpi( 'Active trials', number_format( $trials ), $expiring . ' expiring in 7 days', 'sun', PPC_Admin_UI::url( 'ppc-businesses', array( 'status' => 'trial' ) ) );
		PPC_Admin_UI::kpi( 'Paying businesses', number_format( $paying ), 'of ' . number_format( $total ) . ' registered', 'teal', PPC_Admin_UI::url( 'ppc-businesses', array( 'status' => 'active' ) ) );
		PPC_Admin_UI::kpi( 'MRR', PPC_Util::kes( $mrr ), PPC_Util::kes( $rev30 ) . ' received in 30 days', 'grad', PPC_Admin_UI::url( 'ppc-payments' ) );
		PPC_Admin_UI::kpi( 'New leads (30 days)', number_format( $leads30 ), $ag_act . ' active agents', 'navy', PPC_Admin_UI::url( 'ppc-leads' ) );
		echo '</div>';

		// Attention row.
		$att = array();
		if ( $ag_pend ) {
			$att[] = '<a href="' . esc_url( PPC_Admin_UI::url( 'ppc-agents', array( 'status' => 'pending' ) ) ) . '"><strong>' . $ag_pend . '</strong> agent' . ( 1 === $ag_pend ? '' : 's' ) . ' waiting for approval</a>';
		}
		if ( $book_new ) {
			$att[] = '<a href="' . esc_url( PPC_Admin_UI::url( 'ppc-bookings', array( 'status' => 'new' ) ) ) . '"><strong>' . $book_new . '</strong> new demo booking' . ( 1 === $book_new ? '' : 's' ) . ' to call</a>';
		}
		if ( $expiring ) {
			$att[] = '<a href="' . esc_url( PPC_Admin_UI::url( 'ppc-businesses', array( 'status' => 'expiring' ) ) ) . '"><strong>' . $expiring . '</strong> licence' . ( 1 === $expiring ? '' : 's' ) . ' ending within 7 days</a>';
		}
		if ( $owed ) {
			$att[] = '<a href="' . esc_url( PPC_Admin_UI::url( 'ppc-commissions', array( 'status' => 'approved' ) ) ) . '"><strong>' . esc_html( PPC_Util::kes( $owed ) ) . '</strong> agent commission owed</a>';
		}
		if ( $att ) {
			echo '<div class="ppc-attention"><span class="ppc-attention__label">Needs attention</span>' . implode( '', $att ) . '</div>'; // phpcs:ignore
		}

		echo '<div class="ppc-grid ppc-grid--2-1">';
		// Sign-ups chart.
		$rows   = $wpdb->get_results( $wpdb->prepare( "SELECT SUBSTR(created_at,1,10) AS d, COUNT(*) AS n FROM $tn WHERE is_test = 0 AND created_at >= %s GROUP BY SUBSTR(created_at,1,10)", $d30 ), OBJECT_K );
		$series = array();
		$labels = array();
		for ( $i = 29; $i >= 0; $i-- ) {
			$d        = gmdate( 'Y-m-d', time() - $i * DAY_IN_SECONDS );
			$series[] = isset( $rows[ $d ] ) ? (int) $rows[ $d ]->n : 0;
			$labels[] = wp_date( 'j M', strtotime( $d ) );
		}
		PPC_Admin_UI::card_open( 'Trial sign-ups — last 30 days', '<span class="ppc-big">' . array_sum( $series ) . '</span>' );
		echo PPC_Admin_UI::bars( $series, $labels ); // phpcs:ignore
		echo '<div class="ppc-bars__axis"><span>' . esc_html( $labels[0] ) . '</span><span>' . esc_html( $labels[14] ) . '</span><span>Today</span></div>';
		PPC_Admin_UI::card_close();

		// Expiring soon.
		$exp = $wpdb->get_results( "SELECT t.* FROM $tn t WHERE t.is_test = 0 AND " . self::status_sql( 'expiring' ) . ' ORDER BY COALESCE(t.paid_until, t.trial_ends) ASC LIMIT 8' ); // phpcs:ignore
		PPC_Admin_UI::card_open( 'Ending within 7 days', '<a class="ppc-link" href="' . esc_url( PPC_Admin_UI::url( 'ppc-businesses', array( 'status' => 'expiring' ) ) ) . '">View all</a>' );
		if ( $exp ) {
			echo '<ul class="ppc-list">';
			foreach ( $exp as $t ) {
				echo '<li><a href="' . esc_url( PPC_Admin_UI::url( 'ppc-businesses', array( 'id' => $t->id ) ) ) . '"><strong>' . esc_html( $t->business_name ) . '</strong><span>' . esc_html( $t->code . ' · ' . ( $t->town ? $t->town : '—' ) ) . '</span></a>' . self::licence_cell( $t ) . '</li>'; // phpcs:ignore
			}
			echo '</ul>';
		} else {
			echo '<p class="ppc-mute ppc-pad">Nothing ending this week.</p>';
		}
		PPC_Admin_UI::card_close();
		echo '</div>';

		echo '<div class="ppc-grid ppc-grid--3">';
		// Recent bookings.
		$bk = $wpdb->get_results( 'SELECT * FROM ' . PPC_Util::t( 'demo_bookings' ) . ' ORDER BY created_at DESC LIMIT 6' );
		PPC_Admin_UI::card_open( 'Latest demo bookings', '<a class="ppc-link" href="' . esc_url( PPC_Admin_UI::url( 'ppc-bookings' ) ) . '">All bookings</a>' );
		if ( $bk ) {
			echo '<ul class="ppc-list">';
			foreach ( $bk as $b ) {
				echo '<li><a href="' . esc_url( PPC_Admin_UI::url( 'ppc-bookings', array( 'id' => $b->id ) ) ) . '"><strong>' . esc_html( $b->business ) . '</strong><span>' . esc_html( $b->name . ' · ' . PPC_Util::ago( $b->created_at ) ) . '</span></a>' . PPC_Admin_UI::badge( $b->status ) . '</li>'; // phpcs:ignore
			}
			echo '</ul>';
		} else {
			echo '<p class="ppc-mute ppc-pad">No bookings yet. Add <code>[pentarch_pos_demo_form]</code> to the POS page.</p>';
		}
		PPC_Admin_UI::card_close();

		// Agent activity.
		$ag = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT a.id, a.name, a.code, a.last_seen,
				(SELECT COUNT(*) FROM ' . PPC_Util::t( 'leads' ) . ' l WHERE l.agent_id = a.id AND l.created_at >= %s AND l.deleted = 0) AS leads,
				(SELECT COUNT(*) FROM ' . $tn . ' t WHERE t.agent_id = a.id AND t.created_at >= %s) AS trials
				FROM ' . PPC_Util::t( 'agents' ) . " a WHERE a.status = 'active' ORDER BY a.last_seen DESC LIMIT 6",
				$d30,
				$d30
			)
		);
		PPC_Admin_UI::card_open( 'Agent activity — 30 days', '<a class="ppc-link" href="' . esc_url( PPC_Admin_UI::url( 'ppc-agents' ) ) . '">All agents</a>' );
		if ( $ag ) {
			echo '<table class="ppc-mini"><thead><tr><th>Agent</th><th class="num">Leads</th><th class="num">Trials</th><th>Seen</th></tr></thead><tbody>';
			foreach ( $ag as $a ) {
				echo '<tr><td><a href="' . esc_url( PPC_Admin_UI::url( 'ppc-agents', array( 'id' => $a->id ) ) ) . '">' . esc_html( $a->name ) . '</a></td><td class="num">' . (int) $a->leads . '</td><td class="num">' . (int) $a->trials . '</td><td class="ppc-mute">' . esc_html( PPC_Util::ago( $a->last_seen ) ) . '</td></tr>';
			}
			echo '</tbody></table>';
		} else {
			echo '<p class="ppc-mute ppc-pad">No approved agents yet. Agents sign up at <a href="' . esc_url( home_url( '/pos/agents/' ) ) . '" target="_blank">/pos/agents/</a>.</p>';
		}
		PPC_Admin_UI::card_close();

		// Activity feed.
		$ev = $wpdb->get_results( 'SELECT * FROM ' . PPC_Util::t( 'events' ) . ' ORDER BY id DESC LIMIT 8' );
		PPC_Admin_UI::card_open( 'Recent activity' );
		if ( $ev ) {
			echo '<ul class="ppc-feed">';
			foreach ( $ev as $e ) {
				echo '<li class="ppc-feed--' . esc_attr( strtok( $e->kind, '.' ) ) . '"><span>' . esc_html( $e->message ) . '</span><time>' . esc_html( PPC_Util::ago( $e->created_at ) ) . '</time></li>';
			}
			echo '</ul>';
		} else {
			echo '<p class="ppc-mute ppc-pad">Activity will appear here.</p>';
		}
		PPC_Admin_UI::card_close();
		echo '</div>';

		PPC_Admin_UI::close();
	}

	/* =================================================================== */
	/* Businesses                                                           */
	/* =================================================================== */

	public static function businesses() {
		$id = self::q( 'id' );
		if ( $id ) {
			self::business_detail( $id );
			return;
		}
		global $wpdb;
		$tn    = PPC_Util::t( 'tenants' );
		$where = array( '1=1' );
		$s     = self::q( 's' );
		if ( '' !== $s ) {
			$like    = '%' . $wpdb->esc_like( $s ) . '%';
			$phone   = PPC_Util::phone( $s );
			$where[] = $wpdb->prepare( '(t.business_name LIKE %s OR t.code LIKE %s OR t.owner_name LIKE %s OR t.email LIKE %s OR t.town LIKE %s OR t.phone LIKE %s)', $like, $like, $like, $like, $like, $phone ? $phone : $like );
		}
		$status = self::q( 'status' );
		if ( $status ) {
			$where[] = self::status_sql( $status );
		}
		$agent = (int) self::q( 'agent' );
		if ( $agent ) {
			$where[] = $wpdb->prepare( 't.agent_id = %d', $agent );
		}
		$plan = self::q( 'plan' );
		if ( $plan ) {
			$where[] = $wpdb->prepare( 't.plan = %s', $plan );
		}
		$w     = implode( ' AND ', $where );
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $tn t WHERE $w" ); // phpcs:ignore
		$off   = ( PPC_Admin_UI::paged() - 1 ) * PPC_Admin_UI::PER_PAGE;
		$rows  = $wpdb->get_results( "SELECT t.*, a.name AS agent_name, a.code AS agent_code FROM $tn t LEFT JOIN " . PPC_Util::t( 'agents' ) . " a ON a.id = t.agent_id WHERE $w ORDER BY t.created_at DESC LIMIT $off, " . PPC_Admin_UI::PER_PAGE ); // phpcs:ignore

		PPC_Admin_UI::open( 'Businesses', 'Every business using Pentarch POS — trials and paying clients.', PPC_Admin_UI::link_btn( PPC_Admin::export_url( 'businesses' ), 'Export CSV' ) );
		PPC_Admin_UI::filters(
			'ppc-businesses',
			'Search name, code, owner, phone, email, town…',
			array(
				'status' => array( 'All statuses', array_merge( PPC_Licence::statuses(), array( 'expiring' => 'Ending within 7 days' ) ) ),
				'plan'   => array( 'All plans', PPC_Licence::plans() ),
				'agent'  => array( 'All agents', array_slice( PPC_Admin_UI::agent_options(), 1, null, true ) ),
			)
		);
		if ( ! $rows ) {
			PPC_Admin_UI::empty_state( 'No businesses found', '' !== $s || $status ? 'Try a different search or filter.' : 'Businesses appear here when they start a trial in the POS app or through an agent.' );
		} else {
			echo '<div class="ppc-table-wrap"><table class="ppc-table"><thead><tr><th>Business</th><th>Owner</th><th>Town</th><th>Licence</th><th>Plan</th><th>Agent</th><th>Last sync</th><th>Joined</th></tr></thead><tbody>';
			foreach ( $rows as $t ) {
				$url = PPC_Admin_UI::url( 'ppc-businesses', array( 'id' => $t->id ) );
				echo '<tr><td><a class="ppc-strong" href="' . esc_url( $url ) . '">' . esc_html( $t->business_name ) . '</a><span class="ppc-cell-hint"><code>' . esc_html( $t->code ) . '</code> ' . esc_html( PPC_Tenants::type_label( $t->business_type ) ) . ( $t->is_test ? ' · test' : '' ) . '</span></td>';
				echo '<td>' . esc_html( $t->owner_name ) . '<span class="ppc-cell-hint">' . PPC_Admin_UI::phone_link( $t->phone ) . '</span></td>'; // phpcs:ignore
				echo '<td>' . esc_html( $t->town ? $t->town : '—' ) . '<span class="ppc-cell-hint">' . esc_html( $t->county ) . '</span></td>';
				echo '<td>' . self::licence_cell( $t ) . '</td>'; // phpcs:ignore
				echo '<td>' . esc_html( isset( PPC_Licence::plans()[ $t->plan ] ) ? PPC_Licence::plans()[ $t->plan ] : $t->plan ) . '</td>';
				echo '<td>' . ( $t->agent_name ? '<a href="' . esc_url( PPC_Admin_UI::url( 'ppc-agents', array( 'id' => $t->agent_id ) ) ) . '">' . esc_html( $t->agent_name ) . '</a><span class="ppc-cell-hint">' . esc_html( $t->agent_code ) . '</span>' : '<span class="ppc-mute">Direct</span>' ) . '</td>';
				echo '<td class="ppc-mute">' . esc_html( PPC_Util::ago( $t->last_sync_at ) ) . '</td>';
				echo '<td class="ppc-mute">' . esc_html( PPC_Util::fmt_date( $t->created_at ) ) . '</td></tr>';
			}
			echo '</tbody></table></div>';
			PPC_Admin_UI::pager( $total );
		}
		PPC_Admin_UI::close();
	}

	private static function business_detail( $id ) {
		global $wpdb;
		$t = PPC_Tenants::get( $id );
		if ( ! $t ) {
			PPC_Admin_UI::open( 'Business not found', '', '', array( 'Businesses', PPC_Admin_UI::url( 'ppc-businesses' ) ) );
			PPC_Admin_UI::close();
			return;
		}
		$c     = PPC_Licence::compute( $t );
		$agent = $t->agent_id ? PPC_Agents::get( $t->agent_id ) : null;
		$usage = PPC_Tenants::usage( $t->id );
		$tid   = array( 'tenant_id' => $t->id );

		$wa_text = 'Hello ' . PPC_Util::first_name( $t->owner_name ) . ', this is Pentarch Systems Solutions about your Pentarch POS account (' . $t->code . ').';
		$actions = PPC_Admin_UI::link_btn( PPC_Util::wa_link( $t->phone, $wa_text ), 'WhatsApp owner', 'wa', 'target="_blank" rel="noopener"' )
			. PPC_Admin_UI::link_btn( 'mailto:' . $t->email, 'Email' )
			. PPC_Admin_UI::link_btn( PPC_Admin::export_url( 'tenant_records', $tid ), 'Export data (JSON)' );
		PPC_Admin_UI::open( $t->business_name, '<code>' . esc_html( $t->code ) . '</code> · ' . esc_html( PPC_Tenants::type_label( $t->business_type ) ) . ' · ' . esc_html( trim( $t->town . ', ' . $t->county, ', ' ) ) . ' · ' . PPC_Admin_UI::badge( $c['status'] ), $actions, array( 'Businesses', PPC_Admin_UI::url( 'ppc-businesses' ) ) );

		echo '<div class="ppc-kpis ppc-kpis--sm">';
		PPC_Admin_UI::kpi( 'Licence', PPC_Licence::statuses()[ $c['status'] ], $c['days_left'] ? $c['days_left'] . ' days left' : ( 'suspended' === $c['status'] ? $t->suspended_reason : 'Renew to continue selling' ), 'active' === $c['status'] ? 'teal' : ( 'trial' === $c['status'] ? 'sun' : 'coral' ) );
		PPC_Admin_UI::kpi( 'Sales — 30 days', PPC_Util::kes( $usage['sales_30d'] ), number_format( $usage['sales_30d_n'] ) . ' receipts synced', 'navy' );
		PPC_Admin_UI::kpi( 'Records in cloud', number_format( $usage['records'] ), count( $usage['branches'] ) . ' branch(es)', '' );
		PPC_Admin_UI::kpi( 'Last sync', PPC_Util::ago( $t->last_sync_at ), $t->last_ip ? 'from ' . $t->last_ip : '', '' );
		echo '</div>';

		echo '<div class="ppc-grid ppc-grid--detail"><div class="ppc-col">';

		// Licence & payment.
		echo '<span id="pay" class="ppc-anchor"></span>';
		PPC_Admin_UI::card_open( 'Record a payment', '', 'ppc-card--accent' );
		$types = PPC_Payments::types();
		echo PPC_Admin_UI::form_open( 'record_payment', $tid, 'ppc-form ppc-pay-form' ); // phpcs:ignore
		echo '<div class="ppc-form__grid">';
		echo '<label class="ppc-field ppc-field--full"><span>Paid for</span><select name="type" data-pay-type>';
		foreach ( $types as $k => $d ) {
			echo '<option value="' . esc_attr( $k ) . '">' . esc_html( $d['label'] ) . '</option>';
		}
		echo '</select></label>';
		echo '<label class="ppc-field"><span>Quantity <em data-pay-unit>months</em></span><input type="number" name="qty" value="1" min="1" max="100" data-pay-qty></label>';
		echo '<label class="ppc-field"><span>Amount paid (KES)</span><input type="number" name="amount" min="1" step="1" required data-pay-amount></label>';
		echo '<label class="ppc-field"><span>Method</span>' . PPC_Admin_UI::select( 'method', PPC_Payments::methods(), 'mpesa' ) . '</label>'; // phpcs:ignore
		echo '<label class="ppc-field"><span>Reference (M-Pesa code)</span><input type="text" name="ref" maxlength="100" placeholder="e.g. SKL4X2ABCD" style="text-transform:uppercase"></label>';
		echo '<label class="ppc-field"><span>Date paid</span><input type="date" name="paid_at" value="' . esc_attr( wp_date( 'Y-m-d' ) ) . '" max="' . esc_attr( wp_date( 'Y-m-d' ) ) . '"></label>';
		echo '<label class="ppc-field"><span>Licence months added</span><input type="number" name="months" min="0" max="120" placeholder="auto" data-pay-months></label>';
		echo '<label class="ppc-field ppc-field--full ppc-check" data-pay-branch hidden><input type="checkbox" name="add_branches" value="1" checked> Also raise the branch limit by the quantity</label>';
		echo '<label class="ppc-field ppc-field--full"><span>Note</span><input type="text" name="note" maxlength="255"></label>';
		echo '</div><p class="ppc-help" data-pay-summary></p>';
		echo '<p class="ppc-help">' . ( $agent ? 'Commission for <strong>' . esc_html( $agent->name ) . '</strong> is created automatically.' : 'No agent is attributed — no commission will be created.' ) . '</p>';
		echo '<button class="ppc-btn ppc-btn--primary" type="submit">Record payment</button></form>';
		PPC_Admin_UI::card_close();

		PPC_Admin_UI::card_open( 'Licence' );
		PPC_Admin_UI::dl(
			array(
				'Status'       => PPC_Admin_UI::badge( $c['status'] ) . ( $c['days_left'] ? ' <span class="ppc-mute">' . (int) $c['days_left'] . ' days left</span>' : '' ),
				'Plan'         => esc_html( isset( PPC_Licence::plans()[ $t->plan ] ) ? PPC_Licence::plans()[ $t->plan ] : $t->plan ),
				'Trial ends'   => esc_html( PPC_Util::fmt_date( $t->trial_ends, true ) ),
				'Paid until'   => esc_html( PPC_Util::fmt_date( $t->paid_until, true ) ),
				'Grace ends'   => $c['grace_end'] ? esc_html( PPC_Util::fmt_date( PPC_Util::dt( $c['grace_end'] ), true ) ) : '',
				'Limits'       => esc_html( $t->max_branches . ' branch(es) · ' . $t->max_devices . ' devices' ),
				'Paybill / account' => esc_html( ( PPC_Settings::get( 'paybill' ) ? PPC_Settings::get( 'paybill' ) : 'not set' ) . ' / ' . PPC_Licence::account_ref( $t ) ),
			)
		);
		echo '<div class="ppc-actions-row">';
		echo PPC_Admin_UI::form_open( 'extend_trial', $tid, 'ppc-inline ppc-inline--field' ) . '<input type="number" name="days" value="7" min="1" max="365" aria-label="Days"><button class="ppc-btn ppc-btn--secondary">Extend trial (days)</button></form>'; // phpcs:ignore
		if ( $t->suspended ) {
			echo PPC_Admin_UI::button_form( 'unsuspend', 'Reactivate', $tid, 'secondary' ); // phpcs:ignore
		} else {
			echo PPC_Admin_UI::form_open( 'suspend', $tid, 'ppc-inline ppc-inline--field' ) . '<input type="text" name="reason" placeholder="Reason (optional)" maxlength="190"><button class="ppc-btn ppc-btn--danger" data-confirm="Suspend this business? They can still view and export their data, but cannot sell.">Suspend</button></form>'; // phpcs:ignore
		}
		echo '</div>';
		echo '<details class="ppc-details"><summary>Edit plan, dates and limits</summary>';
		echo PPC_Admin_UI::form_open( 'edit_licence', $tid, 'ppc-form' ) . '<div class="ppc-form__grid">'; // phpcs:ignore
		echo '<label class="ppc-field"><span>Plan</span>' . PPC_Admin_UI::select( 'plan', PPC_Licence::plans(), $t->plan ) . '</label>'; // phpcs:ignore
		echo '<label class="ppc-field"><span>Trial ends</span><input type="date" name="trial_ends" value="' . esc_attr( $t->trial_ends ? substr( $t->trial_ends, 0, 10 ) : '' ) . '"></label>';
		echo '<label class="ppc-field"><span>Paid until</span><input type="date" name="paid_until" value="' . esc_attr( $t->paid_until ? substr( $t->paid_until, 0, 10 ) : '' ) . '"></label>';
		echo '<label class="ppc-field"><span>Max branches</span><input type="number" name="max_branches" min="1" value="' . (int) $t->max_branches . '"></label>';
		echo '<label class="ppc-field"><span>Max devices</span><input type="number" name="max_devices" min="1" value="' . (int) $t->max_devices . '"></label>';
		echo '</div><button class="ppc-btn ppc-btn--secondary">Save licence</button></form></details>';
		PPC_Admin_UI::card_close();

		// Payments.
		$pays = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'payments' ) . ' WHERE tenant_id = %s ORDER BY paid_at DESC', $t->id ) );
		PPC_Admin_UI::card_open( 'Payments' );
		if ( $pays ) {
			echo '<table class="ppc-mini"><thead><tr><th>Date</th><th>For</th><th class="num">Amount</th><th>Ref</th><th>Period</th></tr></thead><tbody>';
			foreach ( $pays as $p ) {
				echo '<tr><td>' . esc_html( PPC_Util::fmt_date( $p->paid_at ) ) . '</td><td>' . esc_html( PPC_Payments::type_label( $p->type ) ) . ( $p->bundles > 1 ? ' ×' . (int) $p->bundles : '' ) . '</td><td class="num">' . esc_html( PPC_Util::kes( $p->amount ) ) . '</td><td><code>' . esc_html( $p->ref ? $p->ref : '—' ) . '</code></td><td class="ppc-mute">' . ( $p->period_to ? esc_html( PPC_Util::fmt_date( $p->period_from ) . ' → ' . PPC_Util::fmt_date( $p->period_to ) ) : '—' ) . '</td></tr>';
			}
			echo '</tbody></table>';
		} else {
			echo '<p class="ppc-mute ppc-pad">No payments yet.</p>';
		}
		PPC_Admin_UI::card_close();

		// Devices.
		$devs = PPC_Tenants::devices( $t->id );
		PPC_Admin_UI::card_open( 'Devices', '<span class="ppc-mute">' . count( $devs ) . '</span>' );
		if ( $devs ) {
			echo '<table class="ppc-mini"><thead><tr><th>Device</th><th>Signed in</th><th>Last seen</th><th></th></tr></thead><tbody>';
			foreach ( $devs as $d ) {
				echo '<tr' . ( $d->revoked_at ? ' class="is-muted"' : '' ) . '><td><strong>' . esc_html( $d->name ) . '</strong><span class="ppc-cell-hint">' . esc_html( self::ua_label( $d->user_agent ) . ( $d->last_ip ? ' · ' . $d->last_ip : '' ) ) . '</span></td><td>' . esc_html( PPC_Util::fmt_date( $d->created_at ) ) . '</td><td>' . esc_html( PPC_Util::ago( $d->last_seen ) ) . '</td><td class="right">';
				echo $d->revoked_at ? '<span class="ppc-mute">Signed out</span>' : PPC_Admin_UI::button_form( 'revoke_device', 'Sign out', array_merge( $tid, array( 'device_row' => $d->id ) ), 'ghost', 'Sign this device out? It will need the owner\'s email and password again.' ); // phpcs:ignore
				echo '</td></tr>';
			}
			echo '</tbody></table>';
		} else {
			echo '<p class="ppc-mute ppc-pad">No devices signed in yet.</p>';
		}
		PPC_Admin_UI::card_close();

		echo '</div><div class="ppc-col">';

		PPC_Admin_UI::card_open( 'Business details' );
		PPC_Admin_UI::dl(
			array(
				'Owner'    => esc_html( $t->owner_name ),
				'Phone'    => PPC_Admin_UI::phone_link( $t->phone ),
				'Email'    => '<a href="mailto:' . esc_attr( $t->email ) . '">' . esc_html( $t->email ) . '</a>',
				'Location' => esc_html( trim( $t->town . ', ' . $t->county, ', ' ) ),
				'Source'   => esc_html( ucfirst( $t->source ) ),
				'Joined'   => esc_html( PPC_Util::fmt_date( $t->created_at, true ) ),
				'Tenant ID' => '<code class="ppc-small">' . esc_html( $t->id ) . '</code>',
			)
		);
		echo '<div class="ppc-actions-row">' . PPC_Admin_UI::button_form( 'reset_password', 'Reset owner password', $tid, 'secondary', 'Generate a new password for the owner? The old one stops working immediately.' ) . '</div>'; // phpcs:ignore
		PPC_Admin_UI::card_close();

		PPC_Admin_UI::card_open( 'Sales agent' );
		echo $agent ? '<p class="ppc-pad-b"><a class="ppc-strong" href="' . esc_url( PPC_Admin_UI::url( 'ppc-agents', array( 'id' => $agent->id ) ) ) . '">' . esc_html( $agent->name ) . '</a> <code>' . esc_html( $agent->code ) . '</code></p>' : '<p class="ppc-mute ppc-pad-b">Came directly (no agent).</p>'; // phpcs:ignore
		echo PPC_Admin_UI::form_open( 'tenant_agent', $tid, 'ppc-inline ppc-inline--field' ) . PPC_Admin_UI::select( 'new_agent_id', PPC_Admin_UI::agent_options( '— No agent —' ), $t->agent_id ) . '<button class="ppc-btn ppc-btn--secondary">Change</button></form>'; // phpcs:ignore
		PPC_Admin_UI::card_close();

		PPC_Admin_UI::card_open( 'Usage' );
		if ( $usage['branches'] ) {
			echo '<p class="ppc-label">Branches</p><ul class="ppc-chips">';
			foreach ( $usage['branches'] as $b ) {
				echo '<li>' . esc_html( ( isset( $b['name'] ) ? $b['name'] : 'Branch' ) . ( ! empty( $b['code'] ) ? ' (' . $b['code'] . ')' : '' ) ) . '</li>';
			}
			echo '</ul>';
		}
		if ( $usage['counts'] ) {
			arsort( $usage['counts'] );
			echo '<table class="ppc-mini"><tbody>';
			foreach ( array_slice( $usage['counts'], 0, 12, true ) as $ent => $n ) {
				echo '<tr><td>' . esc_html( ucwords( str_replace( '_', ' ', $ent ) ) ) . '</td><td class="num">' . esc_html( number_format( $n ) ) . '</td></tr>';
			}
			echo '</tbody></table>';
		} else {
			echo '<p class="ppc-mute ppc-pad">Nothing synced yet.</p>';
		}
		PPC_Admin_UI::card_close();

		$mp = json_decode( (string) $t->mpesa_config, true );
		$mp = is_array( $mp ) ? $mp : array();
		PPC_Admin_UI::card_open( 'M-Pesa STK push for sales' );
		echo '<p class="ppc-help ppc-pad-b">Optional. With the business\'s own Daraja app keys, the POS can send an M-Pesa prompt to customers at the till. Money goes to the business\'s own Paybill/Till.</p>';
		echo '<details class="ppc-details"' . ( $mp ? ' open' : '' ) . '><summary>' . ( $mp ? 'Configured — edit' : 'Set up' ) . '</summary>';
		echo PPC_Admin_UI::form_open( 'tenant_mpesa', $tid, 'ppc-form' ) . '<div class="ppc-form__grid">'; // phpcs:ignore
		$g = function ( $k, $d = '' ) use ( $mp ) {
			return isset( $mp[ $k ] ) ? $mp[ $k ] : $d;
		};
		echo '<label class="ppc-field"><span>Environment</span>' . PPC_Admin_UI::select( 'mp_env', array( 'sandbox' => 'Sandbox (testing)', 'production' => 'Production (live)' ), $g( 'env', 'sandbox' ) ) . '</label>'; // phpcs:ignore
		echo '<label class="ppc-field"><span>Type</span>' . PPC_Admin_UI::select( 'mp_type', array( 'paybill' => 'Paybill', 'till' => 'Buy Goods (Till)' ), $g( 'type', 'paybill' ) ) . '</label>'; // phpcs:ignore
		echo '<label class="ppc-field"><span>Shortcode</span><input type="text" name="mp_shortcode" value="' . esc_attr( $g( 'shortcode' ) ) . '"></label>';
		echo '<label class="ppc-field"><span>Till number (Buy Goods)</span><input type="text" name="mp_till" value="' . esc_attr( $g( 'till' ) ) . '"></label>';
		echo '<label class="ppc-field ppc-field--full"><span>Consumer key</span><input type="text" name="mp_consumer_key" value="' . esc_attr( $g( 'consumer_key' ) ) . '" autocomplete="off"></label>';
		echo '<label class="ppc-field"><span>Consumer secret</span><input type="password" name="mp_consumer_secret" value="' . ( $g( 'consumer_secret' ) ? '********' : '' ) . '" autocomplete="new-password"></label>';
		echo '<label class="ppc-field"><span>Passkey</span><input type="password" name="mp_passkey" value="' . ( $g( 'passkey' ) ? '********' : '' ) . '" autocomplete="new-password"></label>';
		echo '</div><button class="ppc-btn ppc-btn--secondary">Save M-Pesa settings</button></form></details>';
		PPC_Admin_UI::card_close();

		PPC_Admin_UI::card_open( 'Internal notes' );
		echo PPC_Admin_UI::form_open( 'tenant_notes', $tid, 'ppc-form' ) . '<textarea name="notes" rows="4" class="ppc-textarea" placeholder="Visible to Pentarch staff only">' . esc_textarea( (string) $t->notes ) . '</textarea>'; // phpcs:ignore
		echo '<label class="ppc-check"><input type="checkbox" name="is_test" value="1"' . checked( (int) $t->is_test, 1, false ) . '> Test / demo business (excluded from KPIs, removable in Tools)</label>';
		echo '<button class="ppc-btn ppc-btn--secondary">Save notes</button></form>';
		PPC_Admin_UI::card_close();

		echo '</div></div>';
		PPC_Admin_UI::close();
	}

	private static function ua_label( $ua ) {
		if ( ! $ua ) {
			return 'Unknown device';
		}
		$os = preg_match( '/Android/i', $ua ) ? 'Android' : ( preg_match( '/iPhone|iPad/i', $ua ) ? 'iOS' : ( preg_match( '/Windows/i', $ua ) ? 'Windows' : ( preg_match( '/Mac OS/i', $ua ) ? 'macOS' : ( preg_match( '/Linux/i', $ua ) ? 'Linux' : 'Other' ) ) ) );
		$br = preg_match( '/Edg\//', $ua ) ? 'Edge' : ( preg_match( '/Chrome\//', $ua ) ? 'Chrome' : ( preg_match( '/Firefox\//', $ua ) ? 'Firefox' : ( preg_match( '/Safari\//', $ua ) ? 'Safari' : 'Browser' ) ) );
		return $br . ' on ' . $os;
	}

	/* =================================================================== */
	/* Agents                                                               */
	/* =================================================================== */

	public static function agents() {
		$id = (int) self::q( 'id' );
		if ( $id ) {
			self::agent_detail( $id );
			return;
		}
		global $wpdb;
		$at    = PPC_Util::t( 'agents' );
		$where = array( '1=1' );
		$s     = self::q( 's' );
		if ( '' !== $s ) {
			$like    = '%' . $wpdb->esc_like( $s ) . '%';
			$where[] = $wpdb->prepare( '(a.name LIKE %s OR a.code LIKE %s OR a.email LIKE %s OR a.town LIKE %s OR a.phone LIKE %s)', $like, $like, $like, $like, PPC_Util::phone( $s ) ? PPC_Util::phone( $s ) : $like );
		}
		$st = self::q( 'status' );
		if ( in_array( $st, array( 'pending', 'active', 'suspended' ), true ) ) {
			$where[] = $wpdb->prepare( 'a.status = %s', $st );
		}
		$w     = implode( ' AND ', $where );
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $at a WHERE $w" ); // phpcs:ignore
		$off   = ( PPC_Admin_UI::paged() - 1 ) * PPC_Admin_UI::PER_PAGE;
		$rows  = $wpdb->get_results(
			"SELECT a.*,
			(SELECT COUNT(*) FROM " . PPC_Util::t( 'leads' ) . " l WHERE l.agent_id = a.id AND l.deleted = 0) AS leads,
			(SELECT COUNT(*) FROM " . PPC_Util::t( 'tenants' ) . " t WHERE t.agent_id = a.id) AS trials,
			(SELECT COUNT(*) FROM " . PPC_Util::t( 'tenants' ) . " t2 WHERE t2.agent_id = a.id AND t2.first_paid_at IS NOT NULL) AS won,
			(SELECT COALESCE(SUM(c.amount),0) FROM " . PPC_Util::t( 'commissions' ) . " c WHERE c.agent_id = a.id AND c.status IN ('pending','approved')) AS owed
			FROM $at a WHERE $w ORDER BY (a.status = 'pending') DESC, a.created_at DESC LIMIT $off, " . PPC_Admin_UI::PER_PAGE // phpcs:ignore
		);

		PPC_Admin_UI::open( 'Agents', 'Field sales agents. Approve new sign-ups, set rates and track their pipeline.', PPC_Admin_UI::link_btn( home_url( '/pos/agents/' ), 'Agent portal', 'secondary', 'target="_blank" rel="noopener"' ) . PPC_Admin_UI::link_btn( PPC_Admin::export_url( 'agents' ), 'Export CSV' ) );
		PPC_Admin_UI::filters(
			'ppc-agents',
			'Search name, code, phone, email, town…',
			array(
				'status' => array(
					'All statuses',
					array(
						'pending'   => 'Waiting for approval',
						'active'    => 'Active',
						'suspended' => 'Suspended',
					),
				),
			)
		);
		if ( ! $rows ) {
			PPC_Admin_UI::empty_state( 'No agents yet', 'Agents sign up in the agent portal at /pos/agents/. You will get an email for each new sign-up.' );
		} else {
			echo '<div class="ppc-table-wrap"><table class="ppc-table"><thead><tr><th>Agent</th><th>Phone</th><th>Town</th><th>Status</th><th class="num">Leads</th><th class="num">Trials</th><th class="num">Won</th><th class="num">Owed</th><th>Last seen</th><th></th></tr></thead><tbody>';
			foreach ( $rows as $a ) {
				$url = PPC_Admin_UI::url( 'ppc-agents', array( 'id' => $a->id ) );
				echo '<tr><td><a class="ppc-strong" href="' . esc_url( $url ) . '">' . esc_html( $a->name ) . '</a><span class="ppc-cell-hint"><code>' . esc_html( $a->code ) . '</code> ' . esc_html( $a->email ) . '</span></td>';
				echo '<td>' . PPC_Admin_UI::phone_link( $a->phone ) . '</td><td>' . esc_html( $a->town ? $a->town : '—' ) . '</td><td>' . PPC_Admin_UI::badge( $a->status, 'pending' === $a->status ? 'Waiting approval' : null ) . '</td>'; // phpcs:ignore
				echo '<td class="num">' . (int) $a->leads . '</td><td class="num">' . (int) $a->trials . '</td><td class="num">' . (int) $a->won . '</td><td class="num">' . esc_html( PPC_Util::kes( $a->owed, false ) ) . '</td><td class="ppc-mute">' . esc_html( PPC_Util::ago( $a->last_seen ) ) . '</td>';
				echo '<td class="right">' . ( 'pending' === $a->status ? PPC_Admin_UI::button_form( 'agent_status', 'Approve', array( 'agent_id' => $a->id, 'status' => 'active' ), 'primary' ) : '' ) . '</td></tr>'; // phpcs:ignore
			}
			echo '</tbody></table></div>';
			PPC_Admin_UI::pager( $total );
		}
		PPC_Admin_UI::close();
	}

	private static function agent_detail( $id ) {
		global $wpdb;
		$a = PPC_Agents::get( $id );
		if ( ! $a ) {
			PPC_Admin_UI::open( 'Agent not found', '', '', array( 'Agents', PPC_Admin_UI::url( 'ppc-agents' ) ) );
			PPC_Admin_UI::close();
			return;
		}
		$s     = PPC_Agents::stats( $a->id );
		$rates = PPC_Agents::rates( $a );
		$aid   = array( 'agent_id' => $a->id );

		$actions = PPC_Admin_UI::link_btn( PPC_Util::wa_link( $a->phone, 'Hello ' . PPC_Util::first_name( $a->name ) . ', this is Pentarch Systems Solutions.' ), 'WhatsApp', 'wa', 'target="_blank" rel="noopener"' );
		if ( 'pending' === $a->status ) {
			$actions .= PPC_Admin_UI::button_form( 'agent_status', 'Approve agent', array_merge( $aid, array( 'status' => 'active' ) ), 'primary' );
		} elseif ( 'active' === $a->status ) {
			$actions .= PPC_Admin_UI::button_form( 'agent_status', 'Suspend', array_merge( $aid, array( 'status' => 'suspended' ) ), 'danger', 'Suspend this agent? They are signed out and cannot add leads.' );
		} else {
			$actions .= PPC_Admin_UI::button_form( 'agent_status', 'Reactivate', array_merge( $aid, array( 'status' => 'active' ) ), 'secondary' );
		}
		PPC_Admin_UI::open( $a->name, '<code>' . esc_html( $a->code ) . '</code> · ' . esc_html( trim( $a->town . ', ' . $a->county, ', ' ) ) . ' · ' . PPC_Admin_UI::badge( $a->status, 'pending' === $a->status ? 'Waiting approval' : null ), $actions, array( 'Agents', PPC_Admin_UI::url( 'ppc-agents' ) ) );

		echo '<div class="ppc-kpis ppc-kpis--sm">';
		PPC_Admin_UI::kpi( 'Leads', number_format( array_sum( $s['leads_by_stage'] ) ), $s['leads_by_stage']['won'] . ' won · ' . $s['leads_by_stage']['lost'] . ' lost', 'navy' );
		PPC_Admin_UI::kpi( 'Won this month', number_format( $s['won_this_month'] ), 'first payments', 'teal' );
		PPC_Admin_UI::kpi( 'Commission owed', PPC_Util::kes( $s['commission']['pending'] + $s['commission']['approved'] ), PPC_Util::kes( $s['commission']['pending'] ) . ' pending approval', 'sun' );
		PPC_Admin_UI::kpi( 'Commission paid', PPC_Util::kes( $s['commission']['paid'] ), 'all time', '' );
		echo '</div>';

		// Pipeline bar.
		$total = max( 1, array_sum( $s['leads_by_stage'] ) );
		echo '<div class="ppc-pipeline" role="list">';
		foreach ( PPC_Agents::stage_labels() as $k => $l ) {
			$n = $s['leads_by_stage'][ $k ];
			echo '<a role="listitem" class="ppc-pipeline__s ppc-stage--' . esc_attr( $k ) . '" style="flex-grow:' . esc_attr( max( 0.6, $n / $total * 10 ) ) . '" href="' . esc_url( PPC_Admin_UI::url( 'ppc-leads', array( 'agent' => $a->id, 'stage' => $k ) ) ) . '"><strong>' . (int) $n . '</strong><span>' . esc_html( $l ) . '</span></a>';
		}
		echo '</div>';

		echo '<div class="ppc-grid ppc-grid--detail"><div class="ppc-col">';

		// Commissions.
		$coms = $wpdb->get_results( $wpdb->prepare( 'SELECT c.*, t.business_name, t.code FROM ' . PPC_Util::t( 'commissions' ) . ' c LEFT JOIN ' . PPC_Util::t( 'tenants' ) . ' t ON t.id = c.tenant_id WHERE c.agent_id = %d ORDER BY c.created_at DESC LIMIT 100', $a->id ) );
		PPC_Admin_UI::card_open( 'Commissions', '<a class="ppc-link" href="' . esc_url( PPC_Admin_UI::url( 'ppc-commissions', array( 'agent' => $a->id ) ) ) . '">Manage</a>' );
		self::commission_table( $coms, false );
		PPC_Admin_UI::card_close();

		// Businesses brought in.
		$tens = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'tenants' ) . ' WHERE agent_id = %d ORDER BY created_at DESC LIMIT 50', $a->id ) );
		PPC_Admin_UI::card_open( 'Businesses brought in', '<span class="ppc-mute">' . count( $tens ) . '</span>' );
		if ( $tens ) {
			echo '<table class="ppc-mini"><thead><tr><th>Business</th><th>Licence</th><th>Joined</th></tr></thead><tbody>';
			foreach ( $tens as $t ) {
				echo '<tr><td><a href="' . esc_url( PPC_Admin_UI::url( 'ppc-businesses', array( 'id' => $t->id ) ) ) . '">' . esc_html( $t->business_name ) . '</a><span class="ppc-cell-hint">' . esc_html( $t->code . ' · ' . $t->town ) . '</span></td><td>' . self::licence_cell( $t ) . '</td><td class="ppc-mute">' . esc_html( PPC_Util::fmt_date( $t->created_at ) ) . '</td></tr>'; // phpcs:ignore
			}
			echo '</tbody></table>';
		} else {
			echo '<p class="ppc-mute ppc-pad">No trials started yet.</p>';
		}
		PPC_Admin_UI::card_close();

		// Recent leads.
		$leads = $wpdb->get_results( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'leads' ) . ' WHERE agent_id = %d AND deleted = 0 ORDER BY updated_at DESC LIMIT 12', $a->id ) );
		PPC_Admin_UI::card_open( 'Latest leads', '<a class="ppc-link" href="' . esc_url( PPC_Admin_UI::url( 'ppc-leads', array( 'agent' => $a->id ) ) ) . '">All leads</a>' );
		if ( $leads ) {
			echo '<table class="ppc-mini"><thead><tr><th>Business</th><th>Stage</th><th>Follow-up</th></tr></thead><tbody>';
			foreach ( $leads as $l ) {
				echo '<tr><td><a href="' . esc_url( PPC_Admin_UI::url( 'ppc-leads', array( 'agent' => $a->id, 'lead' => $l->lead_id ) ) ) . '">' . esc_html( $l->business_name ) . '</a><span class="ppc-cell-hint">' . esc_html( $l->contact_name . ' · ' . $l->town ) . '</span></td><td>' . PPC_Admin_UI::badge( $l->stage ) . '</td><td class="ppc-mute">' . esc_html( $l->next_follow_up ? wp_date( 'j M', strtotime( $l->next_follow_up ) ) : '—' ) . '</td></tr>'; // phpcs:ignore
			}
			echo '</tbody></table>';
		} else {
			echo '<p class="ppc-mute ppc-pad">No leads yet.</p>';
		}
		PPC_Admin_UI::card_close();

		echo '</div><div class="ppc-col">';
		PPC_Admin_UI::card_open( 'Profile' );
		PPC_Admin_UI::dl(
			array(
				'Agent code'     => '<code>' . esc_html( $a->code ) . '</code>',
				'Phone'          => PPC_Admin_UI::phone_link( $a->phone ),
				'M-Pesa'         => esc_html( PPC_Util::phone_pretty( $a->mpesa_phone ) ),
				'Email'          => '<a href="mailto:' . esc_attr( $a->email ) . '">' . esc_html( $a->email ) . '</a>',
				'Heard about us' => esc_html( $a->heard_from ),
				'Joined'         => esc_html( PPC_Util::fmt_date( $a->created_at, true ) ),
				'Approved'       => esc_html( $a->approved_at ? PPC_Util::fmt_date( $a->approved_at ) : '' ),
				'Last seen'      => esc_html( PPC_Util::ago( $a->last_seen ) ),
				'Demo link'      => '<a class="ppc-small" target="_blank" href="' . esc_url( PPC_Settings::pos_url( array( 'demo' => 1, 'ref' => $a->code ) ) ) . '">' . esc_html( str_replace( array( 'https://', 'http://' ), '', PPC_Settings::pos_url( array( 'demo' => 1, 'ref' => $a->code ) ) ) ) . '</a>',
			)
		);
		PPC_Admin_UI::card_close();

		PPC_Admin_UI::card_open( 'Commission rates' );
		echo PPC_Admin_UI::form_open( 'agent_rates', $aid, 'ppc-form' ) . '<div class="ppc-form__grid">'; // phpcs:ignore
		echo '<label class="ppc-field"><span>Software %</span><input type="number" step="0.5" min="0" max="100" name="software_rate" value="' . esc_attr( null !== $a->software_rate ? (float) $a->software_rate : '' ) . '" placeholder="' . esc_attr( (float) PPC_Settings::get( 'software_rate' ) ) . ' (default)"></label>';
		echo '<label class="ppc-field"><span>Complete Till bonus (KES)</span><input type="number" min="0" name="bundle_bonus" value="' . esc_attr( null !== $a->bundle_bonus ? (int) $a->bundle_bonus : '' ) . '" placeholder="' . esc_attr( (int) PPC_Settings::get( 'bonus_complete_till' ) ) . ' (default)"></label>';
		echo '<label class="ppc-field ppc-field--full"><span>M-Pesa number for payouts</span><input type="tel" name="mpesa_phone" value="' . esc_attr( $a->mpesa_phone ) . '"></label>';
		echo '<label class="ppc-field ppc-field--full"><span>Internal notes</span><textarea name="notes" rows="3" class="ppc-textarea">' . esc_textarea( (string) $a->notes ) . '</textarea></label>';
		echo '</div><p class="ppc-help">Effective: ' . esc_html( $rates['software_rate'] . '% of software payments for ' . $rates['commission_months'] . ' months · Complete Till ' . PPC_Util::kes( $rates['bonus_complete_till'] * 100 ) . ' · Software + Setup ' . PPC_Util::kes( $rates['bonus_software_setup'] * 100 ) . ' · Counter Kit ' . PPC_Util::kes( $rates['bonus_counter_kit'] * 100 ) ) . '. Leave blank to use the defaults in Settings.</p>';
		echo '<button class="ppc-btn ppc-btn--secondary">Save</button></form>';
		PPC_Admin_UI::card_close();
		echo '</div></div>';
		PPC_Admin_UI::close();
	}

	private static function commission_table( $coms, $selectable ) {
		if ( ! $coms ) {
			echo '<p class="ppc-mute ppc-pad">No commissions yet. They are created automatically when a business brought in by an agent pays.</p>';
			return;
		}
		echo '<table class="' . ( $selectable ? 'ppc-table' : 'ppc-mini' ) . '"><thead><tr>' . ( $selectable ? '<th class="check"><input type="checkbox" data-check-all aria-label="Select all"></th><th>Agent</th>' : '' ) . '<th>Date</th><th>Business</th><th>For</th><th class="num">Amount</th><th>Status</th>' . ( $selectable ? '<th>M-Pesa ref</th>' : '' ) . '</tr></thead><tbody>';
		foreach ( $coms as $c ) {
			echo '<tr>';
			if ( $selectable ) {
				echo '<td class="check">' . ( in_array( $c->status, array( 'pending', 'approved' ), true ) ? '<input type="checkbox" name="ids[]" value="' . (int) $c->id . '" form="ppc-bulk" aria-label="Select">' : '' ) . '</td>';
				echo '<td><a href="' . esc_url( PPC_Admin_UI::url( 'ppc-agents', array( 'id' => $c->agent_id ) ) ) . '">' . esc_html( $c->agent_name ) . '</a><span class="ppc-cell-hint">' . esc_html( $c->agent_code . ' · ' . PPC_Util::phone_pretty( $c->mpesa_phone ) ) . '</span></td>';
			}
			echo '<td>' . esc_html( PPC_Util::fmt_date( $c->created_at ) ) . '</td><td><a href="' . esc_url( PPC_Admin_UI::url( 'ppc-businesses', array( 'id' => $c->tenant_id ) ) ) . '">' . esc_html( $c->business_name ) . '</a></td><td>' . esc_html( $c->note ) . '</td><td class="num"><strong>' . esc_html( PPC_Util::kes( $c->amount ) ) . '</strong></td><td>' . PPC_Admin_UI::badge( $c->status ) . '</td>'; // phpcs:ignore
			if ( $selectable ) {
				echo '<td>' . ( $c->mpesa_ref ? '<code>' . esc_html( $c->mpesa_ref ) . '</code><span class="ppc-cell-hint">' . esc_html( PPC_Util::fmt_date( $c->paid_at ) ) . '</span>' : '<span class="ppc-mute">—</span>' ) . '</td>';
			}
			echo '</tr>';
		}
		echo '</tbody></table>';
	}

	/* =================================================================== */
	/* Leads                                                                */
	/* =================================================================== */

	public static function leads() {
		global $wpdb;
		$lead = self::q( 'lead' );
		if ( $lead ) {
			self::lead_detail( (int) self::q( 'agent' ), $lead );
			return;
		}
		$lt    = PPC_Util::t( 'leads' );
		$where = array( 'l.deleted = 0' );
		$s     = self::q( 's' );
		if ( '' !== $s ) {
			$like    = '%' . $wpdb->esc_like( $s ) . '%';
			$where[] = $wpdb->prepare( '(l.business_name LIKE %s OR l.contact_name LIKE %s OR l.town LIKE %s OR l.phone LIKE %s)', $like, $like, $like, PPC_Util::phone( $s ) ? PPC_Util::phone( $s ) : $like );
		}
		$agent = (int) self::q( 'agent' );
		if ( $agent ) {
			$where[] = $wpdb->prepare( 'l.agent_id = %d', $agent );
		}
		$stage = self::q( 'stage' );
		if ( in_array( $stage, PPC_Agents::STAGES, true ) ) {
			$where[] = $wpdb->prepare( 'l.stage = %s', $stage );
		}
		$w     = implode( ' AND ', $where );
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $lt l WHERE $w" ); // phpcs:ignore
		$off   = ( PPC_Admin_UI::paged() - 1 ) * PPC_Admin_UI::PER_PAGE;
		$rows  = $wpdb->get_results( "SELECT l.*, a.name AS agent_name, a.code AS agent_code FROM $lt l LEFT JOIN " . PPC_Util::t( 'agents' ) . " a ON a.id = l.agent_id WHERE $w ORDER BY l.updated_at DESC LIMIT $off, " . PPC_Admin_UI::PER_PAGE ); // phpcs:ignore
		$by    = $wpdb->get_results( "SELECT l.stage, COUNT(*) AS n FROM $lt l WHERE " . implode( ' AND ', array_filter( $where, function ( $x ) { return false === strpos( $x, 'l.stage' ); } ) ) . ' GROUP BY l.stage', OBJECT_K ); // phpcs:ignore

		PPC_Admin_UI::open( 'Leads', 'Every prospect captured by agents in the field or through website bookings.', PPC_Admin_UI::link_btn( PPC_Admin::export_url( 'leads' ), 'Export CSV' ) );
		echo '<div class="ppc-tabs">';
		$base = array_filter(
			array(
				'agent' => $agent ? $agent : '',
				's'     => $s,
			)
		);
		echo '<a class="' . ( ! $stage ? 'is-current' : '' ) . '" href="' . esc_url( PPC_Admin_UI::url( 'ppc-leads', $base ) ) . '">All <span>' . (int) array_sum( wp_list_pluck( $by, 'n' ) ) . '</span></a>';
		foreach ( PPC_Agents::stage_labels() as $k => $l ) {
			echo '<a class="' . ( $stage === $k ? 'is-current' : '' ) . '" href="' . esc_url( PPC_Admin_UI::url( 'ppc-leads', array_merge( $base, array( 'stage' => $k ) ) ) ) . '">' . esc_html( $l ) . ' <span>' . ( isset( $by[ $k ] ) ? (int) $by[ $k ]->n : 0 ) . '</span></a>';
		}
		echo '</div>';
		PPC_Admin_UI::filters( 'ppc-leads', 'Search business, contact, town, phone…', array( 'agent' => array( 'All agents', array_slice( PPC_Admin_UI::agent_options(), 1, null, true ) ) ), $stage ? array( 'stage' => $stage ) : array() );
		if ( ! $rows ) {
			PPC_Admin_UI::empty_state( 'No leads found', 'Leads appear here as agents sync their phones.' );
		} else {
			echo '<div class="ppc-table-wrap"><table class="ppc-table"><thead><tr><th>Business</th><th>Contact</th><th>Town</th><th>Stage</th><th>Interest</th><th>Follow-up</th><th>Agent</th><th>Updated</th></tr></thead><tbody>';
			$today = wp_date( 'Y-m-d' );
			foreach ( $rows as $l ) {
				$url = PPC_Admin_UI::url( 'ppc-leads', array( 'agent' => $l->agent_id, 'lead' => $l->lead_id ) );
				$due = $l->next_follow_up && $l->next_follow_up <= $today && ! in_array( $l->stage, array( 'won', 'lost' ), true );
				echo '<tr><td><a class="ppc-strong" href="' . esc_url( $url ) . '">' . esc_html( $l->business_name ? $l->business_name : '(no name)' ) . '</a></td><td>' . esc_html( $l->contact_name ) . '<span class="ppc-cell-hint">' . PPC_Admin_UI::phone_link( $l->phone ) . '</span></td><td>' . esc_html( $l->town ) . '</td><td>' . PPC_Admin_UI::badge( $l->stage ) . '</td><td>' . esc_html( ucfirst( $l->package_interest ) ) . '</td>'; // phpcs:ignore
				echo '<td class="' . ( $due ? 'ppc-due' : 'ppc-mute' ) . '">' . esc_html( $l->next_follow_up ? wp_date( 'j M Y', strtotime( $l->next_follow_up ) ) : '—' ) . '</td><td><a href="' . esc_url( PPC_Admin_UI::url( 'ppc-agents', array( 'id' => $l->agent_id ) ) ) . '">' . esc_html( $l->agent_name ) . '</a></td><td class="ppc-mute">' . esc_html( PPC_Util::ago( PPC_Util::dt( (int) ( $l->updated_at / 1000 ) ) ) ) . '</td></tr>';
			}
			echo '</tbody></table></div>';
			PPC_Admin_UI::pager( $total );
		}
		PPC_Admin_UI::close();
	}

	private static function lead_detail( $agent_id, $lead_id ) {
		global $wpdb;
		$l = $wpdb->get_row( $wpdb->prepare( 'SELECT l.*, a.name AS agent_name, a.code AS agent_code FROM ' . PPC_Util::t( 'leads' ) . ' l LEFT JOIN ' . PPC_Util::t( 'agents' ) . ' a ON a.id = l.agent_id WHERE l.agent_id = %d AND l.lead_id = %s', $agent_id, $lead_id ) );
		if ( ! $l ) {
			PPC_Admin_UI::open( 'Lead not found', '', '', array( 'Leads', PPC_Admin_UI::url( 'ppc-leads' ) ) );
			PPC_Admin_UI::close();
			return;
		}
		$d    = json_decode( $l->data, true );
		$d    = is_array( $d ) ? $d : array();
		$acts = PPC_Agents::activities_for( $agent_id, array( $lead_id ) );
		$acts = isset( $acts[ $lead_id ] ) ? array_reverse( $acts[ $lead_id ] ) : array();
		$g    = function ( $k ) use ( $d ) {
			return isset( $d[ $k ] ) && is_scalar( $d[ $k ] ) ? (string) $d[ $k ] : '';
		};
		PPC_Admin_UI::open( $l->business_name ? $l->business_name : 'Lead', PPC_Admin_UI::badge( $l->stage ) . ' · Agent: <a href="' . esc_url( PPC_Admin_UI::url( 'ppc-agents', array( 'id' => $l->agent_id ) ) ) . '">' . esc_html( $l->agent_name ) . '</a>', PPC_Admin_UI::link_btn( PPC_Util::wa_link( $l->phone ), 'WhatsApp', 'wa', 'target="_blank" rel="noopener"' ), array( 'Leads', PPC_Admin_UI::url( 'ppc-leads' ) ) );
		echo '<div class="ppc-grid ppc-grid--detail"><div class="ppc-col">';
		PPC_Admin_UI::card_open( 'Lead details' );
		$loc = '';
		if ( ! empty( $d['location']['lat'] ) && ! empty( $d['location']['lng'] ) ) {
			$loc = '<a target="_blank" rel="noopener" href="' . esc_url( 'https://www.google.com/maps?q=' . (float) $d['location']['lat'] . ',' . (float) $d['location']['lng'] ) . '">Open map (±' . (int) ( isset( $d['location']['accuracy'] ) ? $d['location']['accuracy'] : 0 ) . ' m)</a>';
		}
		PPC_Admin_UI::dl(
			array(
				'Contact'        => esc_html( $l->contact_name ),
				'Phone'          => PPC_Admin_UI::phone_link( $l->phone ),
				'Email'          => esc_html( $g( 'email' ) ),
				'Business type'  => esc_html( PPC_Tenants::type_label( $g( 'business_type' ) ) ),
				'Town / area'    => esc_html( $l->town ),
				'Location'       => $loc,
				'Current system' => esc_html( ucfirst( $g( 'current_system' ) ) ),
				'Branches'       => esc_html( $g( 'branches' ) ),
				'Interest'       => esc_html( ucfirst( $l->package_interest ) ),
				'Next follow-up' => esc_html( $l->next_follow_up ),
				'Lost reason'    => esc_html( $g( 'lost_reason' ) ),
				'Notes'          => nl2br( esc_html( $g( 'notes' ) ) ),
				'Trial'          => $l->tenant_id ? '<a href="' . esc_url( PPC_Admin_UI::url( 'ppc-businesses', array( 'id' => $l->tenant_id ) ) ) . '">View business</a>' : '',
				'Created'        => esc_html( PPC_Util::fmt_date( $l->created_at, true ) ),
			)
		);
		PPC_Admin_UI::card_close();
		echo '</div><div class="ppc-col">';
		PPC_Admin_UI::card_open( 'Activity' );
		if ( $acts ) {
			echo '<ol class="ppc-timeline">';
			foreach ( $acts as $x ) {
				echo '<li class="ppc-tl--' . esc_attr( $x['type'] ) . '"><strong>' . esc_html( ucfirst( $x['type'] ) ) . '</strong> <time>' . esc_html( $x['at'] ? wp_date( 'j M Y, H:i', (int) ( $x['at'] / 1000 ) ) : '' ) . '</time>' . ( $x['note'] ? '<p>' . esc_html( $x['note'] ) . '</p>' : '' ) . '</li>';
			}
			echo '</ol>';
		} else {
			echo '<p class="ppc-mute ppc-pad">No activity logged yet.</p>';
		}
		PPC_Admin_UI::card_close();
		echo '</div></div>';
		PPC_Admin_UI::close();
	}

	/* =================================================================== */
	/* Demo bookings                                                        */
	/* =================================================================== */

	private static function booking_statuses() {
		return array(
			'new'       => 'New',
			'contacted' => 'Contacted',
			'scheduled' => 'Scheduled',
			'done'      => 'Done',
			'cancelled' => 'Cancelled',
		);
	}

	private static function time_label( $t ) {
		$m = array(
			'morning'        => 'Morning',
			'afternoon'      => 'Afternoon',
			'late_afternoon' => 'Late afternoon',
		);
		return isset( $m[ $t ] ) ? $m[ $t ] : $t;
	}

	public static function bookings() {
		global $wpdb;
		$bt = PPC_Util::t( 'demo_bookings' );
		$id = (int) self::q( 'id' );
		if ( $id ) {
			$b = $wpdb->get_row( $wpdb->prepare( "SELECT b.*, a.name AS agent_name FROM $bt b LEFT JOIN " . PPC_Util::t( 'agents' ) . ' a ON a.id = b.agent_id WHERE b.id = %d', $id ) );
			if ( ! $b ) {
				PPC_Admin_UI::open( 'Booking not found', '', '', array( 'Demo bookings', PPC_Admin_UI::url( 'ppc-bookings' ) ) );
				PPC_Admin_UI::close();
				return;
			}
			$wa = 'Hello ' . PPC_Util::first_name( $b->name ) . ', this is Pentarch Systems Solutions. Thank you for booking a Pentarch POS demo (' . $b->ref . '). When is a good time for us to visit or call?';
			PPC_Admin_UI::open( $b->business, '<code>' . esc_html( $b->ref ) . '</code> · ' . PPC_Admin_UI::badge( $b->status ) . ' · received ' . esc_html( PPC_Util::fmt_date( $b->created_at, true ) ), PPC_Admin_UI::link_btn( PPC_Util::wa_link( $b->phone, $wa ), 'WhatsApp', 'wa', 'target="_blank" rel="noopener"' ) . PPC_Admin_UI::link_btn( 'tel:+' . $b->phone, 'Call' ), array( 'Demo bookings', PPC_Admin_UI::url( 'ppc-bookings' ) ) );
			echo '<div class="ppc-grid ppc-grid--detail"><div class="ppc-col">';
			PPC_Admin_UI::card_open( 'Request' );
			PPC_Admin_UI::dl(
				array(
					'Name'           => esc_html( $b->name ),
					'Phone'          => PPC_Admin_UI::phone_link( $b->phone ),
					'Email'          => esc_html( $b->email ),
					'Business type'  => esc_html( PPC_Tenants::type_label( $b->business_type ) ),
					'Town'           => esc_html( $b->town ),
					'Preferred'      => esc_html( trim( ( $b->preferred_date ? wp_date( 'D j M Y', strtotime( $b->preferred_date ) ) : '' ) . ' ' . self::time_label( $b->preferred_time ) ) ),
					'Message'        => nl2br( esc_html( (string) $b->message ) ),
					'Referred by'    => $b->agent_name ? esc_html( $b->agent_name . ' (' . $b->agent_code . ')' ) : esc_html( $b->agent_code ),
					'Page'           => $b->source_page ? '<a class="ppc-small" target="_blank" href="' . esc_url( $b->source_page ) . '">' . esc_html( wp_parse_url( $b->source_page, PHP_URL_PATH ) ) . '</a>' : '',
				)
			);
			PPC_Admin_UI::card_close();
			echo '</div><div class="ppc-col">';
			PPC_Admin_UI::card_open( 'Follow up' );
			echo PPC_Admin_UI::form_open( 'booking_update', array( 'booking_id' => $b->id ), 'ppc-form' ) . '<div class="ppc-form__grid">'; // phpcs:ignore
			echo '<label class="ppc-field"><span>Status</span>' . PPC_Admin_UI::select( 'status', self::booking_statuses(), $b->status ) . '</label>'; // phpcs:ignore
			echo '<label class="ppc-field"><span>Assigned agent</span>' . PPC_Admin_UI::select( 'assigned_agent_id', PPC_Admin_UI::agent_options( '— Pentarch office —', true ), $b->assigned_agent_id ) . '</label>'; // phpcs:ignore
			echo '<label class="ppc-field ppc-field--full"><span>Notes</span><textarea name="admin_note" rows="4" class="ppc-textarea">' . esc_textarea( (string) $b->admin_note ) . '</textarea></label>';
			echo '</div><p class="ppc-help">Assigning an agent adds this booking to their leads.</p><button class="ppc-btn ppc-btn--primary">Save</button></form>';
			PPC_Admin_UI::card_close();
			echo '</div></div>';
			PPC_Admin_UI::close();
			return;
		}

		$where = array( '1=1' );
		$s     = self::q( 's' );
		if ( '' !== $s ) {
			$like    = '%' . $wpdb->esc_like( $s ) . '%';
			$where[] = $wpdb->prepare( '(b.name LIKE %s OR b.business LIKE %s OR b.ref LIKE %s OR b.town LIKE %s OR b.phone LIKE %s)', $like, $like, $like, $like, PPC_Util::phone( $s ) ? PPC_Util::phone( $s ) : $like );
		}
		$st = self::q( 'status' );
		if ( array_key_exists( $st, self::booking_statuses() ) ) {
			$where[] = $wpdb->prepare( 'b.status = %s', $st );
		}
		$w     = implode( ' AND ', $where );
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $bt b WHERE $w" ); // phpcs:ignore
		$off   = ( PPC_Admin_UI::paged() - 1 ) * PPC_Admin_UI::PER_PAGE;
		$rows  = $wpdb->get_results( "SELECT b.* FROM $bt b WHERE $w ORDER BY (b.status = 'new') DESC, b.created_at DESC LIMIT $off, " . PPC_Admin_UI::PER_PAGE ); // phpcs:ignore
		$agents = PPC_Admin_UI::agent_options( '— Office —', true );

		PPC_Admin_UI::open( 'Demo bookings', 'Requests from the website form <code>[pentarch_pos_demo_form]</code> and from agents.', PPC_Admin_UI::link_btn( PPC_Admin::export_url( 'bookings' ), 'Export CSV' ) );
		PPC_Admin_UI::filters( 'ppc-bookings', 'Search name, business, ref, town, phone…', array( 'status' => array( 'All statuses', self::booking_statuses() ) ) );
		if ( ! $rows ) {
			PPC_Admin_UI::empty_state( 'No demo bookings', 'Place the shortcode [pentarch_pos_demo_form] on the /systems/pos/ page to start receiving bookings.' );
		} else {
			echo '<div class="ppc-table-wrap"><table class="ppc-table"><thead><tr><th>Booking</th><th>Contact</th><th>Town</th><th>Preferred</th><th>Status &amp; agent</th><th>Received</th></tr></thead><tbody>';
			foreach ( $rows as $b ) {
				echo '<tr><td><a class="ppc-strong" href="' . esc_url( PPC_Admin_UI::url( 'ppc-bookings', array( 'id' => $b->id ) ) ) . '">' . esc_html( $b->business ) . '</a><span class="ppc-cell-hint"><code>' . esc_html( $b->ref ) . '</code> ' . esc_html( PPC_Tenants::type_label( $b->business_type ) ) . '</span></td>';
				echo '<td>' . esc_html( $b->name ) . '<span class="ppc-cell-hint">' . PPC_Admin_UI::phone_link( $b->phone ) . '</span></td><td>' . esc_html( $b->town ) . '</td>'; // phpcs:ignore
				echo '<td>' . esc_html( $b->preferred_date ? wp_date( 'D j M', strtotime( $b->preferred_date ) ) : 'Any day' ) . '<span class="ppc-cell-hint">' . esc_html( $b->preferred_time ? self::time_label( $b->preferred_time ) : 'Any time' ) . '</span></td>';
				echo '<td>' . PPC_Admin_UI::form_open( 'booking_update', array( 'booking_id' => $b->id ), 'ppc-inline ppc-inline--row' ) . PPC_Admin_UI::select( 'status', self::booking_statuses(), $b->status, 'aria-label="Status" class="ppc-status-select ppc-status--' . esc_attr( $b->status ) . '"' ) . PPC_Admin_UI::select( 'assigned_agent_id', $agents, $b->assigned_agent_id, 'aria-label="Assigned agent"' ) . '<button class="ppc-btn ppc-btn--ghost ppc-btn--sm">Save</button></form></td>'; // phpcs:ignore
				echo '<td class="ppc-mute">' . esc_html( PPC_Util::ago( $b->created_at ) ) . '</td></tr>';
			}
			echo '</tbody></table></div>';
			PPC_Admin_UI::pager( $total );
		}
		PPC_Admin_UI::close();
	}

	/* =================================================================== */
	/* Payments                                                             */
	/* =================================================================== */

	public static function payments() {
		global $wpdb;
		$pt    = PPC_Util::t( 'payments' );
		$tn    = PPC_Util::t( 'tenants' );
		$where = array( '1=1' );
		$s     = self::q( 's' );
		if ( '' !== $s ) {
			$like    = '%' . $wpdb->esc_like( $s ) . '%';
			$where[] = $wpdb->prepare( '(t.business_name LIKE %s OR t.code LIKE %s OR p.ref LIKE %s)', $like, $like, $like );
		}
		$type = self::q( 'type' );
		if ( $type && array_key_exists( $type, PPC_Payments::types() ) ) {
			$where[] = $wpdb->prepare( 'p.type = %s', $type );
		}
		$month = self::q( 'month' );
		if ( preg_match( '/^\d{4}-\d{2}$/', $month ) ) {
			$where[] = $wpdb->prepare( 'p.paid_at >= %s AND p.paid_at < %s', $month . '-01 00:00:00', gmdate( 'Y-m-01 00:00:00', strtotime( $month . '-01 +1 month' ) ) );
		}
		$w     = implode( ' AND ', $where );
		$total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $pt p LEFT JOIN $tn t ON t.id = p.tenant_id WHERE $w" ); // phpcs:ignore
		$sum   = (int) $wpdb->get_var( "SELECT COALESCE(SUM(p.amount),0) FROM $pt p LEFT JOIN $tn t ON t.id = p.tenant_id WHERE $w" ); // phpcs:ignore
		$off   = ( PPC_Admin_UI::paged() - 1 ) * PPC_Admin_UI::PER_PAGE;
		$rows  = $wpdb->get_results( "SELECT p.*, t.business_name, t.code FROM $pt p LEFT JOIN $tn t ON t.id = p.tenant_id WHERE $w ORDER BY p.paid_at DESC, p.id DESC LIMIT $off, " . PPC_Admin_UI::PER_PAGE ); // phpcs:ignore

		$months = array();
		for ( $i = 0; $i < 12; $i++ ) {
			$ts                           = strtotime( gmdate( 'Y-m-01' ) . " -$i months" );
			$months[ gmdate( 'Y-m', $ts ) ] = wp_date( 'F Y', $ts );
		}
		$types = array();
		foreach ( PPC_Payments::types() as $k => $d ) {
			$types[ $k ] = $d['label'];
		}

		PPC_Admin_UI::open( 'Payments', 'Licence, package and hardware payments. Recording a payment extends the licence and creates agent commission.', PPC_Admin_UI::link_btn( PPC_Admin::export_url( 'payments' ), 'Export CSV' ) );

		// Record payment: pick a business.
		$q = self::q( 'find' );
		PPC_Admin_UI::card_open( 'Record a payment', '', 'ppc-card--accent' );
		echo '<form class="ppc-inline ppc-inline--field" method="get" action="' . esc_url( admin_url( 'admin.php' ) ) . '"><input type="hidden" name="page" value="ppc-payments"><input type="search" name="find" value="' . esc_attr( $q ) . '" placeholder="Business code (PP12345), name or phone" class="ppc-wide"><button class="ppc-btn ppc-btn--primary">Find business</button></form>';
		if ( '' !== $q ) {
			$like  = '%' . $wpdb->esc_like( $q ) . '%';
			$found = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $tn WHERE code = %s OR business_name LIKE %s OR phone = %s OR email = %s ORDER BY created_at DESC LIMIT 8", strtoupper( $q ), $like, PPC_Util::phone( $q ) ? PPC_Util::phone( $q ) : '-', strtolower( $q ) ) );
			if ( $found ) {
				echo '<ul class="ppc-list ppc-list--pick">';
				foreach ( $found as $t ) {
					echo '<li><a href="' . esc_url( PPC_Admin_UI::url( 'ppc-businesses', array( 'id' => $t->id ) ) . '#pay' ) . '"><strong>' . esc_html( $t->business_name ) . '</strong><span>' . esc_html( $t->code . ' · ' . $t->owner_name . ' · ' . $t->town ) . '</span></a>' . self::licence_cell( $t ) . '</li>'; // phpcs:ignore
				}
				echo '</ul>';
			} else {
				echo '<p class="ppc-mute ppc-pad">No business matches “' . esc_html( $q ) . '”.</p>';
			}
		}
		PPC_Admin_UI::card_close();

		PPC_Admin_UI::filters(
			'ppc-payments',
			'Search business, code or M-Pesa ref…',
			array(
				'type'  => array( 'Everything', $types ),
				'month' => array( 'All months', $months ),
			)
		);
		if ( ! $rows ) {
			PPC_Admin_UI::empty_state( 'No payments', 'Payments you record (or M-Pesa STK licence payments) appear here.' );
		} else {
			echo '<div class="ppc-sum">Total shown: <strong>' . esc_html( PPC_Util::kes( $sum ) ) . '</strong></div>';
			echo '<div class="ppc-table-wrap"><table class="ppc-table"><thead><tr><th>Date</th><th>Business</th><th>For</th><th class="num">Amount</th><th>Method</th><th>Ref</th><th>Licence period</th><th>Source</th></tr></thead><tbody>';
			foreach ( $rows as $p ) {
				echo '<tr><td>' . esc_html( PPC_Util::fmt_date( $p->paid_at ) ) . '</td><td><a class="ppc-strong" href="' . esc_url( PPC_Admin_UI::url( 'ppc-businesses', array( 'id' => $p->tenant_id ) ) ) . '">' . esc_html( $p->business_name ) . '</a><span class="ppc-cell-hint">' . esc_html( $p->code ) . '</span></td><td>' . esc_html( PPC_Payments::type_label( $p->type ) ) . ( $p->bundles > 1 ? ' × ' . (int) $p->bundles : '' ) . '</td><td class="num"><strong>' . esc_html( PPC_Util::kes( $p->amount ) ) . '</strong></td><td>' . esc_html( PPC_Payments::methods()[ $p->method ] ?? $p->method ) . '</td><td><code>' . esc_html( $p->ref ? $p->ref : '—' ) . '</code></td><td class="ppc-mute">' . ( $p->period_to ? esc_html( PPC_Util::fmt_date( $p->period_from ) . ' → ' . PPC_Util::fmt_date( $p->period_to ) ) : '—' ) . '</td><td>' . esc_html( 'mpesa' === $p->source ? 'M-Pesa STK' : 'Admin' ) . '</td></tr>';
			}
			echo '</tbody></table></div>';
			PPC_Admin_UI::pager( $total );
		}
		PPC_Admin_UI::close();
	}

	/* =================================================================== */
	/* Commissions                                                          */
	/* =================================================================== */

	public static function commissions() {
		global $wpdb;
		$ct    = PPC_Util::t( 'commissions' );
		$where = array( '1=1' );
		$st    = self::q( 'status' );
		if ( in_array( $st, array( 'pending', 'approved', 'paid', 'cancelled' ), true ) ) {
			$where[] = $wpdb->prepare( 'c.status = %s', $st );
		}
		$agent = (int) self::q( 'agent' );
		if ( $agent ) {
			$where[] = $wpdb->prepare( 'c.agent_id = %d', $agent );
		}
		$s = self::q( 's' );
		if ( '' !== $s ) {
			$like    = '%' . $wpdb->esc_like( $s ) . '%';
			$where[] = $wpdb->prepare( '(t.business_name LIKE %s OR a.name LIKE %s OR a.code LIKE %s OR c.mpesa_ref LIKE %s)', $like, $like, $like, $like );
		}
		$w      = implode( ' AND ', $where );
		$join   = " FROM $ct c LEFT JOIN " . PPC_Util::t( 'agents' ) . ' a ON a.id = c.agent_id LEFT JOIN ' . PPC_Util::t( 'tenants' ) . ' t ON t.id = c.tenant_id';
		$total  = (int) $wpdb->get_var( "SELECT COUNT(*) $join WHERE $w" ); // phpcs:ignore
		$off    = ( PPC_Admin_UI::paged() - 1 ) * PPC_Admin_UI::PER_PAGE;
		$rows   = $wpdb->get_results( "SELECT c.*, a.name AS agent_name, a.code AS agent_code, a.mpesa_phone, t.business_name $join WHERE $w ORDER BY c.created_at DESC LIMIT $off, " . PPC_Admin_UI::PER_PAGE ); // phpcs:ignore
		$totals = $wpdb->get_results( "SELECT c.status, COALESCE(SUM(c.amount),0) AS s, COUNT(*) AS n FROM $ct c" . ( $agent ? $wpdb->prepare( ' WHERE c.agent_id = %d', $agent ) : '' ) . ' GROUP BY c.status', OBJECT_K ); // phpcs:ignore
		$tv     = function ( $k ) use ( $totals ) {
			return isset( $totals[ $k ] ) ? (int) $totals[ $k ]->s : 0;
		};

		PPC_Admin_UI::open( 'Commissions', 'Approve commissions once the client\'s payment has cleared, then pay agents by M-Pesa and record the reference.', PPC_Admin_UI::link_btn( PPC_Admin::export_url( 'commissions' ), 'Export CSV' ) );
		echo '<div class="ppc-kpis ppc-kpis--sm">';
		PPC_Admin_UI::kpi( 'Pending approval', PPC_Util::kes( $tv( 'pending' ) ), '', 'sun', PPC_Admin_UI::url( 'ppc-commissions', array( 'status' => 'pending' ) ) );
		PPC_Admin_UI::kpi( 'Approved — to pay', PPC_Util::kes( $tv( 'approved' ) ), '', 'navy', PPC_Admin_UI::url( 'ppc-commissions', array( 'status' => 'approved' ) ) );
		PPC_Admin_UI::kpi( 'Paid', PPC_Util::kes( $tv( 'paid' ) ), '', 'teal', PPC_Admin_UI::url( 'ppc-commissions', array( 'status' => 'paid' ) ) );
		echo '</div>';
		PPC_Admin_UI::filters(
			'ppc-commissions',
			'Search agent, business or M-Pesa ref…',
			array(
				'status' => array(
					'All statuses',
					array(
						'pending'   => 'Pending',
						'approved'  => 'Approved',
						'paid'      => 'Paid',
						'cancelled' => 'Cancelled',
					),
				),
				'agent'  => array( 'All agents', array_slice( PPC_Admin_UI::agent_options(), 1, null, true ) ),
			)
		);
		if ( ! $rows ) {
			PPC_Admin_UI::empty_state( 'No commissions', 'Commissions are created automatically when a business brought in by an agent pays.' );
		} else {
			echo '<form id="ppc-bulk" method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '">' . PPC_Admin_UI::action_fields( 'commission_status' ) . '</form>'; // phpcs:ignore
			echo '<div class="ppc-bulkbar"><span data-selected-count>0 selected</span>';
			echo '<select name="status" form="ppc-bulk" aria-label="Set status"><option value="approved">Approve</option><option value="paid">Mark paid</option><option value="cancelled">Cancel</option><option value="pending">Back to pending</option></select>';
			echo '<input type="text" name="mpesa_ref" form="ppc-bulk" placeholder="M-Pesa ref (when paying)" maxlength="60" style="text-transform:uppercase">';
			echo '<button class="ppc-btn ppc-btn--primary" form="ppc-bulk" type="submit">Apply to selected</button></div>';
			echo '<div class="ppc-table-wrap">';
			self::commission_table( $rows, true );
			echo '</div>';
			PPC_Admin_UI::pager( $total );
		}
		PPC_Admin_UI::close();
	}

	/* =================================================================== */
	/* Settings                                                             */
	/* =================================================================== */

	private static function field( $key, $label, $type = 'text', $help = '', $attrs = '' ) {
		$v    = PPC_Settings::get( $key );
		$name = 's[' . $key . ']';
		echo '<label class="ppc-field' . ( 'textarea' === $type || 'url' === $type ? ' ppc-field--full' : '' ) . '"><span>' . esc_html( $label ) . '</span>';
		if ( 'bool' === $type ) {
			echo '</label><label class="ppc-check ppc-field--full"><input type="checkbox" name="' . esc_attr( $name ) . '" value="1"' . checked( (int) $v, 1, false ) . '> ' . esc_html( $help ) . '</label>';
			return;
		}
		if ( 'secret' === $type ) {
			echo '<input type="password" name="' . esc_attr( $name ) . '" value="' . ( $v ? '********' : '' ) . '" autocomplete="new-password" ' . $attrs . '>'; // phpcs:ignore
		} elseif ( 'kes' === $type ) {
			echo '<span class="ppc-affix"><i>KES</i><input type="number" min="0" step="1" name="' . esc_attr( $name ) . '" value="' . esc_attr( $v ) . '" ' . $attrs . '></span>'; // phpcs:ignore
		} else {
			echo '<input type="' . esc_attr( $type ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( $v ) . '" ' . $attrs . '>'; // phpcs:ignore
		}
		if ( $help ) {
			echo '<small>' . esc_html( $help ) . '</small>';
		}
		echo '</label>';
	}

	public static function settings() {
		PPC_Admin_UI::open( 'Settings', 'Prices, licence rules, commission rates, M-Pesa and contact details.' );
		echo '<div class="ppc-settings">';
		echo '<nav class="ppc-settings__nav" aria-label="Sections"><a href="#licence">Licence &amp; trial</a><a href="#prices">Prices</a><a href="#commission">Agent commission</a><a href="#payments">M-Pesa payments</a><a href="#contact">Contact</a><a href="#resources">Agent resources</a><a href="#security">Security &amp; data</a></nav>';
		echo PPC_Admin_UI::form_open( 'save_settings', array(), 'ppc-form ppc-settings__form' ); // phpcs:ignore

		echo '<section class="ppc-card" id="licence"><div class="ppc-card__head"><h3>Licence &amp; trial</h3></div><div class="ppc-form__grid">';
		self::field( 'trial_days', 'Free trial (days)', 'number', 'Applies to new sign-ups.', 'min="1" max="365"' );
		self::field( 'grace_days', 'Grace period after expiry (days)', 'number', 'Selling still allowed, with a red banner.', 'min="0" max="60"' );
		self::field( 'default_max_branches', 'Default branches per business', 'number', '', 'min="1"' );
		self::field( 'default_max_devices', 'Default devices per business', 'number', '', 'min="1"' );
		self::field( 'enforce_device_limit', '', 'bool', 'Block sign-in on new devices when the device limit is reached' );
		echo '</div></section>';

		echo '<section class="ppc-card" id="prices"><div class="ppc-card__head"><h3>Prices</h3><span class="ppc-mute">Shown in the app, agent portal and admin payment form</span></div><div class="ppc-form__grid">';
		self::field( 'software_monthly', 'Software — per month', 'kes' );
		self::field( 'software_yearly', 'Software — per year', 'kes' );
		self::field( 'extra_branch_monthly', 'Extra branch — per month', 'kes' );
		self::field( 'extra_branch_yearly', 'Extra branch — per year', 'kes' );
		self::field( 'package_complete_till', 'Package: Complete Till', 'kes', 'Devices + install + 12 months software' );
		self::field( 'package_software_setup', 'Package: Software + Setup', 'kes', 'Setup on client PC + 12 months software' );
		self::field( 'setup_only_fee', 'Setup only (with monthly billing)', 'kes' );
		self::field( 'counter_kit', 'Counter Kit add-on', 'kes', 'Scanner + printer + drawer + paper' );
		self::field( 'extra_till', 'Extra till', 'kes', 'Second complete till in the same branch' );
		echo '</div></section>';

		echo '<section class="ppc-card" id="commission"><div class="ppc-card__head"><h3>Agent commission</h3></div><div class="ppc-form__grid">';
		self::field( 'software_rate', 'Software commission (%)', 'number', 'Of software payments (subscriptions, extra branches)', 'min="0" max="100" step="0.5"' );
		self::field( 'commission_months', 'For the first (months)', 'number', 'Counted from the client\'s first payment', 'min="1" max="120"' );
		self::field( 'bonus_complete_till', 'Bonus per Complete Till', 'kes' );
		self::field( 'bonus_software_setup', 'Bonus per Software + Setup', 'kes' );
		self::field( 'bonus_counter_kit', 'Bonus per Counter Kit', 'kes' );
		echo '<div></div>';
		self::field( 'package_software_commission', '', 'bool', 'Also pay the software % on the 12 months included in packages (in addition to the bonus)' );
		self::field( 'auto_approve_commission', '', 'bool', 'Approve new commissions automatically (otherwise they start as pending)' );
		echo '</div></section>';

		echo '<section class="ppc-card" id="payments"><div class="ppc-card__head"><h3>M-Pesa payments</h3></div><div class="ppc-form__grid">';
		self::field( 'paybill', 'Pentarch Paybill number', 'text', 'Shown on the POS pay page', 'inputmode="numeric"' );
		self::field( 'account_format', 'Account number format', 'text', '{code} = business code (PP12345), {phone}' );
		echo '</div><h4 class="ppc-subhead">Daraja STK push for licence payments <span class="ppc-mute">(optional)</span></h4><p class="ppc-help">When filled in, businesses can pay their licence from the app with an M-Pesa prompt; the payment is recorded automatically. Until then the STK endpoint returns “not configured” (501) and the app shows the Paybill instructions.</p><div class="ppc-form__grid">';
		echo '<label class="ppc-field"><span>Environment</span>' . PPC_Admin_UI::select( 's[mpesa_env]', array( 'sandbox' => 'Sandbox (testing)', 'production' => 'Production (live)' ), PPC_Settings::get( 'mpesa_env' ) ) . '</label>'; // phpcs:ignore
		echo '<label class="ppc-field"><span>Shortcode type</span>' . PPC_Admin_UI::select( 's[mpesa_type]', array( 'paybill' => 'Paybill', 'till' => 'Buy Goods (Till)' ), PPC_Settings::get( 'mpesa_type' ) ) . '</label>'; // phpcs:ignore
		self::field( 'mpesa_shortcode', 'Business shortcode' );
		self::field( 'mpesa_consumer_key', 'Consumer key', 'text', '', 'autocomplete="off"' );
		self::field( 'mpesa_consumer_secret', 'Consumer secret', 'secret' );
		self::field( 'mpesa_passkey', 'Passkey', 'secret' );
		echo '<label class="ppc-field ppc-field--full"><span>Callback URL (set automatically)</span><input type="text" readonly value="' . esc_attr( PPC_Mpesa::callback_url() ) . '" onclick="this.select()"></label>';
		self::field( 'mpesa_auto_record', '', 'bool', 'Record successful STK licence payments automatically and extend the licence' );
		echo '</div></section>';

		echo '<section class="ppc-card" id="contact"><div class="ppc-card__head"><h3>Contact</h3></div><div class="ppc-form__grid">';
		self::field( 'whatsapp', 'WhatsApp number', 'text', 'International format without +, e.g. 254729455912' );
		self::field( 'phone', 'Phone (display)', 'text' );
		self::field( 'email', 'Support email', 'email' );
		self::field( 'admin_email', 'Admin notification email', 'email', 'New trials, agent sign-ups and demo bookings. Blank = site admin email.' );
		self::field( 'website_pos_path', 'Website POS page', 'text', 'Full address or a path on this site. Used for agent share links.' );
		echo '</div></section>';

		echo '<section class="ppc-card" id="resources"><div class="ppc-card__head"><h3>Agent resources</h3><span class="ppc-mute">Links shown in the agent portal (PDFs in the Media Library work well)</span></div><div class="ppc-form__grid">';
		self::field( 'res_sales_guide', 'Sales guide (PDF)', 'url' );
		self::field( 'res_price_list', 'Price list', 'url' );
		self::field( 'res_demo_script', 'Demo script', 'url' );
		self::field( 'res_objections', 'Objection answers', 'url' );
		self::field( 'res_faqs', 'FAQs', 'url' );
		self::field( 'res_one_pager', 'Product one-pager', 'url' );
		self::field( 'agent_terms_url', 'Agent terms & conditions', 'url' );
		echo '</div></section>';

		echo '<section class="ppc-card" id="security"><div class="ppc-card__head"><h3>Security &amp; data</h3></div><div class="ppc-form__grid">';
		self::field( 'rate_register', 'Sign-ups per IP per hour', 'number', '', 'min="1"' );
		self::field( 'rate_login', 'Sign-in attempts per account / 15 min', 'number', '', 'min="1"' );
		self::field( 'rate_booking', 'Demo bookings per IP per hour', 'number', '', 'min="1"' );
		echo '<div></div>';
		self::field( 'trust_proxy', '', 'bool', 'Site is behind Cloudflare or a proxy — use the forwarded client IP for rate limits' );
		self::field( 'delete_on_uninstall', '', 'bool', 'Delete ALL Pentarch POS data (businesses, records, agents, payments) when the plugin is deleted' );
		echo '</div></section>';

		echo '<div class="ppc-savebar"><button class="ppc-btn ppc-btn--primary" type="submit">Save settings</button></div>';
		echo '</form></div>';
		PPC_Admin_UI::close();
	}

	/* =================================================================== */
	/* Tools                                                                */
	/* =================================================================== */

	public static function tools() {
		global $wpdb, $wp_version;
		PPC_Admin_UI::open( 'Tools', 'System status, maintenance and exports.' );
		$pos  = PPC_Static::build_info( 'pos' );
		$agt  = PPC_Static::build_info( 'agents' );
		$perm = get_option( 'permalink_structure' );
		$ok   = function ( $b, $yes, $no ) {
			return $b ? '<span class="ppc-ok">✓ ' . esc_html( $yes ) . '</span>' : '<span class="ppc-warn">! ' . esc_html( $no ) . '</span>';
		};
		$bi   = function ( $i ) {
			if ( ! $i['present'] ) {
				return '<span class="ppc-warn">! Missing</span>';
			}
			return $i['placeholder'] ? '<span class="ppc-warn">! Placeholder page (copy the build into the plugin)</span>' : '<span class="ppc-ok">✓ Installed ' . esc_html( wp_date( 'j M Y H:i', $i['updated'] ) ) . '</span>';
		};
		echo '<div class="ppc-grid ppc-grid--2">';
		PPC_Admin_UI::card_open( 'System status' );
		PPC_Admin_UI::dl(
			array(
				'Plugin'          => esc_html( PPC_VERSION . ' (DB v' . get_option( PPC_DB::VERSION_OPTION ) . ')' ),
				'WordPress / PHP' => esc_html( $wp_version . ' / ' . PHP_VERSION ),
				'Database'        => esc_html( PPC_Util::is_sqlite() ? 'SQLite (testing)' : $wpdb->db_server_info() ),
				'Permalinks'      => $ok( (bool) $perm, 'Pretty (' . $perm . ')', 'Plain — /pos/ relies on the .htaccess block' ),
				'.htaccess block' => $ok( PPC_Static::htaccess_ok(), 'Present', 'Not written (fine on Nginx; on Apache/LiteSpeed click “Refresh rewrite rules”)' ),
				'POS app'         => $bi( $pos ),
				'Agent portal'    => $bi( $agt ),
				'Authorization header' => '<span data-ppc-authcheck>Checking…</span>',
				'M-Pesa STK'      => $ok( PPC_Settings::mpesa_configured(), 'Configured (' . PPC_Settings::get( 'mpesa_env' ) . ')', 'Not configured (optional)' ),
				'Daily cleanup'   => $ok( (bool) wp_next_scheduled( 'ppc_daily' ), 'Scheduled', 'Not scheduled — deactivate and activate the plugin' ),
				'API base'        => '<code class="ppc-small">' . esc_html( rest_url( PPC_NS ) ) . '</code>',
			)
		);
		PPC_Admin_UI::card_close();

		PPC_Admin_UI::card_open( 'Maintenance' );
		echo '<div class="ppc-toolrow"><div><strong>Refresh rewrite rules</strong><p>Re-registers /pos/ and /pos/agents/ and rewrites the .htaccess block. Use after changing permalinks or moving the site.</p></div>' . PPC_Admin_UI::button_form( 'flush_rewrite', 'Refresh' ) . '</div>'; // phpcs:ignore
		echo '<div class="ppc-toolrow"><div><strong>Clear rate limits</strong><p>Unblocks anyone locked out by too many sign-in attempts.</p></div>' . PPC_Admin_UI::button_form( 'clear_rate_limits', 'Clear' ) . '</div>'; // phpcs:ignore
		echo '<div class="ppc-toolrow"><div><strong>Send a test email</strong><p>To ' . esc_html( PPC_Settings::admin_email() ) . '.</p></div>' . PPC_Admin_UI::button_form( 'test_email', 'Send' ) . '</div>'; // phpcs:ignore
		$n_test = (int) $wpdb->get_var( 'SELECT COUNT(*) FROM ' . PPC_Util::t( 'tenants' ) . ' WHERE is_test = 1' );
		echo '<div class="ppc-toolrow"><div><strong>Purge test businesses</strong><p>Deletes the ' . (int) $n_test . ' business(es) marked “Test / demo” and all their synced data. The live demo (/pos/?demo=1) keeps its data in the visitor\'s browser only.</p></div>' . PPC_Admin_UI::button_form( 'purge_test', 'Purge', array(), 'danger', 'Permanently delete all test businesses and their data? This cannot be undone.' ) . '</div>'; // phpcs:ignore
		PPC_Admin_UI::card_close();
		echo '</div>';

		PPC_Admin_UI::card_open( 'Export CSV' );
		echo '<div class="ppc-exports">';
		foreach ( array( 'businesses' => 'Businesses', 'agents' => 'Agents', 'leads' => 'Leads', 'bookings' => 'Demo bookings', 'payments' => 'Payments', 'commissions' => 'Commissions' ) as $k => $l ) {
			echo '<a class="ppc-export" href="' . esc_url( PPC_Admin::export_url( $k ) ) . '"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M12 4v11m0 0l-4-4m4 4l4-4M5 19h14"/></svg>' . esc_html( $l ) . '</a>';
		}
		echo '</div>';
		PPC_Admin_UI::card_close();

		PPC_Admin_UI::card_open( 'Shortcodes' );
		echo '<table class="ppc-mini"><tbody><tr><td><code>[pentarch_pos_demo_form]</code></td><td>Demo booking form. Options: <code>title</code>, <code>subtitle</code>, <code>button</code>. Picks up <code>?ref=AG-XXXX</code> automatically.</td></tr><tr><td><code>[pentarch_pos_trial_link]</code></td><td>“Start free trial” button to /pos/ that carries the referral code. Options: <code>label</code>, <code>demo="1"</code> (links to the live demo), <code>style="primary|dark|ghost"</code>.</td></tr></tbody></table>';
		PPC_Admin_UI::card_close();
		PPC_Admin_UI::close();
	}
}
