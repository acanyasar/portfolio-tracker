import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
              <svg viewBox="0 0 28 28" fill="none" className="w-5 h-5" aria-label="Logo">
                <rect x="3" y="14" width="5" height="11" rx="1" fill="hsl(var(--primary))" />
                <rect x="11" y="9" width="5" height="16" rx="1" fill="hsl(var(--primary))" opacity="0.75" />
                <rect x="19" y="4" width="5" height="21" rx="1" fill="hsl(var(--primary))" opacity="0.5" />
                <path d="M3 18 L8.5 12 L14 15 L19.5 8 L25 5" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-sm font-semibold">Portfolio Tracker</span>
          </div>
          <CardTitle className="text-lg">Sign in</CardTitle>
          <CardDescription className="text-xs">Enter your credentials to access your portfolio</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin"
                required
                autoFocus
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs" htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-8 text-sm"
              />
            </div>
            {login.isError && (
              <p className="text-xs text-destructive">
                {(login.error as Error)?.message?.replace(/^\d+: /, "") || "Invalid credentials"}
              </p>
            )}
            <Button type="submit" className="w-full h-8 text-sm" disabled={login.isPending}>
              {login.isPending ? "Signing in..." : "Sign in"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register">
                <a className="text-primary hover:underline">Register</a>
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
