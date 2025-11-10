"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createServiceRoleClient } from "@/lib/supabase/admin";

const contactSchema = z.object({
  fullName: z.string().min(1, "fullName").max(200),
  workEmail: z.string().email("workEmail").max(320),
  domain: z.string().url().max(2048).optional().or(z.literal("")),
  locales: z.string().max(320).optional().or(z.literal("")),
  message: z.string().max(2000).optional().or(z.literal("")),
});

export async function submitContactMessage(locale: string, formData: FormData) {
  const parsed = contactSchema.safeParse({
    fullName: formData.get("fullName")?.toString() ?? "",
    workEmail: formData.get("workEmail")?.toString() ?? "",
    domain: formData.get("domain")?.toString() ?? undefined,
    locales: formData.get("locales")?.toString() ?? undefined,
    message: formData.get("message")?.toString() ?? undefined,
  });

  if (!parsed.success) {
    return redirect(`/${locale}/contact?error=invalid`);
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("contact_messages").insert({
    locale,
    full_name: parsed.data.fullName,
    work_email: parsed.data.workEmail,
    domain: parsed.data.domain?.trim() || null,
    locales: parsed.data.locales?.trim() || null,
    message: parsed.data.message?.trim() || null,
  });

  if (error) {
    console.error(
      JSON.stringify(
        {
          level: "error",
          message: "Failed to log contact message",
          error: error.message,
        },
        null,
        0,
      ),
    );
    return redirect(`/${locale}/contact?error=server`);
  }

  redirect(`/${locale}/contact?submitted=1`);
}
