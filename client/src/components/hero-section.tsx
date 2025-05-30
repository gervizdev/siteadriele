import { Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import heroImg from "./icons/hero.jpeg"; 

export default function HeroSection() {
  const scrollToBooking = () => {
    const element = document.getElementById('booking');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Busca depoimentos reais
  const { data: testimonials, isLoading } = useQuery({
    queryKey: ["testimonials"],
    queryFn: () => apiRequest("GET", "/api/testimonials"),
  });

  // Calcula a média das notas
  const testimonialsArray = Array.isArray(testimonials) ? testimonials : [];
  const totalRatings = testimonialsArray.reduce((sum, t) => sum + (t.rating || 0), 0);
  const avgRating = testimonialsArray.length > 0 ? (totalRatings / testimonialsArray.length) : 0;
  const avgRatingDisplay = avgRating > 0 ? avgRating.toFixed(1).replace('.', ',') : "—";

  return (
    <section id="home" className="pt-16 bg-gradient-to-br from-rose-primary to-rose-gold">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <h1 className="font-playfair text-5xl lg:text-6xl font-bold text-deep-rose leading-tight">
              Cílios Perfeitos
              <span className="block text-gold">Para Você</span>
            </h1>
            <p className="text-xl text-charcoal leading-relaxed">
              Transforme seu olhar com nossas extensões de cílios premium. 
              Técnicas avançadas, produtos de alta qualidade e resultado natural.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button 
                onClick={scrollToBooking}
                className="bg-white text-deep-rose px-8 py-4 rounded-full font-semibold hover:shadow-lg transition-all transform hover:scale-105"
              >
                Agendar Agora
              </button>
              <button
                onClick={() => {
                  const element = document.getElementById('about');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                className="border-2 border-white text-deep-rose px-8 py-4 rounded-full font-semibold hover:bg-white hover:text-deep-rose transition-all"
              >
                Ver Portfolio
              </button>
            </div>
          </div>
          <div className="relative">
            <img 
              src={heroImg}
              alt="Extensão de cílios profissional" 
              className="rounded-2xl shadow-2xl w-full h-auto"
            />
            <div
              className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-lg cursor-pointer hover:shadow-2xl transition"
              onClick={() => {
                const element = document.getElementById('contact');
                if (element) {
                  // Detecta se é mobile (largura até 768px)
                  const isMobile = window.innerWidth <= 768;
                  const offset = isMobile ? 550 : 0;
                  const y = element.getBoundingClientRect().top + window.scrollY + offset;
                  window.scrollTo({ top: y, behavior: 'smooth' });
                }
              }}
              title="Clique para deixar sua avaliação"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-rose-primary p-3 rounded-full">
                  <Star className="text-white h-6 w-6" fill="currentColor" />
                </div>
                <div>
                  <p className="font-semibold text-charcoal">
                    {isLoading ? "Carregando..." : `${avgRatingDisplay}/5 Avaliação`}
                  </p>
                  <p className="text-sm text-gray-600">
                    {testimonialsArray.length > 0
                      ? `${testimonialsArray.length}+ clientes satisfeitas`
                      : "Seja a primeira a avaliar!"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
