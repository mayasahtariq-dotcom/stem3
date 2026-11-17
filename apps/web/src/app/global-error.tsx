"use client";

/** Last-resort boundary when the root layout itself fails (no providers, no i18n). */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="hi">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#FFF8EC", color: "#3C3C3C", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ fontWeight: 700, fontSize: 20, margin: 0 }}>कुछ गड़बड़ हो गई · ಏನೋ ತಪ್ಪಾಯಿತು</p>
          <p style={{ color: "#6B6257", margin: "4px 0 16px" }}>Something went wrong.</p>
          <button onClick={reset} style={{ font: "700 17px system-ui", padding: "12px 20px", borderRadius: 12, border: 0, background: "#2F7A00", color: "#fff", minHeight: 44 }}>
            फिर से · ಮತ್ತೆ · Try again
          </button>
        </div>
      </body>
    </html>
  );
}
