import { useLocation } from "react-router-dom";

// The workout templates and exercise library are shared by the online coach
// app (/coach) and the in-person app (/pt). Pages used in both build their
// links from this, so you stay in the app you opened.
export function useCoachBase() {
  return useLocation().pathname.startsWith("/pt") ? "/pt" : "/coach";
}
