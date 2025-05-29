import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function TestimonialsSection() {
  // Busca depoimentos reais do backend
  const { data: testimonials, isLoading } = useQuery({
    queryKey: ["testimonials"],
    queryFn: () => apiRequest("GET", "/api/testimonials"),
  });

  const testimonialsArray = Array.isArray(testimonials) ? testimonials : [];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-playfair text-4xl font-bold text-charcoal mb-4">O Que Nossas Clientes Dizem</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {isLoading && <p>Carregando depoimentos...</p>}
          {testimonialsArray.length === 0 && !isLoading && <p>Nenhum depoimento ainda.</p>}
          {testimonialsArray.map((testimonial: any) => (
            <div key={testimonial.id} className="bg-warm-gray p-8 rounded-2xl">
              <div className="flex items-center mb-4">
                <div className="flex text-gold">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5" fill="currentColor" />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 mb-6 italic">"{testimonial.message}"</p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-rose-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {testimonial.name?.[0]?.toUpperCase() || "?"}
                  </span>
                </div>
                <div className="ml-4">
                  <p className="font-semibold text-charcoal">{testimonial.name}</p>
                  {/* Se quiser, pode exibir a data ou outro campo */}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
