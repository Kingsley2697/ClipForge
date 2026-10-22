import { requireUser } from "@/lib/auth";

export const instant = false;

export default async function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  await requireUser();
  return children;
}
