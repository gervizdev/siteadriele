import React from "react";
import { Button } from "../ui/button";

interface RelatorioButtonsProps {
  onRelatorioMes: () => void;
  onRelatorioAno: () => void;
}

export function RelatorioButtons({ onRelatorioMes, onRelatorioAno }: RelatorioButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        className="border-green-600 text-green-700 hover:bg-green-50"
        onClick={e => {
          e.preventDefault();
          onRelatorioMes();
        }}
      >
        Relatório do mês
      </Button>
      <Button
        variant="outline"
        className="border-blue-600 text-blue-700 hover:bg-blue-50"
        onClick={e => {
          e.preventDefault();
          onRelatorioAno();
        }}
      >
        Relatório do ano
      </Button>
    </div>
  );
}
