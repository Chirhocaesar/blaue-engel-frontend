"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Panel, Select, StatusBadge } from "@/components/ui";
import { formatDayMonth, formatTime, formatWeekdayShort } from "@/lib/format";

export type OpenAssignment = {
  id: string;
  startAt: string;
  endAt: string;
  customerName: string;
  customerAddress?: string | null;
};

export type QueueEmployee = { id: string; label: string };

type RowState = {
  employeeId: string;
  saving: boolean;
  error: string | null;
  assignedTo: string | null;
};

function germanAssignError(status: number, message?: string): string {
  const msg = String(message ?? "");
  if (msg.toLowerCase().includes("conflict")) {
    return "Konflikt: Der Mitarbeiter hat in diesem Zeitraum bereits einen Einsatz.";
  }
  if (status === 401 || status === 403) return "Keine Berechtigung. Bitte neu anmelden.";
  return "Zuweisung fehlgeschlagen. Bitte erneut versuchen.";
}

export default function OpenAssignmentsQueue({
  items,
  employees,
}: {
  items: OpenAssignment[];
  employees: QueueEmployee[];
}) {
  const router = useRouter();
  const [rows, setRows] = React.useState<Record<string, RowState>>({});

  const rowState = (id: string): RowState =>
    rows[id] ?? { employeeId: "", saving: false, error: null, assignedTo: null };

  const patchRow = (id: string, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [id]: { ...rowState(id), ...patch } }));

  async function assign(item: OpenAssignment) {
    const state = rowState(item.id);
    if (!state.employeeId || state.saving) return;
    patchRow(item.id, { saving: true, error: null });
    try {
      const res = await fetch(`/api/admin/assignments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: state.employeeId, status: "ASSIGNED" }),
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        patchRow(item.id, {
          saving: false,
          error: germanAssignError(res.status, json?.message),
        });
        return;
      }
      const label =
        employees.find((e) => e.id === state.employeeId)?.label ?? "Mitarbeiter";
      patchRow(item.id, { saving: false, assignedTo: label });
      router.refresh();
    } catch {
      patchRow(item.id, {
        saving: false,
        error: "Netzwerkfehler. Bitte erneut versuchen.",
      });
    }
  }

  return (
    <Panel>
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="flex items-center gap-2 font-serif text-[17px] font-bold text-ink">
          Offene Einsätze
          {items.length > 0 ? (
            <span className="rounded-full bg-st-amber-bg px-2 py-0.5 font-sans text-xs font-semibold text-st-amber tabular-nums">
              {items.length}
            </span>
          ) : null}
        </h2>
        <span className="text-xs text-muted">noch keinem Mitarbeiter zugewiesen</span>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-4 text-sm text-muted">
          Keine offenen Einsätze — alles ist zugewiesen.
        </div>
      ) : (
        <div>
          {items.map((item, i) => {
            const state = rowState(item.id);
            return (
              <div
                key={item.id}
                className={`flex flex-col gap-3 px-5 py-3.5 lg:flex-row lg:items-center ${i > 0 ? "border-t border-line" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {formatWeekdayShort(item.startAt)} {formatDayMonth(item.startAt)} ·{" "}
                      {formatTime(item.startAt)}–{formatTime(item.endAt)}
                    </span>
                    <Link
                      href={`/assignments/${item.id}`}
                      className="truncate font-semibold text-ink hover:text-accent-deep hover:underline"
                    >
                      {item.customerName}
                    </Link>
                    <StatusBadge tone="amber">Geplant</StatusBadge>
                  </div>
                  {item.customerAddress ? (
                    <div className="mt-0.5 truncate text-xs text-muted">
                      {item.customerAddress}
                    </div>
                  ) : null}
                  {state.error ? (
                    <div className="mt-1.5 inline-flex rounded-field border border-st-amber/30 bg-st-amber-bg px-2.5 py-1 text-xs font-medium text-st-amber">
                      ⚠ {state.error}
                    </div>
                  ) : null}
                </div>

                {state.assignedTo ? (
                  <div className="flex items-center gap-2 text-sm font-medium text-st-green">
                    <StatusBadge tone="blue">Zugewiesen</StatusBadge>
                    an {state.assignedTo}
                  </div>
                ) : (
                  <div className="flex flex-none items-center gap-2">
                    <Select
                      value={state.employeeId}
                      onChange={(e) => patchRow(item.id, { employeeId: e.target.value, error: null })}
                      disabled={state.saving}
                      className="w-auto min-w-[190px] py-2 text-[13px]"
                      aria-label="Mitarbeiter auswählen"
                    >
                      <option value="">Mitarbeiter wählen…</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.label}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      onClick={() => assign(item)}
                      disabled={!state.employeeId || state.saving}
                      className="inline-flex items-center gap-1.5 rounded-field bg-ink px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <UserPlus className="h-4 w-4 text-accent" strokeWidth={1.8} />
                      {state.saving ? "Zuweisen…" : "Zuweisen"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
