<?php
/**
 * Plugin Name:       Pentarch POS Cloud
 * Plugin URI:        https://pentarchsystemssolutions.co.ke/pos/
 * Description:       Cloud sync, licences, superadmin, sales-agent portal and demo bookings for Pentarch POS. Serves the POS app at /pos/ and the agent portal at /pos/agents/.
 * Version:           1.1.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Pentarch Systems Solutions
 * Author URI:        https://pentarchsystemssolutions.co.ke
 * License:           Proprietary
 * Text Domain:       pentarch-pos-cloud
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

define( 'PPC_VERSION', '1.1.0' );
define( 'PPC_DB_VERSION', 3 );
define( 'PPC_FILE', __FILE__ );
define( 'PPC_DIR', plugin_dir_path( __FILE__ ) );
define( 'PPC_URL', plugin_dir_url( __FILE__ ) );
define( 'PPC_NS', 'pentarch-pos/v1' );

require_once PPC_DIR . 'includes/class-ppc-util.php';
require_once PPC_DIR . 'includes/class-ppc-settings.php';
require_once PPC_DIR . 'includes/class-ppc-db.php';
require_once PPC_DIR . 'includes/class-ppc-ratelimit.php';
require_once PPC_DIR . 'includes/class-ppc-licence.php';
require_once PPC_DIR . 'includes/class-ppc-tenants.php';
require_once PPC_DIR . 'includes/class-ppc-agents.php';
require_once PPC_DIR . 'includes/class-ppc-payments.php';
require_once PPC_DIR . 'includes/class-ppc-sync.php';
require_once PPC_DIR . 'includes/class-ppc-mpesa.php';
require_once PPC_DIR . 'includes/class-ppc-notify.php';
require_once PPC_DIR . 'includes/class-ppc-rest.php';
require_once PPC_DIR . 'includes/class-ppc-static.php';
require_once PPC_DIR . 'includes/class-ppc-shortcodes.php';

if ( is_admin() ) {
	require_once PPC_DIR . 'admin/class-ppc-admin.php';
}

register_activation_hook( __FILE__, array( 'PPC_DB', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'PPC_DB', 'deactivate' ) );

// Static apps must be intercepted as early as possible (before themes load).
PPC_Static::early_boot();

add_action( 'plugins_loaded', array( 'PPC_DB', 'maybe_upgrade' ), 5 );
add_action( 'init', array( 'PPC_Static', 'init' ) );
add_action( 'rest_api_init', array( 'PPC_REST', 'register' ) );
add_action( 'init', array( 'PPC_Shortcodes', 'init' ) );
add_action( 'ppc_daily', array( 'PPC_DB', 'daily_cleanup' ) );

if ( is_admin() ) {
	add_action( 'plugins_loaded', array( 'PPC_Admin', 'init' ) );
}
