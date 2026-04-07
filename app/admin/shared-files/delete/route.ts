import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  permanentlyDeleteSharedFileFromForm,
  redirectUrl,
  requireManagerForRoute,
} from "../_lib";

export async function POST(request: Request) {
  const auth = await requireManagerForRoute(request.url);
  if (!("employee" in auth)) {
    return NextResponse.redirect(auth.redirectTo);
  }

  const formData = await request.formData();
  const result = await permanentlyDeleteSharedFileFromForm(formData);
  revalidatePath("/admin/shared-files");

  if (!("successQuery" in result)) {
    return NextResponse.redirect(
      redirectUrl(request.url, `/admin/shared-files?err=${encodeURIComponent(result.error)}`),
    );
  }

  return NextResponse.redirect(redirectUrl(request.url, `/admin/shared-files?${result.successQuery}`));
}
