import { createContext, useContext, useMemo, useState } from "react";

// Two audiences, one app: Simple Mode (default) is for a farmer on a phone
// -- Risk -> Market -> Route -> Earnings, nothing else. Detailed Mode adds
// back the technical depth (model accuracy, feature importance, strategy
// benchmarking) for judges, brokers and logistics staff. Persisted locally
// so it survives a reload, same as the language choice.
const DisplayModeContext = createContext({ simple: true, setSimple: () => {} });

export function DisplayModeProvider({ children }) {
  const [simple, setSimpleState] = useState(() => localStorage.getItem("agriroute_simple_mode") !== "false");

  function setSimple(next) {
    setSimpleState(next);
    localStorage.setItem("agriroute_simple_mode", String(next));
  }

  const value = useMemo(() => ({ simple, setSimple }), [simple]);
  return <DisplayModeContext.Provider value={value}>{children}</DisplayModeContext.Provider>;
}

export function useDisplayMode() {
  return useContext(DisplayModeContext);
}
