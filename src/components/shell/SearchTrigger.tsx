"use client";
import { Icon } from "@/components/ui/Icon";

export function SearchTrigger() {
  return (
    <button type="button" className="search-trigger" aria-label="Open command menu" onClick={() => window.dispatchEvent(new Event("lnp:open-command"))}>
      <Icon name="search" />
      <span>Search pages and actions…</span>
      <kbd>Ctrl K</kbd>
    </button>
  );
}
