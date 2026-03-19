import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
      <h1 className="text-xl font-semibold text-foreground">404 — Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Link href="/">
        <Button size="sm">Back to Dashboard</Button>
      </Link>
    </div>
  );
}
