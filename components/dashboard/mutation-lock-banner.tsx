import { LockKeyhole } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function MutationLockBanner({
  description,
  locked,
  title = "Changes locked",
}: {
  description: string;
  locked: boolean;
  title?: string;
}) {
  if (!locked) {
    return null;
  }

  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-950">
      <LockKeyhole className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="text-amber-900">{description}</AlertDescription>
    </Alert>
  );
}
