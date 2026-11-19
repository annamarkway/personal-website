// Visitor analytics with GoatCounter (https://www.goatcounter.com): free,
// no cookies, no personal data. Analytics stay off until GOATCOUNTER_CODE is set.
//
// To turn it on: create a GoatCounter account, then put your site code here.
// If your dashboard is https://annamarkway.goatcounter.com, the code is "annamarkway".
const GOATCOUNTER_CODE = 'anna-markway-personal-site';

(function () {
  if (!GOATCOUNTER_CODE) return;
  // Don't count visits while testing the site locally.
  if (['localhost', '127.0.0.1', ''].includes(window.location.hostname)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://gc.zgo.at/count.js';
  script.dataset.goatcounter = 'https://' + GOATCOUNTER_CODE + '.goatcounter.com/count';
  document.head.appendChild(script);
})();

// Count an action, such as a resume download. Names show up in the
// GoatCounter dashboard. Never pass anything a visitor typed.
function trackEvent(name, title) {
  if (window.goatcounter && typeof window.goatcounter.count === 'function') {
    window.goatcounter.count({ path: name, title: title || name, event: true });
  }
}

// Any link or button with data-track="event-name" is counted when clicked.
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('[data-track]');
  if (el) trackEvent(el.dataset.track);
});

// Count bookings made through the Calendly widget on the Contact page.
window.addEventListener('message', (e) => {
  if (e.origin === 'https://calendly.com' && e.data && e.data.event === 'calendly.event_scheduled') {
    trackEvent('calendly-booked', 'Calendly chat booked');
  }
});
