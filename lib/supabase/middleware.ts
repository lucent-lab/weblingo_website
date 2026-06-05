import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isDashboardE2eMockEnabled } from "@internal/dashboard/e2e-mock";
import {
  DASHBOARD_DEMO_SCOPE_HEADER,
  DASHBOARD_DEMO_SESSION_COOKIE,
} from "@internal/dashboard/demo-session-constants";
import { i18nConfig, type Locale } from "@internal/i18n";
import { getSupabasePublicEnv } from "./env";

const publicDemoDashboardPaths = new Set(
  i18nConfig.locales.flatMap((locale) => [
    `/${locale}/dashboard/demo`,
    `/${locale}/dashboard/demo/`,
  ]),
);
publicDemoDashboardPaths.add("/dashboard/demo");
publicDemoDashboardPaths.add("/dashboard/demo/");

function resolveDashboardReturnPath(pathname: string, search: string): string | null {
  if (pathname !== "/dashboard" && !pathname.startsWith("/dashboard/")) {
    return null;
  }
  return `${pathname}${search}`;
}

function isDemoDashboardSessionPath(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname === "/dashboard/") {
    return true;
  }
  const parts = pathname.split("/").filter(Boolean);
  return (
    parts.length >= 3 && parts[0] === "dashboard" && parts[1] === "sites" && parts[2] !== "new"
  );
}

export async function updateSession(request: NextRequest) {
  const publicDemoDashboardLocale = getPublicDemoDashboardLocale(request.nextUrl.pathname);

  if (isDashboardE2eMockEnabled()) {
    if (publicDemoDashboardLocale !== undefined) {
      return buildPublicDemoDashboardRewrite(request, publicDemoDashboardLocale);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const env = getSupabasePublicEnv();
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;
  const dashboardReturnPath = resolveDashboardReturnPath(
    request.nextUrl.pathname,
    request.nextUrl.search,
  );
  const hasDemoDashboardSession =
    isDemoDashboardSessionPath(request.nextUrl.pathname) &&
    request.cookies.has(DASHBOARD_DEMO_SESSION_COOKIE);

  if (publicDemoDashboardLocale !== undefined) {
    return buildPublicDemoDashboardRewrite(request, publicDemoDashboardLocale, supabaseResponse);
  }

  if (
    request.nextUrl.pathname !== "/" &&
    !user &&
    !hasDemoDashboardSession &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.search = "";
    if (dashboardReturnPath) {
      url.searchParams.set("next", dashboardReturnPath);
    }
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  if (hasDemoDashboardSession) {
    return buildDemoDashboardSessionResponse(request, supabaseResponse);
  }

  return supabaseResponse;
}

function getPublicDemoDashboardLocale(pathname: string): Locale | null | undefined {
  if (!publicDemoDashboardPaths.has(pathname)) {
    return undefined;
  }

  const pathParts = pathname.split("/").filter(Boolean);
  const maybeLocale = pathParts[0];
  if (maybeLocale && i18nConfig.locales.includes(maybeLocale as Locale)) {
    return maybeLocale as Locale;
  }

  return null;
}

function buildPublicDemoDashboardRewrite(
  request: NextRequest,
  locale: Locale | null,
  supabaseResponse?: NextResponse,
) {
  const url = new URL(request.url);
  url.pathname = "/demo-dashboard";
  if (locale) {
    url.searchParams.set("locale", locale);
  }

  const response = NextResponse.rewrite(url);
  for (const cookie of supabaseResponse?.cookies.getAll() ?? []) {
    response.cookies.set(cookie);
  }
  return response;
}

function buildDemoDashboardSessionResponse(request: NextRequest, supabaseResponse: NextResponse) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(DASHBOARD_DEMO_SCOPE_HEADER, "1");
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const cookie of supabaseResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }
  return response;
}
