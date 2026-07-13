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

export default async function AdminLayout({
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

  if (me.role !== "ADMIN") redirect("/dashboard");

  return (
    <AdminShell userName={me.fullName || me.email} userRole="Verwaltung">
      {children}
    </AdminShell>
  );
}
