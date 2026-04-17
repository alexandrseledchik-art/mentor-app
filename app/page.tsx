import { redirect } from "next/navigation";

import { resolveEntry } from "@/lib/workspace/resolve-entry";

export default async function HomePage() {
  const entry = await resolveEntry();

  if (!entry) {
    redirect("/onboarding");
  }

  switch (entry.route) {
    case "onboarding":
      redirect("/onboarding");
    case "resume_diagnosis":
      redirect("/diagnosis");
    case "dashboard":
    default:
      redirect("/dashboard");
  }
}
