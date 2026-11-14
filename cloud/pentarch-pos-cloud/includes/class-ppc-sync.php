<?php
/**
 * Sync engine (SPEC §4): generic record store with server_seq, LWW for synced
 * entities, insert-once (idempotent) for ledger entities.
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Sync {

	const MAX_PUSH       = 500;
	const MAX_PULL       = 1000;
	const MAX_RECORD     = 524288; // 512 KB per record JSON.
	const MAX_INSERT_SQL = 2097152; // Split multi-row inserts at ~2 MB.

	/** Append-only ledger entities (SPEC §3 "L"). */
	public static function ledger_entities() {
		return apply_filters( 'ppc_ledger_entities', array( 'stock_moves', 'customer_payments', 'goods_received', 'supplier_payments', 'sales', 'returns', 'cash_moves', 'expenses', 'audit' ) );
	}

	/** Local-only entities that must never be synced (SPEC §3 "X"). */
	public static function local_only_entities() {
		return array( 'meta', 'outbox', 'stock_levels' );
	}

	/** Per-tenant advisory lock (MySQL/MariaDB). Serialises pushes so seq order == commit order. */
	private static function lock( $name ) {
		global $wpdb;
		if ( PPC_Util::is_sqlite() ) {
			return true;
		}
		$got = $wpdb->get_var( $wpdb->prepare( 'SELECT GET_LOCK(%s, 15)', 'ppc_' . md5( $name ) ) );
		return '1' === (string) $got;
	}

	private static function unlock( $name ) {
		global $wpdb;
		if ( PPC_Util::is_sqlite() ) {
			return;
		}
		$wpdb->get_var( $wpdb->prepare( 'SELECT RELEASE_LOCK(%s)', 'ppc_' . md5( $name ) ) );
	}

	/**
	 * Normalise one incoming change. Returns array or string reason.
	 */
	private static function normalise_change( $c ) {
		if ( ! is_array( $c ) ) {
			return 'invalid_change';
		}
		$entity = isset( $c['entity'] ) ? (string) $c['entity'] : '';
		$id     = isset( $c['id'] ) ? $c['id'] : '';
		if ( is_int( $id ) ) {
			$id = (string) $id;
		}
		if ( ! preg_match( '/^[a-z][a-z0-9_]{0,39}$/', $entity ) ) {
			return 'invalid_entity';
		}
		if ( in_array( $entity, self::local_only_entities(), true ) ) {
			return 'local_only_entity';
		}
		if ( ! PPC_Util::valid_id( $id ) ) {
			return 'invalid_id';
		}
		$data = isset( $c['data'] ) ? $c['data'] : null;
		if ( null === $data ) {
			$data = array();
		}
		if ( ! is_array( $data ) ) {
			return 'invalid_data';
		}
		$updated = isset( $c['updated_at'] ) ? $c['updated_at'] : ( isset( $data['updated_at'] ) ? $data['updated_at'] : null );
		if ( ! is_numeric( $updated ) || (float) $updated <= 0 ) {
			return 'invalid_updated_at';
		}
		$updated = (int) $updated;
		// Reject clocks wildly in the future (> 1 day) to protect LWW.
		if ( $updated > PPC_Util::now_ms() + DAY_IN_SECONDS * 1000 ) {
			return 'updated_at_in_future';
		}
		$deleted = ! empty( $c['deleted'] ) || ! empty( $data['deleted'] ) ? 1 : 0;
		$branch  = isset( $c['branch_id'] ) ? $c['branch_id'] : ( isset( $data['branch_id'] ) ? $data['branch_id'] : null );
		$branch  = ( is_string( $branch ) && PPC_Util::valid_id( $branch ) ) ? $branch : null;
		$json    = wp_json_encode( $data );
		if ( false === $json ) {
			return 'invalid_data';
		}
		if ( strlen( $json ) > self::MAX_RECORD ) {
			return 'record_too_large';
		}
		return array(
			'entity'     => $entity,
			'id'         => $id,
			'branch_id'  => $branch,
			'json'       => $json,
			'data'       => $data,
			'updated_at' => $updated,
			'deleted'    => $deleted,
		);
	}

	/**
	 * Push changes for a tenant.
	 *
	 * @return array|WP_Error {accepted, rejected, server_seq, superseded}
	 */
	public static function push( $tenant, $device, $changes ) {
		global $wpdb;
		if ( ! is_array( $changes ) ) {
			return PPC_Util::err( 'invalid_input', 'changes must be an array.', 400 );
		}
		if ( count( $changes ) > self::MAX_PUSH ) {
			return PPC_Util::err( 'batch_too_large', 'Push at most ' . self::MAX_PUSH . ' changes per request.', 413, array( 'max' => self::MAX_PUSH ) );
		}
		$table      = PPC_Util::t( 'records' );
		$accepted   = array();
		$rejected   = array();
		$superseded = array();
		$ledger     = array_flip( self::ledger_entities() );

		// 1. Validate and de-duplicate within the batch (keep newest per entity+id).
		$batch = array();
		foreach ( $changes as $c ) {
			$n = self::normalise_change( $c );
			if ( is_string( $n ) ) {
				$rejected[] = array(
					'id'     => is_array( $c ) && isset( $c['id'] ) && is_scalar( $c['id'] ) ? (string) $c['id'] : '',
					'reason' => $n,
				);
				continue;
			}
			$key = $n['entity'] . "\0" . $n['id'];
			if ( isset( $batch[ $key ] ) && $batch[ $key ]['updated_at'] >= $n['updated_at'] ) {
				$accepted[] = $n['id'];
				continue;
			}
			if ( isset( $batch[ $key ] ) ) {
				$accepted[] = $batch[ $key ]['id'];
			}
			$batch[ $key ] = $n;
		}

		if ( $batch ) {
			$lock = 'push_' . $tenant->id;
			if ( ! self::lock( $lock ) ) {
				return PPC_Util::err( 'busy', 'Another sync is in progress. Please retry shortly.', 409 );
			}

			// 2. Load existing versions (grouped per entity).
			$by_entity = array();
			foreach ( $batch as $n ) {
				$by_entity[ $n['entity'] ][] = $n['id'];
			}
			$existing = array();
			foreach ( $by_entity as $entity => $ids ) {
				foreach ( array_chunk( $ids, 400 ) as $chunk ) {
					$ph   = implode( ',', array_fill( 0, count( $chunk ), '%s' ) );
					$args = array_merge( array( $tenant->id, $entity ), $chunk );
					$rows = $wpdb->get_results( $wpdb->prepare( "SELECT record_id, updated_at FROM $table WHERE tenant_id = %s AND entity = %s AND record_id IN ($ph)", $args ) );
					foreach ( $rows as $r ) {
						$existing[ $entity . "\0" . $r->record_id ] = (int) $r->updated_at;
					}
				}
			}

			// 3. Decide.
			$inserts  = array();
			$replaces = array();
			foreach ( $batch as $key => $n ) {
				if ( ! isset( $existing[ $key ] ) ) {
					$inserts[] = $n;
				} elseif ( $n['updated_at'] > $existing[ $key ] ) {
					// LWW. Ledger rows are insert-once; a strictly newer version of the same
					// ledger id (e.g. a sale marked void) is applied, identical retries are ignored.
					$replaces[] = $n;
				} else {
					$accepted[]   = $n['id'];
					$superseded[] = $n['id'];
				}
			}

			// 4. Write in one transaction.
			$now = PPC_Util::now();
			$dev = $device ? $device->device_uid : '';
			$wpdb->query( 'START TRANSACTION' );
			$ok = true;
			if ( $replaces ) {
				$grouped = array();
				foreach ( $replaces as $n ) {
					$grouped[ $n['entity'] ][] = $n['id'];
				}
				foreach ( $grouped as $entity => $ids ) {
					foreach ( array_chunk( $ids, 400 ) as $chunk ) {
						$ph   = implode( ',', array_fill( 0, count( $chunk ), '%s' ) );
						$args = array_merge( array( $tenant->id, $entity ), $chunk );
						if ( false === $wpdb->query( $wpdb->prepare( "DELETE FROM $table WHERE tenant_id = %s AND entity = %s AND record_id IN ($ph)", $args ) ) ) {
							$ok = false;
						}
					}
				}
			}
			$rows = array_merge( $inserts, $replaces );
			if ( $ok && $rows ) {
				$ok = self::multi_insert( $table, $tenant->id, $dev, $now, $rows );
			}
			if ( $ok ) {
				$wpdb->query( 'COMMIT' );
				foreach ( $rows as $n ) {
					$accepted[] = $n['id'];
				}
			} else {
				$wpdb->query( 'ROLLBACK' );
				foreach ( $rows as $n ) {
					$rejected[] = array(
						'id'     => $n['id'],
						'reason' => 'server_error',
					);
				}
			}
			self::unlock( $lock );

			// Keep the tenant's display name in step with the business record.
			foreach ( $rows as $n ) {
				if ( 'business' === $n['entity'] && $n['id'] === $tenant->id && ! empty( $n['data']['name'] ) && is_string( $n['data']['name'] ) ) {
					PPC_Tenants::update( $tenant->id, array( 'business_name' => PPC_Util::text( $n['data']['name'], 190 ) ) );
				}
			}
		}

		PPC_Tenants::update(
			$tenant->id,
			array(
				'last_sync_at' => PPC_Util::now(),
				'last_ip'      => PPC_Util::ip(),
			)
		);

		return array(
			'accepted'   => array_values( array_unique( $accepted ) ),
			'rejected'   => $rejected,
			'server_seq' => self::max_seq( $tenant->id ),
			'superseded' => array_values( array_unique( $superseded ) ),
		);
	}

	/** Multi-row INSERT IGNORE split by size. */
	private static function multi_insert( $table, $tenant_id, $device_uid, $now, $rows ) {
		global $wpdb;
		$values = array();
		$size   = 0;
		$flush  = function () use ( &$values, &$size, $table, $wpdb ) {
			if ( ! $values ) {
				return true;
			}
			$sql    = "INSERT IGNORE INTO $table (tenant_id, entity, record_id, branch_id, data, updated_at, deleted, device_id, received_at) VALUES " . implode( ',', $values );
			$values = array();
			$size   = 0;
			return false !== $wpdb->query( $sql ); // phpcs:ignore -- values prepared individually.
		};
		foreach ( $rows as $n ) {
			if ( null === $n['branch_id'] ) {
				$v = $wpdb->prepare( '(%s, %s, %s, NULL, %s, %d, %d, %s, %s)', $tenant_id, $n['entity'], $n['id'], $n['json'], $n['updated_at'], $n['deleted'], $device_uid, $now );
			} else {
				$v = $wpdb->prepare( '(%s, %s, %s, %s, %s, %d, %d, %s, %s)', $tenant_id, $n['entity'], $n['id'], $n['branch_id'], $n['json'], $n['updated_at'], $n['deleted'], $device_uid, $now );
			}
			$values[] = $v;
			$size    += strlen( $v );
			if ( $size > self::MAX_INSERT_SQL || count( $values ) >= 250 ) {
				if ( ! $flush() ) {
					return false;
				}
			}
		}
		return $flush();
	}

	public static function max_seq( $tenant_id ) {
		global $wpdb;
		return (int) $wpdb->get_var( $wpdb->prepare( 'SELECT MAX(server_seq) FROM ' . PPC_Util::t( 'records' ) . ' WHERE tenant_id = %s', $tenant_id ) );
	}

	/** Pull changes after `since`. */
	public static function pull( $tenant, $since, $limit ) {
		global $wpdb;
		$since = max( 0, (int) $since );
		$limit = max( 1, min( self::MAX_PULL, (int) $limit ? (int) $limit : self::MAX_PULL ) );
		$rows  = $wpdb->get_results(
			$wpdb->prepare(
				'SELECT server_seq, entity, record_id, branch_id, data, updated_at, deleted FROM ' . PPC_Util::t( 'records' ) . ' WHERE tenant_id = %s AND server_seq > %d ORDER BY server_seq ASC LIMIT %d',
				$tenant->id,
				$since,
				$limit + 1
			)
		);
		$has_more = count( $rows ) > $limit;
		if ( $has_more ) {
			array_pop( $rows );
		}
		$out  = array();
		$next = $since;
		foreach ( $rows as $r ) {
			$data  = json_decode( $r->data, true );
			$out[] = array(
				'entity'     => $r->entity,
				'id'         => $r->record_id,
				'branch_id'  => $r->branch_id,
				'data'       => is_array( $data ) ? $data : new stdClass(),
				'updated_at' => (int) $r->updated_at,
				'deleted'    => (int) $r->deleted,
				'seq'        => (int) $r->server_seq,
			);
			$next  = (int) $r->server_seq;
		}
		return array(
			'changes'  => $out,
			'next_seq' => $next,
			'has_more' => $has_more,
		);
	}

	/* ------------------------------------------------------------------ */
	/* Agent leads                                                          */
	/* ------------------------------------------------------------------ */

	/** Recursively sanitise lead data strings. */
	private static function clean_lead_data( $v, $depth = 0 ) {
		if ( $depth > 4 ) {
			return null;
		}
		if ( is_array( $v ) ) {
			$o = array();
			$i = 0;
			foreach ( $v as $k => $x ) {
				if ( ++$i > 200 ) {
					break;
				}
				$o[ is_int( $k ) ? $k : substr( sanitize_key( $k ), 0, 40 ) ] = self::clean_lead_data( $x, $depth + 1 );
			}
			return $o;
		}
		if ( is_string( $v ) ) {
			return PPC_Util::textarea( $v, 5000 );
		}
		if ( is_bool( $v ) || is_int( $v ) || is_float( $v ) || null === $v ) {
			return $v;
		}
		return null;
	}

	/** Push leads/activities for an agent. */
	public static function push_leads( $agent, $changes ) {
		global $wpdb;
		if ( ! is_array( $changes ) ) {
			return PPC_Util::err( 'invalid_input', 'changes must be an array.', 400 );
		}
		if ( count( $changes ) > self::MAX_PUSH ) {
			return PPC_Util::err( 'batch_too_large', 'Push at most ' . self::MAX_PUSH . ' changes per request.', 413 );
		}
		$lt       = PPC_Util::t( 'leads' );
		$at       = PPC_Util::t( 'lead_activities' );
		$accepted = array();
		$rejected = array();
		$touch    = array();
		$now      = PPC_Util::now();

		$lock = 'agent_' . $agent->id;
		self::lock( $lock );
		foreach ( $changes as $c ) {
			$entity = is_array( $c ) && ! empty( $c['entity'] ) ? (string) $c['entity'] : 'leads';
			$id     = is_array( $c ) && isset( $c['id'] ) && is_scalar( $c['id'] ) ? (string) $c['id'] : '';
			if ( ! PPC_Util::valid_id( $id ) ) {
				$rejected[] = array(
					'id'     => $id,
					'reason' => 'invalid_id',
				);
				continue;
			}
			$data = isset( $c['data'] ) && is_array( $c['data'] ) ? self::clean_lead_data( $c['data'] ) : array();
			$upd  = isset( $c['updated_at'] ) && is_numeric( $c['updated_at'] ) ? (int) $c['updated_at'] : ( isset( $data['updated_at'] ) ? (int) $data['updated_at'] : 0 );

			if ( 'lead_activities' === $entity || 'activities' === $entity ) {
				$lead_id = isset( $data['lead_id'] ) ? (string) $data['lead_id'] : '';
				if ( ! PPC_Util::valid_id( $lead_id ) ) {
					$rejected[] = array(
						'id'     => $id,
						'reason' => 'invalid_lead_id',
					);
					continue;
				}
				$type  = isset( $data['type'] ) ? sanitize_key( $data['type'] ) : 'note';
				$type  = in_array( $type, array( 'call', 'visit', 'whatsapp', 'sms', 'demo', 'note', 'stage', 'trial', 'email' ), true ) ? $type : 'note';
				$extra = $data;
				unset( $extra['id'], $extra['lead_id'], $extra['type'], $extra['note'], $extra['at'] );
				$wpdb->query(
					$wpdb->prepare(
						"INSERT IGNORE INTO $at (agent_id, activity_id, lead_id, type, note, at, data, created_at) VALUES (%d, %s, %s, %s, %s, %d, %s, %s)",
						$agent->id,
						$id,
						$lead_id,
						$type,
						isset( $data['note'] ) ? (string) $data['note'] : '',
						isset( $data['at'] ) ? (int) $data['at'] : ( $upd ? $upd : PPC_Util::now_ms() ),
						wp_json_encode( $extra ),
						$now
					)
				);
				$accepted[]        = $id;
				$touch[ $lead_id ] = true;
				continue;
			}

			if ( 'leads' !== $entity ) {
				$rejected[] = array(
					'id'     => $id,
					'reason' => 'invalid_entity',
				);
				continue;
			}
			if ( $upd <= 0 ) {
				$rejected[] = array(
					'id'     => $id,
					'reason' => 'invalid_updated_at',
				);
				continue;
			}
			$deleted = ! empty( $c['deleted'] ) || ! empty( $data['deleted'] ) ? 1 : 0;
			unset( $data['activities'] ); // Activities are stored separately.
			$stage = isset( $data['stage'] ) && in_array( $data['stage'], PPC_Agents::STAGES, true ) ? $data['stage'] : 'new';
			$fu    = isset( $data['next_follow_up'] ) && is_string( $data['next_follow_up'] ) && preg_match( '/^\d{4}-\d{2}-\d{2}/', $data['next_follow_up'] ) ? substr( $data['next_follow_up'], 0, 10 ) : '';
			$pi    = isset( $data['package_interest'] ) && in_array( $data['package_interest'], array( 'bundle', 'software', 'unsure' ), true ) ? $data['package_interest'] : 'unsure';
			$data['id']    = $id;
			$data['stage'] = $stage;

			$cur = $wpdb->get_row( $wpdb->prepare( "SELECT updated_at, tenant_id, created_at FROM $lt WHERE agent_id = %d AND lead_id = %s", $agent->id, $id ) );
			if ( $cur && (int) $cur->updated_at >= $upd ) {
				$accepted[] = $id; // Older or identical: server copy wins (LWW).
				continue;
			}
			if ( $cur && $cur->tenant_id && empty( $data['tenant_id'] ) ) {
				$data['tenant_id'] = $cur->tenant_id; // Keep server-side trial link.
			}
			$row = array(
				'agent_id'         => (int) $agent->id,
				'lead_id'          => $id,
				'business_name'    => PPC_Util::text( isset( $data['business_name'] ) ? $data['business_name'] : '', 190 ),
				'contact_name'     => PPC_Util::text( isset( $data['contact_name'] ) ? $data['contact_name'] : '', 190 ),
				'phone'            => PPC_Util::phone( isset( $data['phone'] ) ? $data['phone'] : '' ),
				'town'             => PPC_Util::text( isset( $data['town'] ) ? $data['town'] : '', 100 ),
				'stage'            => $stage,
				'package_interest' => $pi,
				'next_follow_up'   => $fu,
				'tenant_id'        => ! empty( $data['tenant_id'] ) && is_string( $data['tenant_id'] ) ? substr( $data['tenant_id'], 0, 32 ) : null,
				'data'             => wp_json_encode( $data ),
				'updated_at'       => $upd,
				'deleted'          => $deleted,
				'created_at'       => $cur ? $cur->created_at : $now,
				'received_at'      => $now,
			);
			$wpdb->query( 'START TRANSACTION' );
			if ( $cur ) {
				$wpdb->delete(
					$lt,
					array(
						'agent_id' => $agent->id,
						'lead_id'  => $id,
					)
				);
			}
			$ok = $wpdb->insert( $lt, $row );
			$wpdb->query( 'COMMIT' );
			if ( $ok ) {
				$accepted[] = $id;
				unset( $touch[ $id ] );
				if ( ! $cur ) {
					PPC_DB::event( 'lead.new', sprintf( '%s added lead %s', $agent->name, $row['business_name'] ), null, $agent->id );
				}
			} else {
				$rejected[] = array(
					'id'     => $id,
					'reason' => 'server_error',
				);
			}
		}
		// New activities re-sequence their lead so other devices pull them.
		foreach ( array_keys( $touch ) as $lead_id ) {
			PPC_Agents::touch_lead( $agent->id, $lead_id );
		}
		self::unlock( $lock );

		return array(
			'accepted'   => array_values( array_unique( $accepted ) ),
			'rejected'   => $rejected,
			'server_seq' => (int) $wpdb->get_var( $wpdb->prepare( "SELECT MAX(server_seq) FROM $lt WHERE agent_id = %d", $agent->id ) ),
		);
	}

	public static function pull_leads( $agent, $since, $limit ) {
		global $wpdb;
		$since = max( 0, (int) $since );
		$limit = max( 1, min( self::MAX_PULL, (int) $limit ? (int) $limit : self::MAX_PULL ) );
		$rows  = $wpdb->get_results( $wpdb->prepare( 'SELECT server_seq, lead_id, data, updated_at, deleted FROM ' . PPC_Util::t( 'leads' ) . ' WHERE agent_id = %d AND server_seq > %d ORDER BY server_seq ASC LIMIT %d', $agent->id, $since, $limit + 1 ) );
		$more  = count( $rows ) > $limit;
		if ( $more ) {
			array_pop( $rows );
		}
		$acts = PPC_Agents::activities_for( $agent->id, wp_list_pluck( $rows, 'lead_id' ) );
		$out  = array();
		$next = $since;
		foreach ( $rows as $r ) {
			$d               = json_decode( $r->data, true );
			$d               = is_array( $d ) ? $d : array();
			$d['activities'] = isset( $acts[ $r->lead_id ] ) ? $acts[ $r->lead_id ] : array();
			$out[]           = array(
				'entity'     => 'leads',
				'id'         => $r->lead_id,
				'data'       => $d,
				'updated_at' => (int) $r->updated_at,
				'deleted'    => (int) $r->deleted,
				'seq'        => (int) $r->server_seq,
			);
			$next            = (int) $r->server_seq;
		}
		return array(
			'changes'  => $out,
			'next_seq' => $next,
			'has_more' => $more,
		);
	}
}
