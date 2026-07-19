export function publicAppUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3000"
  );
}

export function contractPublicUrl(token: string) {
  return `${publicAppUrl()}/sign/${token}`;
}
