import "./globals.css";
import { cookies } from "next/headers";

export const metadata = {
  title: "DigitBoost Service App Demo",
  description: "Demo service operations platform by DigitBoost Solutions",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isLoggedIn = Boolean(cookieStore.get("be_access")?.value);

  return (
    <html lang="de">
      <body>
        <header className="border-b">
          <div className="mx-auto max-w-md px-4 py-3 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-lg font-semibold">DigitBoost Service App Demo</div>
              <div className="text-sm text-gray-600">Mitarbeiter-App</div>
            </div>
            {isLoggedIn ? (
              <a
                href="/logout"
                className="inline-flex items-center justify-center rounded border px-3 py-2 text-sm font-semibold hover:bg-gray-50"
              >
                Abmelden
              </a>
            ) : null}
          </div>
        </header>

        <main className="mx-auto max-w-md px-4 py-4">{children}</main>

        <footer className="mx-auto max-w-md px-4 py-6 text-xs text-gray-500">
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <span>© {new Date().getFullYear()} DigitBoost Solutions</span>
            <a
              href="https://digitboostsolutions.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-700"
            >
              DigitBoost Solutions
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
