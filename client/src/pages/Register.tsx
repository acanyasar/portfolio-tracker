import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { AuthLogo } from "./AuthLogo";
import { PasswordStrength } from "@/components/PasswordStrength";
import "./auth.css";

function UserIcon() {
  return (
    <svg className="auth-input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="5.5" r="2.5" />
      <path d="M2.5 13.5a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="auth-input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="7" width="10" height="8" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="auth-input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M1.5 6l6.5 4 6.5-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { register } = useAuth();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await register.mutateAsync({ username, password, email: email || undefined });
      navigate("/");
    } catch {
      // error shown below
    }
  };

  return (
    <div className="auth-root">
      {/* Animated background */}
      <div className="auth-grid" />
      <div className="auth-orb auth-orb--indigo" />
      <div className="auth-orb auth-orb--green" />
      <div className="auth-orb auth-orb--orange" />

      {/* Centering layer */}
      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="auth-card auth-page-enter w-full max-w-sm px-8 py-9">

          <AuthLogo />

          <h1 className="mt-7 text-xl font-bold text-white/90 tracking-tight">Create account</h1>
          <p className="mt-1 text-sm text-white/40">Start tracking your portfolio in minutes</p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-white/50 mb-1.5 tracking-wide">
                Username
              </label>
              <div className="relative">
                <UserIcon />
                <input
                  id="username"
                  className="auth-input auth-input--icon"
                  placeholder="yourname"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  required
                  autoFocus
                  minLength={3}
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Email (optional) */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-white/50 mb-1.5 tracking-wide">
                Email <span className="text-white/25 normal-case font-normal">(optional · for password recovery)</span>
              </label>
              <div className="relative">
                <MailIcon />
                <input
                  id="email"
                  type="email"
                  className="auth-input auth-input--icon"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-xs font-medium text-white/50 mb-1.5 tracking-wide">
                Password
              </label>
              <div className="relative">
                <LockIcon />
                <input
                  id="password"
                  type="password"
                  className="auth-input auth-input--icon"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <PasswordStrength password={password} />
            </div>

            {/* Error */}
            {register.isError && (
              <p className="auth-error">
                {(register.error as Error)?.message?.replace(/^\d+: /, "") || "Registration failed"}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="auth-btn mt-2"
              disabled={register.isPending}
            >
              {register.isPending && <span className="auth-spinner" />}
              {register.isPending ? "Creating account…" : "Create account"}
            </button>

            {/* Footer */}
            <p className="text-center text-xs text-white/35 pt-1">
              Already have an account?{" "}
              <Link href="/login">
                <a className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                  Sign in
                </a>
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
