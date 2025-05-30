import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Clock, User, Mail, Phone, MessageSquare, Plus, Trash2, Edit2, Scissors } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, ContactMessage, AvailableSlot, Service } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import BookingSection from "@/components/booking-section";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<"appointments" | "messages" | "schedule" | "services">("appointments");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    return today.toISOString().split('T')[0];
  });
  const [newSlotTime, setNewSlotTime] = useState("");
  const [deleteType, setDeleteType] = useState<null | { type: 'appointment' | 'message', id: number }>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [editingReview, setEditingReview] = useState<ContactMessage | null>(null);
  // Estados para serviços
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState<{ name: string; description: string; local: string; category: string; price: number }>({
    name: "",
    description: "",
    local: "",
    category: "",
    price: 0,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: appointments, isLoading: appointmentsLoading } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments"],
  });

  const { data: messages, isLoading: messagesLoading } = useQuery<ContactMessage[]>({
    queryKey: ["/api/contact"],
  });

  const { data: slots, isLoading: slotsLoading } = useQuery<AvailableSlot[]>({
    queryKey: [`/api/admin/slots/${selectedDate}`],
    enabled: activeTab === "schedule",
  });

  // Serviços
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    enabled: activeTab === "services",
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
      queryClient.invalidateQueries({ queryKey: [`/api/admin/slots/${selectedDate}`] });
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
      queryClient.invalidateQueries({ queryKey: [`/api/admin/slots/${selectedDate}`] });
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

  const deleteAppointmentMutation = useMutation({
    mutationFn: async (id: number) => {
      console.log("Tentando excluir agendamento id:", id); // Adicione este log
      await apiRequest("DELETE", `/api/appointments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({ title: "Agendamento excluído", description: "Agendamento removido com sucesso." });
      setDeleteType(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir agendamento.", variant: "destructive" });
    },
  });
  const deleteMessageMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/contact/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contact"] });
      toast({ title: "Mensagem excluída", description: "Mensagem removida com sucesso." });
      setDeleteType(null);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir mensagem.", variant: "destructive" });
    },
  });

  const createServiceMutation = useMutation({
    mutationFn: async (data: typeof serviceForm) => {
      return await apiRequest("POST", "/api/services", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setServiceForm({ name: "", description: "", local: "", category: "", price: 0 });
      toast({ title: "Serviço criado", description: "Serviço cadastrado com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar serviço.", variant: "destructive" });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async (data: Service) => {
      return await apiRequest("PUT", `/api/services/${data.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      setEditingService(null);
      toast({ title: "Serviço atualizado", description: "Serviço atualizado com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao atualizar serviço.", variant: "destructive" });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/services"] });
      toast({ title: "Serviço excluído", description: "Serviço removido com sucesso." });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao excluir serviço.", variant: "destructive" });
    },
  });

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
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
                Avaliações
              </button>
              <button
                onClick={() => setActiveTab("schedule")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "schedule"
                    ? "border-rose-primary text-deep-rose"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Gerenciar Horários
              </button>
              <button
                onClick={() => setActiveTab("services")}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === "services"
                    ? "border-rose-primary text-deep-rose"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } flex items-center gap-1`}
              >
                <Scissors className="w-4 h-4" /> Serviços
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

                    <div className="flex gap-2 mt-4 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingAppointment(appointment)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit2 className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteType({ type: 'appointment', id: appointment.id })}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Excluir
                      </Button>
                    </div>
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
              Avaliações ({messages?.length || 0})
            </h2>
            {editingReview ? (
              <div className="mb-8 bg-white rounded-2xl p-6 shadow-sm">
                <form
                  onSubmit={async e => {
                    e.preventDefault();
                    const form = e.target as HTMLFormElement;
                    const formData = new FormData(form);
                    const email = (formData.get("email") as string)?.trim();
                    const phone = (formData.get("phone") as string)?.trim();
                    if (!email && !phone) {
                      toast({ title: "Preencha email ou telefone", variant: "destructive" });
                      return;
                    }
                    const data = {
                      name: formData.get("name") as string,
                      email,
                      phone,
                      message: formData.get("message") as string,
                      rating: Number(formData.get("rating")),
                    };
                    await apiRequest("PUT", `/api/contact/${editingReview.id}`, data);
                    toast({ title: "Avaliação atualizada!" });
                    setEditingReview(null);
                    queryClient.invalidateQueries({ queryKey: ["/api/contact"] });
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-semibold mb-1">Nome</label>
                    <input name="name" defaultValue={editingReview.name} className="w-full border rounded p-2" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Email</label>
                    <input name="email" defaultValue={editingReview.email} className="w-full border rounded p-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Telefone</label>
                    <input name="phone" defaultValue={editingReview.phone || ''} className="w-full border rounded p-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Mensagem</label>
                    <textarea name="message" defaultValue={editingReview.message} className="w-full border rounded p-2" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Nota</label>
                    <input name="rating" type="number" min={1} max={5} defaultValue={editingReview.rating} className="w-20 border rounded p-2" required />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button type="submit" className="bg-deep-rose text-white">Salvar</Button>
                    <Button type="button" variant="outline" onClick={() => setEditingReview(null)}>Cancelar</Button>
                  </div>
                </form>
              </div>
            ) : messagesLoading ? (
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
                    
                    <div className="flex flex-col md:flex-row md:items-center md:space-x-4 text-gray-600 text-sm mt-2">
                      {message.email && (
                        <span className="flex items-center mr-2"><Mail className="w-4 h-4 mr-1" />{message.email}</span>
                      )}
                      {message.phone && (
                        <span className="flex items-center"><Phone className="w-4 h-4 mr-1" />{message.phone}</span>
                      )}
                    </div>
                    
                    <div className="bg-warm-gray rounded-lg p-4">
                      <p className="text-gray-700">{message.message}</p>
                    </div>

                    <div className="flex items-center gap-2 mt-4 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingReview(message)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit2 className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteType({ type: 'message', id: message.id })}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-gray-600">Nenhuma avaliação encontrada</p>
              </div>
            )}
          </div>
        )}

        {/* Schedule Management Tab */}
        {activeTab === "schedule" && (
          <div>
            <h2 className="font-playfair text-3xl font-bold text-charcoal mb-6">
              Gerenciar Horários Disponíveis
            </h2>
            
            {/* Date Selector */}
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                <div className="flex-1">
                  <Label htmlFor="date" className="text-sm font-medium text-charcoal mb-2 block">
                    Selecionar Data
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={(() => {
                      const today = new Date();
                      today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
                      return today.toISOString().split('T')[0];
                    })()}
                    className="w-full"
                  />
                </div>
                
                <div className="flex-1">
                  <Label htmlFor="time" className="text-sm font-medium text-charcoal mb-2 block">
                    Novo Horário
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={newSlotTime}
                    onChange={(e) => setNewSlotTime(e.target.value)}
                    className="w-full"
                  />
                </div>
                
                <Button
                  onClick={handleCreateSlot}
                  disabled={!newSlotTime || createSlotMutation.isPending}
                  className="bg-rose-primary hover:bg-deep-rose text-white px-6 py-2"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {createSlotMutation.isPending ? "Criando..." : "Adicionar Horário"}
                </Button>
              </div>
            </div>

            {/* Available Slots */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="text-xl font-semibold text-charcoal mb-4">
                Horários para {formatDate(selectedDate)}
              </h3>
              
              {slotsLoading ? (
                <div className="grid gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-gray-300 h-12 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : slots && slots.length > 0 ? (
                <div className="grid gap-2">
                  {slots
                    .sort((a, b) => a.time.localeCompare(b.time))
                    .map((slot) => (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-3">
                          <Clock className="text-deep-rose h-5 w-5" />
                          <span className="font-medium">{slot.time}</span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              slot.isAvailable
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {slot.isAvailable ? "Disponível" : "Indisponível"}
                          </span>
                        </div>
                        
                        <Button
                          onClick={() => handleDeleteSlot(slot.id)}
                          disabled={deleteSlotMutation.isPending}
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Clock className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-600">Nenhum horário configurado para esta data</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Adicione horários usando o formulário acima
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Services Tab */}
        {activeTab === "services" && (
          <div>
            <h2 className="font-playfair text-3xl font-bold text-charcoal mb-6">
              Serviços ({services?.length || 0})
            </h2>
            {/* Formulário de criação/edição */}
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (editingService) {
                    updateServiceMutation.mutate({ ...editingService, ...serviceForm });
                  } else {
                    createServiceMutation.mutate(serviceForm);
                  }
                }}
                className="grid md:grid-cols-2 gap-4"
              >
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={serviceForm.name}
                    onChange={e => setServiceForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Categoria</Label>
                  <Input
                    value={serviceForm.category}
                    onChange={e => setServiceForm(f => ({ ...f, category: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Local</Label>
                  <Input
                    value={serviceForm.local}
                    onChange={e => setServiceForm(f => ({ ...f, local: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label>Preço (em reais)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={serviceForm.price / 100}
                    onChange={e => setServiceForm(f => ({ ...f, price: Math.round(Number(e.target.value.replace(',', '.')) * 100) }))}
                    required
                  />
                </div>
                <div className="md:col-span-2">
                  <Label>Descrição</Label>
                  <Input
                    value={serviceForm.description}
                    onChange={e => setServiceForm(f => ({ ...f, description: e.target.value }))}
                    required
                  />
                </div>
                <div className="md:col-span-2 flex gap-2 mt-2">
                  <Button type="submit" className="bg-deep-rose text-white">
                    {editingService ? "Salvar Alterações" : "Adicionar Serviço"}
                  </Button>
                  {editingService && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setEditingService(null);
                        setServiceForm({ name: "", description: "", local: "", category: "", price: 0 });
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </div>
            {/* Lista de serviços */}
            <div className="grid gap-4">
              {servicesLoading ? (
                <div className="text-center">Carregando...</div>
              ) : services && services.length > 0 ? (
                services.map(service => (
                  <div key={service.id} className="bg-white rounded-2xl p-6 shadow-sm flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-lg">{service.name}</div>
                      <div className="text-sm text-gray-600">{service.category} - {service.local}</div>
                      <div className="text-sm text-gray-600">{service.description}</div>
                      <div className="text-sm text-gray-800 font-bold">R$ {(service.price / 100).toFixed(2)}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingService(service);
                          setServiceForm({
                            name: service.name,
                            description: service.description,
                            local: service.local,
                            category: service.category,
                            price: service.price,
                          });
                        }}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit2 className="w-4 h-4 mr-1" /> Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteServiceMutation.mutate(service.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-600">Nenhum serviço cadastrado.</div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!deleteType} onOpenChange={() => setDeleteType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p>Tem certeza que deseja excluir este {deleteType?.type === 'appointment' ? 'agendamento' : 'mensagem'}?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteType(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteType?.type === 'appointment') deleteAppointmentMutation.mutate(deleteType.id);
                if (deleteType?.type === 'message') deleteMessageMutation.mutate(deleteType.id);
              }}
              disabled={deleteAppointmentMutation.isPending || deleteMessageMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}