"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";

/** Updates ?q= after typing pauses, keeping other filters. */
export function SearchBox({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => {
    const id = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      if (next.toString() !== params.toString()) router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 250);
    return () => clearTimeout(id);
  }, [value, params, pathname, router]);

  return (
    <label className="sinput">
      <Icon name="search" />
      <span className="sr">Search people</span>
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoComplete="off" />
    </label>
  );
}
