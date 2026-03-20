import { useState } from "react";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { AuthLogo } from "./AuthLogo";
import { PasswordStrength } from "@/components/PasswordStrength";
import "./auth.css";

function LockIcon() {
  return (
    <svg className="auth-input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="7" width="10" height="8" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" strokeLinecap="round" />
    </svg>
  );
}

function getTokenFromHash(): string | null {
  const hash = window.location.hash; // e.g. "#/reset-password?token=abc123"
  const queryString = hash.includes("?") ? hash.split("?")[1] : "";
  return new URLSearchParams(queryString).get("token");
}

export default function ResetPassword() {
  const token = getTokenFromHash();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError((err as Error).message?.replace(/^\d+: /, "") || "Invalid or expired reset link");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-root">
        <div className="auth-grid" />
        <div className="auth-orb auth-orb--indigo" />
        <div className="auth-orb auth-orb--green" />
        <div className="auth-orb auth-orb--orange" />
        <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
          <div className="auth-card auth-page-enter w-full max-w-sm px-8 py-9 text-center">
            <p className="text-white/50 text-sm mb-4">Invalid or missing reset link.</p>
            <Link href="/forgot-password">
              <a className="text-indigo-400 hover:text-indigo-300 transition-colors text-sm font-medium">
                Request a new one →
              </a>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-root">
      <div className="auth-grid" />
      <div className="auth-orb auth-orb--indigo" />
      <div className="auth-orb auth-orb--green" />
      <div className="auth-orb auth-orb--orange" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="auth-card auth-page-enter w-full max-w-sm px-8 py-9">

          <AuthLogo />

          {success ? (
            <div className="mt-7">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-500/15 mb-5">
                <svg viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="1.5" className="w-6 h-6" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                  <path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white/90 tracking-tight">Password updated</h1>
              <p className="mt-2 text-sm text-white/45 leading-relaxed">
                Your password has been reset successfully. Redirecting you to sign in…
              </p>
            </div>
          ) : (
            <>
              <h1 className="mt-7 text-xl font-bold text-white/90 tracking-tight">Set new password</h1>
              <p className="mt-1 text-sm text-white/40">Choose a strong password for your account</p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                <div>
                  <label htmlFor="newPassword" className="block text-xs font-medium text-white/50 mb-1.5 tracking-wide">
                    New password
                  </label>
                  <div className="relative">
                    <LockIcon />
                    <input
                      id="newPassword"
                      type="password"
                      className="auth-input auth-input--icon"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      required
                      autoFocus
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                  <PasswordStrength password={newPassword} />
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-xs font-medium text-white/50 mb-1.5 tracking-wide">
                    Confirm password
                  </label>
                  <div className="relative">
                    <LockIcon />
                    <input
                      id="confirmPassword"
                      type="password"
                      className="auth-input auth-input--icon"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {error && <p className="auth-error">{error}</p>}

                <button
                  type="submit"
                  className="auth-btn mt-2"
                  disabled={isLoading}
                >
                  {isLoading && <span className="auth-spinner" />}
                  {isLoading ? "Updating…" : "Update password"}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-xs text-white/35">
            <Link href="/login">
              <a className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                ← Back to sign in
              </a>
            </Link>
          </p>

        </div>
      </div>
    </div>
  );
}
