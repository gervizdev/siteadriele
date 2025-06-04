// Centraliza as rotas e seções para navegação SPA e scroll suave
export const NAV_LINKS = [
  { label: "Início", section: "home", path: "/" },
  { label: "Serviços", section: "services", path: "/" },
  { label: "Agendamento", section: "booking", path: "/" },
  { label: "Meus Agendamentos", path: "/meus-agendamentos" },
  { label: "Contato", section: "contact", path: "/" },
  { label: "Painel Administrativo", path: "/admin", admin: true },
];

// Helper para saber se um link é seção da home
export function isHomeSection(link: { section?: string; path: string }) {
  return link.path === "/" && !!link.section;
}
