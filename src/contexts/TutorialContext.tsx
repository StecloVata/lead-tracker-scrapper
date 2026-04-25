"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

interface TutorialCtx {
  active: boolean;
  step: number;
  total: number;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  goTo: (n: number) => void;
}

const Ctx = createContext<TutorialCtx | null>(null);

export function useTutorial() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTutorial must be used inside TutorialProvider");
  return ctx;
}

const TOTAL = 6;

export function TutorialProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const key = `adv_tutorial_step_${userId}`;
  const doneKey = `adv_tutorial_done_${userId}`;

  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  const start = useCallback(() => {
    localStorage.removeItem(doneKey);
    setStep(0);
    setActive(true);
  }, [doneKey]);

  const skip = useCallback(() => {
    setActive(false);
    localStorage.setItem(doneKey, "1");
    localStorage.removeItem(key);
  }, [doneKey, key]);

  const next = useCallback(() => {
    setStep(s => {
      const n = s + 1;
      if (n >= TOTAL) {
        setActive(false);
        localStorage.setItem(doneKey, "1");
        localStorage.removeItem(key);
        return s;
      }
      localStorage.setItem(key, String(n));
      return n;
    });
  }, [doneKey, key]);

  const prev = useCallback(() => {
    setStep(s => {
      const n = Math.max(0, s - 1);
      localStorage.setItem(key, String(n));
      return n;
    });
  }, [key]);

  const goTo = useCallback((n: number) => {
    setStep(n);
    setActive(true);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      setStep(Number(saved));
      setActive(true);
    }
  }, [key]);

  return (
    <Ctx.Provider value={{ active, step, total: TOTAL, start, next, prev, skip, goTo }}>
      {children}
    </Ctx.Provider>
  );
}
