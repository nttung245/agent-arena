export function InteractPrompt({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <div className="life-interact-prompt" role="status">
      Press E to {label}
    </div>
  );
}
