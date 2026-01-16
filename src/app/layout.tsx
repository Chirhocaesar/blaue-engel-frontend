import "./globals.css";

export const metadata = {
  title: "Blaue Engel",
  description: "Blaue Engel HaushaltsHilfe",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body>
        <header className="border-b">
          <div className="mx-auto max-w-md px-4 py-3">
            <div className="text-lg font-semibold">Blaue Engel</div>
            <div className="text-sm text-gray-600">
              Mitarbeiter-App
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-md px-4 py-4">{children}</main>

        <footer className="mx-auto max-w-md px-4 py-6 text-xs text-gray-500">
          © {new Date().getFullYear()} Blaue Engel
        </footer>
      </body>
    </html>
  );
}
