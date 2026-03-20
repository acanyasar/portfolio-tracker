import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { AuthLogo } from "./AuthLogo";
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

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ username, password });
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

          <h1 className="mt-7 text-xl font-bold text-white/90 tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-white/40">Sign in to your portfolio</p>

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
                  autoComplete="username"
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
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Forgot password */}
            <div className="flex justify-end -mt-2">
              <Link href="/forgot-password">
                <a className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
                  Forgot password?
                </a>
              </Link>
            </div>

            {/* Error */}
            {login.isError && (
              <p className="auth-error">
                {(login.error as Error)?.message?.replace(/^\d+: /, "") || "Invalid credentials"}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="auth-btn mt-2"
              disabled={login.isPending}
            >
              {login.isPending && <span className="auth-spinner" />}
              {login.isPending ? "Signing in…" : "Sign in"}
            </button>

            {/* Footer */}
            <p className="text-center text-xs text-white/35 pt-1">
              Don't have an account?{" "}
              <Link href="/register">
                <a className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                  Create one
                </a>
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
