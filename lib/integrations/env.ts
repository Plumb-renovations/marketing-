// Central, server-only access to integration credentials + settings. Every
// value comes from env (never the DB, never the browser). `configured` flags
// let routes/UI degrade gracefully and report what's still missing.

function get(name: string) {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : undefined;
}

export const meta = {
  appId: get("META_APP_ID"),
  appSecret: get("META_APP_SECRET"),
  // Facebook Login for Business "configuration" id (optional). When set, the
  // Connect-Meta dialog uses this configuration; otherwise it falls back to a
  // scope-based dialog with the same permissions (handy for dev/testing).
  loginConfigId: get("META_LOGIN_CONFIG_ID"),
  systemUserToken: get("META_SYSTEM_USER_TOKEN"),
  webhookVerifyToken: get("META_WEBHOOK_VERIFY_TOKEN"),
  graphVersion: get("META_GRAPH_VERSION") || "v23.0",
  adAccountId: get("META_AD_ACCOUNT_ID"), // digits only, no act_ prefix
  pageId: get("META_PAGE_ID"),
  igUserId: get("META_IG_USER_ID"),
  billingCurrency: get("META_BILLING_CURRENCY") || "NZD", // account bills in NZD
  get configured() {
    return !!(this.systemUserToken && this.adAccountId);
  },
  get webhookConfigured() {
    return !!(this.systemUserToken && this.webhookVerifyToken && this.appSecret);
  },
};

export const googleAds = {
  developerToken: get("GOOGLE_ADS_DEVELOPER_TOKEN"),
  clientId: get("GOOGLE_ADS_CLIENT_ID"),
  clientSecret: get("GOOGLE_ADS_CLIENT_SECRET"),
  refreshToken: get("GOOGLE_ADS_REFRESH_TOKEN"),
  loginCustomerId: get("GOOGLE_ADS_LOGIN_CUSTOMER_ID"), // MCC, digits only
  customerId: get("GOOGLE_ADS_CUSTOMER_ID"), // the renovations account, digits only
  apiVersion: get("GOOGLE_ADS_API_VERSION") || "v23",
  get configured() {
    return !!(this.developerToken && this.clientId && this.clientSecret && this.refreshToken && this.customerId);
  },
};

export const dataManager = {
  clientId: get("GOOGLE_DM_CLIENT_ID") || googleAds.clientId,
  clientSecret: get("GOOGLE_DM_CLIENT_SECRET") || googleAds.clientSecret,
  refreshToken: get("GOOGLE_DM_REFRESH_TOKEN") || googleAds.refreshToken,
  // Operating account + the Google Ads conversion-action destination.
  loginAccount: get("GOOGLE_DM_LOGIN_ACCOUNT") || googleAds.loginCustomerId,
  operatingAccount: get("GOOGLE_DM_OPERATING_ACCOUNT") || googleAds.customerId,
  conversionActionId: get("GOOGLE_DM_CONVERSION_ACTION_ID"),
  get configured() {
    return !!(this.clientId && this.clientSecret && this.refreshToken && this.operatingAccount && this.conversionActionId);
  },
};

export const googleBusiness = {
  // OAuth app credentials (shared by every org's per-user connection).
  clientId: get("GOOGLE_GBP_CLIENT_ID"),
  clientSecret: get("GOOGLE_GBP_CLIENT_SECRET"),
  // Env fallback for the DEFAULT (Plumb) org — analogous to the Meta System User.
  refreshToken: get("GOOGLE_GBP_REFRESH_TOKEN"),
  accountId: get("GOOGLE_GBP_ACCOUNT_ID"), // "accounts/123" or bare id
  locationId: get("GOOGLE_GBP_LOCATION_ID"), // "locations/456" or bare id
  get oauthConfigured() {
    return !!(this.clientId && this.clientSecret);
  },
};

export const twilio = {
  accountSid: get("TWILIO_ACCOUNT_SID"),
  authToken: get("TWILIO_AUTH_TOKEN"),
  from: get("TWILIO_FROM"), // sending number, e.g. +61...
  get configured() {
    return !!(this.accountSid && this.authToken && this.from);
  },
};

export const resend = {
  apiKey: get("RESEND_API_KEY"),
  from: get("LEAD_FROM_EMAIL") || get("REVIEW_FROM_EMAIL") || "hello@example.com",
  fromName: get("LEAD_FROM_NAME") || "",
  get configured() {
    return !!this.apiKey;
  },
};

export const fx = {
  apiKey: get("FX_API_KEY"),
  apiBase: get("FX_API_BASE") || "https://api.exchangerate.host",
};

export const app = {
  url: get("NEXT_PUBLIC_APP_URL") || "http://localhost:3000",
  cronSecret: get("CRON_SECRET"),
};

// A redacted snapshot for the in-app "Integrations" status (no secret values).
export function integrationStatus() {
  return {
    meta: { configured: meta.configured, webhook: meta.webhookConfigured, graphVersion: meta.graphVersion },
    googleAds: { configured: googleAds.configured, apiVersion: googleAds.apiVersion },
    dataManager: { configured: dataManager.configured },
    fx: { configured: !!fx.apiKey || true }, // exchangerate.host works keyless
  };
}
