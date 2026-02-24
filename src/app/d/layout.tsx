export default function PublicDeliveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="app-shell relative min-h-screen overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 -z-0">
        <div
          className="absolute -top-32 -left-20 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--card2) 66%, transparent)" }}
        />
        <div
          className="absolute top-10 right-0 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "color-mix(in srgb, var(--card2) 48%, transparent)" }}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
