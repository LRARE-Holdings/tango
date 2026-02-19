import "./globals.css";
import { Inter, Instrument_Serif } from "next/font/google";
import { CookieConsent } from "@/components/cookie-consent";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: "400",
  display: "swap",
});

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
    <html
      lang="en"
      className={`h-full ${inter.variable} ${instrumentSerif.variable}`}
    >
      <body className="min-h-full">
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
