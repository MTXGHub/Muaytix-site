/**
 * MuayTix Tonight - Webflow behaviour script
 *
 * Registered with the Webflow Data API as inline script `muaytix_behaviour` v1.0.0.
 * Hosted at:
 *   https://cdn.prod.website-files.com/6a852790915d21261647d825/.../muaytix_behaviour-1.0.0.js
 *
 * NOT YET ATTACHED to the site - applying it returns 404 "Custom code block not found",
 * which is Webflow's paid-site-plan gate. Attach it once the site is on a paid plan,
 * either in Site settings > Custom code, or via data_scripts_tool > add_site_script.
 *
  * Loads Barlow via injected stylesheet - NO LONGER NEEDED, the faces are now installed
 * as Webflow custom fonts. Strip the font block if this script is ever attached.
 *
 * Covers three behaviours that the React original handled in component state:
 *   1. Countdown  - Home.tsx <Countdown/> used a rolling 68h from page load, which is
 *                   mockup behaviour (it resets on every refresh). Replaced here with a
 *                   fixed target matching the advertised main event. One line to change.
 *   2. Mobile menu - replaces the useState(menuOpen) toggle.
 *   3. Cookie tray - replaces useState(visible), and additionally remembers the choice
 *                    in localStorage so it does not reappear on every visit.
 */
(function () {
  // Load Barlow + Barlow Condensed. Remove this block once Google Fonts are added
  // natively under Site settings > Fonts, so the faces appear in the Designer picker.
  var l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&family=Barlow+Condensed:wght@500;600;700;800;900&display=swap';
  document.head.appendChild(l);

  // ---- Countdown ---------------------------------------------------------
  // Target the advertised main event. ICT is UTC+7. Change this line to move it.
  var EVENT_TIME = new Date('2026-08-29T22:15:00+07:00').getTime();

  var cd = document.querySelector('[data-countdown]');
  if (cd) {
    var hEl = cd.querySelector('[data-cd="hrs"]');
    var mEl = cd.querySelector('[data-cd="min"]');
    var sEl = cd.querySelector('[data-cd="sec"]');
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var tick = function () {
      var t = Math.max(0, Math.floor((EVENT_TIME - Date.now()) / 1000));
      if (hEl) hEl.textContent = pad(Math.floor(t / 3600));
      if (mEl) mEl.textContent = pad(Math.floor((t % 3600) / 60));
      if (sEl) sEl.textContent = pad(t % 60);
    };
    tick();
    setInterval(tick, 1000);
  }

  // ---- Mobile menu -------------------------------------------------------
  var menu = document.querySelector('.js-mobile-menu');
  var openBtn = document.querySelector('.js-menu-open');
  if (menu && openBtn) {
    openBtn.addEventListener('click', function () {
      menu.classList.add('mobile-menu--open');
      document.body.style.overflow = 'hidden';
    });
    Array.prototype.forEach.call(document.querySelectorAll('.js-menu-close'), function (el) {
      el.addEventListener('click', function () {
        menu.classList.remove('mobile-menu--open');
        document.body.style.overflow = '';
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        menu.classList.remove('mobile-menu--open');
        document.body.style.overflow = '';
      }
    });
  }

  // ---- Cookie tray -------------------------------------------------------
  var tray = document.querySelector('.js-cookie-tray');
  if (tray) {
    var seen = false;
    try { seen = localStorage.getItem('mtx-cookie-ack') === '1'; } catch (err) {}
    if (seen) tray.classList.add('cookie-tray--hidden');
    Array.prototype.forEach.call(document.querySelectorAll('.js-cookie-dismiss'), function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        tray.classList.add('cookie-tray--hidden');
        try { localStorage.setItem('mtx-cookie-ack', '1'); } catch (err) {}
      });
    });
  }
})();
