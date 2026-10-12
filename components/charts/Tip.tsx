/** Hover/focus tooltip for a chart mark. Wrap the mark; `content` shows above it. */
export default function Tip({ content, children, className = "" }: { content: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <span tabIndex={0} className={`group/tip relative block outline-none ${className}`}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-56 -translate-x-1/2 rounded-md border border-line-strong bg-surface-3 px-2.5 py-1.5 text-xs text-ink shadow-xl group-hover/tip:block group-focus/tip:block"
      >
        {content}
      </span>
    </span>
  );
}
