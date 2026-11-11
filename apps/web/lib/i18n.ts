import cs from './cs.json';
export type Locale = 'cs' | 'en';
export function getLocale(): Locale {
  if (typeof window === 'undefined') return 'cs';
  return document.cookie.split('; ').includes('open-ta-language=en') ? 'en' : 'cs';
}
export function localeTag() { return getLocale() === 'cs' ? 'cs-CZ' : 'en-GB'; }
export function t(message: string): string {
  return getLocale() === 'cs' ? (cs as Record<string, string>)[message] ?? message : message;
}
