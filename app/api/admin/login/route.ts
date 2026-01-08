import { NextResponse } from "next/server";

const sessionCookieName = "admin_session";

export async function POST(request: Request) {
  const formData = await request.formData();
  const password = formData.get("password");
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword) {
    return NextResponse.json(
      { error: "Admin password not configured." },
      { status: 500 }
    );
  }

  if (!password || password !== expectedPassword) {
    return NextResponse.redirect(new URL("/admin/login?error=1", request.url));
  }

  const response = NextResponse.redirect(new URL("/admin", request.url));
  response.cookies.set(sessionCookieName, "authenticated", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return response;
}
