const DEMO_DASHBOARD_PATH = "/dashboard/demo";
const URL_BASE = "https://weblingo.app";

export function withDemoDashboardLocale(href: string, locale: string): string {
  const normalizedLocale = locale.trim();
  if (!normalizedLocale) {
    return href;
  }
  try {
    const isAbsolute = /^[a-z][a-z\d+\-.]*:/i.test(href);
    const url = new URL(href, URL_BASE);
    if (url.pathname !== DEMO_DASHBOARD_PATH) {
      return href;
    }
    url.searchParams.set("locale", normalizedLocale);
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}
