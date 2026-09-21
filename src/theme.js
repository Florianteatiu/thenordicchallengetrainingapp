// ---------- Shared design tokens (brand language used across coach + client apps) ----------
// The whole app is dark: `ink` is the near-black used for headers/sidebars,
// `paper`/`paperMuted` are the (dark) surface colors everything else sits on.
export const C = {
  ink: "#000000",
  inkLine: "rgba(255,255,255,0.12)",
  paper: "#161616",
  paperMuted: "#242424",
  line: "rgba(255,255,255,0.12)",
  textOnDark: "#FFFFFF",
  textOnDarkMuted: "#9C9A97",
  textPrimary: "#F5F4F2",
  textSecondary: "#A8A6A2",
  textMuted: "#7A7874",
  signal: "#FFE234",
  signalSoft: "rgba(255,226,52,0.16)",
  signalText: "#FFE234",
  // Dark text/icon color for content placed directly on the (always-bright)
  // yellow `signal` background — `textPrimary` is light-on-dark and would be
  // unreadable there.
  onSignal: "#161616",
  success: "#4BC98A",
  successSoft: "rgba(75,201,138,0.16)",
  danger: "#E5726C",
  dangerSoft: "rgba(229,114,108,0.16)",
};

export const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Roboto, sans-serif";

export const ghostBtn = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 12.5,
  fontWeight: 700,
  color: C.textPrimary,
  background: C.paperMuted,
  border: "none",
  borderRadius: 20,
  padding: "7px 12px",
  cursor: "pointer",
};

export const cardStyle = { background: C.paper, border: `1px solid ${C.line}`, borderRadius: 10 };

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
  background: C.paper,
  color: C.textPrimary,
};

export const editInputStyle = {
  width: "100%",
  padding: "6px 7px",
  border: `1px solid ${C.line}`,
  borderRadius: 5,
  fontSize: 12.5,
  fontFamily: fontStack,
  boxSizing: "border-box",
  background: C.paper,
  color: C.textPrimary,
};
