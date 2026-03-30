/**
 * API + Twitch OAuth base URL. Local/dev hosts (Live Server, etc.) use the live Worker URL
 * so /auth/twitch and /auth/callback match Twitch redirect URIs and production secrets.
 *
 * Override: <meta name="castle-public-url" content="https://your-domain.com">
 */
(function (w) {
  var DEFAULT_PRODUCTION_ORIGIN = 'https://multistreamer-tcg.codeoce.workers.dev';

  function readMetaPublicUrl() {
    try {
      var m = typeof document !== 'undefined' && document.querySelector('meta[name="castle-public-url"]');
      if (m) {
        var c = (m.getAttribute('content') || '').trim().replace(/\/$/, '');
        if (c.indexOf('http://') === 0 || c.indexOf('https://') === 0) return c;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function getCastleBackendOrigin() {
    var canonical = readMetaPublicUrl() || DEFAULT_PRODUCTION_ORIGIN;
    try {
      var h = window.location.hostname;
      var isLocal =
        h === 'localhost' ||
        h === '127.0.0.1' ||
        !h ||
        window.location.protocol === 'file:';
      if (isLocal) {
        return canonical;
      }
      return window.location.origin;
    } catch (e) {
      return canonical;
    }
  }

  w.getCastleBackendOrigin = getCastleBackendOrigin;
  w.__CASTLE_BACKEND__ = getCastleBackendOrigin();
})(typeof window !== 'undefined' ? window : globalThis);
