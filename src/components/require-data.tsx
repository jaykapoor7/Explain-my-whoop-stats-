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
        title="Let's get your data in"
        body="Connect a wearable to auto-sync, upload an export, or explore with six months of realistic demo data first."
        cta={
          <div className="flex flex-wrap justify-center gap-3">
            <LinkButton href="/connections">Connect a device</LinkButton>
            <Button variant="ghost" onClick={loadDemo}>
              Try demo data
            </Button>
            <LinkButton href="/upload" variant="ghost">
              Upload a file
            </LinkButton>
          </div>
        }
      />
    );
  }
  return <>{children}</>;
}
