import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  redirectUrl,
  requireManagerForRoute,
  uploadSharedFileFromForm,
} from "../_lib";

const SEE_OTHER = 303;

export async function POST(request: Request) {
  const auth = await requireManagerForRoute(request);
  if (!("employee" in auth)) {
    return NextResponse.redirect(auth.redirectTo, SEE_OTHER);
  }

  const formData = await request.formData();
  const result = await uploadSharedFileFromForm(formData, auth.employee.id);
  revalidatePath("/admin/shared-files");

  const successPath = "successPath" in result ? result.successPath : undefined;
  const errorMessage = ("error" in result ? result.error : undefined) ?? "操作失败";
  if (!successPath) {
    return NextResponse.redirect(
      redirectUrl(request, `/admin/shared-files?err=${encodeURIComponent(errorMessage)}`),
      SEE_OTHER,
    );
  }

  return NextResponse.redirect(redirectUrl(request, successPath), SEE_OTHER);
}
