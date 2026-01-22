import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiGet, ApiError } from "@/lib/api";
import CorrectionsClient from "./CorrectionsClient";

export const dynamic = "force-dynamic";

// Verification checklist:
// 1) Login as admin and open /admin/corrections.
// 2) Pick employee + date, verify lock badge and lists.
// 3) Create time/km adjustments, see “Gespeichert ✓” and refreshed bundle.
// 4) curl: GET /api/admin/corrections/day?employeeId=...&date=YYYY-MM-DD

type Me = {
  id: string;
  email: string;
  role: "ADMIN" | "EMPLOYEE";
};

export default async function CorrectionsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;

  if (!token) redirect("/login");

  let me: Me;
  try {
    me = await apiGet<Me>("/users/me", token);
  } catch (e: any) {
    const err = e as ApiError;
    if (err?.status === 401) redirect("/login");
    throw e;
  }

  if (me.role !== "ADMIN") {
    return (
      <div className="p-4 pb-24">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Admin Korrekturen</h1>
          <Link className="text-sm underline" href="/dashboard">
            Dashboard
          </Link>
        </div>

        <div className="mt-4 rounded-xl border p-4">
          <p className="font-medium">Kein Zugriff</p>
          <p className="mt-1 text-sm opacity-80">
            Diese Seite ist aktuell nur für Admins verfügbar.
          </p>
        </div>

        <div className="mt-4">
          <Link className="underline" href="/dashboard">
            Zurück zum Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <CorrectionsClient />;
}
