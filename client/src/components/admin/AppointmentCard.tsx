import { Calendar, Clock, User, Phone, Mail, Edit2, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import type { Appointment, Service } from "@shared/schema";
import React from "react";

interface AppointmentCardProps {
  appointment: Appointment;
  services?: Service[];
  onEdit: (a: Appointment) => void;
  onDelete: (a: Appointment) => void;
}

export function AppointmentCard({ appointment, services, onEdit, onDelete }: AppointmentCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const service = services?.find(s => s.id === appointment.serviceId);
  const isCilios = service && service.category && service.category.toLowerCase().includes("cílios");
  const isIrece = service && service.local && service.local.toLowerCase() === "irece";

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <h3 className="font-semibold text-lg text-charcoal">
          {appointment.serviceName}
        </h3>
        <span className="bg-rose-primary text-white px-3 py-1 rounded-full text-sm font-medium">
          {((appointment.servicePrice || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div className="flex items-center space-x-2">
          <Calendar className="text-deep-rose h-5 w-5" />
          <span>{appointment.date}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Clock className="text-deep-rose h-5 w-5" />
          <span>{appointment.time}</span>
        </div>
        <div className="flex items-center space-x-2">
          <User className="text-deep-rose h-5 w-5" />
          <span>{appointment.clientName}</span>
        </div>
        <div className="flex items-center space-x-2">
          <Phone className="text-deep-rose h-5 w-5" />
          <span>{appointment.clientPhone}</span>
        </div>
      </div>
      <div className="flex items-center space-x-2 mb-2">
        <Mail className="text-deep-rose h-5 w-5" />
        <span>{appointment.clientEmail}</span>
      </div>
      <div className="flex items-center space-x-2 mb-2">
        <span className={`px-3 py-1 rounded-full text-sm ${
          appointment.isFirstTime
            ? "bg-gold text-white"
            : "bg-gray-200 text-gray-700"
        }`}>
          {appointment.isFirstTime ? "Primeira vez" : "Cliente retornante"}
        </span>
        {/* Checkbox de presença */}
        <label className="flex items-center gap-1 ml-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={appointment.clientShowedUp === true}
            onChange={async (e) => {
              try {
                await apiRequest("PUT", `/api/appointments/${appointment.id}?admin=true`, {
                  ...appointment,
                  clientShowedUp: e.target.checked
                });
                queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
                toast({ title: e.target.checked ? "Marcado como não compareceu" : "Marcado como compareceu" });
              } catch {
                toast({ title: "Erro ao atualizar presença", variant: "destructive" });
              }
            }}
            className="accent-green-600 w-4 h-4"
          />
          <span className="text-sm">Compareceu</span>
        </label>
      </div>
      {appointment.notes && (
        <div className="mt-4 p-3 bg-warm-gray rounded-lg">
          <p className="text-sm text-gray-600">
            <strong>Observações:</strong> {appointment.notes}
          </p>
        </div>
      )}
      <div className="flex gap-2 mt-4 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(appointment)}
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          <Edit2 className="w-4 h-4 mr-1" /> Editar
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (isCilios && isIrece) {
              toast({
                title: "Cancelamento bloqueado",
                description: "O cancelamento de cílios em Irecê só pode ser feito via WhatsApp pelo cliente.",
                variant: "destructive"
              });
              return;
            }
            onDelete(appointment);
          }}
          className={`text-red-600 hover:text-red-700 hover:bg-red-50 ${isCilios && isIrece ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={Boolean(isCilios && isIrece)}
        >
          <Trash2 className="w-4 h-4 mr-1" /> Excluir
        </Button>
      </div>
    </div>
  );
}
