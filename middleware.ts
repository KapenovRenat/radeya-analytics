import { NextRequest, NextResponse } from "next/server";

/**
 * Basic Auth for all routes except /api/health.
 * Supports multiple users via RADEYA_USER/RADEYA_PASS (primary) and
 * RADEYA_USER_2/RADEYA_PASS_2 (secondary — e.g. for a partner / client demo).
 * Add more pairs by extending the PAIRS array below.
 */
export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === "/api/health") return NextResponse.next();

  // Public demo mode: skip Basic Auth entirely.
  // Set PUBLIC_DEMO env var (any value, even empty) to disable auth — used for
  // course demos on mock data. Unset the var to re-enable auth.
  if (process.env.PUBLIC_DEMO !== undefined) return NextResponse.next();

  const pairs = [
    [process.env.RADEYA_USER, process.env.RADEYA_PASS],
    [process.env.RADEYA_USER_2, process.env.RADEYA_PASS_2],
  ].filter((p): p is [string, string] => !!p[0] && !!p[1]);

  if (pairs.length === 0) {
    if (process.env.NODE_ENV === "production") {
      return new NextResponse(
        "Server misconfigured: RADEYA_USER/RADEYA_PASS not set",
        { status: 500 },
      );
    }
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization");
  const matched = pairs.some(([user, pass]) => {
    const expected = "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
    return auth === expected;
  });

  if (!matched) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="radeya-analytics"' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
