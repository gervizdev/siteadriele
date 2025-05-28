import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { MapPin, Phone, Mail, Clock, Instagram, Facebook, MessageCircle } from "lucide-react";

const contactSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  message: z.string().min(10, "Mensagem deve ter pelo menos 10 caracteres"),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function ContactSection() {
  const { toast } = useToast();
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      return apiRequest("POST", "/api/contact", data);
    },
    onSuccess: () => {
      toast({
        title: "Mensagem enviada!",
        description: "Sua mensagem foi enviada com sucesso. Responderemos em breve.",
      });
      reset();
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Ocorreu um erro ao enviar sua mensagem.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    sendMessageMutation.mutate(data);
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
                  <p className="font-semibold">Endereço</p>
                  <p className="text-gray-300">Rua das Flores, 123 - Vila Madalena, São Paulo</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-rose-gold p-3 rounded-full">
                  <Phone className="text-white h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">Telefone</p>
                  <p className="text-gray-300">(11) 99999-9999</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-gold p-3 rounded-full">
                  <Mail className="text-white h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">Email</p>
                  <p className="text-gray-300">contato@bellalashes.com</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="bg-deep-rose p-3 rounded-full">
                  <Clock className="text-white h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">Horário de Funcionamento</p>
                  <p className="text-gray-300">Seg-Sex: 9h às 18h | Sáb: 9h às 16h</p>
                </div>
              </div>
            </div>
            
            <div className="mt-8">
              <p className="font-semibold mb-4">Siga-nos nas redes sociais</p>
              <div className="flex space-x-4">
                <a 
                  href="#" 
                  className="bg-rose-primary p-3 rounded-full hover:bg-rose-gold transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="text-white h-6 w-6" />
                </a>
                <a 
                  href="#" 
                  className="bg-rose-primary p-3 rounded-full hover:bg-rose-gold transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="text-white h-6 w-6" />
                </a>
                <a 
                  href="#" 
                  className="bg-rose-primary p-3 rounded-full hover:bg-rose-gold transition-colors"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="text-white h-6 w-6" />
                </a>
              </div>
            </div>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
            <h3 className="font-playfair text-2xl font-bold mb-6">Envie uma Mensagem</h3>
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
              <button 
                type="submit" 
                disabled={sendMessageMutation.isPending}
                className="w-full bg-rose-primary text-white py-4 rounded-xl font-semibold hover:bg-rose-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendMessageMutation.isPending ? "Enviando..." : "Enviar Mensagem"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
