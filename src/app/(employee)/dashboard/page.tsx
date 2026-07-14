import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { apiGet } from "@/lib/api";
import { formatDate, formatTime, formatWeekdayShort } from "@/lib/format";
import { statusLabelDe } from "@/lib/status";
import { Panel, StatusBadge, statusTone, type BadgeTone } from "@/components/ui";

type TodayAssignment = {
  id: string;
  startAt: string;
  endAt: string;
  status?: string;
  customer?: { name?: string | null; companyName?: string | null; address?: string | null } | null;
  customerName?: string | null;
};

const tickColor: Record<BadgeTone, string> = {
  amber: "bg-st-amber",
  blue: "bg-st-blue",
  green: "bg-st-green",
  gray: "bg-st-gray",
  violet: "bg-st-violet",
};

function ymdLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

  const today = ymdLocal(new Date());
  let todayJobs: TodayAssignment[] = [];
  let todayError = false;
  try {
    // `to` must reach end-of-day: the API parses bare dates as midnight.
    const raw = await apiGet<{ items?: TodayAssignment[] } | TodayAssignment[]>(
      `/me/assignments?from=${today}&to=${encodeURIComponent(`${today}T23:59:59.999`)}&limit=50`,
      token,
    );
    const items = Array.isArray(raw) ? raw : raw?.items ?? [];
    todayJobs = items
      .filter((a) => String(a.status ?? "").toUpperCase() !== "CANCELLED")
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  } catch {
    todayError = true;
  }

  return (
    <main className="space-y-4">
      <PageHeader
        title="Dashboard"
        subtitle="Bitte wählen Sie eine Funktion aus."
      />

      {/* Heute */}
      <Panel>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-serif text-[15px] font-bold text-ink">Heute</h2>
          <span className="text-xs text-muted tabular-nums">
            {formatWeekdayShort(new Date())}, {formatDate(new Date())}
          </span>
        </div>
        {todayError ? (
          <div className="px-4 py-4 text-sm text-muted">
            Einsätze konnten nicht geladen werden.
          </div>
        ) : todayJobs.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted">
            Keine Einsätze heute. Genießen Sie den Tag!
          </div>
        ) : (
          <div className="py-1">
            {todayJobs.map((a, i) => {
              const name =
                a.customer?.companyName || a.customer?.name || a.customerName || "Kunde";
              const tone = statusTone(a.status);
              return (
                <Link
                  key={a.id}
                  href={`/assignments/${a.id}`}
                  className={`flex items-stretch gap-3 px-4 py-[10px] transition-colors hover:bg-tint-hover ${i > 0 ? "border-t border-line" : ""}`}
                >
                  <span
                    aria-hidden
                    className={`w-[3px] flex-none self-stretch rounded-full ${tickColor[tone]}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-ink">
                      <span className="tabular-nums">
                        {formatTime(a.startAt)}–{formatTime(a.endAt)}
                      </span>{" "}
                      · {name}
                    </span>
                    {a.customer?.address ? (
                      <span className="mt-0.5 block truncate text-xs text-muted">
                        {a.customer.address}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-none items-center">
                    <StatusBadge status={a.status}>{statusLabelDe(a.status)}</StatusBadge>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </Panel>

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
