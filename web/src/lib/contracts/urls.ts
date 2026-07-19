function isLocalHostUrl(url: string) {
  return /localhost|127\.0\.0\.1/i.test(url);
}

/**
 * Public origin for staff-facing links (sign URLs, etc.).
 * Prefer the browser host in the client so Production never shows localhost
 * when NEXT_PUBLIC_APP_URL was left as a local default.
 */
export function publicAppUrl() {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (fromEnv && !isLocalHostUrl(fromEnv)) {
    return fromEnv;
  }

  // Vercel injects this on serverless (no protocol).
  const vercel = process.env.VERCEL_URL?.replace(/\/$/, "");
  if (vercel) {
    return `https://${vercel}`;
  }

  return fromEnv || "http://127.0.0.1:3000";
}

export function contractPublicUrl(token: string) {
  return `${publicAppUrl()}/sign/${token}`;
}
