/** Relayer API 베이스. 앱(로컬 번들)은 Vercel 절대 URL, 웹은 /api */
export function getRelayerApiBase(): string {
  const base = process.env.NEXT_PUBLIC_RELAYER_API_BASE?.trim();
  if (base) return base.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') return 'https://ad-gas.vercel.app/api';
  return '/api';
}
