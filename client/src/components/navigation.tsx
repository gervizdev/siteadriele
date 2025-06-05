import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useLocation } from "wouter";

export default function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [, navigate] = useLocation(); // Corrigido: usar navigate

  // Função para scroll ou navegação SPA inteligente
  const goToSection = (sectionId: string) => {
    if (window.location.pathname === "/") {
      // Se já está na home, faz scroll normalmente
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
      setIsMobileMenuOpen(false);
    } else {
      // Se não está na home, navega para home SPA e salva seção no sessionStorage
      sessionStorage.setItem("scrollToSection", sectionId);
      setIsMobileMenuOpen(false);
      navigate("/"); // SPA
    }
  };

  // Detecta carregamento da home e faz scroll se necessário
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      const section = sessionStorage.getItem("scrollToSection");
      if (section && window.location.pathname === "/") {
        const el = document.getElementById(section);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          sessionStorage.removeItem("scrollToSection");
        }
      }
    }, 900); // delay aumentado para garantir carregamento
  }

  return (
    <nav className="bg-white shadow-sm fixed w-full z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="font-playfair text-2xl font-bold text-deep-rose">Adriele Martins Lash</h1>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-8">
              <button 
                onClick={() => goToSection('home')}
                className="text-charcoal hover:text-deep-rose transition-colors"
              >
                Início
              </button>
              <button 
                onClick={() => goToSection('services')}
                className="text-charcoal hover:text-deep-rose transition-colors"
              >
                Serviços
              </button>
              <button 
                onClick={() => goToSection('booking')}
                className="text-charcoal hover:text-deep-rose transition-colors"
              >
                Agendamento
              </button>
              <a
                href="/meus-agendamentos"
                className="text-charcoal hover:text-deep-rose transition-colors"
              >
                Meus Agendamentos
              </a>
              <button 
                onClick={() => goToSection('contact')}
                className="text-charcoal hover:text-deep-rose transition-colors"
              >
                Contato
              </button>
              <a
                href="/admin"
                className="text-charcoal hover:text-deep-rose transition-colors font-semibold"
              >
                Painel Administrativo
              </a>
              <a
                href="https://wa.me/5574988117722?text=Ol%C3%A1%2C%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20os%20servi%C3%A7os."
                target="_blank"
                rel="noopener noreferrer"
                className="bg-rose-primary text-white px-4 py-2 rounded-full font-semibold shadow hover:bg-rose-gold transition-colors"
                style={{ marginLeft: 12 }}
              >
                Dúvidas? WhatsApp
              </a>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-charcoal hover:text-deep-rose"
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t">
              <button 
                onClick={() => goToSection('home')}
                className="block w-full text-left px-3 py-2 text-charcoal hover:text-deep-rose transition-colors"
              >
                Início
              </button>
              <button 
                onClick={() => goToSection('services')}
                className="block w-full text-left px-3 py-2 text-charcoal hover:text-deep-rose transition-colors"
              >
                Serviços
              </button>
              <button 
                onClick={() => goToSection('booking')}
                className="block w-full text-left px-3 py-2 text-charcoal hover:text-deep-rose transition-colors"
              >
                Agendamento
              </button>
              <a
                href="/meus-agendamentos"
                className="block w-full text-left px-3 py-2 text-charcoal hover:text-deep-rose transition-colors"
              >
                Meus Agendamentos
              </a>
              <button 
                onClick={() => goToSection('contact')}
                className="block w-full text-left px-3 py-2 text-charcoal hover:text-deep-rose transition-colors"
              >
                Contato
              </button>
              <a
                href="/admin"
                className="block w-full text-left px-3 py-2 text-charcoal hover:text-deep-rose transition-colors font-semibold"
              >
                Painel Administrativo
              </a>
              <a
                href="https://wa.me/5574988117722?text=Ol%C3%A1%2C%20gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20os%20servi%C3%A7os."
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center mt-2 bg-rose-primary text-white px-4 py-2 rounded-full font-semibold shadow hover:bg-rose-gold transition-colors"
              >
                Dúvidas? WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
