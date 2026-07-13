import { cookies } from "next/headers";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get("be_access")?.value);

  return (
    <>
      <header className="border-b border-line">
        <div className="mx-auto max-w-md px-4 py-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-lg font-semibold font-serif text-ink">
              DigitBoost Service App Demo
            </div>
            <div className="text-sm text-muted">Mitarbeiter-App</div>
          </div>
          {isLoggedIn ? (
            <a
              href="/logout"
              className="inline-flex items-center justify-center rounded-field border border-line-strong px-3 py-2 text-sm font-semibold hover:bg-tint"
            >
              Abmelden
            </a>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">{children}</main>

      <footer className="mx-auto max-w-md px-4 py-6 text-xs text-muted">
        <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} DigitBoost Solutions</span>
          <a
            href="https://digitboostsolutions.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-fg"
          >
            DigitBoost Solutions
          </a>
        </div>
      </footer>
    </>
  );
}
