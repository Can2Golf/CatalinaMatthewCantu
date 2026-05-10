// RSVP form — submit shrinks button to a circle, spinner shows, then
// expands back with a checkmark and "We can't wait to celebrate with you!"

export function bindRsvp(form) {
  if (!form) return;
  const submit = form.querySelector('#rsvp-submit');

  form.addEventListener('submit', (e) => {
    const action = form.getAttribute('action') || '';
    if (action.indexOf('mailto:') !== 0) return;
    e.preventDefault();
    if (!form.reportValidity()) return;

    submit.classList.add('is-loading');
    submit.disabled = true;

    setTimeout(() => {
      // Compose mailto and open user's email client
      const to = action.replace(/^mailto:/, '');
      const data = new FormData(form);
      const lines = [];
      data.forEach((v, k) => lines.push(`${k}: ${v}`));
      const body = encodeURIComponent(lines.join('\n'));
      const subject = encodeURIComponent('Wedding RSVP — ' + (data.get('Name') || 'Guest'));
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;

      submit.classList.remove('is-loading');
      submit.classList.add('is-success');
    }, 900);
  });
}
