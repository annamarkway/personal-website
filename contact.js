// Submit the contact form in the background so visitors stay on the page.
window.addEventListener('load', () => {
  const form = document.getElementById('contact-form-el');
  const status = document.getElementById('contact-status');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    status.className = 'contact-status';
    status.innerText = 'Sending...';

    try {
      const resp = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' },
      });
      if (!resp.ok) throw new Error('Status ' + resp.status);
      form.reset();
      trackEvent('contact-form-sent', 'Contact form sent');
      status.classList.add('contact-status-success');
      status.innerText = "Thanks! Your message was sent. I'll get back to you soon.";
    } catch (err) {
      status.classList.add('contact-status-error');
      status.innerText = 'Something went wrong sending your message. Please try again, or email me directly.';
    } finally {
      button.disabled = false;
    }
  });
});
