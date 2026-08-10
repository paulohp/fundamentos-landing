/**
 * Meta Conversions API (CAPI) — Serverless endpoint for Vercel.
 *
 * Receives events from the browser (where the Pixel already fires) and
 * sends them *also* server-to-server to Meta.  This catches traffic that
 * ad-blockers or ITP might swallow on the Pixel side.
 *
 * Usage:
 *   POST /api/meta-capi
 *   Body:
 *     { "eventName": "PageView", "eventId": "<optional dedup>", "url": "<current page>", "userData": {} }
 *
 * Environment variables (set in Vercel dashboard):
 *   META_CAPI_TOKEN  — Access Token from Meta Events Manager
 *   META_PIXEL_ID    — Same pixel ID used in the front-end
 */

const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** SHA-256 hash a string. Returns empty string for falsy input. */
function sha256(str) {
  if (!str) return "";
  return crypto.createHash("sha256").update(String(str)).digest("hex");
}

/** Normalise and hash user data so Meta never sees raw PII on the server. */
function buildUserData(raw) {
  const u = raw || {};
  return {
    em: sha256(u.email), // email
    ph: sha256(u.phone), // phone
    fn: sha256(u.firstName), // first name
    ln: sha256(u.lastName), // last name
    ct: sha256(u.city), // city
    st: sha256(u.state), // state
    zp: sha256(u.zip), // postal code
    external_id: sha256(u.externalId),
    client_ip_address: u.ip || "",
    client_user_agent: u.userAgent || "",
  };
}

/** Build the payload Meta expects for the Conversions API. */
function buildPayload(eventName, eventData, pixelId, token) {
  const now = new Date();
  const eventTime = Math.floor(now.getTime() / 1000);

  return {
    data: [
      {
        event_name: eventName,
        event_time: eventTime,
        event_id: eventData.eventId || `${eventName}_${eventTime}`,
        action_source: "website",
        event_source_url: eventData.url || "",
        user_data: buildUserData(eventData.userData),
        custom_data: eventData.customData || {},
      },
    ],
    access_token: token,
    pixel_id: pixelId,
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

module.exports = async (req, res) => {
  // Only accept POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = process.env.META_CAPI_TOKEN;
  const pixelId = process.env.META_PIXEL_ID || req.body.pixelId;

  if (!token) {
    console.warn("[meta-capi] META_CAPI_TOKEN not set — skipping event");
    return res
      .status(200)
      .json({ ok: true, skipped: true, reason: "token not configured" });
  }

  if (!pixelId) {
    console.warn("[meta-capi] META_PIXEL_ID not set — skipping event");
    return res
      .status(200)
      .json({ ok: true, skipped: true, reason: "pixelId not configured" });
  }

  try {
    const { eventName, ...eventData } = req.body;
    if (!eventName) {
      return res.status(400).json({ error: "eventName is required" });
    }

    // Merge the real client IP from Vercel's headers into userData.
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "";
    const userData = { ...(eventData.userData || {}), ip };

    const payload = buildPayload(
      eventName,
      { ...eventData, userData },
      pixelId,
      token,
    );
    const metaUrl = `https://graph.facebook.com/v22.0/${pixelId}/events`;

    const metaRes = await fetch(metaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const metaBody = await metaRes.json();

    if (!metaRes.ok) {
      console.error("[meta-capi] Meta API error:", metaBody);
      return res
        .status(metaRes.status)
        .json({ error: "Meta API error", details: metaBody });
    }

    console.log("[meta-capi] Event sent:", eventName, metaBody);
    return res.status(200).json({ ok: true, meta: metaBody });
  } catch (err) {
    console.error("[meta-capi] Unexpected error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
};
