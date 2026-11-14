<?php
/**
 * Shortcodes: [pentarch_pos_demo_form] and [pentarch_pos_trial_link].
 *
 * Referral codes (?ref=AG-XXXX) are read in the browser (and remembered for 30 days)
 * so the HTML stays cacheable by LiteSpeed.
 *
 * @package PentarchPOSCloud
 */

defined( 'ABSPATH' ) || exit;

class PPC_Shortcodes {

	public static function init() {
		add_shortcode( 'pentarch_pos_demo_form', array( __CLASS__, 'demo_form' ) );
		add_shortcode( 'pentarch_pos_trial_link', array( __CLASS__, 'trial_link' ) );
		add_action( 'wp_enqueue_scripts', array( __CLASS__, 'maybe_enqueue' ) );
	}

	private static function register_assets() {
		wp_register_style( 'ppc-front', PPC_URL . 'assets/front.css', array(), PPC_VERSION );
		wp_register_script( 'ppc-front', PPC_URL . 'assets/front.js', array(), PPC_VERSION, true );
		wp_localize_script(
			'ppc-front',
			'PPC_FRONT',
			array(
				'endpoint' => esc_url_raw( rest_url( PPC_NS . '/public/demo-booking' ) ),
				'whatsapp' => (string) PPC_Settings::get( 'whatsapp' ),
				'posUrl'   => esc_url_raw( home_url( '/pos/' ) ),
			)
		);
	}

	/** Enqueue in <head> when the current post contains a shortcode (avoids a flash of unstyled form). */
	public static function maybe_enqueue() {
		self::register_assets();
		if ( is_singular() ) {
			$post = get_post();
			if ( $post && ( has_shortcode( $post->post_content, 'pentarch_pos_demo_form' ) || has_shortcode( $post->post_content, 'pentarch_pos_trial_link' ) ) ) {
				wp_enqueue_style( 'ppc-front' );
				wp_enqueue_script( 'ppc-front' );
			}
		}
	}

	private static function enqueue() {
		if ( ! wp_script_is( 'ppc-front', 'registered' ) ) {
			self::register_assets();
		}
		wp_enqueue_style( 'ppc-front' );
		wp_enqueue_script( 'ppc-front' );
	}

