import { useState } from "react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { AuthLogo } from "./AuthLogo";
import "./auth.css";

function MailIcon() {
  return (
    <svg className="auth-input-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
      <path d="M1.5 6l6.5 4 6.5-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-grid" />
      <div className="auth-orb auth-orb--indigo" />
      <div className="auth-orb auth-orb--green" />
      <div className="auth-orb auth-orb--orange" />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="auth-card auth-page-enter w-full max-w-sm px-8 py-9">

          <AuthLogo />

          {submitted ? (
            <div className="mt-7">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/15 mb-5">
                <svg viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="1.5" className="w-6 h-6" aria-hidden="true">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 6L2 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white/90 tracking-tight">Check your inbox</h1>
              <p className="mt-2 text-sm text-white/45 leading-relaxed">
                If an account exists for <span className="text-white/70">{email}</span>, we've sent a password reset link. It expires in 1 hour.
              </p>
              <p className="mt-4 text-xs text-white/30">
                Didn't get it? Check your spam folder or{" "}
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  try again
                </button>
                .
              </p>
            </div>
          ) : (
            <>
              <h1 className="mt-7 text-xl font-bold text-white/90 tracking-tight">Forgot password?</h1>
              <p className="mt-1 text-sm text-white/40">Enter your email and we'll send a reset link</p>

              <form onSubmit={handleSubmit} className="mt-7 space-y-4">
                <div>
                  <label htmlFor="email" className="block text-xs font-medium text-white/50 mb-1.5 tracking-wide">
                    Email
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
                      required
                      autoFocus
                      autoComplete="email"
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
                  {isLoading ? "Sending…" : "Send reset link"}
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
