import { requireUser } from "@/lib/auth";

// This route intentionally reads a per-request session before rendering.
export const instant = false;

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  await requireUser();
  return children;
}
