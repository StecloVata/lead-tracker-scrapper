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
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--navy)" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold" style={{ color: "var(--text)" }}>Adversus Leads</h1>
              <p className="text-xs" style={{ color: "var(--muted)" }}>Lead tracking & discovery</p>
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl shadow-lg p-8" style={{ background: "#fff", border: "1px solid var(--border)" }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: "var(--text)" }}>
            {mode === "login" ? "Sign in to your account" : "Create an account"}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "login" ? (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-sub)" }}>
                  Username <span style={{ color: "var(--muted)", fontWeight: 400 }}>or email</span>
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
                  placeholder="your_username"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-sub)" }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                  style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
                  placeholder="your_username"
                />
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  Letters, numbers, dots, dashes and underscores only.
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "var(--text-sub)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
                style={{ border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ background: "#FCEBEB", color: "#A32D2D" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 hover-btn"
              style={{ background: "var(--orange)", color: "#fff" }}
            >
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-5 text-center text-sm" style={{ color: "var(--muted)" }}>
            {mode === "login" ? (
              <>Don&apos;t have an account?{" "}
                <button onClick={() => { setMode("signup"); setError(""); }} className="font-medium underline" style={{ color: "var(--navy)" }}>Sign up</button>
              </>
            ) : (
              <>Already have an account?{" "}
                <button onClick={() => { setMode("login"); setError(""); }} className="font-medium underline" style={{ color: "var(--navy)" }}>Sign in</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
