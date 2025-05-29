import { useState } from "react";
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
  clientEmail: z.string().email("Email inválido"),
  isFirstTime: z.boolean(),
  notes: z.string().optional(),
});

type BookingFormData = z.infer<typeof bookingSchema>;

export default function BookingSection() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedLocal, setSelectedLocal] = useState<string>("");
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
      return apiRequest("POST", "/api/appointments", data);
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

  const onSubmit = (data: BookingFormData) => {
    createAppointmentMutation.mutate(data);
  };

  const handleServiceSelect = (service: Service) => {
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

  return (
    <section id="booking" className="py-20 bg-cream">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="font-playfair text-4xl font-bold text-charcoal mb-4">Agende Seu Horário</h2>
          <p className="text-xl text-gray-600">Escolha o melhor horário para você</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            
            {/* Service Selection */}
            <div>
              <label className="block text-lg font-semibold text-charcoal mb-4">Escolha o Serviço</label>
              {servicesLoading ? (
                <div className="grid md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="border-2 border-gray-200 rounded-xl p-4 animate-pulse">
                      <div className="bg-gray-300 h-6 rounded mb-2"></div>
                      <div className="bg-gray-300 h-4 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid md:grid-cols-3 gap-4">
                  {services?.map((service) => (
                    <div
                      key={service.id}
                      onClick={() => handleServiceSelect(service)}
                      className={`border-2 rounded-xl p-4 cursor-pointer transition-colors ${
                        selectedService?.id === service.id
                          ? "border-rose-primary bg-rose-primary/10"
                          : "border-gray-200 hover:border-rose-primary"
                      }`}
                    >
                      <div className="text-center">
                        <h4 className="font-semibold text-charcoal">{service.name}</h4>
                        <p className="text-deep-rose font-bold">R$ {(service.price / 100).toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {errors.serviceId && (
                <p className="text-red-600 text-sm mt-2">{errors.serviceId.message}</p>
              )}
            </div>

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
                <label className="block text-sm font-semibold text-charcoal mb-2">Email</label>
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
                  {...register("isFirstTime", { valueAsNumber: false })}
                  className="w-full p-4 border border-gray-200 rounded-xl focus:outline-none focus:border-rose-primary transition-colors"
                  onChange={(e) => setValue("isFirstTime", e.target.value === "true")}
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
                disabled={createAppointmentMutation.isPending}
                className="bg-deep-rose text-white px-12 py-4 rounded-full text-lg font-semibold hover:bg-rose-gold transition-all transform hover:scale-105 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createAppointmentMutation.isPending ? "Agendando..." : "Confirmar Agendamento"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
