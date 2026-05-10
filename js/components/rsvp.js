// RSVP form — animated submit + mailto compose.

export function bindRsvp(form) {
  if (!form) return;
  const submit = form.querySelector('#rsvp-submit');

  form.addEventListener('submit', (e) => {
    const action = form.getAttribute('action') || '';
    if (action.indexOf('mailto:') !== 0) return;   // server-handled forms pass through

    e.preventDefault();
    if (!form.reportValidity()) return;

    submit.classList.add('is-loading');
    submit.disabled = true;

    setTimeout(() => {
      const to = action.replace(/^mailto:/, '');
      const data = new FormData(form);
      const lines = [];
      data.forEach((v, k) => lines.push(`${k}: ${v}`));
      const body = encodeURIComponent(lines.join('\n'));
      const subject = encodeURIComponent('Wedding RSVP — ' + (data.get('Name') || 'Guest'));
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;

      submit.classList.remove('is-loading');
      submit.disabled = false;

      // Inline confirmation
      const confirm = document.createElement('p');
      confirm.style.cssText = 'text-align:center;color:var(--gold-light);font-style:italic;margin-top:1rem;letter-spacing:.04em';
      confirm.textContent = 'Thank you — your email client should now open with your reply.';
      form.appendChild(confirm);
    }, 700);
  });
}
