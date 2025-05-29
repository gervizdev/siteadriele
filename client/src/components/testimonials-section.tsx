import { Star, Mail, Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function TestimonialsSection() {
  const { data: testimonials, isLoading, isError } = useQuery({
    queryKey: ["testimonials"],
    queryFn: () => apiRequest("GET", "/api/testimonials"),
  });

  // Garante que sempre será um array
  const testimonialsArray = Array.isArray(testimonials) ? testimonials : [];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-playfair text-4xl font-bold text-charcoal mb-4">
            O Que Nossas Clientes Dizem
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {isLoading && <p>Carregando depoimentos...</p>}
          {isError && (
            <p className="text-red-600">Erro ao carregar depoimentos.</p>
          )}
          {!isLoading && testimonialsArray.length === 0 && (
            <p>Nenhum depoimento ainda.</p>
          )}
          {testimonialsArray.map((testimonial: any) => (
            <div
              key={testimonial.id}
              className="bg-warm-gray p-8 rounded-2xl"
            >
              <div className="flex items-center mb-4">
                <div className="flex text-gold">
                  {[...Array(testimonial.rating || 5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5" fill="currentColor" />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 mb-6 italic">
                "{testimonial.message}"
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-rose-primary rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold">
                    {testimonial.name?.[0]?.toUpperCase() || "?"}
                  </span>
                </div>
                <div className="ml-4">
                  <p className="font-semibold text-charcoal">
                    {testimonial.name}
                  </p>
                  <div className="flex flex-col md:flex-row md:items-center md:space-x-4 text-gray-600 text-sm mt-2">
                    {testimonial.email && (
                      <span className="flex items-center mr-2">
                        <Mail className="w-4 h-4 mr-1" />
                        {testimonial.email}
                      </span>
                    )}
                    {testimonial.phone && (
                      <span className="flex items-center">
                        <Phone className="w-4 h-4 mr-1" />
                        {testimonial.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
