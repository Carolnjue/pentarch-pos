/* Pentarch POS — public shortcodes (demo form + trial links). No dependencies. */
(function () {
	'use strict';
	var CFG = window.PPC_FRONT || {};
	var REF_KEY = 'ppc_ref';
	var REF_RE = /^AG-[A-Z0-9]{4,6}$/;

	function readRef() {
		var ref = '';
		try {
			var q = new URLSearchParams(window.location.search).get('ref');
			if (q && REF_RE.test(q.toUpperCase())) {
				ref = q.toUpperCase();
				try { localStorage.setItem(REF_KEY, JSON.stringify({ v: ref, t: Date.now() })); } catch (e) {}
				return ref;
			}
		} catch (e) {}
		try {
			var s = JSON.parse(localStorage.getItem(REF_KEY) || 'null');
			if (s && s.v && REF_RE.test(s.v) && Date.now() - s.t < 30 * 864e5) { ref = s.v; }
		} catch (e) {}
		return ref;
	}

	function digits(s) { return String(s || '').replace(/\D+/g, ''); }
	function normPhone(raw) {
		var d = digits(raw);
		if (d.indexOf('00254') === 0) d = d.slice(2);
		if (d.length === 10 && d[0] === '0') d = '254' + d.slice(1);
		else if (d.length === 9 && (d[0] === '7' || d[0] === '1')) d = '254' + d;
		return /^254[17]\d{8}$/.test(d) ? d : '';
	}
	function prettyPhone(p) { var m = /^254(\d{3})(\d{3})(\d{3})$/.exec(p); return m ? '0' + m[1] + ' ' + m[2] + ' ' + m[3] : p; }

	var ref = readRef();

	// Trial / demo links carry the referral code through.
	Array.prototype.forEach.call(document.querySelectorAll('[data-ppc-ref-link]'), function (a) {
		if (!ref) return;
		try { var u = new URL(a.href, window.location.href); u.searchParams.set('ref', ref); a.href = u.toString(); } catch (e) {}
	});

	Array.prototype.forEach.call(document.querySelectorAll('[data-ppc-demo]'), function (form) {
		var root = form.parentNode;
		var ok = root.querySelector('.ppc-demo__ok');
		var alertBox = form.querySelector('.ppc-demo__alert');
		var btn = form.querySelector('button[type=submit]');
		form.elements.agent_code.value = ref;
		form.elements.source_page.value = window.location.href.split('#')[0].slice(0, 250);

		function setErr(name, msg) {
			var el = form.querySelector('[data-err="' + name + '"]');
			if (!el) return;
			el.textContent = msg || '';
			el.parentNode.classList.toggle('is-invalid', !!msg);
		}
		function clearErrs() {
			Array.prototype.forEach.call(form.querySelectorAll('.is-invalid'), function (n) { n.classList.remove('is-invalid'); });
			alertBox.hidden = true;
		}
		Array.prototype.forEach.call(form.querySelectorAll('input,select,textarea'), function (el) {
			el.addEventListener('input', function () { if (el.parentNode.classList.contains('is-invalid')) setErr(el.name, ''); });
		});

		form.addEventListener('submit', function (ev) {
			ev.preventDefault();
			clearErrs();
			var f = form.elements;
			var data = {
				name: f.name.value.trim(), phone: f.phone.value.trim(), business: f.business.value.trim(),
				business_type: f.business_type.value, email: f.email.value.trim(), town: f.town.value.trim(),
				preferred_date: f.preferred_date.value, preferred_time: f.preferred_time.value, message: f.message.value.trim(),
				agent_code: f.agent_code.value, source_page: f.source_page.value, website: f.website.value
			};
			var bad = false;
			if (data.name.length < 2) { setErr('name', 'Enter your name.'); bad = true; }
			if (!normPhone(data.phone)) { setErr('phone', 'Enter a valid phone number, e.g. 0712 345 678.'); bad = true; }
			if (data.business.length < 2) { setErr('business', 'Enter the business name.'); bad = true; }
			if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { setErr('email', 'Enter a valid email or leave it blank.'); bad = true; }
			if (bad) { var first = form.querySelector('.is-invalid input, .is-invalid select'); if (first) first.focus(); return; }

			btn.disabled = true; btn.classList.add('is-busy');
			fetch(CFG.endpoint, {
				method: 'POST', credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
				body: JSON.stringify(data)
			}).then(function (r) {
				return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; });
			}).then(function (res) {
				btn.disabled = false; btn.classList.remove('is-busy');
				if (res.status >= 200 && res.status < 300 && res.body && res.body.ok) {
					var refNo = res.body.ref;
					ok.querySelector('.ppc-demo__ref').textContent = refNo;
					ok.querySelector('.ppc-demo__phone').textContent = prettyPhone(normPhone(data.phone));
					var wa = (res.body.whatsapp || CFG.whatsapp || '254729455912');
					var text = 'Hello Pentarch, I have booked a Pentarch POS demo. Reference ' + refNo + '. Business: ' + data.business + '.';
					ok.querySelector('[data-wa]').href = 'https://wa.me/' + digits(wa) + '?text=' + encodeURIComponent(text);
					var tryUrl = (CFG.posUrl || '/pos/') + '?demo=1' + (ref ? '&ref=' + encodeURIComponent(ref) : '');
					ok.querySelector('[data-try]').href = tryUrl;
					form.hidden = true; ok.hidden = false; ok.focus();
					try { root.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
					return;
				}
				var b = res.body || {};
				if (b.data && b.data.fields) { Object.keys(b.data.fields).forEach(function (k) { setErr(k, b.data.fields[k]); }); }
				alertBox.textContent = b.message || 'Something went wrong. Please try again, or message us on WhatsApp.';
				alertBox.hidden = false;
			}).catch(function () {
				btn.disabled = false; btn.classList.remove('is-busy');
				alertBox.textContent = 'You appear to be offline. Check your connection and try again, or message us on WhatsApp.';
				alertBox.hidden = false;
			});
		});
	});
})();
