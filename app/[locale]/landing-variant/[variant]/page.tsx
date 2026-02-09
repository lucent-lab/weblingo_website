import { notFound, redirect } from "next/navigation";

export const dynamicParams = false;

const variants = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
] as const;
type LandingVariantId = (typeof variants)[number];

export async function generateStaticParams() {
  return variants.map((variant) => ({ variant }));
}

export default async function LocaleLandingVariantRedirectPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant: rawVariant } = await params;

  if (!variants.includes(rawVariant as LandingVariantId)) {
    notFound();
  }

  redirect(`/landing-variant/${rawVariant}`);
}
