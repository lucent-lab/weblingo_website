const URL_BASE = "https://weblingo.app";

export function withDashboardLocale(href: string, locale: string | null | undefined): string {
  const normalizedLocale = locale?.trim();
  if (!normalizedLocale) {
    return href;
  }
  try {
    const isAbsolute = /^[a-z][a-z\d+\-.]*:/i.test(href);
    const url = new URL(href, URL_BASE);
    url.searchParams.set("locale", normalizedLocale);
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}
