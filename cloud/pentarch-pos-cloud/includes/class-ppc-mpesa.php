<?php
/**
 * M-Pesa Daraja STK push (Lipa na M-Pesa Online).
 *
 * Credentials: a tenant can have its own Daraja app (admin → business → M-Pesa) used for
 * sale payments into the tenant's own paybill/till. Pentarch's global credentials (Settings)
 * are only used for licence payments (ref = the tenant's business code), so customer sale
 * money is never collected into Pentarch's shortcode.
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Mpesa {

	/** Resolve credentials for a tenant + purpose. Returns array or null. */
	public static function config_for( $tenant, $ref ) {
		$own = json_decode( (string) $tenant->mpesa_config, true );
		if ( is_array( $own ) && ! empty( $own['consumer_key'] ) && ! empty( $own['consumer_secret'] ) && ! empty( $own['shortcode'] ) && ! empty( $own['passkey'] ) ) {
			return array(
				'env'             => isset( $own['env'] ) && 'production' === $own['env'] ? 'production' : 'sandbox',
				'consumer_key'    => $own['consumer_key'],
				'consumer_secret' => $own['consumer_secret'],
				'shortcode'       => $own['shortcode'],
				'passkey'         => $own['passkey'],
				'type'            => isset( $own['type'] ) && 'till' === $own['type'] ? 'till' : 'paybill',
				'till'            => isset( $own['till'] ) ? $own['till'] : '',
				'purpose'         => 'sale',
				'scope'           => 'tenant',
			);
		}
		if ( PPC_Settings::mpesa_configured() && strtoupper( trim( (string) $ref ) ) === strtoupper( PPC_Licence::account_ref( $tenant ) ) ) {
			return array(
				'env'             => PPC_Settings::get( 'mpesa_env' ),
				'consumer_key'    => PPC_Settings::get( 'mpesa_consumer_key' ),
				'consumer_secret' => PPC_Settings::get( 'mpesa_consumer_secret' ),
				'shortcode'       => PPC_Settings::get( 'mpesa_shortcode' ),
				'passkey'         => PPC_Settings::get( 'mpesa_passkey' ),
				'type'            => PPC_Settings::get( 'mpesa_type' ),
				'till'            => '',
				'purpose'         => 'licence',
				'scope'           => 'global',
			);
		}
		return null;
	}

	public static function base_url( $env ) {
		return 'production' === $env ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
	}

	public static function callback_url() {
		return rest_url( PPC_NS . '/mpesa/callback/' . PPC_Settings::get( 'mpesa_callback_secret' ) );
	}

	private static function access_token( $cfg ) {
		$key    = 'ppc_mpesa_tok_' . md5( $cfg['consumer_key'] . $cfg['env'] );
		$cached = get_transient( $key );
		if ( $cached ) {
			return $cached;
		}
		$res = wp_remote_get(
			self::base_url( $cfg['env'] ) . '/oauth/v1/generate?grant_type=client_credentials',
			array(
				'timeout' => 20,
				'headers' => array( 'Authorization' => 'Basic ' . base64_encode( $cfg['consumer_key'] . ':' . $cfg['consumer_secret'] ) ),
			)
		);
		if ( is_wp_error( $res ) ) {
			return $res;
		}
		$body = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( empty( $body['access_token'] ) ) {
			return PPC_Util::err( 'mpesa_auth_failed', 'M-Pesa authentication failed. Check the Daraja consumer key and secret.', 502 );
		}
		set_transient( $key, $body['access_token'], max( 60, (int) ( isset( $body['expires_in'] ) ? $body['expires_in'] : 3599 ) - 120 ) );
		return $body['access_token'];
	}

	/**
	 * Start an STK push. Returns ['checkout_request_id'=>...] or WP_Error.
	 */
	public static function stk( $tenant, $phone_raw, $amount, $ref ) {
		global $wpdb;
		$cfg = self::config_for( $tenant, $ref );
		if ( ! $cfg ) {
			return PPC_Util::err( 'mpesa_not_configured', 'M-Pesa STK push is not configured for this business. Enter the M-Pesa code manually.', 501 );
		}
		$phone = PPC_Util::phone( $phone_raw );
		if ( ! $phone ) {
			return PPC_Util::err( 'invalid_phone', 'Enter a valid Safaricom number.', 422 );
		}
		$amount = (int) $amount;
		if ( $amount < 1 || $amount > 250000 ) {
			return PPC_Util::err( 'invalid_amount', 'Amount must be between KES 1 and KES 250,000.', 422 );
		}
		$ref   = substr( preg_replace( '/[^A-Za-z0-9\-]/', '', (string) $ref ), 0, 12 );
		$token = self::access_token( $cfg );
		if ( is_wp_error( $token ) ) {
			return $token;
		}
		$ts       = wp_date( 'YmdHis', null, new DateTimeZone( 'Africa/Nairobi' ) );
		$password = base64_encode( $cfg['shortcode'] . $cfg['passkey'] . $ts );
		$is_till  = 'till' === $cfg['type'];
		$payload  = array(
			'BusinessShortCode' => $cfg['shortcode'],
			'Password'          => $password,
			'Timestamp'         => $ts,
			'TransactionType'   => $is_till ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
			'Amount'            => $amount,
			'PartyA'            => $phone,
			'PartyB'            => $is_till && ! empty( $cfg['till'] ) ? $cfg['till'] : $cfg['shortcode'],
			'PhoneNumber'       => $phone,
			'CallBackURL'       => self::callback_url(),
			'AccountReference'  => $ref ? $ref : $tenant->code,
			'TransactionDesc'   => 'licence' === $cfg['purpose'] ? 'Pentarch POS licence' : 'Payment',
		);
		$res      = wp_remote_post(
			self::base_url( $cfg['env'] ) . '/mpesa/stkpush/v1/processrequest',
			array(
				'timeout' => 30,
				'headers' => array(
					'Authorization' => 'Bearer ' . $token,
					'Content-Type'  => 'application/json',
				),
				'body'    => wp_json_encode( $payload ),
			)
		);
		if ( is_wp_error( $res ) ) {
			return PPC_Util::err( 'mpesa_unreachable', 'Could not reach M-Pesa. Please try again.', 502 );
		}
		$body = json_decode( wp_remote_retrieve_body( $res ), true );
		if ( empty( $body['CheckoutRequestID'] ) || ( isset( $body['ResponseCode'] ) && '0' !== (string) $body['ResponseCode'] ) ) {
			$msg = isset( $body['errorMessage'] ) ? $body['errorMessage'] : ( isset( $body['ResponseDescription'] ) ? $body['ResponseDescription'] : 'M-Pesa rejected the request.' );
			return PPC_Util::err( 'mpesa_rejected', PPC_Util::text( $msg, 200 ), 502 );
		}
		$now = PPC_Util::now();
		$wpdb->insert(
			PPC_Util::t( 'mpesa_requests' ),
			array(
				'tenant_id'           => $tenant->id,
				'checkout_request_id' => $body['CheckoutRequestID'],
				'merchant_request_id' => isset( $body['MerchantRequestID'] ) ? $body['MerchantRequestID'] : '',
				'purpose'             => $cfg['purpose'],
				'phone'               => $phone,
				'amount'              => $amount,
				'ref'                 => $ref,
				'status'              => 'pending',
				'created_at'          => $now,
				'updated_at'          => $now,
			)
		);
		return array(
			'checkout_request_id' => $body['CheckoutRequestID'],
			'customer_message'    => isset( $body['CustomerMessage'] ) ? $body['CustomerMessage'] : '',
		);
	}

	public static function status( $tenant, $checkout_id ) {
		global $wpdb;
		$row = $wpdb->get_row( $wpdb->prepare( 'SELECT * FROM ' . PPC_Util::t( 'mpesa_requests' ) . ' WHERE checkout_request_id = %s AND tenant_id = %s', $checkout_id, $tenant->id ) );
		if ( ! $row ) {
			return PPC_Util::err( 'not_found', 'Payment request not found.', 404 );
		}
		// Requests with no callback after 3 minutes are treated as failed (customer did not respond).
		if ( 'pending' === $row->status && PPC_Util::ts( $row->created_at ) < time() - 180 ) {
			$wpdb->update(
				PPC_Util::t( 'mpesa_requests' ),
				array(
					'status'      => 'failed',
					'result_desc' => 'Timed out waiting for M-Pesa confirmation.',
					'updated_at'  => PPC_Util::now(),
				),
				array( 'id' => $row->id )
			);
			$row->status      = 'failed';
			$row->result_desc = 'Timed out waiting for M-Pesa confirmation.';
		}
		return array(
			'status'        => $row->status,
			'mpesa_receipt' => $row->mpesa_receipt ? $row->mpesa_receipt : null,
			'result_desc'   => $row->result_desc,
			'amount'        => (int) $row->amount,
		);
	}

	/** Daraja callback. Always acknowledges with ResultCode 0. */
	public static function callback( $body ) {
		global $wpdb;
		$cb = isset( $body['Body']['stkCallback'] ) ? $body['Body']['stkCallback'] : null;
		if ( ! is_array( $cb ) || empty( $cb['CheckoutRequestID'] ) ) {
			return;
		}
		$table = PPC_Util::t( 'mpesa_requests' );
		$row   = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE checkout_request_id = %s", $cb['CheckoutRequestID'] ) );
		if ( ! $row || 'paid' === $row->status ) {
			return;
		}
		$code    = isset( $cb['ResultCode'] ) ? (string) $cb['ResultCode'] : '';
		$receipt = '';
		$amount  = (int) $row->amount;
		if ( '0' === $code && ! empty( $cb['CallbackMetadata']['Item'] ) && is_array( $cb['CallbackMetadata']['Item'] ) ) {
			foreach ( $cb['CallbackMetadata']['Item'] as $it ) {
				if ( isset( $it['Name'], $it['Value'] ) && 'MpesaReceiptNumber' === $it['Name'] ) {
					$receipt = PPC_Util::text( $it['Value'], 30 );
				}
				if ( isset( $it['Name'], $it['Value'] ) && 'Amount' === $it['Name'] ) {
					$amount = (int) $it['Value'];
				}
			}
		}
		$status = '0' === $code ? 'paid' : 'failed';
		$wpdb->update(
			$table,
			array(
				'status'        => $status,
				'result_code'   => substr( $code, 0, 10 ),
				'result_desc'   => isset( $cb['ResultDesc'] ) ? PPC_Util::text( $cb['ResultDesc'], 255 ) : '',
				'mpesa_receipt' => $receipt,
				'raw'           => substr( wp_json_encode( $cb ), 0, 4000 ),
				'updated_at'    => PPC_Util::now(),
			),
			array( 'id' => $row->id )
		);
		if ( 'paid' === $status && 'licence' === $row->purpose && PPC_Settings::get( 'mpesa_auto_record' ) ) {
			$monthly = max( 1, (int) PPC_Settings::get( 'software_monthly' ) );
			$yearly  = max( 1, (int) PPC_Settings::get( 'software_yearly' ) );
			if ( $amount >= $yearly ) {
				$in = array(
					'type' => 'subscription_yearly',
					'qty'  => max( 1, (int) floor( $amount / $yearly ) ),
				);
			} elseif ( $amount >= $monthly ) {
				$in = array(
					'type' => 'subscription_monthly',
					'qty'  => max( 1, (int) floor( $amount / $monthly ) ),
				);
			} else {
				$in = array( 'type' => 'other' );
			}
			$in['amount'] = $amount;
			$in['method'] = 'mpesa';
			$in['ref']    = $receipt;
			$in['note']   = 'Auto-recorded from M-Pesa STK push';
			$res          = PPC_Payments::record( $row->tenant_id, $in, 'mpesa' );
			if ( is_array( $res ) ) {
				$wpdb->update( $table, array( 'payment_id' => $res['payment_id'] ), array( 'id' => $row->id ) );
			}
		}
	}
}
