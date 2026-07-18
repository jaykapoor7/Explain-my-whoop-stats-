"use client";

import { useApp } from "@/lib/store";
import { Button, EmptyState, LinkButton } from "@/components/ui";

/**
 * Gates a page on having data loaded; offers demo data or upload otherwise.
 * Also holds rendering until the persisted store has rehydrated to avoid
 * a hydration mismatch flash.
 */
export function RequireData({ children }: { children: React.ReactNode }) {
  const hydrated = useApp((s) => s.hydrated);
  const days = useApp((s) => s.days);
  const loadDemo = useApp((s) => s.loadDemo);

  if (!hydrated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }
  if (!days.length) {
    return (
      <EmptyState
        title="No health data yet"
        body="Upload an export from WHOOP, Apple Health, Fitbit, Garmin, Oura or any CSV — or explore with six months of realistic demo data."
        cta={
          <div className="flex gap-3">
            <Button onClick={loadDemo}>Load demo data</Button>
            <LinkButton href="/upload" variant="ghost">
              Upload your data
            </LinkButton>
          </div>
        }
      />
    );
  }
  return <>{children}</>;
}
