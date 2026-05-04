import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout", "/api/health", "/api/delivery/batch", "/api/menu-links/", "/api/track/", "/api/settings/public", "/api/table-menu", "/api/siparis/", "/api/menu/categories", "/api/menu/items", "/api/orders", "/api/tables/session"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/siparis") || pathname.startsWith("/m/") || pathname.startsWith("/t/") || pathname.startsWith("/track/") || pathname.startsWith("/courier/batch/") || pathname.startsWith("/customer") || pathname.startsWith("/table/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("varosh_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Structural check: token should be base64url.base64url format
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.set("varosh_session", "", { maxAge: 0, path: "/" });
    return response;
  }

  // Check expiration from the payload without crypto verification
  try {
    const payload = JSON.parse(atob(parts[0].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp < Date.now()) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.set("varosh_session", "", { maxAge: 0, path: "/" });
      return response;
    }
  } catch {
    // If parse fails, let the server-side auth handle it
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
