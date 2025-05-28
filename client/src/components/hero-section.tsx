import { Star } from "lucide-react";

export default function HeroSection() {
  const scrollToBooking = () => {
    const element = document.getElementById('booking');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="home" className="pt-16 bg-gradient-to-br from-rose-primary to-rose-gold">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <h1 className="font-playfair text-5xl lg:text-6xl font-bold text-white leading-tight">
              Cílios Perfeitos
              <span className="block text-gold">Para Você</span>
            </h1>
            <p className="text-xl text-white/90 leading-relaxed">
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
              <button className="border-2 border-white text-white px-8 py-4 rounded-full font-semibold hover:bg-white hover:text-deep-rose transition-all">
                Ver Portfolio
              </button>
            </div>
          </div>
          <div className="relative">
            <img 
              src="https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=600" 
              alt="Extensão de cílios profissional" 
              className="rounded-2xl shadow-2xl w-full h-auto"
            />
            <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center space-x-3">
                <div className="bg-rose-primary p-3 rounded-full">
                  <Star className="text-white h-6 w-6" fill="currentColor" />
                </div>
                <div>
                  <p className="font-semibold text-charcoal">4.9/5 Avaliação</p>
                  <p className="text-sm text-gray-600">200+ clientes satisfeitas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
