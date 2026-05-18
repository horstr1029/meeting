import { auth } from "@/auth";
import { NextResponse } from "next/server";

const publicPaths = ["/login", "/register"];

export default auth((req) => {
  const isPublic = publicPaths.some((p) => req.nextUrl.pathname.startsWith(p));

  if (!req.auth && !isPublic) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (req.auth && isPublic) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
