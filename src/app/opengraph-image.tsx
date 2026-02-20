import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
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
          padding: "56px 68px",
          color: "#101828",
        }}
      >
        <div style={{ fontSize: 26, opacity: 0.86 }}>Receipt</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.06 }}>
            Certainty, delivered.
          </div>
          <div style={{ fontSize: 30, opacity: 0.84 }}>
            Proof of delivery, review activity and acknowledgement.
          </div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.72 }}>getreceipt.co</div>
      </div>
    ),
    size
  );
}
