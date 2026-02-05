import "./globals.css";
import { ThemeScript } from "./theme-script";

export const metadata = {
  title: "Receipt",
  description: "Proof your document was read.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>{children}</body>
    </html>
  );
}