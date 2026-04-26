"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

// Converts a username to the synthetic email used in Supabase Auth.
// Existing real-email users are unaffected — they pass their @ address directly.
function usernameToEmail(username: string) {
  return `${username.toLowerCase().trim()}@adversusleads.user`;
}

function isEmail(value: string) {
  return value.includes("@");
}

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState(""); // username OR email
  const [username, setUsername] = useState("");      // sign-up only
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (mode === "login") {
      // Auto-detect: if the user typed an @, treat as email; otherwise username
      const email = isEmail(identifier) ? identifier.trim() : usernameToEmail(identifier);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(
          error.message === "Invalid login credentials"
            ? "Incorrect username or password."
            : error.message
        );
        setLoading(false);
        return;
      }
      router.push("/");
      router.refresh();
    } else {
      // Sign up — always username-based
      const trimmed = username.trim();
      if (!trimmed) { setError("Username is required."); setLoading(false); return; }
      if (trimmed.includes("@")) { setError("Username cannot contain @."); setLoading(false); return; }
      if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
        setError("Username can only contain letters, numbers, dots, dashes, and underscores.");
        setLoading(false);
        return;
      }

      const email = usernameToEmail(trimmed);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: trimmed } },
      });

      if (error) {
        setError(
          error.message.includes("already registered")
            ? "That username is already taken."
            : error.message
        );
        setLoading(false);
        return;
      }

      if (data.session) {
        router.push("/");
        router.refresh();
      } else {
        setLoading(false);
        setError("Something went wrong. Please try again.");
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md" style={{ background: "var(--navy)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
              </svg>
            </div>
            <div className="text-left">
              <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text)" }}>Adversus Leads</h1>
              <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Lead tracking & discovery</p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8" style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}>
          <h2 className="text-lg font-bold mb-1 tracking-tight" style={{ color: "var(--text)" }}>
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            {mode === "login" ? "Sign in to continue to your pipeline." : "Set up a username and password to get started."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "login" ? (
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>
                  Username <span style={{ color: "var(--muted)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>or email</span>
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }}
                  placeholder="your_username"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }}
                  placeholder="your_username"
                />
                <p className="text-xs mt-1.5" style={{ color: "var(--muted)" }}>
                  Letters, numbers, dots, dashes and underscores only.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--text-sub)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{ border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)" }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm px-3 py-2.5 rounded-lg" style={{ background: "#fdecec", color: "#a02323", border: "1px solid #f5c6c6" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 rounded-lg text-sm"
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t text-center text-sm" style={{ color: "var(--muted)", borderColor: "var(--border)" }}>
            {mode === "login" ? (
              <>Don&apos;t have an account?{" "}
                <button onClick={() => { setMode("signup"); setError(""); }} className="font-semibold transition-colors" style={{ color: "var(--primary)" }}>Sign up</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => { setMode("login"); setError(""); }} className="font-semibold transition-colors" style={{ color: "var(--primary)" }}>Sign in</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
