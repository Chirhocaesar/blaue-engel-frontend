import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
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
      className="flex items-center gap-3 rounded-card border border-line bg-card p-4 shadow-card transition-colors hover:border-accent active:scale-[0.99]"
    >
      <div className="min-w-0 flex-1">
        <div className="font-serif text-lg font-bold text-ink">{title}</div>
        <div className="mt-0.5 text-sm text-muted">{desc}</div>
      </div>
      <ChevronRight className="h-5 w-5 flex-none text-faint" strokeWidth={1.8} />
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
        subtitle="Bitte wählen Sie eine Funktion aus."
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
          desc="Ihre geplanten Einsätze ansehen und bestätigen."
        />
        <CardLink
          href="/monthly"
          title="Monatsübersicht"
          desc="Ihre Monatswerte und erledigten Kilometer."
        />
      </div>

      <div className="pt-2">
        <form action="/logout">
          <button className="w-full rounded-field border border-line-strong bg-card px-4 py-3 text-base font-semibold hover:border-accent hover:bg-accent-soft hover:text-accent-deep">
            Abmelden
          </button>
        </form>
      </div>
    </main>
  );
}
