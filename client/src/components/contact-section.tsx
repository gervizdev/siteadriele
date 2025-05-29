import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Phone, Mail, Instagram, Facebook, MessageCircle, Star } from "lucide-react";

const contactSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().min(8, "Telefone inválido").optional().or(z.literal("")),
  message: z.string().min(10, "Mensagem deve ter pelo menos 10 caracteres"),
  rating: z.number().min(1, "Dê uma nota").max(5, "Nota máxima é 5"),
}).refine((data) => data.email || data.phone, {
  message: "Preencha email ou telefone",
  path: ["email"],
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function ContactSection() {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return apiRequest("POST", "/api/contact", data);
    },
    onSuccess: () => {
      toast({
        title: "Avaliação enviada!",
        description: "Sua Avaliação foi enviada com sucesso. Muito Obrigado por compartilhar sua experiencia.",
      });
      reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar avaliação",
        description: error.message || "Ocorreu um erro ao enviar sua avaliação.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    if (!data.email && !data.phone) {
      toast({ title: "Preencha email ou telefone", variant: "destructive" });
      return;
    }
    sendMessageMutation.mutate(data);
  };

  // Atualize o rating no form ao clicar
  const handleStarClick = (value: number) => {
    setRating(value);
    setValue("rating", value, { shouldValidate: true });
  };

  return (
    <section id="contact" className="py-20 bg-charcoal text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12">
          <div>
            <h2 className="font-playfair text-4xl font-bold mb-8">Entre em Contato</h2>
            <div className="space-y-6">
              <div className="flex items-center space-x-4">
                <div className="bg-rose-primary p-3 rounded-full">
                  <MapPin className="text-white h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">Endereço Irecê</p>
                  <p className="text-gray-300">
                    Avenida Primeiro de Janeiro, nº 839<br />
                    Apartamento <br />
                    Em frente à Cuscuzeira Maria Bonita<br />
                    Ao lado do Posto KF<br />
                    
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-rose-primary p-3 rounded-full">
                  <MapPin className="text-white h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">Endereço Campo Formoso</p>
                  <p className="text-gray-300">
                    Travessa Rui Bacelar, nº 35<br />
                    Casa<br />
                    Portão marrom e cerâmica na frente
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-rose-gold p-3 rounded-full">
                  <Phone className="text-white h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">Telefone</p>
                  <p className="text-gray-300">(74) 98811-7722</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-gold p-3 rounded-full">
                  <Mail className="text-white h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">Email</p>
                  <p className="text-gray-300">adriele.martins213@gmail.com</p>
                </div>
              </div>
            </div>
            
            <div className="mt-8">
              <p className="font-semibold mb-4">Siga-nos nas redes sociais</p>
              <div className="flex space-x-4">
                <a 
                  href="https://www.instagram.com/adrielemartins_lash?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" 
                  className="bg-rose-primary p-3 rounded-full hover:bg-rose-gold transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="text-white h-6 w-6" />
                </a>
                <a 
                  href="https://wa.me/5574988117722" 
                  className="bg-rose-primary p-3 rounded-full hover:bg-rose-gold transition-colors"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="text-white h-6 w-6" />
                </a>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
            <h3 className="font-playfair text-2xl font-bold mb-6">Envie uma Avaliação</h3>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <input 
                  type="text" 
                  {...register("name")}
                  placeholder="Seu nome" 
                  className="w-full p-4 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:border-rose-primary"
                />
                {errors.name && (
                  <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>
                )}
              </div>
              <div>
                <input 
                  type="email" 
                  {...register("email")}
                  placeholder="Seu email" 
                  className="w-full p-4 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:border-rose-primary"
                />
                {errors.email && (
                  <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>
                )}
              </div>
              <div>
                <input 
                  type="tel" 
                  {...register("phone")}
                  placeholder="Seu telefone" 
                  className="w-full p-4 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:border-rose-primary"
                />
                {errors.phone && (
                  <p className="text-red-400 text-sm mt-1">{errors.phone.message}</p>
                )}
              </div>
              <div>
                <textarea 
                  rows={4} 
                  {...register("message")}
                  placeholder="Sua mensagem" 
                  className="w-full p-4 bg-white/20 border border-white/30 rounded-xl text-white placeholder-white/70 focus:outline-none focus:border-rose-primary resize-none"
                />
                {errors.message && (
                  <p className="text-red-400 text-sm mt-1">{errors.message.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-charcoal mb-2">Sua nota</label>
                <div className="flex items-center space-x-1 mb-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => handleStarClick(star)}
                      className="focus:outline-none"
                      tabIndex={-1}
                    >
                      <Star
                        className={`h-7 w-7 transition-colors ${
                          rating >= star ? "text-gold fill-gold" : "text-gray-400"
                        }`}
                        fill={rating >= star ? "currentColor" : "none"}
                      />
                    </button>
                  ))}
                </div>
                <input type="hidden" {...register("rating", { valueAsNumber: true })} />
                {errors.rating && (
                  <p className="text-red-400 text-sm mt-1">{errors.rating.message}</p>
                )}
              </div>
              <button 
                type="submit" 
                disabled={sendMessageMutation.isPending}
                className="w-full bg-rose-primary text-white py-4 rounded-xl font-semibold hover:bg-rose-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendMessageMutation.isPending ? "Enviando..." : "Enviar Avaliação"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
