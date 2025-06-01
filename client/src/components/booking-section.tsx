import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Calendar } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import type { Service } from "@shared/schema";
import { format, addDays, isBefore, startOfDay } from "date-fns";
// Popover não está sendo usado, mas vou manter caso seja para uso futuro.
// import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
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
  clientEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  isFirstTime: z.boolean(),
  notes: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

// Função auxiliar para converter tempo HH:MM para minutos
function timeStringToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

export default function BookingSection({ editData, onEditFinish }: { editData?: BookingFormData & { id: number }, onEditFinish?: () => void } = {}) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedService, setSelectedService] = useState<Service | null>(null); // Mantido para compatibilidade e lógica de adiantamento original
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedLocal, setSelectedLocal] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null); // Não parece ativamente usado, mas mantido
  const [isEditing, setIsEditing] = useState(!!editData);
  const [selectedServices, setSelectedServices] = useState<Record<string, Service | null>>({});
  const { toast } = useToast();
  const [waitingPayment, setWaitingPayment] = useState(false);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);

  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: availableTimes, isLoading: timesLoading } = useQuery({
    queryKey: ["/api/available-times", selectedDate ? format(selectedDate, "yyyy-MM-dd") : null, selectedLocal], // Adicionado selectedLocal para refetch se local mudar
    queryFn: async () => {
      if (!selectedDate || !selectedLocal) return [];
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      // A API de available-times pode precisar do local se os horários variarem por local
      const response = await fetch(`/api/available-times/${dateStr}?local=${selectedLocal}`);
      if (!response.ok) throw new Error('Failed to fetch available times');
      return response.json();
    },
    enabled: !!selectedDate && !!selectedLocal,
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch, trigger } = useForm<BookingFormData>({
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

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const response = await apiRequest("POST", "/api/appointments", data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Agendamento realizado!",
        description: "Seu agendamento foi confirmado com sucesso. Entraremos em contato em breve.",
      });
      reset();
      setSelectedDate(undefined);
      setSelectedService(null);
      setSelectedTime("");
      setSelectedLocal("");
      setSelectedServices({});
      setSelectedCategory(null);
      queryClient.invalidateQueries({ queryKey: ["/api/available-times"] });
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] }); // Para atualizar listas de agendamentos, se houver
    },
    onError: (error: any) => {
      toast({
        title: "Erro no agendamento",
        description: error.message || "Ocorreu um erro ao realizar o agendamento.",
        variant: "destructive",
      });
    },
  });

  const editAppointmentMutation = useMutation({
    mutationFn: async (data: BookingFormData & { id: number }) => {
      const response = await apiRequest("PUT", `/api/appointments/${data.id}`, data);
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Agendamento atualizado!",
        description: "O agendamento foi atualizado com sucesso.",
      });
      reset();
      setIsEditing(false);
      onEditFinish?.();
      setSelectedDate(undefined);
      setSelectedService(null);
      setSelectedTime("");
      setSelectedLocal("");
      setSelectedServices({});
      setSelectedCategory(null);
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/available-times"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao editar",
        description: error.message || "Ocorreu um erro ao editar o agendamento.",
        variant: "destructive",
      });
    },
  });

  // Soma dos preços dos serviços selecionados
  const totalPrice = Object.values(selectedServices).reduce((acc, s) => acc + (s?.price || 0), 0);

  // Verifica se algum serviço selecionado é cílios e em Irecê
  const hasCiliosIrece = Object.values(selectedServices).some(
    s => s && s.category === "cílios" && s.local?.toLowerCase() === "irece"
  );


  async function handleMercadoPagoPayment(data: BookingFormData) {
    try {
      // Usa o totalPrice dos serviços selecionados, se não, o preço do serviço principal do formulário.
      // Para adiantamento, o preço é fixo (3000), então o title pode ser mais genérico.
      const paymentTitle = `Adiantamento Agendamento: ${
        Object.values(selectedServices).filter(Boolean).map(s => s?.name).join(', ') || data.serviceName
      }`;

      const response = await fetch("/api/mercadopago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: paymentTitle,
          price: 3000, // Valor fixo do adiantamento
          quantity: 1,
          payer: {
            name: data.clientName,
            email: data.clientEmail,
          },
          bookingData: {
            ...data,
            serviceName: Object.values(selectedServices).filter(Boolean).map(s => s?.name).join(', '), // Envia todos os nomes
            servicePrice: totalPrice, // Envia o preço total
          }
        }),
      });
      if (!response.ok) {
        const errorResult = await response.json().catch(() => ({ message: "Erro ao criar pagamento. Sem detalhes."}));
        throw new Error(errorResult.message || "Erro ao criar pagamento");
      }
      const result = await response.json();
      if (result.preference_id) {
        setPreferenceId(result.preference_id);
        setWaitingPayment(true);
        return true;
      } else if (result.init_point) {
        window.location.href = result.init_point;
        return true;
      } else {
        throw new Error("Resposta inválida do backend do Mercado Pago");
      }
    } catch (e: any) {
      toast({
        title: "Erro ao iniciar pagamento",
        description: e.message || "Tente novamente ou entre em contato.",
        variant: "destructive",
      });
      setWaitingPayment(false);
      return false;
    }
  }

  useEffect(() => {
  console.log("MP useEffect triggered. waitingPayment:", waitingPayment, "preferenceId:", preferenceId, "MP SDK:", typeof (window as any).MercadoPago);
  if (waitingPayment && preferenceId && (window as any).MercadoPago) {
    console.log("MP useEffect: Conditions met. Initializing Brick.");
    const mpPublicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || "TEST-d3df5742-153d-43cc-a18e-da4f8745aa79";
    console.log("Using MP Public Key:", mpPublicKey);

    if (!mpPublicKey) {
        console.error("Mercado Pago Public Key is MISSING!");
        toast({ title: "Erro de Configuração", description: "Chave pública do Mercado Pago não encontrada.", variant: "destructive"});
        setWaitingPayment(false);
        setPreferenceId(null);
        return;
    }

    try {
      const mp = new (window as any).MercadoPago(mpPublicKey, { locale: "pt-BR" });
      const bricksBuilder = mp.bricks();
      console.log("MP Bricks Builder created.");

      const walletContainerElement = document.getElementById("wallet_container"); // Renomeado para evitar conflito com a variável de string
      if (!walletContainerElement) {
        console.error("MP useEffect: 'wallet_container' DIV NOT FOUND!");
        toast({ title: "Erro na UI", description: "Container do pagamento não encontrado.", variant: "destructive"});
        setWaitingPayment(false);
        setPreferenceId(null);
        return;
      }
      console.log("MP useEffect: 'wallet_container' found.", walletContainerElement);

      bricksBuilder.create("wallet", "wallet_container", { // Usando a string "wallet_container" aqui
        initialization: {
          preferenceId: preferenceId,
        },
        customization: {
            visual: {
               
            }
        },
        callbacks: {
          onReady: () => {
            console.log("MP Brick: onReady - Brick está pronto.");
            // --- INÍCIO DA LÓGICA DE SCROLL ---
            if (walletContainerElement) { // Verifica se o elemento ainda existe
              console.log("Scrolling to wallet_container.");
              walletContainerElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            // --- FIM DA LÓGICA DE SCROLL ---
          },
          onSubmit: () => { console.log("MP Brick: onSubmit - Usuário submeteu o pagamento."); },
          onError: (error: any) => {
            console.error("MP Brick: onError callback:", error);
            toast({ title: "Erro no pagamento MP", description: error.message || "Ocorreu um erro com o Mercado Pago.", variant: "destructive" });
            setWaitingPayment(false);
            setPreferenceId(null);
          }
        }
      }).then(() => {
        console.log("MP Brick .create() promise RESOLVED.");
      }).catch((error: any) => {
        console.error("MP Brick .create() promise REJECTED:", error);
        toast({ title: "Erro ao carregar módulo de pagamento", description: error.message || "Falha ao iniciar o componente de pagamento.", variant: "destructive"});
        setWaitingPayment(false);
        setPreferenceId(null);
      });
      console.log("MP Brick .create() called.");
    } catch (brickError: any) {
        console.error("Error initializing MP Brick (outer try-catch):", brickError);
        toast({ title: "Erro Crítico no Pagamento", description: brickError.message || "Não foi possível carregar a interface de pagamento.", variant: "destructive"});
        setWaitingPayment(false);
        setPreferenceId(null);
    }
  } else {
    if (waitingPayment && preferenceId && !(window as any).MercadoPago) {
        console.warn("MP useEffect: Attempting to init Brick, but MercadoPago SDK not found on window!");
    } else if (waitingPayment && !preferenceId) {
        console.warn("MP useEffect: waitingPayment is true, but preferenceId is missing.");
    }
  }
}, [waitingPayment, preferenceId, toast]); // As dependências estão corretas
  const handleBookingSubmit = async (data: BookingFormData) => {
    const isAdiantamento = hasCiliosIrece; // Usando a variável mais precisa

    // Atualiza data com o preço total e nomes de todos os serviços selecionados
    const finalBookingData = {
      ...data,
      serviceName: Object.values(selectedServices).filter(Boolean).map(s => s?.name).join(', ') || data.serviceName,
      servicePrice: totalPrice || data.servicePrice,
    };


    if (isAdiantamento) {
      toast({ title: "Redirecionando para pagamento..." });
      await handleMercadoPagoPayment(finalBookingData);
      return;
    }

    if (isEditing && editData?.id) {
      editAppointmentMutation.mutate({ ...finalBookingData, id: editData.id });
    } else {
      // Validação antes de criar
      if (Object.values(selectedServices).filter(Boolean).length === 0) {
        toast({
            title: "Nenhum serviço selecionado",
            description: "Por favor, selecione pelo menos um serviço.",
            variant: "destructive",
        });
        const serviceSelect = document.getElementById('servico-combobox');
        if (serviceSelect) serviceSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!finalBookingData.servicePrice || finalBookingData.servicePrice <= 0) {
        toast({
          title: "Erro no serviço",
          description: "O preço total dos serviços é inválido. Verifique os serviços selecionados.",
          variant: "destructive",
        });
        return;
      }
      createAppointmentMutation.mutate(finalBookingData);
    }
  };

  const handleServiceSelect = (service: Service | null, category: string) => {
    const newSelectedServices = { ...selectedServices, [category]: service };
    setSelectedServices(newSelectedServices);

    // Atualiza campos do formulário com base no primeiro serviço válido para compatibilidade
    // ou limpa se nenhum serviço estiver selecionado.
    const firstValidService = Object.values(newSelectedServices).find(s => s !== null) as Service | undefined;

    if (firstValidService) {
      setSelectedService(firstValidService); // Mantém selectedService para lógica que possa depender dele
      setValue("serviceId", firstValidService.id, { shouldValidate: true });
      setValue("serviceName", firstValidService.name); // Este será sobrescrito em handleBookingSubmit
      setValue("servicePrice", firstValidService.price); // Este será sobrescrito em handleBookingSubmit
    } else {
      setSelectedService(null);
      setValue("serviceId", 0, { shouldValidate: true });
      setValue("serviceName", "");
      setValue("servicePrice", 0);
    }
    trigger("serviceId"); // Força a validação do serviceId
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime("");
    setValue("time", "", { shouldValidate: true });
    if (date) {
      setValue("date", format(date, "yyyy-MM-dd"), { shouldValidate: true });
    } else {
      setValue("date", "", { shouldValidate: true });
    }
    trigger(["date", "time"]);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setValue("time", time, { shouldValidate: true });
    trigger("time");
    // Rola para os dados do cliente após selecionar o horário
    setTimeout(() => {
        const el = document.getElementById('dados-cliente');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const disabledDays = { before: startOfDay(new Date()) };

  const servicesCampoFormoso = services?.filter(s => s.local?.toLowerCase() === "campo formoso");
  const servicesIrece = services?.filter(s => s.local?.toLowerCase() === "irece");

  let activeServicesForGrouping: Service[] | undefined = undefined;
  if (selectedLocal.toLowerCase() === "irece") {
    activeServicesForGrouping = servicesIrece;
  } else if (selectedLocal.toLowerCase() === "campo formoso") {
    activeServicesForGrouping = servicesCampoFormoso;
  }

  const groupedServices = (activeServicesForGrouping || []).reduce((acc, service) => {
    acc[service.category] = acc[service.category] || [];
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  useEffect(() => {
    if (editData) {
      setIsEditing(true);
      setSelectedLocal(editData.local);
      // Simular seleção de serviços se houver nomes múltiplos ou para popular groupedServices corretamente
      // Esta parte é complexa pois editData tem um único serviceId/Name/Price
      // Precisamos reconstruir selectedServices se possível.
      // Por simplicidade, vamos setar o primeiro serviço como em handleServiceSelect
      // e o usuário ajusta se for um agendamento com múltiplos serviços.
      const serviceToEdit = services?.find(s => s.id === editData.serviceId && s.local?.toLowerCase() === editData.local.toLowerCase());
      if(serviceToEdit) {
        setSelectedServices({ [serviceToEdit.category]: serviceToEdit });
        setSelectedService(serviceToEdit);
      } else {
        // Fallback se o serviço não for encontrado (pode ter sido excluído ou local mudado)
         setSelectedService({
            id: editData.serviceId, name: editData.serviceName, price: editData.servicePrice,
            description: '', category: 'Desconhecida', local: editData.local,
        });
        setSelectedServices({}); // Limpa para evitar inconsistências
      }

      setSelectedDate(editData.date ? new Date(new Date(editData.date).valueOf() + new Date().getTimezoneOffset() * 60 * 1000) : undefined); // Ajuste de timezone para exibir data correta no calendário
      setSelectedTime(editData.time);
      // setSelectedCategory(''); // Não usado ativamente

      setValue("serviceId", editData.serviceId);
      setValue("serviceName", editData.serviceName);
      setValue("servicePrice", editData.servicePrice);
      setValue("local", editData.local);
      setValue("date", editData.date);
      setValue("time", editData.time);
      setValue("clientName", editData.clientName);
      setValue("clientPhone", editData.clientPhone);
      setValue("clientEmail", editData.clientEmail || "");
      setValue("isFirstTime", editData.isFirstTime);
      setValue("notes", editData.notes || "");
    }
  }, [editData, setValue, services]);

  if (waitingPayment) {
    return (
      <section id="booking" className="py-20 bg-cream">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-3xl shadow-xl p-8">
            <h2 className="font-playfair text-3xl font-bold text-charcoal mb-4">Pagamento Antecipado</h2>
            <p className="text-lg text-gray-700 mb-6">
              Para confirmar seu agendamento, realize o pagamento do adiantamento via Mercado Pago.<br />
              Após o pagamento ser aprovado, seu agendamento será confirmado automaticamente.<br />
              Você receberá uma confirmação por WhatsApp ou e-mail.
            </p>
            <div id="wallet_container" className="my-6 flex justify-center" />
            <p className="mt-6 text-sm text-gray-500">Não feche esta janela até finalizar o pagamento.</p>
             <button
                onClick={() => {
                    setWaitingPayment(false);
                    setPreferenceId(null);
                    // Considerar resetar mais estados ou levar para a tela de agendamento
                }}
                className="mt-4 px-4 py-2 bg-gray-200 text-charcoal rounded-lg hover:bg-gray-300"
            >
                Cancelar Pagamento e Voltar
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section id="booking" className="py-20 bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-playfair text-4xl font-bold text-charcoal mb-4">{isEditing ? "Editar Agendamento" : "Agende Seu Horário"}</h2>
          <p className="text-xl text-gray-600">Escolha o melhor horário para você</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <form onSubmit={handleSubmit(handleBookingSubmit)} className="space-y-8">
            {/* Localidade */}
            <div className="mt-8" id="local-escolha">
              <label className="block text-lg font-semibold text-charcoal mb-4">1. Escolha o Local</label>
              <div className="flex gap-4">
                {["campo formoso", "irece"].map((local) => (
                  <button
                    type="button"
                    key={local}
                    disabled={isEditing} // Desabilita mudança de local durante edição
                    className={`flex-1 border-2 rounded-xl p-4 text-center font-semibold transition-all ${
                      selectedLocal === local
                        ? "border-rose-primary bg-rose-primary/10 text-rose-primary"
                        : "border-gray-200 hover:border-rose-primary"
                    } ${isEditing ? "cursor-not-allowed opacity-70" : ""}`}
                    onClick={() => {
                      if(isEditing) return;
                      setSelectedLocal(local);
                      setValue("local", local, { shouldValidate: true });
                      // Limpar seleções de serviço e horário anteriores ao mudar de local
                      setSelectedServices({});
                      setSelectedService(null);
                      setValue("serviceId", 0, { shouldValidate: true });
                      setValue("serviceName", "");
                      setValue("servicePrice", 0);
                      setSelectedDate(undefined);
                      setValue("date", "", { shouldValidate: true });
                      setSelectedTime("");
                      setValue("time", "", { shouldValidate: true });
                      trigger(["local", "serviceId", "date", "time"]);

                      setTimeout(() => {
                        const el = document.getElementById('servico-combobox');
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }, 100);
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
            {selectedLocal && (servicesLoading ? (
              <div className="grid md:grid-cols-3 gap-4 mb-8 animate-pulse">
                {[1, 2, 3].map((i) => ( <div key={i} className="bg-gray-200 h-24 rounded-xl"></div> ))}
              </div>
            ) : groupedServices && Object.keys(groupedServices).length > 0 ? (
              <div className="mt-8" id="servico-combobox">
                <label className="block text-lg font-semibold text-charcoal mb-4">2. Selecione o(s) Serviço(s) <span className="text-sm font-normal">(até 3)</span></label>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.keys(groupedServices).map((category) => (
                    <div key={category} className="flex flex-col">
                      <span className="font-semibold mb-2 text-base">{category.charAt(0).toUpperCase() + category.slice(1)}</span>
                      <select
                        className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-rose-primary transition-colors"
                        value={selectedServices[category]?.id || ''}
                        onChange={e => {
                          const id = Number(e.target.value);
                          const totalSelected = Object.values(selectedServices).filter(s => s && s.category !== category).length;

                          if (id && totalSelected >= 2 && !selectedServices[category]) { // Verifica se já tem 2 de OUTRAS categorias e está tentando adicionar um NOVO
                              toast({ title: "Limite de serviços", description: "Você pode selecionar no máximo 3 serviços no total.", variant: "default"});
                              e.target.value = selectedServices[category]?.id || ''; // Reverte a seleção
                              return;
                          }
                          if (id && Object.values(selectedServices).filter(Boolean).length >=3 && !selectedServices[category]) {
                              toast({ title: "Limite de serviços", description: "Você pode selecionar no máximo 3 serviços no total.", variant: "default"});
                              e.target.value = selectedServices[category]?.id || ''; // Reverte a seleção
                              return;
                          }

                          const service = groupedServices?.[category]?.find(s => s.id === id);
                          handleServiceSelect(service || null, category);

                          // Auto-scroll
                          setTimeout(() => {
                            const allCombos = Array.from(document.querySelectorAll('#servico-combobox select')) as HTMLSelectElement[];
                            const currentIdx = allCombos.findIndex(sel => sel === e.target);
                            if (allCombos[currentIdx + 1]) {
                              allCombos[currentIdx + 1].focus();
                              allCombos[currentIdx + 1].scrollIntoView({ behavior: 'smooth', block: 'center' });
                            } else if (Object.values(selectedServices).some(s => s !== null) || (service !== null && service !== undefined) ) { // Se algo foi selecionado
                              const calendarEl = document.getElementById('calendar-booking');
                              if (calendarEl) calendarEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                          }, 100);
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
            ) : (
              <p className="mt-4 text-gray-600">Nenhum serviço disponível para este local ou categoria.</p>
            ))}


            {/* Calendar */}
            {selectedLocal && Object.values(selectedServices).filter(Boolean).length > 0 && (
              <div id="calendar-booking" className="mt-8">
                <label className="block text-lg font-semibold text-charcoal mb-4">3. Escolha a Data</label>
                <div className="bg-warm-gray rounded-xl p-6 flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={date => {
                      handleDateSelect(date);
                      if (date) {
                        setTimeout(() => {
                          const el = document.getElementById('horario-disponivel');
                          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }
                    }}
                    disabled={disabledDays}
                    fromDate={new Date()}
                    toDate={addDays(new Date(), 60)}
                    className="rounded-md"
                  />
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
                {Object.values(selectedServices).filter(Boolean).length > 1 && (
                  <div className="mb-4 p-3 rounded-xl bg-yellow-100 text-yellow-800 border border-yellow-300 text-sm">
                    Você selecionou múltiplos serviços. O sistema tentará alocar tempo consecutivo.
                    A duração exata será confirmada após o agendamento.
                  </div>
                )}
                {timesLoading ? (
                  <div className="animate-pulse grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {[1,2,3,4].map(i => <div key={i} className="h-12 bg-gray-200 rounded-xl"></div>)}
                  </div>
                ) : availableTimes && availableTimes.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {availableTimes?.map((timeSlot: string, idx: number) => {
                      // A lógica de requiredSlots e isAvailable pode ser complexa e depender da API de available-times.
                      // Simplificando: por agora, todos os horários retornados são considerados selecionáveis individualmente.
                      // A lógica de múltiplos slots precisaria de mais informações sobre como a API funciona.
                      const isSelected = selectedTime === timeSlot;
                      return (
                        <button
                          key={idx}
                          onClick={() => handleTimeSelect(timeSlot)}
                          className={`w-full py-3 px-2 rounded-xl font-semibold transition-all flex items-center justify-center text-sm 
                            ${isSelected ? "bg-rose-primary text-white shadow-md" : "bg-gray-100 text-charcoal hover:bg-gray-200"}`}
                          type="button"
                        >
                          {timeSlot}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                    <p className="text-gray-600 text-center py-4">Nenhum horário disponível para esta data. Por favor, selecione outra data.</p>
                )}
                {errors.time && <p className="mt-2 text-red-500 text-sm">{errors.time.message}</p>}
              </div>
            )}

            {/* Dados do Cliente */}
            {selectedLocal && Object.values(selectedServices).filter(Boolean).length > 0 && selectedDate && selectedTime && (
              <div className="mt-8" id="dados-cliente">
                <label className="block text-lg font-semibold text-charcoal mb-4">5. Seus Dados</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="clientName" className="block text-sm font-medium text-charcoal mb-1">Nome Completo <span className="text-red-500">*</span></label>
                    <input id="clientName" type="text" {...register("clientName")}
                      className={`w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-primary focus:border-rose-primary transition-colors ${errors.clientName ? "border-red-500 ring-red-500" : ""}`}
                      placeholder="Seu nome completo" />
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
                    <label htmlFor="clientEmail" className="block text-sm font-medium text-charcoal mb-1">Email <span className="text-gray-400 text-xs">(opcional, para confirmação)</span></label>
                    <input id="clientEmail" type="email" {...register("clientEmail")}
                      className={`w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-primary focus:border-rose-primary transition-colors ${errors.clientEmail ? "border-red-500 ring-red-500" : ""}`}
                      placeholder="seu@email.com" />
                    {errors.clientEmail && <p className="mt-1 text-red-500 text-xs">{errors.clientEmail.message}</p>}
                  </div>
                  <div className="flex items-center md:col-span-2">
                    <input id="isFirstTime" type="checkbox" {...register("isFirstTime")}
                      className="h-4 w-4 text-rose-primary border-gray-300 rounded focus:ring-rose-primary" />
                    <label htmlFor="isFirstTime" className="ml-2 block text-sm text-charcoal">É sua primeira vez conosco?</label>
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
                        {hasCiliosIrece ? (
                            <>
                            R$ {(totalPrice / 100).toFixed(2).replace('.', ',')}
                            <span className="text-xs block">(Será cobrado um adiantamento de R$ 30,00. Restante de R$ {((totalPrice - 3000) / 100).toFixed(2).replace('.', ',')} a pagar no local)</span>
                            </>
                        ) : (
                            `R$ ${(totalPrice / 100).toFixed(2).replace('.', ',')}`
                        )}
                    </p>
                    {hasCiliosIrece && (
                      <div className="!mt-4 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs flex items-start gap-2">
                        <QuestionMarkIcon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <span>Para serviços de Cílios em Irecê, é necessário um adiantamento de <b>R$ 30,00</b> via Mercado Pago. Este valor será descontado do total no dia do atendimento. O agendamento só é confirmado após a aprovação do pagamento.</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-10">
                  <button type="submit"
                    className="w-full py-4 bg-rose-primary text-white rounded-xl font-semibold text-lg transition-all hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-primary focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed"
                    disabled={createAppointmentMutation.isPending || editAppointmentMutation.isPending || Object.keys(errors).length > 0 || Object.values(selectedServices).filter(Boolean).length === 0}>
                    {createAppointmentMutation.isPending || editAppointmentMutation.isPending ? "Processando..." : (isEditing ? "Atualizar Agendamento" : "Confirmar Agendamento")}
                  </button>
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
      </div>
    </section>
  );
}