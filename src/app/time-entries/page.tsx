import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function TimeEntriesPage() {
  const token = (await cookies()).get("be_access")?.value;
  if (!token) redirect("/login");

  return (
    <main className="space-y-3">
      <h1 className="text-2xl font-bold">Zeiterfassung</h1>
      <p className="text-sm text-gray-600">
        Nächster Schritt: Zeit-Einträge aus der API laden und erstellen.
      </p>
    </main>
  );
}
