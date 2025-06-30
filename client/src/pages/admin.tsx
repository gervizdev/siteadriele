import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Appointment, ContactMessage, AvailableSlot, Service } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import BookingSection from "@/components/booking-section";
import * as XLSX from "xlsx";
import { AppointmentList } from "@/components/admin/AppointmentList";
import { AppointmentSwitcher } from "@/components/admin/AppointmentSwitcher";
import { AppointmentFilters } from "@/components/admin/AppointmentFilters";
import { RelatorioButtons } from "@/components/admin/RelatorioButtons";
import { Scissors, Mail, Phone, Edit2, Trash2, MessageSquare, Plus, Clock } from "lucide-react";

export default function AdminPanel() {
  // HOOKS E ESTADOS DEVEM VIR PRIMEIRO!
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
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceForm, setServiceForm] = useState<{ name: string; description: string; local: string; category: string; price: number }>({
    name: "",
    description: "",
    local: "",
    category: "",
    price: 0,
  });
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [batchStart, setBatchStart] = useState("");
  const [batchEnd, setBatchEnd] = useState("");
  const [isBatching, setIsBatching] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [slotToDelete, setSlotToDelete] = useState<number|null>(null);
  const [selectedSlotLocal, setSelectedSlotLocal] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 7); // yyyy-mm do mês atual
  });
  const [searchName, setSearchName] = useState("");
  // Adiciona estado para o ano selecionado
  const [selectedYear, setSelectedYear] = useState(() => {
    const today = new Date();
    return today.getFullYear().toString();
  });
  // Estado para alternar entre passados e futuros
  const [showFuture, setShowFuture] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Todas as queries e mutations
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
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
    enabled: activeTab === "services",
  });

  // Filtros de agendamento (depois do hook de appointments)
  const pastAppointments = (appointments || [])
    .filter(a => new Date(`${a.date}T${a.time}`) < new Date())
    .filter(a => a.date.startsWith(selectedMonth))
    .filter(a => a.clientName.toLowerCase().includes(searchName.toLowerCase()));
  const futureAppointments = (appointments || [])
    .filter(a => new Date(`${a.date}T${a.time}`) >= new Date())
    .filter(a => a.clientName.toLowerCase().includes(searchName.toLowerCase()));
  const monthAppointments = (appointments || []).filter(a => a.date.slice(0, 7) === selectedMonth && a.clientName.toLowerCase().includes(searchName.toLowerCase()));

  const createSlotMutation = useMutation({
    mutationFn: async (data: { date: string; time: string; isAvailable: boolean; local: string }) => {
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
      await apiRequest("DELETE", `/api/appointments/${id}?admin=true`);
      // Após deletar o agendamento, marca o slot como disponível
      const deleted = appointments?.find(a => a.id === id);
      if (deleted) {
        // Busca o slot correspondente pelo horário/data/local
        const slotResp = await fetch(`/api/admin/slots/${deleted.date}`);
        if (slotResp.ok) {
          const slots: any[] = await slotResp.json();
          const slot = slots.find(s => s.time === deleted.time && s.local?.toLowerCase() === (services?.find(sv => sv.id === deleted.serviceId)?.local?.toLowerCase() || ""));
          if (slot && !slot.isAvailable) {
            await fetch(`/api/admin/slots/${slot.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ isAvailable: true })
            });
          }
        }
      }
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
  const deleteAllSlotsMutation = useMutation({
    mutationFn: async (date: string) => {
      // Busca todos os slots do dia
      const response = await fetch(`/api/admin/slots/${date}`);
      if (!response.ok) throw new Error("Falha ao buscar horários do dia");
      const slots: { id: number; isAvailable: boolean }[] = await response.json();
      // Deleta apenas os disponíveis
      for (const slot of slots) {
        if (slot.isAvailable) {
          await fetch(`/api/admin/slots/${slot.id}`, { method: "DELETE" });
        }
      }
      return { message: `Todos os horários disponíveis de ${date} foram apagados.` };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/admin/slots/${selectedDate}`] });
      setShowDeleteAllDialog(false);
      toast({
        title: "Horários apagados",
        description: data?.message || "Todos os horários do dia foram removidos.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Falha ao apagar todos os horários do dia.",
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatPrice = (cents: number) => {
    return `R$ ${(cents / 100).toFixed(0)}`;
  };

  // Utilitário para comparar horário (HH:mm) com o horário atual
  function isTimeInPast(dateStr: string, timeStr: string, offsetMin: number = 0) {
    const [h, m] = timeStr.split(":").map(Number);
    const date = new Date(dateStr + 'T' + timeStr);
    // Aplica offset negativo para considerar antecedência
    date.setMinutes(date.getMinutes() - offsetMin);
    return date < new Date();
  }

  const handleCreateSlot = () => {
    if (!newSlotTime || !selectedSlotLocal) return;
    // Impede adicionar horário que já passou
    if (isTimeInPast(selectedDate, newSlotTime)) {
      toast({
        title: "Horário inválido",
        description: "Não é possível adicionar um horário que já passou.",
        variant: "destructive",
      });
      return;
    }
    createSlotMutation.mutate({
      date: selectedDate,
      time: newSlotTime,
      isAvailable: true,
      local: selectedSlotLocal,
    });
  };

  const handleDeleteSlot = (id: number) => {
    deleteSlotMutation.mutate(id);
  };

  const handleEditAppointment = (appointment: Appointment) => setEditingAppointment(appointment);
  const handleDeleteAppointment = (id: number) => deleteAppointmentMutation.mutate(id);

  // Remove automaticamente todos os horários passados, inclusive de dias e meses anteriores, ao carregar qualquer data na tela de administração.
  useEffect(() => {
    if (slots && slots.length > 0) {
      slots.forEach(slot => {
        // Remove slots de qualquer data que já passou (com 10 minutos de antecedência)
        const slotDate = slot.date || selectedDate;
        if (isTimeInPast(slotDate, slot.time, 10)) {
          deleteSlotMutation.mutate(slot.id);
        }
      });
    }
    // eslint-disable-next-line
  }, [slots]);

  // --- PUSH NOTIFICATION ADMIN ---
  useEffect(() => {
    // Só registra se estiver no painel admin
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    let registration: ServiceWorkerRegistration;
    let vapidKey: string;
    fetch('/api/push-public-key')
      .then(res => res.json())
      .then(data => {
        vapidKey = data.publicKey;
        return navigator.serviceWorker.register('/admin-sw.js');
      })
      .then(reg => {
        registration = reg;
        return registration.pushManager.getSubscription();
      })
      .then(async (subscription) => {
        if (!subscription) {
          // Solicita permissão e faz subscribe
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') return;
          const newSub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });
          await fetch('/api/admin-push-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSub),
          });
        } else {
          // Já está inscrito, garante que está salvo no backend
          await fetch('/api/admin-push-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription),
          });
        }
      });

    // Função utilitária para converter a chave VAPID
    function urlBase64ToUint8Array(base64String: string) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }
  }, []);
  // --- FIM PUSH NOTIFICATION ADMIN ---

  if (editingAppointment) {
    // Busca o serviço correspondente ao agendamento para obter o local
    const service = (services || []).find(s => s.id === editingAppointment.serviceId);
    return (
      <div className="min-h-screen bg-cream">
        <div className="max-w-4xl mx-auto py-12">
          <h2 className="font-playfair text-3xl font-bold text-charcoal mb-6 text-center">Editar Agendamento</h2>
          <BookingSection
            editData={{
              ...editingAppointment,
              id: editingAppointment.id,
              local: service?.local || "",
              notes: editingAppointment.notes ?? undefined,
              clientCPF: (editingAppointment as any).clientCPF || ""
            }}
            onEditFinish={() => setEditingAppointment(null)}
          />
          <div className="flex justify-center mt-8">
            <Button variant="outline" onClick={() => setEditingAppointment(null)}>
              Cancelar edição
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Filtra agendamentos passados e futuros
  const pastAppointmentsFiltered = (appointments || [])
    .filter(a => new Date(`${a.date}T${a.time}`) < new Date())
    .filter(a => a.date.startsWith(selectedMonth))
    .filter(a => a.clientName.toLowerCase().includes(searchName.toLowerCase()));
  const futureAppointmentsFiltered = (appointments || [])
    .filter(a => new Date(`${a.date}T${a.time}`) >= new Date())
    .filter(a => a.clientName.toLowerCase().includes(searchName.toLowerCase()));

  console.log('DEBUG appointments:', appointments, 'selectedMonth:', selectedMonth, 'filtro:', (appointments||[]).map(a => ({date: a.date, time: a.time, slice: a.date?.slice(0,7), isPast: new Date(`${a.date}T${a.time}`) < new Date()})));
  console.log('DEBUG filtro final:', (appointments||[]).filter(a => a.date.slice(0, 7) === selectedMonth && new Date(`${a.date}T${a.time}`) < new Date()));

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="font-playfair text-2xl font-bold text-deep-rose">
              Painel Administrativo - adriele martins lash
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

      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 overflow-x-hidden">
        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 w-full overflow-x-auto scrollbar-thin scrollbar-thumb-rose-primary scrollbar-track-transparent">
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
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setEditingAppointment(null)}
              >
                Novo Agendamento
              </Button>
              <RelatorioButtons
                onRelatorioMes={() => {
                  if (!appointments) {
                    toast({ title: "Nenhum agendamento encontrado.", variant: "destructive" });
                    return;
                  }
                  const ags = (appointments||[]).filter(a => a.date.slice(0, 7) === selectedMonth && new Date(`${a.date}T${a.time}`) < new Date());
                  if (ags.length === 0) {
                    toast({ title: "Nenhum agendamento encontrado para o mês selecionado.", variant: "destructive" });
                    return;
                  }
                  gerarRelatorioMensalXLSX(ags, selectedMonth);
                }}
                onRelatorioAno={() => {
                  if (!appointments) {
                    toast({ title: "Nenhum agendamento encontrado.", variant: "destructive" });
                    return;
                  }
                  const agsAno = (appointments||[]).filter(a => a.date.slice(0, 4) === selectedYear && new Date(`${a.date}T${a.time}`) < new Date());
                  if (agsAno.length === 0) {
                    toast({ title: "Nenhum agendamento encontrado para o ano selecionado.", variant: "destructive" });
                    return;
                  }
                  gerarRelatorioAnualXLSX(agsAno, selectedYear);
                }}
              />
            </div>
            <AppointmentFilters
              selectedMonth={selectedMonth}
              setSelectedMonth={setSelectedMonth}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              searchName={searchName}
              setSearchName={setSearchName}
            />
            <div className="mb-6 flex justify-center">
              <AppointmentSwitcher showFuture={showFuture} setShowFuture={setShowFuture} />
            </div>
            <div>
              {showFuture ? (
                // Lista de futuros
                <AppointmentList
                  appointments={futureAppointmentsFiltered}
                  services={services}
                  onEdit={handleEditAppointment}
                  onDelete={a => handleDeleteAppointment(a.id)}
                  emptyMessage="Nenhum agendamento futuro encontrado."
                  title={`Futuros (${futureAppointmentsFiltered.length})`}
                />
              ) : (
                // Lista de passados
                <AppointmentList
                  appointments={pastAppointmentsFiltered}
                  services={services}
                  onEdit={handleEditAppointment}
                  onDelete={a => handleDeleteAppointment(a.id)}
                  emptyMessage="Nenhum agendamento passado encontrado."
                  title={`Passados (${pastAppointmentsFiltered.length})`}
                />
              )}
            </div>

            {/* Todos os agendamentos do mês selecionado */}
            
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
                      <div>
                        <h3 className="font-semibold text-lg text-charcoal">
                          {message.name}
                        </h3>
                        <span className="inline-block text-yellow-600 font-bold text-base mt-1">Nota: {message.rating}/5</span>
                      </div>
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
            {/* Date Selector + Batch */}
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
                  <Label htmlFor="batchStart" className="text-sm font-medium text-charcoal mb-2 block">
                    Início dos Atendimentos
                  </Label>
                  <Input
                    id="batchStart"
                    type="time"
                    value={batchStart}
                    onChange={e => setBatchStart(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="batchEnd" className="text-sm font-medium text-charcoal mb-2 block">
                    Término dos Atendimentos
                  </Label>
                  <Input
                    id="batchEnd"
                    type="time"
                    value={batchEnd}
                    onChange={e => setBatchEnd(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="slotLocal" className="text-sm font-medium text-charcoal mb-2 block">
                    Local do Horário
                  </Label>
                  <select
                    id="slotLocal"
                    value={selectedSlotLocal}
                    onChange={e => setSelectedSlotLocal(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 p-2"
                  >
                    <option value="">Selecione o local</option>
                    <option value="Campo Formoso">Campo Formoso</option>
                    <option value="Irecê">Irecê</option>
                  </select>
                </div>
                <Button
                  onClick={async () => {
                    if (!batchStart || !batchEnd || !selectedSlotLocal) {
                      toast({ title: "Preencha início, término e local", variant: "destructive" });
                      return;
                    }
                    if (batchEnd <= batchStart) {
                      toast({ title: "Término deve ser após o início", variant: "destructive" });
                      return;
                    }
                    setIsBatching(true);
                    // Gera horários de 1 em 1 hora, respeitando minutos do início
                    let [h, m] = batchStart.split(":").map(Number);
                    const [endH, endM] = batchEnd.split(":").map(Number);
                    const times: string[] = [];
                    while (h < endH || (h === endH && m <= endM)) {
                      // Pula o intervalo de 12:00 até 13:59
                      if (!(h === 12 || h === 13 || (h === 14 && m === 0))) {
                        times.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
                      }
                      // Soma 60 minutos
                      m += 60;
                      if (m >= 60) {
                        h += Math.floor(m / 60);
                        m = m % 60;
                      }
                    }
                    for (const t of times) {
                      await createSlotMutation.mutateAsync({ date: selectedDate, time: t, isAvailable: true, local: selectedSlotLocal });
                    }
                    setIsBatching(false);
                    toast({ title: "Horários gerados!", description: `Foram criados ${times.length} horários.` });
                  }}
                  disabled={!batchStart || !batchEnd || !selectedSlotLocal || isBatching || createSlotMutation.isPending}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2"
                >
                  {isBatching ? "Gerando..." : "Gerar horários"}
                </Button>
              </div>
              {/* Campo manual antigo */}
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mt-4">
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-charcoal">
                  Horários para {formatDate(selectedDate)}
                </h3>
                {slots && slots.length > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setShowDeleteAllDialog(true)}
                    className="ml-2"
                  >
                    Apagar todos os disponiveis
                  </Button>
                )}
              </div>
              
              {slotsLoading ? (
                <div className="grid gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-gray-300 h-12 rounded animate-pulse"></div>
                  ))}
                </div>
              ) : slots && slots.length > 0 ? (
                <div className="grid gap-2">
                  {slots
                    .filter(slot => !isTimeInPast(selectedDate, slot.time, 10))
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
                          onClick={() => setSlotToDelete(slot.id)}
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
            <div className="grid md:grid-cols-2 gap-8">
              {["Campo Formoso", "Irecê"].map(local => (
                <div key={local}>
                  <h3 className="text-lg font-bold mb-4 capitalize text-deep-rose">{local}</h3>
                  <div className="grid gap-4">
                    {servicesLoading ? (
                      <div className="text-center">Carregando...</div>
                    ) : services && services.length > 0 ? (
                      [...services]
                        .filter(service => service.local?.toLowerCase() === local.toLowerCase())
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(service => (
                          <div key={service.id} className="bg-white rounded-2xl p-6 shadow-sm flex justify-between items-center min-h-[170px] h-full">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-lg break-words">{service.name}</div>
                              <div className="text-sm text-gray-600 break-words">{service.category} - {service.local}</div>
                              <div className="text-sm text-gray-600 break-words">{service.description}</div>
                              <div className="text-sm text-gray-800 font-bold">R$ {(service.price / 100).toFixed(2)}</div>
                            </div>
                            <div className="flex flex-col gap-2 items-end ml-4">
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
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Edit2 className="w-4 h-4 mr-1" /> Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setServiceToDelete(service)}
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
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={!!deleteType} onOpenChange={() => setDeleteType(null)}>
        <DialogContent aria-describedby="delete-confirm-desc">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p id="delete-confirm-desc">Tem certeza que deseja excluir este {deleteType?.type === 'appointment' ? 'agendamento' : 'mensagem'}?</p>
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

      {/* Modal de confirmação para exclusão de serviço */}
      <Dialog open={!!serviceToDelete} onOpenChange={() => setServiceToDelete(null)}>
        <DialogContent aria-describedby="delete-service-desc">
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
          </DialogHeader>
          <p id="delete-service-desc">Tem certeza que deseja excluir o serviço <b>{serviceToDelete?.name}</b>?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceToDelete(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (serviceToDelete) deleteServiceMutation.mutate(serviceToDelete.id);
                setServiceToDelete(null);
              }}
              disabled={deleteServiceMutation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação para apagar todos */}
      <Dialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <DialogContent aria-describedby="delete-all-slots-desc">
          <DialogHeader>
            <DialogTitle>Apagar todos os horários do dia?</DialogTitle>
          </DialogHeader>
          <p id="delete-all-slots-desc">Tem certeza que deseja apagar <b>todos</b> os horários do dia {formatDate(selectedDate)}? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteAllDialog(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteAllSlotsMutation.mutate(selectedDate)} disabled={deleteAllSlotsMutation.isPending}>
              Apagar todos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmação para apagar individual */}
      <Dialog open={!!slotToDelete} onOpenChange={() => setSlotToDelete(null)}>
        <DialogContent aria-describedby="delete-slot-desc">
          <DialogHeader>
            <DialogTitle>Apagar horário?</DialogTitle>
          </DialogHeader>
          <p id="delete-slot-desc">Tem certeza que deseja apagar este horário?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { if(slotToDelete) { deleteSlotMutation.mutate(slotToDelete); setSlotToDelete(null); } }} disabled={deleteSlotMutation.isPending}>
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Função simples para exportação de relatório (substitua pela real depois)
function gerarRelatorioMensalXLSX(ags: Appointment[], selectedMonth: string) {
  const services: Service[] = (window as any).adminServices || [];
  const getLocal = (a: Appointment) => (services.find(s => s.id === a.serviceId)?.local || 'Não informado').toLowerCase();
  const locais = Array.from(new Set(ags.map(getLocal))) as string[];
  const agsPorLocal = Object.fromEntries(locais.map(local => [local, ags.filter(a => getLocal(a) === local)]));

  // Função para calcular métricas por local
  function getMetricaLocal(agsLocal: Appointment[]) {
    const total = agsLocal.length;
    const faltaram = agsLocal.filter(a => a.clientShowedUp === false).length;
    const compareceram = agsLocal.filter(a => a.clientShowedUp === true).length;
    const primeiraVez = agsLocal.filter(a => a.isFirstTime === true).length;
    const retornantes = agsLocal.filter(a => a.isFirstTime === false).length;
    const valor = agsLocal.reduce((acc, a) => acc + (a.servicePrice || 0), 0) / 100;
    const percFaltaram = total ? (faltaram / total * 100).toFixed(1) + '%' : '0%';
    const percCompareceram = total ? (compareceram / total * 100).toFixed(1) + '%' : '0%';
    return {
      'Qtd. Agendamentos': total,
      'Soma dos Valores': valor,
      'Faltaram': faltaram,
      'Compareceram': compareceram,
      '% Faltaram': percFaltaram,
      '% Compareceram': percCompareceram,
      'Primeira vez': primeiraVez,
      'Retornantes': retornantes
    };
  }

  // Página principal (resumo) - orientação vertical
  const resumoPorLocal = locais.map(local => {
    const agsLocal = agsPorLocal[local];
    return {
      [local.charAt(0).toUpperCase() + local.slice(1)]: getMetricaLocal(agsLocal)
    };
  });
  const totalObj = { TOTAL: getMetricaLocal(ags) };
  const allLocais = [...resumoPorLocal, totalObj];
  // Transpor: cada métrica vira linha, cada local/total vira coluna
  const metricaKeys = Object.keys(getMetricaLocal(ags));
  const header = ['Métrica', ...allLocais.map(obj => Object.keys(obj)[0])];
  const data = metricaKeys.map(key => [key, ...allLocais.map(obj => (Object.values(obj)[0] as any)[key])]);
  const wsResumo = XLSX.utils.aoa_to_sheet([header, ...data]);
  wsResumo['!cols'] = header.map(h => ({ wch: Math.max(h.length + 2, 18), alignment: { horizontal: 'right' } }));
  // Ajusta alinhamento à direita para todas as células (exceto coluna 0)
  for (let R = 1; R <= data.length; ++R) {
    for (let C = 1; C < header.length; ++C) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C });
      if (wsResumo[cell]) wsResumo[cell].s = { alignment: { horizontal: 'right' } };
    }
  }

  // Páginas por local (mantém igual)
  const sheetsPorLocal = locais.map(local => {
    const agsLocal = agsPorLocal[local];
    const ws = XLSX.utils.json_to_sheet(agsLocal.map(a => ({
      Data: a.date,
      Horário: a.time,
      Cliente: a.clientName,
      Email: a.clientEmail,
      Telefone: a.clientPhone,
      Serviço: a.serviceName,
      Valor: (a.servicePrice / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      Observações: a.notes || ''
    })));
    ws['!cols'] = [
      { wch: 12 }, // Data
      { wch: 8 },  // Horário
      { wch: 22 }, // Cliente
      { wch: 28 }, // Email
      { wch: 14 }, // Telefone
      { wch: 28 }, // Serviço
      { wch: 10 }, // Valor
      { wch: 30 }  // Observações
    ];
    return { name: local.charAt(0).toUpperCase() + local.slice(1), ws };
  });

  // Monta o workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
  sheetsPorLocal.forEach(({ name, ws }) => XLSX.utils.book_append_sheet(wb, ws, name));
  XLSX.writeFile(wb, `relatorio-agendamentos-${selectedMonth}.xlsx`);
}

// Função para gerar relatório anual
function gerarRelatorioAnualXLSX(ags: Appointment[], selectedYear: string) {
  const services: Service[] = (window as any).adminServices || [];
  const getLocal = (a: Appointment) => (services.find(s => s.id === a.serviceId)?.local || 'Não informado').toLowerCase();
  const mesesNomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const meses = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const locais = Array.from(new Set(ags.map(getLocal))) as string[];
  function getMetricaLocal(agsLocal: Appointment[]): { [key: string]: string | number } {
    const total = agsLocal.length;
    const faltaram = agsLocal.filter(a => a.clientShowedUp === false).length;
    const compareceram = agsLocal.filter(a => a.clientShowedUp === true).length;
    const primeiraVez = agsLocal.filter(a => a.isFirstTime === true).length;
    const retornantes = agsLocal.filter(a => a.isFirstTime === false).length;
    const valor = agsLocal.reduce((acc, a) => acc + (a.servicePrice || 0), 0) / 100;
    const percFaltaram = total ? (faltaram / total * 100).toFixed(1) + '%' : '0%';
    const percCompareceram = total ? (compareceram / total * 100).toFixed(1) + '%' : '0%';
    return {
      'Qtd. Agendamentos': total,
      'Soma dos Valores': valor,
      'Faltaram': faltaram,
      'Compareceram': compareceram,
      '% Faltaram': percFaltaram,
      '% Compareceram': percCompareceram,
      'Primeira vez': primeiraVez,
      'Retornantes': retornantes
    };
  }
  // Cabeçalho: Métrica | ...
  const metricaKeys = Object.keys(getMetricaLocal(ags));
  // Para cada mês, para cada local, calcula as métricas
  const header = ['Mês/Local', ...locais.map(local => local.charAt(0).toUpperCase() + local.slice(1)), 'TOTAL'];
  // Para cada mês, gera uma linha com as métricas de cada local e o total
  const data: any[][] = [];
  meses.forEach((mes, idx) => {
    metricaKeys.forEach((key, i) => {
      const row = [`${mesesNomes[idx]} - ${key}`];
      locais.forEach(local => {
        const agsLocalMes = ags.filter(a => getLocal(a) === local && a.date.slice(5,7) === mes);
        row.push((getMetricaLocal(agsLocalMes) as any)[key]);
      });
      // Total do mês (todos locais)
      const agsMes = ags.filter(a => a.date.slice(5,7) === mes);
      row.push((getMetricaLocal(agsMes) as any)[key]);
      (data as any[][]).push(row);
    });
    // Linha em branco para separar meses
    (data as any[][]).push(Array(header.length).fill(''));
  });
  // Formatação: colunas largas, alinhamento à direita, cabeçalho destacado
  const wsResumo = XLSX.utils.aoa_to_sheet([header, ...data]);
  wsResumo['!cols'] = header.map(h => ({ wch: Math.max(h.length + 4, 18), alignment: { horizontal: 'right' } }));
  for (let R = 1; R <= data.length; ++R) {
    for (let C = 1; C < header.length; ++C) {
      const cell = XLSX.utils.encode_cell({ r: R, c: C });
      if (wsResumo[cell]) wsResumo[cell].s = { alignment: { horizontal: 'right' } };
    }
  }
  // Destaca cabeçalho
  for (let C = 0; C < header.length; ++C) {
    const cell = XLSX.utils.encode_cell({ r: 0, c: C });
    if (wsResumo[cell]) wsResumo[cell].s = { font: { bold: true }, alignment: { horizontal: 'center' } };
  }
  // Monta o workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Anual');
  XLSX.writeFile(wb, `relatorio-anual-${selectedYear}.xlsx`);
}