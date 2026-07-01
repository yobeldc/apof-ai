"use client";

import * as React from "react";
import { redactName } from "@/lib/utils";

type PrivacyState = {
  hideNames: boolean;
  redact: boolean;
  setHideNames: (v: boolean) => void;
  setRedact: (v: boolean) => void;
  /** Transform a party/person name according to the active privacy mode. */
  transform: (name: string) => string;
};

const PrivacyContext = React.createContext<PrivacyState | null>(null);

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hideNames, setHideNamesState] = React.useState(false);
  const [redact, setRedactState] = React.useState(false);

  React.useEffect(() => {
    setHideNamesState(localStorage.getItem("pp:hideNames") === "true");
    setRedactState(localStorage.getItem("pp:redact") === "true");
  }, []);

  const setHideNames = (v: boolean) => {
    setHideNamesState(v);
    localStorage.setItem("pp:hideNames", String(v));
  };
  const setRedact = (v: boolean) => {
    setRedactState(v);
    localStorage.setItem("pp:redact", String(v));
  };

  const transform = React.useCallback(
    (name: string) => {
      if (!name) return name;
      if (hideNames) return "—";
      if (redact) return redactName(name);
      return name;
    },
    [hideNames, redact],
  );

  return (
    <PrivacyContext.Provider value={{ hideNames, redact, setHideNames, setRedact, transform }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const ctx = React.useContext(PrivacyContext);
  if (!ctx) throw new Error("usePrivacy must be used within PrivacyProvider");
  return ctx;
}
