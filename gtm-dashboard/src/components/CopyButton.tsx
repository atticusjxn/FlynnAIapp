import { useState } from 'react';

export function CopyButton({
  text,
  label = 'Copy',
  className = '',
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`btn-outline ${className}`}
      type="button"
    >
      {copied ? 'Copied' : label}
    </button>
  );
}
