import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, User, Mail, Phone, MessageSquare, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, ContactMessage, AvailableSlot } from "@shared/schema";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<"appointments" | "messages" | "schedule">("appointments");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [newSlotTime, setNewSlotTime] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: appointments, isLoading: appointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<ContactMessage[]>({
    queryKey: ["/api/contact"],
  });

  const { data: slots, isLoading: slotsLoading } = useQuery<AvailableSlot[]>({
    queryKey: ["/api/admin/slots", selectedDate],
    enabled: activeTab === "schedule",
  });

  const createSlotMutation = useMutation({
    mutationFn: async (data: { date: string; time: string; isAvailable: boolean }) => {
      const response = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create slot");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slots", selectedDate] });
      setNewSlotTime("");
      toast({
        title: "Horário criado",
        description: "Novo horário disponível criado com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao criar horário. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const deleteSlotMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/slots/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete slot");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/slots", selectedDate] });
      toast({
        title: "Horário removido",
        description: "Horário removido com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao remover horário. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit", 
      year: "numeric"
    });
  };

  const formatPrice = (cents: number) => {
    return `R$ ${(cents / 100).toFixed(0)}`;
  };

  const handleCreateSlot = () => {
    if (!newSlotTime) return;
    
    createSlotMutation.mutate({
      date: selectedDate,
      time: newSlotTime,
      isAvailable: true,
    });
  };

  const handleDeleteSlot = (id: number) => {
    deleteSlotMutation.mutate(id);
  };

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="font-playfair text-2xl font-bold text-deep-rose">
              Painel Administrativo - Bella Lashes
            </h1>
            <button 
              onClick={() => window.location.href = '/'}
              className="text-charcoal hover:text-deep-rose transition-colors"
            >
              Voltar ao Site
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("appointments")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "appointments"
                    ? "border-rose-primary text-deep-rose"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Agendamentos
              </button>
              <button
                onClick={() => setActiveTab("messages")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "messages"
                    ? "border-rose-primary text-deep-rose"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Mensagens de Contato
              </button>
            </nav>
          </div>
        </div>

        {/* Appointments Tab */}
        {activeTab === "appointments" && (
          <div>
            <h2 className="font-playfair text-3xl font-bold text-charcoal mb-6">
              Agendamentos ({appointments?.length || 0})
            </h2>
            
            {appointmentsLoading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 shadow-sm animate-pulse">
                    <div className="bg-gray-300 h-6 rounded mb-4"></div>
                    <div className="bg-gray-300 h-4 rounded mb-2"></div>
                    <div className="bg-gray-300 h-4 rounded"></div>
                  </div>
                ))}
              </div>
            ) : appointments && appointments.length > 0 ? (
              <div className="grid gap-4">
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-lg text-charcoal">
                        {appointment.serviceName}
                      </h3>
                      <span className="bg-rose-primary text-white px-3 py-1 rounded-full text-sm font-medium">
                        {formatPrice(appointment.servicePrice)}
                      </span>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center space-x-2">
                        <Calendar className="text-deep-rose h-5 w-5" />
                        <span>{formatDate(appointment.date)}</span>
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
                    </div>
                    
                    {appointment.notes && (
                      <div className="mt-4 p-3 bg-warm-gray rounded-lg">
                        <p className="text-sm text-gray-600">
                          <strong>Observações:</strong> {appointment.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600">Nenhum agendamento encontrado</p>
              </div>
            )}
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === "messages" && (
          <div>
            <h2 className="font-playfair text-3xl font-bold text-charcoal mb-6">
              Mensagens de Contato ({messages?.length || 0})
            </h2>
            
            {messagesLoading ? (
              <div className="grid gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 shadow-sm animate-pulse">
                    <div className="bg-gray-300 h-6 rounded mb-4"></div>
                    <div className="bg-gray-300 h-4 rounded mb-2"></div>
                    <div className="bg-gray-300 h-16 rounded"></div>
                  </div>
                ))}
              </div>
            ) : messages && messages.length > 0 ? (
              <div className="grid gap-4">
                {messages.map((message) => (
                  <div key={message.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-semibold text-lg text-charcoal">
                        {message.name}
                      </h3>
                      <span className="text-sm text-gray-500">
                        {new Date(message.createdAt).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2 mb-4">
                      <Mail className="text-deep-rose h-5 w-5" />
                      <span>{message.email}</span>
                    </div>
                    
                    <div className="bg-warm-gray rounded-lg p-4">
                      <p className="text-gray-700">{message.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600">Nenhuma mensagem encontrada</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}