<?php
/**
 * Email notifications (wp_mail).
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Notify {

	/** Wrap content in a simple branded HTML email. */
	private static function wrap( $title, $rows, $cta_label = '', $cta_url = '', $intro = '' ) {
		$h  = '<div style="background:#F7F5F0;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#121A2E">';
		$h .= '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #E4E0D7;border-radius:12px;overflow:hidden">';
		$h .= '<div style="height:5px;background:linear-gradient(100deg,#EE4B3B 0%,#F6B22C 48%,#14B1AC 100%);background-color:#EE4B3B"></div>';
		$h .= '<div style="padding:22px 24px 8px"><div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#646E82">Pentarch POS</div>';
		$h .= '<h1 style="font-size:20px;margin:6px 0 4px;color:#0A1530">' . esc_html( $title ) . '</h1>';
		if ( $intro ) {
			$h .= '<p style="color:#3D475C;font-size:14px;line-height:1.5;margin:8px 0 0">' . esc_html( $intro ) . '</p>';
		}
		$h .= '</div><table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0">';
		foreach ( $rows as $k => $v ) {
			if ( '' === (string) $v ) {
				continue;
			}
			$h .= '<tr><td style="padding:8px 24px;color:#646E82;width:38%;border-top:1px solid #EFEBE3;vertical-align:top">' . esc_html( $k ) . '</td><td style="padding:8px 24px 8px 0;border-top:1px solid #EFEBE3;color:#121A2E">' . nl2br( esc_html( $v ) ) . '</td></tr>';
		}
		$h .= '</table>';
		if ( $cta_url ) {
			$h .= '<div style="padding:12px 24px 24px"><a href="' . esc_url( $cta_url ) . '" style="display:inline-block;background:#C9301F;color:#fff;text-decoration:none;padding:11px 18px;border-radius:8px;font-weight:bold">' . esc_html( $cta_label ) . '</a></div>';
		}
		$h .= '</div><p style="text-align:center;color:#646E82;font-size:12px;margin-top:14px">Pentarch Communications · ' . esc_html( PPC_Settings::get( 'phone' ) ) . ' · ' . esc_html( PPC_Settings::get( 'email' ) ) . '</p></div>';
		return $h;
	}

	private static function send( $to, $subject, $html ) {
		if ( ! $to || ! is_email( $to ) ) {
			return false;
		}
		$headers = array( 'Content-Type: text/html; charset=UTF-8' );
		return wp_mail( $to, $subject, $html, $headers );
	}

	public static function tenant_signup( $t ) {
		$agent = $t->agent_id ? PPC_Agents::get( $t->agent_id ) : null;
		$html  = self::wrap(
			'New free trial: ' . $t->business_name,
			array(
				'Business'      => $t->business_name . ' (' . $t->code . ')',
				'Type'          => PPC_Tenants::type_label( $t->business_type ),
				'Owner'         => $t->owner_name,
				'Phone'         => PPC_Util::phone_pretty( $t->phone ),
				'Email'         => $t->email,
				'Location'      => trim( $t->town . ', ' . $t->county, ', ' ),
				'Source'        => ucfirst( $t->source ),
				'Agent'         => $agent ? $agent->name . ' (' . $agent->code . ')' : '',
				'Trial ends'    => PPC_Util::fmt_date( $t->trial_ends ),
			),
			'Open in wp-admin',
			admin_url( 'admin.php?page=ppc-businesses&id=' . rawurlencode( $t->id ) )
		);
		self::send( PPC_Settings::admin_email(), '[Pentarch POS] New trial — ' . $t->business_name, $html );
	}

	public static function agent_signup( $a ) {
		$html = self::wrap(
			'New agent application: ' . $a->name,
			array(
				'Name'          => $a->name,
				'Agent code'    => $a->code,
				'Phone'         => PPC_Util::phone_pretty( $a->phone ),
				'Email'         => $a->email,
				'Location'      => trim( $a->town . ', ' . $a->county, ', ' ),
				'Heard about us' => $a->heard_from,
			),
			'Review and approve',
			admin_url( 'admin.php?page=ppc-agents&id=' . (int) $a->id ),
			'This agent is waiting for approval before they can add leads.'
		);
		self::send( PPC_Settings::admin_email(), '[Pentarch POS] New agent sign-up — ' . $a->name, $html );
	}

	public static function agent_approved( $a ) {
		$html = self::wrap(
			'Welcome to the Pentarch POS sales team',
			array(
				'Your agent code' => $a->code,
				'Demo link'       => PPC_Settings::pos_url( array( 'demo' => 1, 'ref' => $a->code ) ),
				'Website link'    => PPC_Settings::website_url( array( 'ref' => $a->code ) ),
				'Support'         => PPC_Settings::get( 'phone' ) . ' (WhatsApp)',
			),
			'Open the agent portal',
			home_url( '/pos/agents/' ),
			'Hello ' . PPC_Util::first_name( $a->name ) . ', your agent account has been approved. Share your links so every client you bring is credited to you.'
		);
		self::send( $a->email, 'Your Pentarch POS agent account is approved', $html );
	}

	public static function demo_booking( $b ) {
		$agent = $b->agent_id ? PPC_Agents::get( $b->agent_id ) : null;
		$html  = self::wrap(
			'New demo booking ' . $b->ref,
			array(
				'Name'           => $b->name,
				'Business'       => $b->business,
				'Type'           => PPC_Tenants::type_label( $b->business_type ),
				'Phone'          => PPC_Util::phone_pretty( $b->phone ),
				'Email'          => $b->email,
				'Town'           => $b->town,
				'Preferred time' => trim( $b->preferred_date . ' ' . $b->preferred_time ),
				'Message'        => (string) $b->message,
				'Agent'          => $agent ? $agent->name . ' (' . $agent->code . ')' : $b->agent_code,
				'Page'           => $b->source_page,
			),
			'Open bookings',
			admin_url( 'admin.php?page=ppc-bookings&id=' . (int) $b->id )
		);
		self::send( PPC_Settings::admin_email(), '[Pentarch POS] Demo booking ' . $b->ref . ' — ' . $b->business, $html );
	}
}
