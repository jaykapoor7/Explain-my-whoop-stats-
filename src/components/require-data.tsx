"use client";

import { useApp } from "@/lib/store";
import { EmptyState, LinkButton } from "@/components/ui";

/**
 * Gates a page on having data loaded; prompts to connect a device or upload
 * otherwise. Also holds rendering until the persisted store has rehydrated to
 * avoid a hydration mismatch flash.
 */
export function RequireData({ children }: { children: React.ReactNode }) {
  const hydrated = useApp((s) => s.hydrated);
  const days = useApp((s) => s.days);

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
        body="Connect a wearable to auto-sync your recovery, sleep and heart data, or upload an export file."
        cta={
          <div className="flex flex-wrap justify-center gap-3">
            <LinkButton href="/connections">Connect a device</LinkButton>
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
