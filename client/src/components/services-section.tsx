import { useQuery } from "@tanstack/react-query";
import { Eye, Sparkles, Crown } from "lucide-react";
import type { Service } from "@shared/schema";
import sobrancelhaIcon from './icons/SobrancelhaIcon.svg';
import ciliosIcon from './icons/CiliosIcon.svg';
import faceIcon from './icons/FaceIcon.svg';

const serviceIcons = {
  "design de sobrancelha": sobrancelhaIcon,
  "design de cilios": ciliosIcon,
  // outros...
};

export default function ServicesSection() {
  const { data: services, isLoading, error } = useQuery<Service[]>({
    queryKey: ["/api/services"],
  });

  if (isLoading) {
    return (
      <section id="services" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="font-playfair text-4xl font-bold text-charcoal mb-4">Nossos Serviços</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Oferecemos uma variedade de técnicas para realçar sua beleza natural
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-warm-gray p-8 rounded-2xl animate-pulse">
                <div className="bg-gray-300 w-16 h-16 rounded-full mb-6"></div>
                <div className="bg-gray-300 h-6 rounded mb-4"></div>
                <div className="bg-gray-300 h-4 rounded mb-6"></div>
                <div className="flex justify-between items-center">
                  <div className="bg-gray-300 h-6 w-20 rounded"></div>
                  <div className="bg-gray-300 h-8 w-24 rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="services" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="font-playfair text-4xl font-bold text-charcoal mb-4">Nossos Serviços</h2>
            <p className="text-red-600">Erro ao carregar serviços. Tente novamente mais tarde.</p>
          </div>
        </div>
      </section>
    );
  }

  // Filtra para mostrar apenas um serviço por nome/categoria (priorizando "irece")
  const uniqueServices = services
    ? Object.values(
        services.reduce((acc, service) => {
          const key = `${service.category}-${service.name}`;
          // Prioriza o serviço de "irece", senão pega o primeiro encontrado
          if (!acc[key] || service.local === "irece") {
            acc[key] = service;
          }
          return acc;
        }, {} as Record<string, Service>)
      )
    : [];

  // Agrupa os serviços filtrados por categoria
  const groupedServices = uniqueServices.reduce((acc, service) => {
    (acc[service.category] = acc[service.category] || []).push(service);
    return acc;
  }, {} as Record<string, Service[]>);

  const scrollToBooking = () => {
    const element = document.getElementById('booking');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="services" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="font-playfair text-4xl font-bold text-charcoal mb-4">Nossos Serviços</h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Oferecemos uma variedade de técnicas para realçar sua beleza natural
          </p>
        </div>
        {Object.entries(groupedServices).map(([category, services]) => (
          <div key={category} className="mb-12">
            <h3 className="text-2xl font-bold mb-6 capitalize">{category}</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {services.map((service) => {
                let IconComponent;
                const category = service.category.toLowerCase();

                if (category in serviceIcons) {
                  IconComponent = serviceIcons[category as keyof typeof serviceIcons];
                } else if (category.includes("sobrancelha")) {
                  IconComponent = sobrancelhaIcon;
                } else if (category.includes("cílios") || category.includes("cilios")) {
                  IconComponent = ciliosIcon;
                } else if (category.includes("buço") || category.includes("buco")) {
                  IconComponent = faceIcon;
                } else {
                  IconComponent = Eye;
                }

                return (
                  <div 
                    key={service.id}
                    className="bg-warm-gray p-8 rounded-2xl hover:shadow-xl transition-all transform hover:-translate-y-2"
                  >
                    <div className="bg-rose-primary p-4 rounded-full w-16 h-16 flex items-center justify-center mb-6">
                      {typeof IconComponent === "string" ? (
                        <img src={IconComponent} alt={service.name} className="h-8 w-8" />
                      ) : (
                        <IconComponent className="h-8 w-8" />
                      )}
                    </div>
                    <h4 className="font-playfair text-xl font-semibold text-charcoal mb-4">{service.name}</h4>
                    <p className="text-gray-600 mb-2">{service.description}</p>
                    <div className="flex justify-end">
                      <button 
                        onClick={scrollToBooking}
                        className="bg-deep-rose text-white px-6 py-2 rounded-full hover:bg-rose-gold transition-colors"
                      >
                        Escolher
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
