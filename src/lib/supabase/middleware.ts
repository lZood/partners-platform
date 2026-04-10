import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    }
  );

  // Refresh session — important for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Classify the page type
  const pathname = request.nextUrl.pathname;
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth");
  const isSetPasswordPage = pathname.startsWith("/auth/set-password");
  const isPendingPage = pathname.startsWith("/auth/pending-approval");

  // Redirect unauthenticated users to login (except auth pages)
  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // For authenticated users trying to access dashboard pages,
  // check if they have at least one partner assignment
  if (user && !isAuthPage) {
    // Look up the user record and check for partner roles
    const { data: userRecord } = await supabase
      .from("users")
      .select("id, user_partner_roles (id)")
      .eq("auth_user_id", user.id)
      .single();

    const hasPartnerRoles =
      userRecord?.user_partner_roles &&
      (userRecord.user_partner_roles as any[]).length > 0;

    if (!hasPartnerRoles) {
      const url = request.nextUrl.clone();
      url.pathname = "/auth/pending-approval";
      return NextResponse.redirect(url);
    }
  }

  // Redirect authenticated users away from auth pages
  // BUT allow /auth/set-password and /auth/pending-approval
  if (user && isAuthPage && !isSetPasswordPage && !isPendingPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
