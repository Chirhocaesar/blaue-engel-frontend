import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";

function CardLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border p-4 active:scale-[0.99]"
    >
      <div className="text-lg font-semibold">{title}</div>
      <div className="mt-1 text-sm text-gray-600">{desc}</div>
    </Link>
  );
}

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("be_access")?.value;

  if (!token) redirect("/login");

  return (
    <main className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="Wähle eine Funktion aus."
      />

      <div className="space-y-3">
        <CardLink
          href="/planner"
          title="Dienstplan"
          desc="Zum Dienstplan wechseln."
        />
        <CardLink
          href="/assignments"
          title="Einsätze"
          desc="Deine geplanten Einsätze ansehen und bestätigen."
        />
        <CardLink
          href="/monthly"
          title="Monatsübersicht"
          desc="Deine Monatswerte und erledigte Kilometer."
        />
      </div>

      <div className="pt-2">
        <form action="/logout">
          <button className="w-full rounded-xl border px-4 py-3 text-base font-semibold">
            Abmelden
          </button>
        </form>
      </div>
    </main>
  );
}
