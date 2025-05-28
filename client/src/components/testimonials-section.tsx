import { Star } from "lucide-react";

const testimonials = [
  {
    id: 1,
    name: "Mariana Silva",
    role: "Cliente há 6 meses",
    content: "Simplesmente perfeito! Os cílios ficaram naturais e duradouros. Recomendo demais!",
    initial: "M",
    color: "bg-rose-primary",
  },
  {
    id: 2,
    name: "Ana Costa", 
    role: "Cliente há 1 ano",
    content: "Profissional incrível! Ambiente aconchegante e resultado maravilhoso.",
    initial: "A",
    color: "bg-rose-gold",
  },
  {
    id: 3,
    name: "Julia Santos",
    role: "Cliente há 8 meses", 
    content: "Melhor investimento que fiz! Acordo linda todos os dias.",
    initial: "J",
    color: "bg-gold",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-playfair text-4xl font-bold text-charcoal mb-4">O Que Nossas Clientes Dizem</h2>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <div key={testimonial.id} className="bg-warm-gray p-8 rounded-2xl">
              <div className="flex items-center mb-4">
                <div className="flex text-gold">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-5 w-5" fill="currentColor" />
                  ))}
                </div>
              </div>
              <p className="text-gray-600 mb-6 italic">"{testimonial.content}"</p>
              <div className="flex items-center">
                <div className={`w-12 h-12 ${testimonial.color} rounded-full flex items-center justify-center`}>
                  <span className="text-white font-semibold">{testimonial.initial}</span>
                </div>
                <div className="ml-4">
                  <p className="font-semibold text-charcoal">{testimonial.name}</p>
                  <p className="text-sm text-gray-600">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
