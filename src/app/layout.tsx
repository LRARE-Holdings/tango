import "./globals.css";

export const metadata = {
  title: "Receipt",
  description: "Proof your document was read.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}