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

const bookingSchema = z.object({
  serviceId: z.number().min(1, "Por favor, selecione um serviço"),
  serviceName: z.string().min(1),
  servicePrice: z.number().min(1),
  local: z.string().min(1, "Por favor, selecione o local"), // <-- adicionado
  date: z.string().min(1, "Por favor, selecione uma data"),
  time: z.string().min(1, "Por favor, selecione um horário"),
  clientName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  clientPhone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  clientEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  isFirstTime: z.boolean(),
  notes: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

export default function BookingSection({ editData, onEditFinish }: { editData?: BookingFormData & { id: number }, onEditFinish?: () => void } = {}) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedLocal, setSelectedLocal] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(!!editData);
  const { toast } = useToast();

  const { data: services, isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  const { data: availableTimes, isLoading: timesLoading } = useQuery({
    queryKey: ["/api/available-times", selectedDate ? format(selectedDate, "yyyy-MM-dd") : null],
    queryFn: async () => {
      if (!selectedDate) return [];
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const response = await fetch(`/api/available-times/${dateStr}`);
      if (!response.ok) throw new Error('Failed to fetch available times');
      return response.json();
    },
    enabled: !!selectedDate,
  });

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      isFirstTime: true,
      notes: "",
      local: "",
    },
  });

  const createAppointmentMutation = useMutation({
    mutationFn: async (data: BookingFormData) => {
      const response = await apiRequest("POST", "/api/appointments", data);
      console.log("Resposta da API:", response);
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
      queryClient.invalidateQueries({ queryKey: ["/api/available-times"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro no agendamento",
        description: error.message || "Ocorreu um erro ao realizar o agendamento.",
        variant: "destructive",
      });
    },
  });

  // Mutation para editar agendamento
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
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao editar",
        description: error.message || "Ocorreu um erro ao editar o agendamento.",
        variant: "destructive",
      });
    },
  });

  // Função para simular pagamento Mercado Pago (substitua pelo real depois)
  async function handleMercadoPagoPayment() {
    // Aqui você integraria o checkout do Mercado Pago
    // Exemplo: abrir modal, redirecionar, etc.
    // Retorne true se pago, false se não pago
    // Exemplo fake:
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        // Simula pagamento aprovado
        resolve(true);
      }, 2000);
    });
  }

  // Handler do botão de agendamento/edição
  const handleBookingSubmit = async (data: BookingFormData) => {
    // Verifica se precisa de adiantamento
    const isAdiantamento =
      selectedService &&
      typeof selectedService.price === "number" &&
      selectedService.price > 0 &&
      selectedLocal === "irece" &&
      (selectedService.category === "cílios" || selectedService.category === "sobrancelha");

    if (isAdiantamento) {
      toast({ title: "Redirecionando para pagamento..." });
      const pago = await handleMercadoPagoPayment();
      if (!pago) {
        toast({
          title: "Pagamento não realizado",
          description: "O agendamento só será confirmado após o pagamento do adiantamento.",
          variant: "destructive",
        });
        return;
      }
    }
    // Se não precisa de adiantamento ou pagamento aprovado, agenda normalmente
    if (isEditing && editData?.id) {
      editAppointmentMutation.mutate({ ...data, id: editData.id });
      return;
    }
    onSubmit(data);
  };

  const onSubmit = (data: BookingFormData) => {
    console.log("Dados enviados:", data);
    if (!data.servicePrice || data.servicePrice <= 0) {
      toast({
        title: "Erro no serviço",
        description: "O serviço selecionado está sem preço. Escolha outro serviço.",
        variant: "destructive",
      });
      return;
    }
    createAppointmentMutation.mutate(data);
  };

  const handleServiceSelect = (service: Service) => {
    if (typeof service.price !== "number" || isNaN(service.price) || service.price <= 0) {
      toast({
        title: "Serviço inválido",
        description: "Este serviço não possui preço cadastrado. Por favor, escolha outro.",
        variant: "destructive",
      });
      setSelectedService(null);
      setValue("serviceId", 0);
      setValue("serviceName", "");
      setValue("servicePrice", 0);
      return;
    }
    setSelectedService(service);
    setValue("serviceId", service.id);
    setValue("serviceName", service.name);
    setValue("servicePrice", service.price);
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    setSelectedTime("");
    setValue("time", "");
    if (date) {
      setValue("date", format(date, "yyyy-MM-dd"));
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setValue("time", time);
  };

  // Disable dates in the past
  const disabledDays = {
    before: startOfDay(new Date()),
  };

  // Filtra apenas serviços de Irece
  const servicesIrece = services?.filter(service => 
    service.local?.toLowerCase() === "irece"
  );

  // Agrupa os serviços filtrados por categoria
  const groupedServices = servicesIrece?.reduce((acc, service) => {
    acc[service.category] = acc[service.category] || [];
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  // Preenche o formulário se for edição
  useEffect(() => {
    if (editData) {
      setIsEditing(true);
      setSelectedDate(editData.date ? new Date(editData.date) : undefined);
      setSelectedService({
        id: editData.serviceId,
        name: editData.serviceName,
        price: editData.servicePrice,
        description: '',
        category: '',
        local: '',
      });
      setSelectedTime(editData.time);
      setSelectedLocal(editData.local);
      setSelectedCategory('');
      setValue("serviceId", editData.serviceId);
      setValue("serviceName", editData.serviceName);
      setValue("servicePrice", editData.servicePrice);
      setValue("local", editData.local);
      setValue("date", editData.date);
      setValue("time", editData.time);
      setValue("clientName", editData.clientName);
      setValue("clientPhone", editData.clientPhone);
      setValue("clientEmail", editData.clientEmail);
      setValue("isFirstTime", editData.isFirstTime);
      setValue("notes", editData.notes || "");
    }
  }, [editData, setValue]);

  return (
    <section id="booking" className="py-20 bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-playfair text-4xl font-bold text-charcoal mb-4">Agende Seu Horário</h2>
          <p className="text-xl text-gray-600">Escolha o melhor horário para você</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <form onSubmit={handleSubmit(handleBookingSubmit)} className="space-y-8">
            
            {/* Categoria de Serviço */}
            <div>
              <label className="block text-lg font-semibold text-charcoal mb-4">Escolha a Categoria</label>
              {servicesLoading ? (
                <div className="grid md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border-2 border-gray-200 rounded-xl p-4 animate-pulse">
                      <div className="bg-gray-300 h-6 rounded mb-2"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {groupedServices && Object.keys(groupedServices).map((category) => (
                    <button
                      type="button"
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setSelectedService(null);
                        setValue("serviceId", 0);
                        setValue("serviceName", "");
                        setValue("servicePrice", 0);
                      }}
                      className={`border-2 rounded-xl p-4 cursor-pointer font-semibold transition-colors ${
                        selectedCategory === category
                          ? "border-rose-primary bg-rose-primary/10 text-rose-primary"
                          : "border-gray-200 hover:border-rose-primary"
                      }`}
                    >
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Serviço dentro da categoria - só aparece se uma categoria foi selecionada */}
            {selectedCategory && (
              <div className="mt-8">
                <label className="block text-lg font-semibold text-charcoal mb-4">Escolha o Serviço</label>
                <div className="grid md:grid-cols-3 gap-4">
                  {groupedServices &&
                    groupedServices[selectedCategory]?.map((service) => (
                      <div key={service.id} className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => handleServiceSelect(service)}
                          className={`border-2 rounded-xl p-4 cursor-pointer transition-colors font-semibold ${
                            selectedService?.id === service.id
                              ? "border-rose-primary bg-rose-primary/10"
                              : "border-gray-200 hover:border-rose-primary"
                          }`}
                        >
                          <div className="text-center">
                            <h4 className="font-semibold text-charcoal">{service.name}</h4>
                          </div>
                        </button>
                        {/* Slider/Accordion para descrição */}
                        <div
                          className={`overflow-hidden transition-all duration-300 ease-in-out ${
                            selectedService?.id === service.id ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0"
                          } bg-warm-gray rounded-xl text-charcoal text-center px-4`}
                        >
                          <div className="py-3">
                            <span className="font-semibold">Descrição: </span>
                            {service.description}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
                {errors.serviceId && (
                  <p className="text-red-600 text-sm mt-2">{errors.serviceId.message}</p>
                )}
              </div>
            )}

            {/* Calendar */}
            <div>
              <label className="block text-lg font-semibold text-charcoal mb-4">Escolha a Data</label>
              <div className="bg-warm-gray rounded-xl p-6 flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
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

            {/* Time Selection */}
            {selectedDate && (
              <div>
                <label className="block text-lg font-semibold text-charcoal mb-4">Horário Disponível</label>
                {timesLoading ? (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="border-2 border-gray-200 rounded-xl p-3 animate-pulse">
                        <div className="bg-gray-300 h-4 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : availableTimes && availableTimes.length > 0 ? (
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {availableTimes.map((time: string) => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => handleTimeSelect(time)}
                        className={`border-2 rounded-xl p-3 text-center transition-all ${
                          selectedTime === time
                            ? "border-rose-primary bg-rose-primary text-white"
                            : "border-gray-200 hover:border-rose-primary hover:bg-rose-primary hover:text-white"
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600">Nenhum horário disponível para esta data.</p>
                )}
                {errors.time && (
                  <p className="text-red-600 text-sm mt-2">{errors.time.message}</p>
                )}
              </div>
            )}

            {/* Local Selection */}
            <div>
              <label className="block text-lg font-semibold text-charcoal mb-4">Escolha o Local</label>
              <div className="flex gap-4">
                {["campo formoso", "irece"].map((local) => (
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

            {/* Client Information */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">Nome Completo</label>
                <input 
                  type="text" 
                  {...register("clientName")}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-rose-primary transition-colors" 
                  placeholder="Seu nome"
                />
                {errors.clientName && (
                  <p className="text-red-600 text-sm mt-1">{errors.clientName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">Telefone</label>
                <input 
                  type="tel" 
                  {...register("clientPhone")}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-rose-primary transition-colors" 
                  placeholder="(11) 99999-9999"
                />
                {errors.clientPhone && (
                  <p className="text-red-600 text-sm mt-1">{errors.clientPhone.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">
                  Email <span className="text-gray-500 font-normal">(opcional)</span>
                </label>
                <input 
                  type="email" 
                  {...register("clientEmail")}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-rose-primary transition-colors" 
                  placeholder="seu@email.com"
                />
                {errors.clientEmail && (
                  <p className="text-red-600 text-sm mt-1">{errors.clientEmail.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">Primeira vez?</label>
                <select 
                  {...register("isFirstTime")}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-rose-primary transition-colors"
                  onChange={(e) => setValue("isFirstTime", e.target.value === "true")}
                  value={watch("isFirstTime") ? "true" : "false"}
                >
                  <option value="true">Sim, primeira vez</option>
                  <option value="false">Não, já sou cliente</option>
                </select>
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <label className="block text-sm font-semibold text-charcoal mb-2">Observações (opcional)</label>
              <textarea 
                {...register("notes")}
                className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-rose-primary transition-colors" 
                rows={3} 
                placeholder="Alguma observação especial?"
              />
            </div>

            {/* Submit Button */}
            <div className="text-center">
              <button 
                type="submit" 
                disabled={createAppointmentMutation.isPending || editAppointmentMutation.isPending}
                className="bg-deep-rose text-white px-12 py-4 rounded-full text-lg font-semibold hover:bg-rose-gold transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditing
                  ? (editAppointmentMutation.isPending ? "Salvando..." : "Salvar Alterações")
                  : createAppointmentMutation.isPending
                    ? "Agendando..."
                    : selectedService && typeof selectedService.price === "number" && selectedService.price > 0 && selectedLocal === "irece" && (selectedService.category === "cílios" || selectedService.category === "sobrancelha")
                      ? `Confirmar Agendamento (Adiantamento: R$ 30,00)`
                      : selectedService && typeof selectedService.price === "number" && selectedService.price > 0
                        ? `Confirmar Agendamento (R$ ${(selectedService.price / 100).toFixed(2)})`
                        : "Confirmar Agendamento"}
              </button>
              {isEditing && (
                <button
                  type="button"
                  className="ml-4 px-8 py-4 rounded-full border border-gray-300 text-charcoal font-semibold hover:bg-gray-100 transition-all"
                  onClick={() => {
                    setIsEditing(false);
                    reset();
                    onEditFinish?.();
                  }}
                >
                  Cancelar
                </button>
              )}
              {selectedService && selectedLocal === "irece" && (selectedService.category === "cílios" || selectedService.category === "sobrancelha") && (
                <p className="text-sm text-gray-600 mt-2">Será cobrado um adiantamento de <span className="font-bold text-rose-primary">R$ 30,00</span>. O valor será descontado do total do serviço no dia do atendimento.</p>
              )}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
