import React from "react";

interface AppointmentFiltersProps {
  selectedMonth: string;
  setSelectedMonth: (v: string) => void;
  selectedYear: string;
  setSelectedYear: (v: string) => void;
  searchName: string;
  setSearchName: (v: string) => void;
}

export function AppointmentFilters({ selectedMonth, setSelectedMonth, selectedYear, setSelectedYear, searchName, setSearchName }: AppointmentFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2 items-center mb-6">
      <label htmlFor="month-filter" className="font-medium text-sm text-gray-700">Mês:</label>
      <input
        id="month-filter"
        type="month"
        value={selectedMonth}
        onChange={e => setSelectedMonth(e.target.value)}
        className="border rounded px-2 py-1 text-sm"
      />
      <label htmlFor="year-filter" className="font-medium text-sm text-gray-700 ml-2">Ano:</label>
      <input
        id="year-filter"
        type="number"
        min="2020"
        max={new Date().getFullYear()}
        value={selectedYear}
        onChange={e => setSelectedYear(e.target.value)}
        className="border rounded px-2 py-1 text-sm w-20"
      />
      <label htmlFor="name-filter" className="font-medium text-sm text-gray-700 ml-2">Filtrar por nome:</label>
      <input
        id="name-filter"
        type="text"
        placeholder="Digite o nome da cliente"
        value={searchName}
        onChange={e => setSearchName(e.target.value)}
        className="border rounded px-2 py-1 text-sm w-full max-w-xs"
      />
    </div>
  );
}
