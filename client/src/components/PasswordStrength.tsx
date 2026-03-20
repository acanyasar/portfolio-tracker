function getScore(password: string): number {
  if (password.length === 0) return 0;
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const LABELS = ["", "Weak", "Fair", "Good", "Strong"] as const;
const COLORS = ["", "text-red-400", "text-amber-400", "text-amber-400", "text-green-400"] as const;

export function PasswordStrength({ password }: { password: string }) {
  const score = getScore(password);
  if (score === 0) return null;

  return (
    <div className="mt-2">
      <div className="auth-strength-bars">
        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className={`auth-strength-bar${i <= score ? ` auth-strength-bar--active-${score}` : ""}`}
          />
        ))}
      </div>
      <p className={`mt-1 text-xs ${COLORS[score]}`}>{LABELS[score]}</p>
    </div>
  );
}
