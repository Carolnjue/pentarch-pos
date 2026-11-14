<?php
/**
 * Small rendering helpers for the admin screens (all output escaped here).
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Admin_UI {

	const PER_PAGE = 25;

	public static function url( $page, $args = array() ) {
		return add_query_arg( array_merge( array( 'page' => $page ), $args ), admin_url( 'admin.php' ) );
	}

	public static function current_url() {
		$req = isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
		return $req ? home_url( $req ) : admin_url( 'admin.php?page=ppc' );
	}

	/** Brand header + flash message. */
	public static function open( $title, $subtitle = '', $actions = '', $crumb = null ) {
		$mark = PPC_URL . 'assets/pentarch-mark.svg';
		echo '<div class="wrap ppc-wrap"><h1 class="screen-reader-text">' . esc_html( $title ) . '</h1>';
		echo '<header class="ppc-top"><div class="ppc-top__brand"><img src="' . esc_url( $mark ) . '" alt="" width="34" height="34"><div><span class="ppc-top__eyebrow">Pentarch POS</span><span class="ppc-top__product">Cloud &amp; Sales</span></div></div>';
		echo '<nav class="ppc-top__nav" aria-label="Pentarch POS">';
		$items = array(
			'ppc'             => 'Dashboard',
			'ppc-businesses'  => 'Businesses',
			'ppc-agents'      => 'Agents',
			'ppc-leads'       => 'Leads',
			'ppc-bookings'    => 'Bookings',
			'ppc-payments'    => 'Payments',
			'ppc-commissions' => 'Commissions',
			'ppc-settings'    => 'Settings',
			'ppc-tools'       => 'Tools',
		);
		$cur   = isset( $_GET['page'] ) ? sanitize_key( $_GET['page'] ) : 'ppc'; // phpcs:ignore
		foreach ( $items as $slug => $label ) {
			echo '<a href="' . esc_url( self::url( $slug ) ) . '"' . ( $slug === $cur ? ' class="is-current" aria-current="page"' : '' ) . '>' . esc_html( $label ) . '</a>';
		}
		echo '</nav></header><div class="ppc-strip" aria-hidden="true"></div>';
		echo '<div class="ppc-body">';
		echo '<div class="ppc-head"><div>';
		if ( $crumb ) {
			echo '<a class="ppc-crumb" href="' . esc_url( $crumb[1] ) . '">← ' . esc_html( $crumb[0] ) . '</a>';
		}
		echo '<h2 class="ppc-title">' . esc_html( $title ) . '</h2>';
		if ( $subtitle ) {
			echo '<p class="ppc-sub">' . wp_kses_post( $subtitle ) . '</p>';
		}
		echo '</div>';
		if ( $actions ) {
			echo '<div class="ppc-head__actions">' . $actions . '</div>'; // phpcs:ignore -- built from escaped helpers.
		}
		echo '</div>';
		$f = PPC_Admin::take_flash();
		if ( $f ) {
			echo '<div class="ppc-flash ppc-flash--' . esc_attr( $f[1] ) . '" role="status">' . wp_kses(
				$f[0],
				array(
					'code'   => array( 'class' => array() ),
					'a'      => array(
						'href'   => array(),
						'target' => array(),
						'rel'    => array(),
						'class'  => array(),
					),
					'strong' => array(),
				)
			) . '</div>';
		}
	}

	public static function close() {
		echo '</div></div>';
	}

	public static function badge( $status, $label = null ) {
		$map = array(
			'trial'     => 'sun',
			'active'    => 'teal',
			'grace'     => 'coral',
			'expired'   => 'grey',
			'suspended' => 'ink',
			'pending'   => 'sun',
			'approved'  => 'navy',
			'paid'      => 'teal',
			'cancelled' => 'grey',
			'new'       => 'coral',
			'contacted' => 'navy',
			'scheduled' => 'sun',
			'done'      => 'teal',
			'demo_booked' => 'sun',
			'demo_done' => 'navy',
			'won'       => 'teal',
			'lost'      => 'grey',
		);
		$tone = isset( $map[ $status ] ) ? $map[ $status ] : 'grey';
		if ( null === $label ) {
			$labels = array_merge( PPC_Licence::statuses(), PPC_Agents::stage_labels(), array( 'pending' => 'Pending', 'approved' => 'Approved', 'paid' => 'Paid', 'cancelled' => 'Cancelled', 'scheduled' => 'Scheduled', 'done' => 'Done', 'contacted' => 'Contacted', 'new' => 'New', 'active' => 'Active', 'suspended' => 'Suspended' ) );
			$label  = isset( $labels[ $status ] ) ? $labels[ $status ] : ucfirst( str_replace( '_', ' ', (string) $status ) );
		}
		return '<span class="ppc-badge ppc-badge--' . esc_attr( $tone ) . '">' . esc_html( $label ) . '</span>';
	}

	public static function kpi( $label, $value, $hint = '', $tone = '', $href = '' ) {
		$tag = $href ? 'a href="' . esc_url( $href ) . '"' : 'div';
		echo '<' . $tag . ' class="ppc-kpi' . ( $tone ? ' ppc-kpi--' . esc_attr( $tone ) : '' ) . '">'; // phpcs:ignore
		echo '<span class="ppc-kpi__label">' . esc_html( $label ) . '</span>';
		echo '<span class="ppc-kpi__value">' . esc_html( $value ) . '</span>';
		if ( $hint ) {
			echo '<span class="ppc-kpi__hint">' . esc_html( $hint ) . '</span>';
		}
		echo $href ? '</a>' : '</div>';
	}

	/** Hidden fields for an admin-post action. */
	public static function action_fields( $do, $extra = array() ) {
		$out  = wp_nonce_field( 'ppc_action', '_wpnonce', true, false );
		$out .= '<input type="hidden" name="action" value="ppc_do"><input type="hidden" name="do" value="' . esc_attr( $do ) . '">';
		$out .= '<input type="hidden" name="_back" value="' . esc_attr( self::current_url() ) . '">';
		foreach ( $extra as $k => $v ) {
			$out .= '<input type="hidden" name="' . esc_attr( $k ) . '" value="' . esc_attr( $v ) . '">';
		}
		return $out;
	}

	public static function form_open( $do, $extra = array(), $class = '' ) {
		return '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"' . ( $class ? ' class="' . esc_attr( $class ) . '"' : '' ) . '>' . self::action_fields( $do, $extra );
	}

	/** One-button form. */
	public static function button_form( $do, $label, $extra = array(), $style = 'secondary', $confirm = '' ) {
		return self::form_open( $do, $extra, 'ppc-inline' ) . '<button type="submit" class="ppc-btn ppc-btn--' . esc_attr( $style ) . '"' . ( $confirm ? ' data-confirm="' . esc_attr( $confirm ) . '"' : '' ) . '>' . esc_html( $label ) . '</button></form>';
	}

	public static function link_btn( $href, $label, $style = 'secondary', $attrs = '' ) {
		return '<a class="ppc-btn ppc-btn--' . esc_attr( $style ) . '" href="' . esc_url( $href ) . '" ' . $attrs . '>' . esc_html( $label ) . '</a>';
	}

	/** Filter/search bar (GET). $selects: name => [label, options[]]. */
	public static function filters( $page, $search_placeholder, $selects = array(), $extra_hidden = array() ) {
		$q = isset( $_GET['s'] ) ? sanitize_text_field( wp_unslash( $_GET['s'] ) ) : ''; // phpcs:ignore
		echo '<form class="ppc-filters" method="get" action="' . esc_url( admin_url( 'admin.php' ) ) . '">';
		echo '<input type="hidden" name="page" value="' . esc_attr( $page ) . '">';
		foreach ( $extra_hidden as $k => $v ) {
			echo '<input type="hidden" name="' . esc_attr( $k ) . '" value="' . esc_attr( $v ) . '">';
		}
		echo '<label class="ppc-search"><span class="screen-reader-text">Search</span><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/></svg><input type="search" name="s" value="' . esc_attr( $q ) . '" placeholder="' . esc_attr( $search_placeholder ) . '"></label>';
		foreach ( $selects as $name => $def ) {
			$cur = isset( $_GET[ $name ] ) ? sanitize_text_field( wp_unslash( $_GET[ $name ] ) ) : ''; // phpcs:ignore
			echo '<label class="ppc-select"><span class="screen-reader-text">' . esc_html( $def[0] ) . '</span><select name="' . esc_attr( $name ) . '" data-autosubmit>';
			echo '<option value="">' . esc_html( $def[0] ) . '</option>';
			foreach ( $def[1] as $v => $l ) {
				echo '<option value="' . esc_attr( $v ) . '"' . selected( $cur, (string) $v, false ) . '>' . esc_html( $l ) . '</option>';
			}
			echo '</select></label>';
		}
		echo '<button class="ppc-btn ppc-btn--secondary" type="submit">Filter</button>';
		$active = $q;
		foreach ( array_keys( $selects ) as $n ) {
			$active .= isset( $_GET[ $n ] ) ? sanitize_text_field( wp_unslash( $_GET[ $n ] ) ) : ''; // phpcs:ignore
		}
		if ( '' !== $active ) {
			echo '<a class="ppc-clear" href="' . esc_url( self::url( $page, $extra_hidden ) ) . '">Clear</a>';
		}
		echo '</form>';
	}

	public static function paged() {
		return isset( $_GET['paged'] ) ? max( 1, (int) $_GET['paged'] ) : 1; // phpcs:ignore
	}

	public static function pager( $total, $per = self::PER_PAGE ) {
		$pages = (int) ceil( $total / $per );
		$cur   = self::paged();
		echo '<div class="ppc-pager"><span>' . esc_html( number_format( $total ) ) . ' result' . ( 1 === (int) $total ? '' : 's' ) . '</span>';
		if ( $pages > 1 ) {
			echo '<span class="ppc-pager__links">';
			if ( $cur > 1 ) {
				echo '<a href="' . esc_url( add_query_arg( 'paged', $cur - 1, self::current_url() ) ) . '">‹ Prev</a>';
			}
			echo '<span>Page ' . (int) $cur . ' of ' . (int) $pages . '</span>';
			if ( $cur < $pages ) {
				echo '<a href="' . esc_url( add_query_arg( 'paged', $cur + 1, self::current_url() ) ) . '">Next ›</a>';
			}
			echo '</span>';
		}
		echo '</div>';
	}

	public static function empty_state( $title, $text, $cta = '' ) {
		echo '<div class="ppc-empty"><div class="ppc-empty__icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="28" height="28"><path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" d="M4 7h16M4 12h10M4 17h7"/></svg></div><h3>' . esc_html( $title ) . '</h3><p>' . esc_html( $text ) . '</p>' . $cta . '</div>'; // phpcs:ignore
	}

	public static function card_open( $title = '', $actions = '', $class = '' ) {
		echo '<section class="ppc-card' . ( $class ? ' ' . esc_attr( $class ) : '' ) . '">';
		if ( $title || $actions ) {
			echo '<div class="ppc-card__head"><h3>' . esc_html( $title ) . '</h3>' . ( $actions ? '<div class="ppc-card__actions">' . $actions . '</div>' : '' ) . '</div>'; // phpcs:ignore
		}
	}

	public static function card_close() {
		echo '</section>';
	}

	/** Definition list rows. */
	public static function dl( $rows ) {
		echo '<dl class="ppc-dl">';
		foreach ( $rows as $k => $v ) {
			echo '<dt>' . esc_html( $k ) . '</dt><dd>' . ( '' === (string) $v ? '<span class="ppc-mute">—</span>' : $v ) . '</dd>'; // phpcs:ignore -- callers escape values.
		}
		echo '</dl>';
	}

	public static function e( $v ) {
		return esc_html( (string) $v );
	}

	public static function phone_link( $p ) {
		if ( ! $p ) {
			return '';
		}
		return '<a href="tel:+' . esc_attr( $p ) . '">' . esc_html( PPC_Util::phone_pretty( $p ) ) . '</a> <a class="ppc-wa" target="_blank" rel="noopener" title="WhatsApp" href="' . esc_url( PPC_Util::wa_link( $p ) ) . '"><svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm4.5 12.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg><span class="screen-reader-text">WhatsApp</span></a>';
	}

	public static function select( $name, $options, $current, $attrs = '' ) {
		$o = '<select name="' . esc_attr( $name ) . '" ' . $attrs . '>';
		foreach ( $options as $v => $l ) {
			$o .= '<option value="' . esc_attr( $v ) . '"' . selected( (string) $current, (string) $v, false ) . '>' . esc_html( $l ) . '</option>';
		}
		return $o . '</select>';
	}

	/** Options list of agents (id => "Name (AG-XXXX)"). */
	public static function agent_options( $empty = '— None —', $only_active = false ) {
		global $wpdb;
		$rows = $wpdb->get_results( 'SELECT id, name, code, status FROM ' . PPC_Util::t( 'agents' ) . ( $only_active ? " WHERE status = 'active'" : '' ) . ' ORDER BY name ASC' );
		$o    = array( '' => $empty );
		foreach ( $rows as $r ) {
			$o[ $r->id ] = $r->name . ' (' . $r->code . ')' . ( 'active' !== $r->status ? ' — ' . $r->status : '' );
		}
		return $o;
	}

	/** Tiny inline bar chart (SVG) for a series of ints. */
	public static function bars( $series, $labels = array() ) {
		$max = max( 1, max( $series ) );
		$n   = count( $series );
		$w   = 100 / max( 1, $n );
		$svg = '<svg class="ppc-bars" viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Sign-ups per day">';
		foreach ( array_values( $series ) as $i => $v ) {
			$h    = $v ? max( 1.5, 38 * $v / $max ) : 0.6;
			$svg .= '<rect x="' . round( $i * $w + $w * 0.14, 2 ) . '" y="' . round( 40 - $h, 2 ) . '" width="' . round( $w * 0.72, 2 ) . '" height="' . round( $h, 2 ) . '" rx="0.6"><title>' . esc_html( ( isset( $labels[ $i ] ) ? $labels[ $i ] . ': ' : '' ) . $v ) . '</title></rect>';
		}
		return $svg . '</svg>';
	}
}
