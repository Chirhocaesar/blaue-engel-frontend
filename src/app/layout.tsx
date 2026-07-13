import "./globals.css";
import "@fontsource-variable/inter";
import "@fontsource-variable/playfair-display";

export const metadata = {
  title: "DigitBoost Service App Demo",
  description: "Demo service operations platform by DigitBoost Solutions",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de">
      <body className="font-sans text-fg antialiased">{children}</body>
    </html>
  );
}
