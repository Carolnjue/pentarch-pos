/* Pentarch POS — admin interactions. */
(function () {
	'use strict';
	var CFG = window.PPC_ADMIN || {};

	// Confirm destructive actions.
	document.addEventListener('click', function (e) {
		var b = e.target.closest('[data-confirm]');
		if (b && !window.confirm(b.getAttribute('data-confirm'))) { e.preventDefault(); }
	});

	// Auto-submit filter selects.
	Array.prototype.forEach.call(document.querySelectorAll('select[data-autosubmit]'), function (s) {
		s.addEventListener('change', function () { s.form.submit(); });
	});

	// Bulk selection on commissions.
	var all = document.querySelector('[data-check-all]');
	var counter = document.querySelector('[data-selected-count]');
	function boxes() { return document.querySelectorAll('input[name="ids[]"]'); }
	function count() {
		var n = 0; Array.prototype.forEach.call(boxes(), function (b) { if (b.checked) n++; });
		if (counter) counter.textContent = n + ' selected';
	}
	if (all) {
		all.addEventListener('change', function () { Array.prototype.forEach.call(boxes(), function (b) { b.checked = all.checked; }); count(); });
	}
	Array.prototype.forEach.call(boxes(), function (b) { b.addEventListener('change', count); });
	var bulk = document.getElementById('ppc-bulk');
	if (bulk) {
		bulk.addEventListener('submit', function (e) {
			var n = 0; Array.prototype.forEach.call(boxes(), function (b) { if (b.checked) n++; });
			if (!n) { e.preventDefault(); window.alert('Select at least one commission.'); }
		});
	}

	// Record-payment form: fill amount/months from the chosen product.
	var pay = document.querySelector('.ppc-pay-form');
	if (pay && CFG.prices) {
		var type = pay.querySelector('[data-pay-type]');
		var qty = pay.querySelector('[data-pay-qty]');
		var amt = pay.querySelector('[data-pay-amount]');
		var months = pay.querySelector('[data-pay-months]');
		var unit = pay.querySelector('[data-pay-unit]');
		var branch = pay.querySelector('[data-pay-branch]');
		var summary = pay.querySelector('[data-pay-summary]');
		var touched = false;
		amt.addEventListener('input', function () { touched = true; render(); });
		months.addEventListener('input', render);
		function fmt(n) { return 'KES ' + Math.round(n).toLocaleString('en-KE'); }
		function render() {
			var d = CFG.prices[type.value] || { price: 0, months: 0, unit: 'item' };
			var q = Math.max(1, parseInt(qty.value || '1', 10));
			unit.textContent = '(' + d.unit + (q > 1 ? 's' : '') + ')';
			if (!touched && d.price) { amt.value = d.price * q; }
			var m = months.value !== '' ? parseInt(months.value, 10) : d.months * q;
			months.placeholder = String(d.months * q);
			branch.hidden = !/^extra_branch/.test(type.value);
			var parts = [];
			if (amt.value) parts.push(fmt(parseFloat(amt.value)) + ' for ' + d.label.toLowerCase() + (q > 1 ? ' × ' + q : ''));
			parts.push(m > 0 ? 'adds ' + m + ' month' + (m === 1 ? '' : 's') + ' to the licence' : 'licence dates unchanged');
			summary.textContent = parts.join(' — ');
		}
		type.addEventListener('change', function () { touched = false; months.value = ''; render(); });
		qty.addEventListener('input', function () { touched = false; render(); });
		render();
	}

	// Tools: does the Authorization header reach PHP? (Some shared hosts strip it.)
	var ac = document.querySelector('[data-ppc-authcheck]');
	if (ac && CFG.ping) {
		fetch(CFG.ping, { headers: { 'Authorization': 'Bearer ppd_check' }, credentials: 'omit' })
			.then(function (r) { return r.json(); })
			.then(function (j) {
				ac.innerHTML = j && j.auth_header_received
					? '<span class="ppc-ok">✓ Received by PHP</span>'
					: '<span class="ppc-warn">! Stripped by the server — the app falls back to the X-PPC-Token header</span>';
			})
			.catch(function () { ac.innerHTML = '<span class="ppc-warn">! REST API not reachable</span>'; });
	}
})();
