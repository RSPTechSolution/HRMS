import { Fragment } from "react";

export function WordReveal({ text, accentLast = false, className = "h1" }: { text: string; accentLast?: boolean; className?: string }) {
  const words = text.split(" ");
  return (
    <h1 className={className} aria-label={text}>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className="w" aria-hidden="true">
            <span style={{ "--w": i } as React.CSSProperties} className={accentLast && i === words.length - 1 ? "acc" : undefined}>
              {word}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </h1>
  );
}
