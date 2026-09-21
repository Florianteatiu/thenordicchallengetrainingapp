// ---------- Shared design tokens (brand language used across coach + client apps) ----------
export const C = {
  ink: "#0A0A0A",
  inkLine: "rgba(255,255,255,0.12)",
  paper: "#FFFFFF",
  paperMuted: "#F4F3F1",
  line: "#E7E5E2",
  textOnDark: "#FFFFFF",
  textOnDarkMuted: "#9C9A97",
  textPrimary: "#0A0A0A",
  textSecondary: "#5B5854",
  textMuted: "#A6A4A0",
  signal: "#FFE234",
  signalSoft: "#FFF6B8",
  signalText: "#6B5300",
  success: "#2FA36B",
  successSoft: "#E1F3E9",
};

export const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif";

export const ghostBtn = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12.5,
  fontWeight: 700,
  color: C.ink,
  background: C.paperMuted,
  border: "none",
  borderRadius: 20,
  padding: "7px 12px",
  cursor: "pointer",
};

export const cardStyle = { background: "#fff", border: `1px solid ${C.line}`, borderRadius: 10 };

export const smallDarkBtnStyle = {
  background: "rgba(255,255,255,0.14)",
  border: "none",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 10px",
  display: "flex",
  alignItems: "center",
  gap: 4,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};

export const inputStyle = {
  width: "100%",
  padding: "7px 8px",
  border: `1px solid ${C.line}`,
  borderRadius: 6,
  fontSize: 13.5,
  fontFamily: fontStack,
  boxSizing: "border-box",
};

export const editInputStyle = {
  width: "100%",
  padding: "6px 7px",
  border: `1px solid ${C.line}`,
  borderRadius: 5,
  fontSize: 12.5,
  fontFamily: fontStack,
  boxSizing: "border-box",
  background: "#fff",
};
