<?php
/**
 * Serves the POS PWA at /pos/ and the agent portal at /pos/agents/ from
 * public/pos and public/agents with correct MIME types and cache rules.
 *
 * Works with pretty permalinks (via WordPress's own .htaccess) and with plain
 * permalinks (via a small "Pentarch POS" block this plugin adds to .htaccess).
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Static {

	const MARKER = 'Pentarch POS';

	private static $mime = array(
		'html'        => 'text/html; charset=utf-8',
		'htm'         => 'text/html; charset=utf-8',
		'js'          => 'text/javascript; charset=utf-8',
		'mjs'         => 'text/javascript; charset=utf-8',
		'css'         => 'text/css; charset=utf-8',
		'json'        => 'application/json; charset=utf-8',
		'map'         => 'application/json; charset=utf-8',
		'webmanifest' => 'application/manifest+json; charset=utf-8',
		'svg'         => 'image/svg+xml',
		'png'         => 'image/png',
		'jpg'         => 'image/jpeg',
		'jpeg'        => 'image/jpeg',
		'gif'         => 'image/gif',
		'webp'        => 'image/webp',
		'avif'        => 'image/avif',
		'ico'         => 'image/x-icon',
		'woff'        => 'font/woff',
		'woff2'       => 'font/woff2',
		'ttf'         => 'font/ttf',
		'otf'         => 'font/otf',
		'txt'         => 'text/plain; charset=utf-8',
		'xml'         => 'application/xml; charset=utf-8',
		'pdf'         => 'application/pdf',
		'wasm'        => 'application/wasm',
		'mp3'         => 'audio/mpeg',
		'wav'         => 'audio/wav',
		'csv'         => 'text/csv; charset=utf-8',
	);

	/** Home path, e.g. "/" or "/blog/". */
	private static function home_path() {
		$p = wp_parse_url( home_url( '/' ), PHP_URL_PATH );
		return $p ? trailingslashit( $p ) : '/';
	}

	/** Request path relative to the WordPress home, without leading slash. */
	private static function rel_path() {
		if ( empty( $_SERVER['REQUEST_URI'] ) ) {
			return null;
		}
		$path = wp_parse_url( wp_unslash( $_SERVER['REQUEST_URI'] ), PHP_URL_PATH ); // phpcs:ignore
		if ( ! is_string( $path ) ) {
			return null;
		}
		$path = rawurldecode( $path );
		$home = self::home_path();
		if ( 0 !== strpos( $path, $home ) ) {
			return null;
		}
		return substr( $path, strlen( $home ) );
	}

	/** Called while the plugin file loads: intercept /pos/* before themes/other plugins boot. */
	public static function early_boot() {
		$rel = self::rel_path();
		if ( null === $rel ) {
			return;
		}
		// Plain permalinks: route /wp-json/pentarch-pos/... to the REST API.
		if ( 0 === strpos( $rel, 'wp-json/' . PPC_NS ) && ! get_option( 'permalink_structure' ) && empty( $_GET['rest_route'] ) ) { // phpcs:ignore
			$_GET['rest_route'] = '/' . substr( $rel, strlen( 'wp-json/' ) );
			return;
		}
		if ( 'pos' === $rel || 0 === strpos( $rel, 'pos/' ) ) {
			if ( defined( 'WP_CLI' ) || ( defined( 'DOING_CRON' ) && DOING_CRON ) ) {
				return;
			}
			self::serve( $rel );
		}
	}

	public static function init() {
		self::add_rules();
		add_filter( 'query_vars', array( __CLASS__, 'query_vars' ) );
		add_action( 'parse_request', array( __CLASS__, 'parse_request' ), 1 );
		add_filter( 'redirect_canonical', array( __CLASS__, 'no_canonical' ), 10, 2 );
		if ( get_option( 'ppc_flush_rewrite' ) ) {
			delete_option( 'ppc_flush_rewrite' );
			flush_rewrite_rules( false );
			self::write_htaccess( true );
		}
	}

	public static function add_rules() {
		add_rewrite_rule( '^pos/?$', 'index.php?ppc_app=pos&ppc_path=', 'top' );
		add_rewrite_rule( '^pos/(.+)$', 'index.php?ppc_app=pos&ppc_path=$matches[1]', 'top' );
	}

	public static function query_vars( $vars ) {
		$vars[] = 'ppc_app';
		$vars[] = 'ppc_path';
		return $vars;
	}

	/** Fallback if early_boot did not catch the request (e.g. unusual server paths). */
	public static function parse_request( $wp ) {
		if ( ! empty( $wp->query_vars['ppc_app'] ) ) {
			self::serve( 'pos/' . ( isset( $wp->query_vars['ppc_path'] ) ? $wp->query_vars['ppc_path'] : '' ) );
		}
	}

	public static function no_canonical( $redirect, $requested ) {
		$rel = self::rel_path();
		return ( null !== $rel && ( 'pos' === $rel || 0 === strpos( $rel, 'pos/' ) ) ) ? false : $redirect;
	}

	/**
	 * Serve a file below /pos/. $rel is "pos", "pos/", "pos/assets/x.js", "pos/agents/..." etc.
	 */
	public static function serve( $rel ) {
		$method = isset( $_SERVER['REQUEST_METHOD'] ) ? strtoupper( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) ) : 'GET';
		if ( ! in_array( $method, array( 'GET', 'HEAD' ), true ) ) {
			self::send_status( 405, 'Method not allowed' );
		}
		$qs = isset( $_SERVER['QUERY_STRING'] ) && '' !== $_SERVER['QUERY_STRING'] ? '?' . wp_unslash( $_SERVER['QUERY_STRING'] ) : ''; // phpcs:ignore
		// Canonical trailing slashes.
		if ( 'pos' === $rel || 'pos/agents' === $rel ) {
			self::redirect( home_url( '/' . $rel . '/' ) . $qs );
		}
		$sub = substr( $rel, 4 ); // After "pos/".
		if ( 'agents' === $sub || 0 === strpos( $sub, 'agents/' ) ) {
			$app  = 'agents';
			$sub  = (string) substr( $sub, 7 );
			$base = PPC_DIR . 'public/agents';
			$sw   = '/pos/agents/';
		} else {
			$app  = 'pos';
			$base = PPC_DIR . 'public/pos';
			$sw   = '/pos/';
		}
		$sub = ltrim( (string) $sub, '/' );
		if ( preg_match( '#(^|/)\.#', $sub ) || false !== strpos( $sub, "\0" ) ) {
			self::send_status( 404, 'Not found' );
		}
		$base_real = realpath( $base );
		$file      = '' === $sub ? $base . '/index.html' : $base . '/' . $sub;
		$real      = realpath( $file );
		if ( $real && is_dir( $real ) ) {
			$real = realpath( $real . '/index.html' );
		}
		$is_nav = false;
		if ( ! $real || ! $base_real || 0 !== strpos( $real, $base_real . DIRECTORY_SEPARATOR ) || ! is_file( $real ) ) {
			// SPA fallback: extension-less paths are app routes -> index.html.
			if ( ! preg_match( '/\.[a-z0-9]{1,12}$/i', $sub ) ) {
				$real   = realpath( $base . '/index.html' );
				$is_nav = true;
			} else {
				$real = false;
			}
		}
		if ( ! $real || ! is_file( $real ) ) {
			self::send_status( 404, 'Not found' );
		}
		self::output( $real, $app, $sw, $method, $is_nav );
	}

	private static function output( $real, $app, $sw_scope, $method, $is_nav ) {
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true );
		}
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}
		$name = basename( $real );
		$ext  = strtolower( pathinfo( $name, PATHINFO_EXTENSION ) );
		$mime = isset( self::$mime[ $ext ] ) ? self::$mime[ $ext ] : 'application/octet-stream';

		$no_cache = in_array( $name, array( 'index.html', 'sw.js', 'registerSW.js', 'manifest.webmanifest', 'manifest.json', 'version.json' ), true ) || 'html' === $ext;
		$hashed   = (bool) preg_match( '/[.\-_][A-Za-z0-9_\-]{8,}\.(js|mjs|css|woff2?|ttf|otf|svg|png|jpe?g|webp|avif|gif|wasm)$/', $name ) || false !== strpos( $real, DIRECTORY_SEPARATOR . 'assets' . DIRECTORY_SEPARATOR );

		$size  = filesize( $real );
		$mtime = filemtime( $real );
		$etag  = '"' . substr( md5( $real . '|' . $size . '|' . $mtime ), 0, 20 ) . '"';

		status_header( 200 );
		header( 'Content-Type: ' . $mime );
		header( 'X-Content-Type-Options: nosniff' );
		header( 'ETag: ' . $etag );
		header( 'Last-Modified: ' . gmdate( 'D, d M Y H:i:s', $mtime ) . ' GMT' );
		header( 'Vary: Accept-Encoding' );
		if ( $no_cache ) {
			header( 'Cache-Control: no-cache, must-revalidate' );
			header( 'X-LiteSpeed-Cache-Control: no-cache' );
		} elseif ( $hashed ) {
			header( 'Cache-Control: public, max-age=31536000, immutable' );
			header( 'X-LiteSpeed-Cache-Control: no-cache' );
		} else {
			header( 'Cache-Control: public, max-age=86400' );
			header( 'X-LiteSpeed-Cache-Control: no-cache' );
		}
		if ( 'sw.js' === $name ) {
			header( 'Service-Worker-Allowed: ' . $sw_scope );
		}
		if ( 'html' === $ext ) {
			header( 'X-Frame-Options: SAMEORIGIN' );
			header( 'Referrer-Policy: strict-origin-when-cross-origin' );
		}
		// Hide WordPress / PHP noise.
		header_remove( 'X-Pingback' );
		header_remove( 'Link' );
		header_remove( 'X-Powered-By' );
		header_remove( 'Expires' );
		header_remove( 'Pragma' );

		$inm = isset( $_SERVER['HTTP_IF_NONE_MATCH'] ) ? trim( wp_unslash( $_SERVER['HTTP_IF_NONE_MATCH'] ) ) : ''; // phpcs:ignore
		if ( $inm && ( $inm === $etag || 'W/' . $etag === $inm ) ) {
			status_header( 304 );
			exit;
		}

		// Serve a precompressed .gz sibling when present (build.sh creates them).
		$ae = isset( $_SERVER['HTTP_ACCEPT_ENCODING'] ) ? (string) $_SERVER['HTTP_ACCEPT_ENCODING'] : ''; // phpcs:ignore
		if ( false !== stripos( $ae, 'gzip' ) && is_file( $real . '.gz' ) && ! ini_get( 'zlib.output_compression' ) ) {
			$real = $real . '.gz';
			$size = filesize( $real );
			header( 'Content-Encoding: gzip' );
		}
		header( 'Content-Length: ' . $size );
		if ( 'HEAD' === $method ) {
			exit;
		}
		readfile( $real ); // phpcs:ignore
		exit;
	}

	private static function redirect( $url ) {
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}
		header( 'Cache-Control: no-cache' );
		header( 'Location: ' . $url, true, 301 );
		exit;
	}

	private static function send_status( $code, $msg ) {
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}
		status_header( $code );
		header( 'Content-Type: text/plain; charset=utf-8' );
		header( 'Cache-Control: no-cache' );
		header( 'X-LiteSpeed-Cache-Control: no-cache' );
		echo esc_html( $msg );
		exit;
	}

	/* ---------------- .htaccess ---------------- */

	/** The block placed at the top of .htaccess (before the WordPress block). */
	private static function htaccess_lines() {
		$base = self::home_path();
		return array(
			'<IfModule mod_rewrite.c>',
			'RewriteEngine On',
			'RewriteBase ' . $base,
			'RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]',
			'# LiteSpeed: never page-cache the POS apps or the POS API',
			'RewriteRule ^(pos|wp-json/pentarch-pos)(/.*)?$ - [E=Cache-Control:no-cache]',
			'RewriteRule ^pos(/.*)?$ ' . $base . 'index.php [L]',
			'</IfModule>',
		);
	}

	/**
	 * Add (or remove) our block at the top of .htaccess. Safe no-op on non-Apache servers
	 * or when the file is not writable.
	 */
	public static function write_htaccess( $add ) {
		global $is_apache;
		if ( empty( $is_apache ) ) {
			return false;
		}
		if ( ! function_exists( 'get_home_path' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		$file = get_home_path() . '.htaccess';
		if ( file_exists( $file ) && ! is_writable( $file ) ) {
			return false;
		}
		if ( ! file_exists( $file ) && ( ! $add || ! is_writable( dirname( $file ) ) ) ) {
			return false;
		}
		$content = file_exists( $file ) ? (string) file_get_contents( $file ) : ''; // phpcs:ignore
		$start   = '# BEGIN ' . self::MARKER;
		$end     = '# END ' . self::MARKER;
		$content = preg_replace( '/' . preg_quote( $start, '/' ) . '.*?' . preg_quote( $end, '/' ) . "\r?\n?/s", '', $content );
		if ( $add ) {
			$block   = $start . "\n" . implode( "\n", self::htaccess_lines() ) . "\n" . $end . "\n";
			$content = $block . ltrim( $content );
		}
		return false !== file_put_contents( $file, $content, LOCK_EX ); // phpcs:ignore
	}

	/** Has our block been written? */
	public static function htaccess_ok() {
		if ( ! function_exists( 'get_home_path' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
		$file = get_home_path() . '.htaccess';
		return file_exists( $file ) && false !== strpos( (string) file_get_contents( $file ), '# BEGIN ' . self::MARKER ); // phpcs:ignore
	}

	/** Is a real build present (not the placeholder)? */
	public static function build_info( $app ) {
		$f = PPC_DIR . 'public/' . $app . '/index.html';
		if ( ! is_file( $f ) ) {
			return array(
				'present'     => false,
				'placeholder' => false,
				'updated'     => 0,
			);
		}
		$c = (string) file_get_contents( $f ); // phpcs:ignore
		return array(
			'present'     => true,
			'placeholder' => false !== strpos( $c, 'ppc-placeholder' ),
			'updated'     => filemtime( $f ),
		);
	}
}
