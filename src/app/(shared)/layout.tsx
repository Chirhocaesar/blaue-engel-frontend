import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import AdminShell from "@/components/AdminShell";

type Me = {
  id: string;
  email: string;
  fullName?: string | null;
  role: "ADMIN" | "EMPLOYEE";
};

/**
 * The planner is shared by both roles: admins get the dark admin shell,
 * employees get the slim app header — both with full-width content.
 */
export default async function PlannerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;

  if (!token) redirect("/login");

  let me: Me;
  try {
    me = await apiGet<Me>("/users/me", token);
  } catch (e) {
    const err = e as ApiError;
    if (err?.status === 401) redirect("/login");
    throw e;
  }

  if (me.role === "ADMIN") {
    return (
      <AdminShell userName={me.fullName || me.email} userRole="Verwaltung">
        {children}
      </AdminShell>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="font-serif text-lg font-semibold text-ink">
              DigitBoost Service App Demo
            </div>
            <div className="text-sm text-muted">Mitarbeiter-App</div>
          </div>
          <a
            href="/logout"
            className="inline-flex items-center justify-center rounded-field border border-line-strong px-3 py-2 text-sm font-semibold hover:bg-tint"
          >
            Abmelden
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4">{children}</main>
    </div>
  );
}
