import * as React from "react";

export function QuestionMarkIcon({ className = "w-4 h-4", ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      className={className}
      {...props}
    >
      <circle cx="10" cy="10" r="9" strokeWidth="2" />
      <path d="M10 14v-1m0-2.5a2 2 0 1 0-2-2" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="15.5" r="1" fill="currentColor" />
    </svg>
  );
}
