import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/types/database.types';

const AUTH_ROUTES = ['/login', '/register'];
const ONBOARDING_ROUTE = '/onboarding';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient<Database>(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));
  const isOnboardingRoute = pathname.startsWith(ONBOARDING_ROUTE);

  // 1. Belum login & mencoba masuk ke halaman internal/dashboard
  if (!user && !isAuthRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Sudah login: cek kepemilikan organisasi
  if (user) {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    const hasOrganization = Boolean(membership?.organization_id);

    // Belum punya organisasi -> paksa masuk ke /onboarding
    if (!hasOrganization && !isOnboardingRoute) {
      const onboardingUrl = request.nextUrl.clone();
      onboardingUrl.pathname = ONBOARDING_ROUTE;
      return NextResponse.redirect(onboardingUrl);
    }

    // Sudah punya organisasi -> cegah akses ke /login, /register, maupun /onboarding
    if (hasOrganization && (isAuthRoute || isOnboardingRoute)) {
      const dashboardUrl = request.nextUrl.clone();
      dashboardUrl.pathname = '/';
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};