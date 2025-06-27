import React from "react";
import { AppointmentCard } from "./AppointmentCard";
import type { Appointment, Service } from "@shared/schema";

interface AppointmentListProps {
  appointments: Appointment[];
  services?: Service[];
  onEdit: (a: Appointment) => void;
  onDelete: (a: Appointment) => void;
  emptyMessage?: string;
  title?: string;
}

export function AppointmentList({ appointments, services, onEdit, onDelete, emptyMessage, title }: AppointmentListProps) {
  return (
    <div>
      {title && (
        <h3 className="text-lg font-bold mb-4 text-gray-500 flex items-center gap-2">
          {title}
        </h3>
      )}
      {appointments.length === 0 ? (
        <div className="text-gray-400 text-center py-8">{emptyMessage || "Nenhum agendamento encontrado."}</div>
      ) : (
        appointments.map(appointment => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            services={services}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
}
