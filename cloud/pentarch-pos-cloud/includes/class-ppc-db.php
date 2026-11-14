<?php
/**
 * Schema, activation and upgrades.
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_DB {

	const VERSION_OPTION = 'ppc_db_version';

	/** All table names (without prefix). */
	public static function tables() {
		return array( 'tenants', 'devices', 'records', 'payments', 'agents', 'agent_tokens', 'leads', 'lead_activities', 'commissions', 'demo_bookings', 'mpesa_requests', 'rate_limits', 'events' );
	}

	public static function schema() {
		global $wpdb;
		$c = $wpdb->get_charset_collate();
		$p = $wpdb->prefix . 'ppc_';

		// Note: dbDelta requires two spaces after PRIMARY KEY and one field per line.
		$sql   = array();
		$sql[] = "CREATE TABLE {$p}tenants (
  id varchar(32) NOT NULL,
  code varchar(10) NOT NULL,
  business_name varchar(190) NOT NULL DEFAULT '',
  business_type varchar(60) NOT NULL DEFAULT '',
  owner_name varchar(190) NOT NULL DEFAULT '',
  phone varchar(20) NOT NULL DEFAULT '',
  email varchar(190) NOT NULL,
  password_hash varchar(255) NOT NULL DEFAULT '',
  town varchar(100) NOT NULL DEFAULT '',
  county varchar(100) NOT NULL DEFAULT '',
  source varchar(20) NOT NULL DEFAULT 'app',
  agent_id bigint(20) unsigned DEFAULT NULL,
  lead_id varchar(64) DEFAULT NULL,
  plan varchar(20) NOT NULL DEFAULT 'trial',
  suspended tinyint(1) NOT NULL DEFAULT 0,
  suspended_reason varchar(190) NOT NULL DEFAULT '',
  trial_ends datetime DEFAULT NULL,
  paid_until datetime DEFAULT NULL,
  first_paid_at datetime DEFAULT NULL,
  max_branches int(11) NOT NULL DEFAULT 1,
  max_devices int(11) NOT NULL DEFAULT 3,
  mpesa_config text,
  notes text,
  is_test tinyint(1) NOT NULL DEFAULT 0,
  last_sync_at datetime DEFAULT NULL,
  last_ip varchar(45) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY code (code),
  UNIQUE KEY email (email),
  KEY agent_id (agent_id),
  KEY phone (phone),
  KEY created_at (created_at),
  KEY trial_ends (trial_ends),
  KEY paid_until (paid_until)
) $c;";

		$sql[] = "CREATE TABLE {$p}devices (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  tenant_id varchar(32) NOT NULL,
  device_uid varchar(32) NOT NULL,
  name varchar(100) NOT NULL DEFAULT '',
  token_hash char(64) NOT NULL,
  user_agent varchar(255) NOT NULL DEFAULT '',
  last_ip varchar(45) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  last_seen datetime DEFAULT NULL,
  revoked_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY token_hash (token_hash),
  UNIQUE KEY device_uid (device_uid),
  KEY tenant_id (tenant_id)
) $c;";

		$sql[] = "CREATE TABLE {$p}records (
  server_seq bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  tenant_id varchar(32) NOT NULL,
  entity varchar(40) NOT NULL,
  record_id varchar(64) NOT NULL,
  branch_id varchar(64) DEFAULT NULL,
  data longtext NOT NULL,
  updated_at bigint(20) NOT NULL DEFAULT 0,
  deleted tinyint(1) NOT NULL DEFAULT 0,
  device_id varchar(32) NOT NULL DEFAULT '',
  received_at datetime NOT NULL,
  PRIMARY KEY  (server_seq),
  UNIQUE KEY uniq_record (tenant_id,entity,record_id),
  KEY tenant_seq (tenant_id,server_seq),
  KEY tenant_entity (tenant_id,entity,updated_at)
) $c;";

		$sql[] = "CREATE TABLE {$p}payments (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  tenant_id varchar(32) NOT NULL,
  type varchar(30) NOT NULL DEFAULT 'software_monthly',
  amount bigint(20) NOT NULL DEFAULT 0,
  months int(11) NOT NULL DEFAULT 0,
  bundles int(11) NOT NULL DEFAULT 0,
  method varchar(20) NOT NULL DEFAULT 'mpesa',
  ref varchar(100) NOT NULL DEFAULT '',
  paid_at datetime NOT NULL,
  period_from datetime DEFAULT NULL,
  period_to datetime DEFAULT NULL,
  source varchar(20) NOT NULL DEFAULT 'admin',
  recorded_by bigint(20) unsigned NOT NULL DEFAULT 0,
  note varchar(255) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY tenant_id (tenant_id),
  KEY paid_at (paid_at),
  KEY ref (ref)
) $c;";

		$sql[] = "CREATE TABLE {$p}agents (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  code varchar(12) NOT NULL,
  name varchar(190) NOT NULL DEFAULT '',
  phone varchar(20) NOT NULL DEFAULT '',
  mpesa_phone varchar(20) NOT NULL DEFAULT '',
  email varchar(190) NOT NULL,
  password_hash varchar(255) NOT NULL DEFAULT '',
  town varchar(100) NOT NULL DEFAULT '',
  county varchar(100) NOT NULL DEFAULT '',
  heard_from varchar(190) NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'pending',
  software_rate decimal(5,2) DEFAULT NULL,
  bundle_bonus int(11) DEFAULT NULL,
  lang varchar(5) NOT NULL DEFAULT 'en',
  notes text,
  terms_accepted_at datetime DEFAULT NULL,
  approved_at datetime DEFAULT NULL,
  last_seen datetime DEFAULT NULL,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY code (code),
  UNIQUE KEY email (email),
  KEY status (status),
  KEY phone (phone)
) $c;";

		$sql[] = "CREATE TABLE {$p}agent_tokens (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  agent_id bigint(20) unsigned NOT NULL,
  token_hash char(64) NOT NULL,
  device_name varchar(100) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  last_seen datetime DEFAULT NULL,
  revoked_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY token_hash (token_hash),
  KEY agent_id (agent_id)
) $c;";

		$sql[] = "CREATE TABLE {$p}leads (
  server_seq bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  agent_id bigint(20) unsigned NOT NULL,
  lead_id varchar(64) NOT NULL,
  business_name varchar(190) NOT NULL DEFAULT '',
  contact_name varchar(190) NOT NULL DEFAULT '',
  phone varchar(20) NOT NULL DEFAULT '',
  town varchar(100) NOT NULL DEFAULT '',
  stage varchar(20) NOT NULL DEFAULT 'new',
  package_interest varchar(20) NOT NULL DEFAULT 'unsure',
  next_follow_up varchar(10) NOT NULL DEFAULT '',
  tenant_id varchar(32) DEFAULT NULL,
  data longtext NOT NULL,
  updated_at bigint(20) NOT NULL DEFAULT 0,
  deleted tinyint(1) NOT NULL DEFAULT 0,
  created_at datetime NOT NULL,
  received_at datetime NOT NULL,
  PRIMARY KEY  (server_seq),
  UNIQUE KEY uniq_lead (agent_id,lead_id),
  KEY agent_seq (agent_id,server_seq),
  KEY stage (stage),
  KEY phone (phone),
  KEY created_at (created_at)
) $c;";

		$sql[] = "CREATE TABLE {$p}lead_activities (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  agent_id bigint(20) unsigned NOT NULL,
  activity_id varchar(64) NOT NULL,
  lead_id varchar(64) NOT NULL,
  type varchar(20) NOT NULL DEFAULT 'note',
  note text,
  at bigint(20) NOT NULL DEFAULT 0,
  data text,
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY uniq_activity (agent_id,activity_id),
  KEY agent_lead (agent_id,lead_id),
  KEY created_at (created_at)
) $c;";

		$sql[] = "CREATE TABLE {$p}commissions (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  agent_id bigint(20) unsigned NOT NULL,
  tenant_id varchar(32) NOT NULL,
  payment_id bigint(20) unsigned NOT NULL DEFAULT 0,
  kind varchar(20) NOT NULL DEFAULT 'software',
  base_amount bigint(20) NOT NULL DEFAULT 0,
  rate decimal(5,2) NOT NULL DEFAULT 0,
  amount bigint(20) NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'pending',
  mpesa_ref varchar(60) NOT NULL DEFAULT '',
  note varchar(255) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  approved_at datetime DEFAULT NULL,
  paid_at datetime DEFAULT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY payment_kind (payment_id,kind),
  KEY agent_status (agent_id,status),
  KEY tenant_id (tenant_id)
) $c;";

		$sql[] = "CREATE TABLE {$p}demo_bookings (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  ref varchar(12) NOT NULL,
  name varchar(190) NOT NULL DEFAULT '',
  business varchar(190) NOT NULL DEFAULT '',
  business_type varchar(60) NOT NULL DEFAULT '',
  phone varchar(20) NOT NULL DEFAULT '',
  email varchar(190) NOT NULL DEFAULT '',
  town varchar(100) NOT NULL DEFAULT '',
  preferred_date varchar(10) NOT NULL DEFAULT '',
  preferred_time varchar(20) NOT NULL DEFAULT '',
  message text,
  agent_code varchar(12) NOT NULL DEFAULT '',
  agent_id bigint(20) unsigned DEFAULT NULL,
  assigned_agent_id bigint(20) unsigned DEFAULT NULL,
  lead_id varchar(64) DEFAULT NULL,
  source_page varchar(255) NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'new',
  admin_note text,
  ip_hash char(64) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY ref (ref),
  KEY status (status),
  KEY agent_id (agent_id),
  KEY assigned_agent_id (assigned_agent_id),
  KEY created_at (created_at)
) $c;";

		$sql[] = "CREATE TABLE {$p}mpesa_requests (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  tenant_id varchar(32) NOT NULL,
  checkout_request_id varchar(80) NOT NULL,
  merchant_request_id varchar(80) NOT NULL DEFAULT '',
  purpose varchar(20) NOT NULL DEFAULT 'sale',
  phone varchar(20) NOT NULL DEFAULT '',
  amount int(11) NOT NULL DEFAULT 0,
  ref varchar(60) NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'pending',
  result_code varchar(10) NOT NULL DEFAULT '',
  result_desc varchar(255) NOT NULL DEFAULT '',
  mpesa_receipt varchar(30) NOT NULL DEFAULT '',
  payment_id bigint(20) unsigned NOT NULL DEFAULT 0,
  raw text,
  created_at datetime NOT NULL,
  updated_at datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY checkout_request_id (checkout_request_id),
  KEY tenant_id (tenant_id)
) $c;";

		$sql[] = "CREATE TABLE {$p}rate_limits (
  bucket char(40) NOT NULL,
  hits int(11) NOT NULL DEFAULT 0,
  window_start int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY  (bucket),
  KEY window_start (window_start)
) $c;";

		$sql[] = "CREATE TABLE {$p}events (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  kind varchar(40) NOT NULL,
  tenant_id varchar(32) DEFAULT NULL,
  agent_id bigint(20) unsigned DEFAULT NULL,
  message varchar(255) NOT NULL DEFAULT '',
  created_at datetime NOT NULL,
  PRIMARY KEY  (id),
  KEY created_at (created_at),
  KEY kind (kind)
) $c;";

		return $sql;
	}

	public static function install() {
		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		foreach ( self::schema() as $q ) {
			dbDelta( $q );
		}
		update_option( self::VERSION_OPTION, PPC_DB_VERSION, false );
	}

	public static function activate() {
		self::install();
		PPC_Settings::ensure_secrets();
		PPC_Static::add_rules();
		PPC_Static::write_htaccess( true );
		flush_rewrite_rules( false );
		if ( ! wp_next_scheduled( 'ppc_daily' ) ) {
			wp_schedule_event( time() + 3600, 'daily', 'ppc_daily' );
		}
	}

	public static function deactivate() {
		PPC_Static::write_htaccess( false );
		flush_rewrite_rules( false );
		wp_clear_scheduled_hook( 'ppc_daily' );
	}

	/** Run dbDelta when the stored DB version is older. */
	public static function maybe_upgrade() {
		$v = (int) get_option( self::VERSION_OPTION, 0 );
		if ( $v < PPC_DB_VERSION ) {
			self::install();
			PPC_Settings::ensure_secrets();
			// Rewrite rules may have changed between versions.
			update_option( 'ppc_flush_rewrite', 1, false );
		}
	}

	/** Housekeeping: old rate-limit buckets, revoked tokens. */
	public static function daily_cleanup() {
		global $wpdb;
		$wpdb->query( $wpdb->prepare( 'DELETE FROM ' . PPC_Util::t( 'rate_limits' ) . ' WHERE window_start < %d', time() - DAY_IN_SECONDS ) );
		$old = PPC_Util::dt( time() - 90 * DAY_IN_SECONDS );
		$wpdb->query( $wpdb->prepare( 'DELETE FROM ' . PPC_Util::t( 'agent_tokens' ) . ' WHERE revoked_at IS NOT NULL AND revoked_at < %s', $old ) );
		$wpdb->query( $wpdb->prepare( 'DELETE FROM ' . PPC_Util::t( 'events' ) . ' WHERE created_at < %s', PPC_Util::dt( time() - 365 * DAY_IN_SECONDS ) ) );
	}

	/** Log an activity event for the admin dashboard. */
	public static function event( $kind, $message, $tenant_id = null, $agent_id = null ) {
		global $wpdb;
		$wpdb->insert(
			PPC_Util::t( 'events' ),
			array(
				'kind'       => $kind,
				'tenant_id'  => $tenant_id,
				'agent_id'   => $agent_id,
				'message'    => substr( (string) $message, 0, 255 ),
				'created_at' => PPC_Util::now(),
			)
		);
	}

	/** Drop all plugin tables and options (uninstall with delete flag). */
	public static function drop_all() {
		global $wpdb;
		foreach ( self::tables() as $t ) {
			$wpdb->query( 'DROP TABLE IF EXISTS ' . PPC_Util::t( $t ) ); // phpcs:ignore
		}
		delete_option( self::VERSION_OPTION );
		delete_option( PPC_Settings::OPTION );
		delete_option( 'ppc_flush_rewrite' );
	}
}
