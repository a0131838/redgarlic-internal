import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

const SEE_OTHER = 303;

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/admin", request.url), SEE_OTHER);
}

export async function POST(request: Request) {
  await clearSession();
  return NextResponse.redirect(new URL("/admin/login", request.url), SEE_OTHER);
}
