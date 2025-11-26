import { OnboardingForm } from "./onboarding-form";

export const metadata = {
  title: "New site",
  robots: { index: false, follow: false },
};

export default function NewSitePage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">Add a new site</h2>
        <p className="text-sm text-muted-foreground">
          Guided setup to capture your source URL, languages, and domain pattern.
        </p>
      </div>
      <OnboardingForm />
    </div>
  );
}