	public static function demo_form( $atts ) {
		self::enqueue();
		$a     = shortcode_atts(
			array(
				'title'    => 'Book a free demo',
				'subtitle' => 'See Pentarch POS working for your type of business. We will call you to confirm a time — at your shop or online.',
				'button'   => 'Book my demo',
			),
			$atts,
			'pentarch_pos_demo_form'
		);
		$uid   = 'ppc-demo-' . wp_rand( 1000, 99999 );
		$types = PPC_Tenants::business_types();
		$min   = wp_date( 'Y-m-d' );
		ob_start();
		?>
<div class="ppc-demo" id="<?php echo esc_attr( $uid ); ?>">
	<div class="ppc-demo__strip" aria-hidden="true"></div>
	<form class="ppc-demo__form" novalidate data-ppc-demo>
		<div class="ppc-demo__head">
			<h3 class="ppc-demo__title"><?php echo esc_html( $a['title'] ); ?></h3>
			<?php if ( $a['subtitle'] ) : ?>
				<p class="ppc-demo__sub"><?php echo esc_html( $a['subtitle'] ); ?></p>
			<?php endif; ?>
		</div>
		<div class="ppc-demo__grid">
			<label class="ppc-f">
				<span class="ppc-f__l">Your name <i>*</i></span>
				<input type="text" name="name" autocomplete="name" required maxlength="190" placeholder="e.g. Mary Wanjiku">
				<span class="ppc-f__e" data-err="name"></span>
			</label>
			<label class="ppc-f">
				<span class="ppc-f__l">Phone (WhatsApp) <i>*</i></span>
				<input type="tel" name="phone" autocomplete="tel" inputmode="tel" required maxlength="20" placeholder="0712 345 678">
				<span class="ppc-f__e" data-err="phone"></span>
			</label>
			<label class="ppc-f">
				<span class="ppc-f__l">Business name <i>*</i></span>
				<input type="text" name="business" autocomplete="organization" required maxlength="190" placeholder="e.g. Wanjiku Minimart">
				<span class="ppc-f__e" data-err="business"></span>
			</label>
			<label class="ppc-f">
				<span class="ppc-f__l">Type of business</span>
				<select name="business_type">
					<option value="">Choose…</option>
					<?php foreach ( $types as $k => $label ) : ?>
						<option value="<?php echo esc_attr( $k ); ?>"><?php echo esc_html( $label ); ?></option>
					<?php endforeach; ?>
				</select>
			</label>
			<label class="ppc-f">
				<span class="ppc-f__l">Email <em>(optional)</em></span>
				<input type="email" name="email" autocomplete="email" maxlength="190" placeholder="you@example.com">
				<span class="ppc-f__e" data-err="email"></span>
			</label>
			<label class="ppc-f">
				<span class="ppc-f__l">Town / area</span>
				<input type="text" name="town" autocomplete="address-level2" maxlength="100" placeholder="e.g. Kitengela">
			</label>
			<label class="ppc-f">
				<span class="ppc-f__l">Preferred date</span>
				<input type="date" name="preferred_date" min="<?php echo esc_attr( $min ); ?>">
			</label>
			<label class="ppc-f">
				<span class="ppc-f__l">Preferred time</span>
				<select name="preferred_time">
					<option value="">Any time</option>
					<option value="morning">Morning (8am – 12pm)</option>
					<option value="afternoon">Afternoon (12pm – 3pm)</option>
					<option value="late_afternoon">Late afternoon (3pm – 6pm)</option>
				</select>
			</label>
			<label class="ppc-f ppc-f--full">
				<span class="ppc-f__l">Anything we should know? <em>(optional)</em></span>
				<textarea name="message" rows="3" maxlength="2000" placeholder="e.g. Two branches, about 800 products, we use a paper book today."></textarea>
			</label>
		</div>
		<div class="ppc-hp" aria-hidden="true">
			<label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
		</div>
		<input type="hidden" name="agent_code" value="">
		<input type="hidden" name="source_page" value="">
		<div class="ppc-demo__foot">
			<button type="submit" class="ppc-btn ppc-btn--primary"><span class="ppc-btn__t"><?php echo esc_html( $a['button'] ); ?></span><span class="ppc-btn__spin" aria-hidden="true"></span></button>
			<p class="ppc-demo__note">Free, no obligation. We reply within one working day.</p>
		</div>
		<div class="ppc-demo__alert" role="alert" hidden></div>
	</form>
	<div class="ppc-demo__ok" hidden tabindex="-1">
		<div class="ppc-demo__tick" aria-hidden="true"><svg viewBox="0 0 24 24" width="30" height="30"><path fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" d="M5 12.5l4.2 4.2L19 7"/></svg></div>
		<h3 class="ppc-demo__title">Thank you — your demo is booked</h3>
		<p class="ppc-demo__sub">Your reference is <strong class="ppc-demo__ref"></strong>. We will call you on <strong class="ppc-demo__phone"></strong> to confirm the time.</p>
		<div class="ppc-demo__actions">
			<a class="ppc-btn ppc-btn--wa" href="#" target="_blank" rel="noopener" data-wa>
				<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.1 5.1 0 0 0 1.1 2.7 11.6 11.6 0 0 0 4.4 3.9c1.6.7 2.3.8 3.1.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z"/></svg>
				Message us on WhatsApp
			</a>
			<a class="ppc-btn ppc-btn--ghost" href="#" data-try>Try the live demo now</a>
		</div>
	</div>
</div>
		<?php
		return ob_get_clean();
	}

	public static function trial_link( $atts ) {
		self::enqueue();
		$a = shortcode_atts(
			array(
				'label' => 'Start free ' . (int) PPC_Settings::get( 'trial_days' ) . '-day trial',
				'demo'  => '0',
				'style' => 'primary',
			),
			$atts,
			'pentarch_pos_trial_link'
		);
		$args = array();
		if ( '1' === (string) $a['demo'] ) {
			$args['demo'] = 1;
		} else {
			$args['trial'] = 1; // opens the trial form (never a demo the visitor tried earlier)
		}
		$href  = add_query_arg( $args, home_url( '/pos/' ) );
		$class = 'ppc-btn ppc-btn--' . ( in_array( $a['style'], array( 'primary', 'ghost', 'dark' ), true ) ? $a['style'] : 'primary' );
		return '<a class="ppc-trial-link ' . esc_attr( $class ) . '" data-ppc-ref-link href="' . esc_url( $href ) . '">' . esc_html( $a['label'] ) . ' <span aria-hidden="true">→</span></a>';
	}
}
