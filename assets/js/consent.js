(function () {
  var DISCLOSURE_KEY = "fdr_disclosure_seen";
  var cfg = window.__trackingConfig || {};
  var banner = document.getElementById("cookie-consent");
  var dismissBtn = document.getElementById("cookie-dismiss");

  /* -----------------------------------------------------------------------
     Meta Conversions API (CAPI) — server-side event relay
  ----------------------------------------------------------------------- */

  function sendCapi(eventName, extra) {
    if (!cfg.fbPixelId) return;
    extra = extra || {};
    var payload = {
      eventName: eventName,
      eventId: extra.eventId || eventName + "_" + Date.now(),
      pixelId: cfg.fbPixelId,
      url: window.location.href,
      userData: {},
      customData: extra.customData || {},
    };
    // Best-effort — fire-and-forget, never block the UI.
    // keepalive ensures the request completes even if the user navigates away.
    fetch("/api/meta-capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(function () {
      /* silently ignore network errors */
    });
  }

  /* -----------------------------------------------------------------------
     Google Analytics (GA4) via gtag
  ----------------------------------------------------------------------- */

  function loadGtag() {
    if (!cfg.gaId || window.__gaLoaded) return;
    window.__gaLoaded = true;
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + cfg.gaId;
    document.head.appendChild(s);
    gtag("js", new Date());
    gtag("config", cfg.gaId, { anonymize_ip: true });
  }

  /* -----------------------------------------------------------------------
     Meta Pixel (client-side)
  ----------------------------------------------------------------------- */

  function loadPixel() {
    if (!cfg.fbPixelId || window.__fbLoaded) return;
    window.__fbLoaded = true;
    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod
          ? n.callMethod.apply(n, arguments)
          : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = "2.0";
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(
      window,
      document,
      "script",
      "https://connect.facebook.net/en_US/fbevents.js",
    );
    /* eslint-enable */
    fbq("init", cfg.fbPixelId);
    fbq("track", "PageView");
  }

  /* -----------------------------------------------------------------------
     Deferred execution — run tracking only when the browser is idle
     so it never blocks rendering or the main thread.
  ----------------------------------------------------------------------- */

  function runWhenIdle(fn) {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(fn, { timeout: 2000 });
    } else {
      setTimeout(fn, 500);
    }
  }

  function grantConsent() {
    if (typeof gtag === "function") {
      gtag("consent", "update", {
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
        analytics_storage: "granted",
      });
    }
    loadGtag();
    loadPixel();
    // Also fire server-side PageView so CAPI catches what the Pixel might miss.
    sendCapi("PageView");
  }

  // Defer ALL tracking until the browser is idle.
  runWhenIdle(grantConsent);

  /* -----------------------------------------------------------------------
     Cookie-consent banner (purely informational)
  ----------------------------------------------------------------------- */

  if (
    banner &&
    (cfg.gaId || cfg.fbPixelId) &&
    !localStorage.getItem(DISCLOSURE_KEY)
  ) {
    banner.hidden = false;
  }

  if (dismissBtn) {
    dismissBtn.addEventListener("click", function () {
      localStorage.setItem(DISCLOSURE_KEY, "1");
      if (banner) banner.hidden = true;
    });
  }

  /* -----------------------------------------------------------------------
     Checkout CTA clicks — fire both Pixel + CAPI + GA4
  ----------------------------------------------------------------------- */

  var ctaEls = document.querySelectorAll('[data-track="checkout_click"]');
  for (var i = 0; i < ctaEls.length; i++) {
    ctaEls[i].addEventListener("click", function () {
      if (typeof fbq === "function") fbq("track", "InitiateCheckout");
      if (typeof gtag === "function") gtag("event", "begin_checkout");
      sendCapi("InitiateCheckout", { eventId: "chk_" + Date.now() });
    });
  }
})();
