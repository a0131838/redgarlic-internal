import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  redirectUrl,
  requireManagerForRoute,
  uploadSharedFileFromForm,
} from "../_lib";

export async function POST(request: Request) {
  const auth = await requireManagerForRoute(request);
  if (!("employee" in auth)) {
    return NextResponse.redirect(auth.redirectTo);
  }

  const formData = await request.formData();
  const result = await uploadSharedFileFromForm(formData, auth.employee.id);
  revalidatePath("/admin/shared-files");

  if (!("successQuery" in result)) {
    return NextResponse.redirect(
      redirectUrl(request, `/admin/shared-files?err=${encodeURIComponent(result.error)}`),
    );
  }

  return NextResponse.redirect(redirectUrl(request, `/admin/shared-files?${result.successQuery}`));
}
