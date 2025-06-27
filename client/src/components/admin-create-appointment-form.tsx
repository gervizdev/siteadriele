import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import type { Service } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { QuestionMarkIcon } from "./ui/question-mark-icon";

const bookingSchema = z.object({
  serviceId: z.number().min(1, "Por favor, selecione um serviço"),
  serviceName: z.string().min(1),
  servicePrice: z.number().min(1),
  local: z.string().min(1, "Por favor, selecione o local"),
  date: z.string().min(1, "Por favor, selecione uma data"),
  time: z.string().min(1, "Por favor, selecione um horário"),
  clientName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  clientPhone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  clientEmail: z.string().min(1, "O email é obrigatório").email("Formato de email inválido"),
  clientCPF: z.string().min(11, "O CPF é obrigatório").max(14, "CPF inválido"),
  isFirstTime: z.boolean(),
  notes: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

export function CreateAppointmentForm({ onSuccess }: { onSuccess: () => void; }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedLocal, setSelectedLocal] = useState<string>("");
  const [selectedServices, setSelectedServices] = useState<Record<string, Service | null>>({});
  const [selectedTime, setSelectedTime] = useState<string>("");

  // Busca os serviços disponíveis
  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  // Agrupamento e ordenação de serviços
  const servicesCampo = services?.filter(s => s.local?.toLowerCase() === "campo formoso");
  const servicesIrece = services?.filter(s => s.local?.toLowerCase() === "irecê");
  let activeServicesForGrouping: Service[] | undefined = undefined;
  if (selectedLocal.toLowerCase() === "irecê") {
    activeServicesForGrouping = servicesIrece;
  } else if (selectedLocal.toLowerCase() === "campo formoso") {
    activeServicesForGrouping = servicesCampo;
  }
  const categoryOrder = ["cílios", "sobrancelha", "depilação"];
  const groupedServices = (activeServicesForGrouping || []).reduce((acc, service) => {
    acc[service.category] = acc[service.category] || [];
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);
  const orderedCategories = [
    ...categoryOrder.filter(cat => groupedServices[cat] && groupedServices[cat].length > 0),
    ...Object.keys(groupedServices).filter(cat => !categoryOrder.includes(cat))
  ];

  // Horários disponíveis (mock simples para admin)
  const { data: availableTimes = [], isLoading: timesLoading, refetch: refetchTimes } = useQuery({
    queryKey: ["/api/available-times", selectedDate ? format(selectedDate, "yyyy-MM-dd") : null, selectedLocal],
    queryFn: async () => {
      if (!selectedDate || !selectedLocal) return [];
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const response = await fetch(`/api/available-times/${dateStr}?local=${selectedLocal}`);
      if (!response.ok) throw new Error('Failed to fetch available times');
      return response.json();
    },
    enabled: !!selectedDate && !!selectedLocal,
  });
  const [newTime, setNewTime] = useState("");
  const createSlotMutation = useMutation({
    mutationFn: async (data: { date: string; time: string; local: string }) => {
      const response = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, isAvailable: false }), // já cria como ocupado
      });
      if (!response.ok) throw new Error("Erro ao criar horário");
      return response.json();
    },
    onSuccess: (slot) => {
      toast({ title: "Horário criado", description: "Novo horário criado e selecionado." });
      setNewTime("");
      refetchSlots();
      setSelectedTime(slot.time); // seleciona o horário criado
      setValue("time", slot.time, { shouldValidate: true });
      trigger("time");
      // scroll para próximo passo (dados do cliente)
      setTimeout(() => {
        const el = document.getElementById('dados-cliente');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao criar horário. Tente novamente.", variant: "destructive" });
    },
  });

  const { register, handleSubmit, formState: { errors }, setValue, trigger, reset } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      isFirstTime: false,
      notes: "",
      local: "",
      serviceId: 0,
      serviceName: "",
      servicePrice: 0,
    },
  });

  // Soma dos preços dos serviços selecionados
  const totalPrice = Object.values(selectedServices).reduce((acc, s) => acc + (s?.price || 0), 0);

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const service = services?.find(s => s.id === Number(data.serviceId));
      if (!service) {
        throw new Error("Serviço não encontrado ou ainda não carregado.");
      }
      const payload = {
        ...data,
        serviceId: Number(data.serviceId),
        serviceName: service?.name || "",
        servicePrice: service?.price || 0,
        date: selectedDate ? format(selectedDate, "yyyy-MM-dd") : "",
        time: selectedTime,
        local: selectedLocal,
      };
      return apiRequest("POST", "/api/appointments", payload);
    },
    onSuccess: () => {
      toast({ title: "Agendamento criado!", description: "O agendamento presencial foi registrado." });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      reset();
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Erro ao criar agendamento", description: error.message || "Ocorreu um erro.", variant: "destructive" });
    },
  });

  // Handlers
  const handleServiceSelect = (service: Service | null, category: string) => {
    const newSelectedServices = { ...selectedServices, [category]: service };
    setSelectedServices(newSelectedServices);
    const firstValidService = Object.values(newSelectedServices).find(s => s !== null) as Service | undefined;
    if (firstValidService) {
      setValue("serviceId", firstValidService.id, { shouldValidate: true });
      setValue("serviceName", firstValidService.name);
      setValue("servicePrice", firstValidService.price);
    } else {
      setValue("serviceId", 0, { shouldValidate: true });
      setValue("serviceName", "");
      setValue("servicePrice", 0);
    }
    trigger("serviceId");
  };

  // Buscar todos os slots do dia/local para mostrar horários ocupados e disponíveis
  const { data: allSlots = [], isLoading: slotsLoading, refetch: refetchSlots } = useQuery({
    queryKey: ["/api/admin/slots", selectedDate ? format(selectedDate, "yyyy-MM-dd") : null, selectedLocal],
    queryFn: async () => {
      if (!selectedDate || !selectedLocal) return [];
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const response = await fetch(`/api/admin/slots/${dateStr}?local=${selectedLocal}`);
      if (!response.ok) throw new Error('Failed to fetch slots');
      return response.json();
    },
    enabled: !!selectedDate && !!selectedLocal,
  });

  return (
    <section className="py-2">
      <div className="max-h-[70vh] overflow-y-auto pr-2">
        <form onSubmit={handleSubmit(data => createAppointmentMutation.mutate(data))} className="space-y-8">
          {/* Localidade */}
          <div className="mt-2" id="local-escolha">
            <label className="block text-lg font-semibold text-charcoal mb-4">1. Escolha o Local</label>
            <div className="flex gap-4">
              {["Campo Formoso", "Irecê"].map((local) => (
                <button
                  type="button"
                  key={local}
                  className={`flex-1 border-2 rounded-xl p-4 text-center font-semibold transition-all ${
                    selectedLocal === local
                      ? "border-rose-primary bg-rose-primary/10 text-rose-primary"
                      : "border-gray-200 hover:border-rose-primary"
                  }`}
                  onClick={() => {
                    setSelectedLocal(local);
                    setValue("local", local, { shouldValidate: true });
                    setSelectedServices({});
                    setValue("serviceId", 0, { shouldValidate: true });
                    setValue("serviceName", "");
                    setValue("servicePrice", 0);
                    setSelectedDate(undefined);
                    setValue("date", "", { shouldValidate: true });
                    setSelectedTime("");
                    setValue("time", "", { shouldValidate: true });
                    trigger(["local", "serviceId", "date", "time"]);
                  }}
                >
                  {local.charAt(0).toUpperCase() + local.slice(1)}
                </button>
              ))}
            </div>
            {errors.local && (
              <p className="text-red-600 text-sm mt-2">{errors.local.message}</p>
            )}
          </div>

          {/* Serviços */}
          {selectedLocal && groupedServices && Object.keys(groupedServices).length > 0 && (
            <div className="mt-8" id="servico-combobox">
              <label className="block text-lg font-semibold text-charcoal mb-4">2. Selecione o(s) Serviço(s) <span className="text-sm font-normal">(até 3)</span></label>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {orderedCategories.map((category) => (
                  <div key={category} className="flex flex-col">
                    <span className="font-semibold mb-2 text-base">{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                    <select
                      className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-rose-primary transition-colors"
                      value={selectedServices[category] && typeof selectedServices[category] === 'object' && 'id' in selectedServices[category] ? selectedServices[category]?.id : ''}
                      onChange={e => {
                        const id = Number(e.target.value);
                        const alreadySelected = Object.values(selectedServices).filter(Boolean).length;
                        const isAddingNew = id && !selectedServices[category];
                        const newTotal = isAddingNew ? alreadySelected + 1 : alreadySelected;
                        if (id && newTotal > 3) {
                          toast({ title: "Limite de serviços", description: "Você pode selecionar no máximo 3 serviços no total.", variant: "default" });
                          if (selectedServices[category] && typeof selectedServices[category] === 'object' && 'id' in selectedServices[category]) {
                            const service = selectedServices[category] as Service;
                            e.target.value = String(service.id);
                          } else {
                            e.target.value = '';
                          }
                          return;
                        }
                        const service = groupedServices?.[category]?.find(s => s.id === id);
                        handleServiceSelect(service || null, category);
                      }}
                    >
                      <option value="">Nenhum</option>
                      {groupedServices[category]?.map(service => (
                        <option key={service.id} value={service.id}>{service.name} (R$ {(service.price / 100).toFixed(2)})</option>
                      ))}
                    </select>
                    {selectedServices[category]?.description && (
                      <div className="mt-2 bg-warm-gray rounded-xl text-charcoal text-center px-2 py-1 text-xs">
                        <span className="font-semibold">Descrição: </span>
                        {selectedServices[category]?.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {errors.serviceId && Object.values(selectedServices).filter(Boolean).length === 0 && (
                <p className="text-red-600 text-sm mt-2">{errors.serviceId.message}</p>
              )}
            </div>
          )}

          {/* Calendar */}
          {selectedLocal && Object.values(selectedServices).filter(Boolean).length > 0 && (
            <div id="calendar-booking" className="mt-8">
              <label className="block text-lg font-semibold text-charcoal mb-4">3. Escolha a Data</label>
              <div className="flex justify-center">
                <div className="bg-warm-gray rounded-2xl p-8 md:p-12 flex justify-center w-full max-w-lg shadow-lg">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={date => {
                      setSelectedDate(date);
                      setSelectedTime("");
                      setValue("date", date ? format(date, "yyyy-MM-dd") : "", { shouldValidate: true });
                      setValue("time", "", { shouldValidate: true });
                      trigger(["date", "time"]);
                    }}
                    fromDate={undefined}
                    toDate={undefined}
                    className="rounded-xl w-full min-w-[320px] max-w-lg text-base"
                  />
                </div>
              </div>
              {errors.date && (
                <p className="text-red-600 text-sm mt-2">{errors.date.message}</p>
              )}
            </div>
          )}

          {/* Horário */}
          {selectedDate && Object.values(selectedServices).filter(Boolean).length > 0 && (
            <div className="mt-8" id="horario-disponivel">
              <label className="block text-lg font-semibold text-charcoal mb-4">4. Selecione o Horário</label>
              {slotsLoading ? (
                <div className="animate-pulse grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-200 rounded-xl"></div>)}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-4">
                    {allSlots.map((slot: any, idx: number) => {
                      if (slot.isAvailable) {
                        const isSelected = selectedTime === slot.time;
                        return (
                          <button
                            key={idx}
                            onClick={() => {
                              setSelectedTime(slot.time);
                              setValue("time", slot.time, { shouldValidate: true });
                              trigger("time");
                            }}
                            className={`w-full py-3 px-2 rounded-xl font-semibold transition-all flex items-center justify-center text-sm 
                              ${isSelected ? "bg-rose-primary text-white shadow-md" : "bg-gray-100 text-charcoal hover:bg-gray-200"}`}
                            type="button"
                          >
                            {slot.time}
                          </button>
                        );
                      } else {
                        return (
                          <div
                            key={idx}
                            className="w-full py-3 px-2 rounded-xl font-semibold flex items-center justify-center text-sm bg-red-100 text-red-600 border border-red-300 cursor-not-allowed opacity-70"
                          >
                            {slot.time}
                          </div>
                        );
                      }
                    })}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="time"
                      value={newTime}
                      onChange={e => setNewTime(e.target.value)}
                      className="border rounded px-2 py-1 text-sm"
                    />
                    <Button
                      type="button"
                      className="bg-green-600 text-white px-3 py-1"
                      disabled={!newTime || createSlotMutation.isPending}
                      onClick={() => {
                        if (!selectedDate || !selectedLocal || !newTime) return;
                        createSlotMutation.mutate({
                          date: format(selectedDate, "yyyy-MM-dd"),
                          time: newTime,
                          local: selectedLocal,
                        });
                      }}
                    >
                      {createSlotMutation.isPending ? "Adicionando..." : "Adicionar novo horário"}
                    </Button>
                  </div>
                </>
              )}
              {errors.time && <p className="mt-2 text-red-500 text-sm">{errors.time.message}</p>}
            </div>
          )}

          {/* Dados do Cliente */}
          {selectedLocal && Object.values(selectedServices).filter(Boolean).length > 0 && selectedDate && selectedTime && (
            <div className="mt-8" id="dados-cliente">
              <label className="block text-lg font-semibold text-charcoal mb-4">5. Dados do Cliente</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="clientName" className="block text-sm font-medium text-charcoal mb-1">Nome Completo <span className="text-red-500">*</span></label>
                  <input id="clientName" type="text" {...register("clientName")}
                    className={`w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-primary focus:border-rose-primary transition-colors ${errors.clientName ? "border-red-500 ring-red-500" : ""}`}
                    placeholder="Nome completo" />
                  {errors.clientName && <p className="mt-1 text-red-500 text-xs">{errors.clientName.message}</p>}
                </div>
                <div>
                  <label htmlFor="clientPhone" className="block text-sm font-medium text-charcoal mb-1">Telefone (WhatsApp) <span className="text-red-500">*</span></label>
                  <input id="clientPhone" type="tel" {...register("clientPhone")}
                    className={`w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-primary focus:border-rose-primary transition-colors ${errors.clientPhone ? "border-red-500 ring-red-500" : ""}`}
                    placeholder="(XX) XXXXX-XXXX" />
                  {errors.clientPhone && <p className="mt-1 text-red-500 text-xs">{errors.clientPhone.message}</p>}
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="clientEmail" className="block text-sm font-medium text-charcoal mb-1">Email <span className="text-red-500">*</span></label>
                  <input id="clientEmail" type="email" {...register("clientEmail")}
                    className={`w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-primary focus:border-rose-primary transition-colors ${errors.clientEmail ? "border-red-500 ring-red-500" : ""}`}
                    placeholder="seu@email.com" />
                  {errors.clientEmail && <p className="mt-1 text-red-500 text-xs">{errors.clientEmail.message}</p>}
                </div>
                <div>
                  <label htmlFor="clientCPF" className="block text-sm font-medium text-charcoal mb-1">CPF <span className="text-red-500">*</span></label>
                  <input id="clientCPF" type="text" {...register("clientCPF")}
                    className={`w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-primary focus:border-rose-primary transition-colors ${errors.clientCPF ? "border-red-500 ring-red-500" : ""}`}
                    placeholder="Digite o CPF" maxLength={14} inputMode="numeric" />
                  {errors.clientCPF && <p className="mt-1 text-red-500 text-xs">{errors.clientCPF.message}</p>}
                </div>
                <div className="flex items-center md:col-span-2">
                  <input id="isFirstTime" type="checkbox" {...register("isFirstTime")}
                    className="h-4 w-4 text-rose-primary border-gray-300 rounded focus:ring-rose-primary" />
                  <label htmlFor="isFirstTime" className="ml-2 block text-sm text-charcoal">É a primeira vez do cliente?</label>
                </div>
              </div>
            </div>
          )}

          {/* Observações */}
          {selectedLocal && Object.values(selectedServices).filter(Boolean).length > 0 && selectedDate && selectedTime && (
            <div className="mt-8">
              <label htmlFor="notes" className="block text-lg font-semibold text-charcoal mb-4">6. Observações <span className="text-sm font-normal text-gray-500">(opcional)</span></label>
              <textarea id="notes" {...register("notes")}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-primary focus:border-rose-primary transition-colors"
                rows={3} placeholder="Alguma informação adicional, alergia, ou preferência?"></textarea>
            </div>
          )}

          {/* Resumo e Botão Final */}
          {selectedLocal && Object.values(selectedServices).filter(Boolean).length > 0 && selectedDate && selectedTime && (
            <>
              <div className="mt-8 p-6 bg-warm-gray rounded-xl shadow">
                <h3 className="text-xl font-playfair font-semibold text-charcoal mb-4">Resumo do Agendamento</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="font-semibold">Serviços:</span> {Object.values(selectedServices).filter(Boolean).map(s => s?.name).join(", ") || "Nenhum"}</p>
                  <p><span className="font-semibold">Local:</span> {selectedLocal ? selectedLocal.charAt(0).toUpperCase() + selectedLocal.slice(1) : "N/A"}</p>
                  <p><span className="font-semibold">Data:</span> {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "N/A"}</p>
                  <p><span className="font-semibold">Horário:</span> {selectedTime || "N/A"}</p>
                  <p className="text-base font-semibold mt-3">
                    <span className="font-semibold">Preço Total: </span>
                    {`R$ ${(totalPrice / 100).toFixed(2).replace('.', ',')}`}
                  </p>
                </div>
              </div>
              <div className="mt-10">
                <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white" disabled={createAppointmentMutation.isPending}>
                  {createAppointmentMutation.isPending ? "Salvando..." : "Salvar Agendamento"}
                </Button>
                {Object.keys(errors).length > 0 && (
                  <div className="mt-4 p-3 rounded-xl bg-red-100 text-red-700 border border-red-300 text-sm text-center font-semibold">
                    Por favor, revise os campos marcados em vermelho e preencha todas as informações obrigatórias.
                  </div>
                )}
              </div>
            </>
          )}
        </form>
      </div>
    </section>
  );
}
