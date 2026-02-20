import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 600,
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background:
            "linear-gradient(140deg, rgb(245, 248, 255) 0%, rgb(234, 241, 255) 52%, rgb(248, 252, 255) 100%)",
          padding: "48px 64px",
          color: "#101828",
        }}
      >
        <div style={{ fontSize: 24, opacity: 0.86 }}>Receipt</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.06 }}>
            Certainty, delivered.
          </div>
          <div style={{ fontSize: 28, opacity: 0.84 }}>
            Proof of document acknowledgement for modern teams.
          </div>
        </div>
        <div style={{ fontSize: 20, opacity: 0.72 }}>getreceipt.co</div>
      </div>
    ),
    size
  );
}
