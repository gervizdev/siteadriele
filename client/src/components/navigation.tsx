import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useLocation } from "wouter";
import { NAV_LINKS, isHomeSection } from "./navigation-links";

export default function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location, navigate] = useLocation();

  // Detecta se está na home
  const isHome = location === "/";

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  // Handler para navegação SPA ou scroll
  const handleNav = (link: typeof NAV_LINKS[number]) => {
    if (isHomeSection(link) && isHome) {
      scrollToSection(link.section!);
    } else if (isHomeSection(link)) {
      navigate("/", { replace: false });
      // Após navegação, scroll suave (delay para garantir render)
      setTimeout(() => scrollToSection(link.section!), 100);
    } else if (link.path) {
      navigate(link.path);
      setIsMobileMenuOpen(false);
    }
  };

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
              {NAV_LINKS.map((link) =>
                isHomeSection(link) ? (
                  <button
                    key={link.label}
                    onClick={() => handleNav(link)}
                    className="text-charcoal hover:text-deep-rose transition-colors"
                  >
                    {link.label}
                  </button>
                ) : (
                  <button
                    key={link.label}
                    onClick={() => handleNav(link)}
                    className={`text-charcoal hover:text-deep-rose transition-colors${link.admin ? " font-semibold" : ""}`}
                  >
                    {link.label}
                  </button>
                )
              )}
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
              {NAV_LINKS.map((link) =>
                isHomeSection(link) ? (
                  <button
                    key={link.label}
                    onClick={() => handleNav(link)}
                    className="block w-full text-left px-3 py-2 text-charcoal hover:text-deep-rose transition-colors"
                  >
                    {link.label}
                  </button>
                ) : (
                  <button
                    key={link.label}
                    onClick={() => handleNav(link)}
                    className={`block w-full text-left px-3 py-2 text-charcoal hover:text-deep-rose transition-colors${link.admin ? " font-semibold" : ""}`}
                  >
                    {link.label}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
