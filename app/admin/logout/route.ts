import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

const SEE_OTHER = 303;

function requestOrigin(request: Request) {
  const fallback = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    fallback.host;
  const protocol =
    request.headers.get("x-forwarded-proto") ||
    fallback.protocol.replace(/:$/, "");

  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/admin", requestOrigin(request)), SEE_OTHER);
}

export async function POST(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/admin/login", requestOrigin(request)), SEE_OTHER);
}
