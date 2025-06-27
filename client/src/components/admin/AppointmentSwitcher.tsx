import React from "react";

interface AppointmentSwitcherProps {
  showFuture: boolean;
  setShowFuture: (v: boolean) => void;
}

export function AppointmentSwitcher({ showFuture, setShowFuture }: AppointmentSwitcherProps) {
  return (
    <div className="mb-6 flex justify-center">
      <button
        className={`px-4 py-2 rounded-l-xl border border-gray-300 font-semibold text-sm transition-colors ${!showFuture ? 'bg-rose-primary text-white' : 'bg-white text-charcoal hover:bg-gray-100'}`}
        onClick={() => setShowFuture(false)}
        type="button"
      >
        Passados
      </button>
      <button
        className={`px-4 py-2 rounded-r-xl border border-gray-300 font-semibold text-sm transition-colors border-l-0 ${showFuture ? 'bg-rose-primary text-white' : 'bg-white text-charcoal hover:bg-gray-100'}`}
        onClick={() => setShowFuture(true)}
        type="button"
      >
        Futuros
      </button>
    </div>
  );
}
