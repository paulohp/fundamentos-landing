(function () {
  var CONSENT_KEY = "fdr_consent";
  var cfg = window.__trackingConfig || {};
  var banner = document.getElementById("cookie-consent");
  var acceptBtn = document.getElementById("cookie-accept");
  var declineBtn = document.getElementById("cookie-decline");

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
  }

  var stored = localStorage.getItem(CONSENT_KEY);
  if (stored === "granted") {
    grantConsent();
  } else if (!stored && banner && (cfg.gaId || cfg.fbPixelId)) {
    banner.hidden = false;
  }

  if (acceptBtn) {
    acceptBtn.addEventListener("click", function () {
      localStorage.setItem(CONSENT_KEY, "granted");
      grantConsent();
      if (banner) banner.hidden = true;
    });
  }

  if (declineBtn) {
    declineBtn.addEventListener("click", function () {
      localStorage.setItem(CONSENT_KEY, "denied");
      if (banner) banner.hidden = true;
    });
  }

  var ctaEls = document.querySelectorAll('[data-track="checkout_click"]');
  for (var i = 0; i < ctaEls.length; i++) {
    ctaEls[i].addEventListener("click", function () {
      if (typeof fbq === "function") fbq("track", "InitiateCheckout");
      if (typeof gtag === "function") gtag("event", "begin_checkout");
    });
  }
})();
