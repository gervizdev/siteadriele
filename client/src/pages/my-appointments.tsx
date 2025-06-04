import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import BookingSection from "../components/booking-section";
import Navigation from "../components/navigation";
import Footer from "../components/footer";
import type { Service } from "@shared/schema";

// Exemplo de tipo, ajuste conforme seu backend
interface Appointment {
  id: number;
  serviceName: string;
  local: string;
  date: string;
  time: string;
  clientName: string;
  clientEmail: string;
  status?: string;
}

export default function MyAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [, navigate] = useLocation();

  // Novo: lista de serviços
  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  // Simples filtro por e-mail (pode ser substituído por autenticação real)
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);

  useEffect(() => {
    setServicesLoading(true);
    fetch("/api/services")
      .then(res => res.json())
      .then(data => setServices(data))
      .finally(() => setServicesLoading(false));
  }, []);

  useEffect(() => {
    if (!emailSubmitted) return;
    setLoading(true);
    fetch(`/api/appointments?email=${encodeURIComponent(email)}`)
      .then(res => res.json())
      .then(data => setAppointments(data))
      .finally(() => setLoading(false));
  }, [email, emailSubmitted]);

  if (!emailSubmitted) {
    return (
      <>
        <Navigation />
        <section className="py-20 bg-cream min-h-[calc(100vh-64px-64px)] flex justify-center items-center">
          <form onSubmit={e => { e.preventDefault(); setEmailSubmitted(true); }} className="bg-white p-8 rounded-xl shadow-xl flex flex-col gap-4">
            <h2 className="text-2xl font-bold mb-2">Consultar meus agendamentos</h2>
            <input
              type="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="border rounded px-3 py-2"
              required
            />
            <button type="submit" className="bg-rose-primary hover:bg-deep-rose text-white rounded-xl px-6 py-3 font-semibold text-lg shadow transition-colors focus:outline-none focus:ring-2 focus:ring-rose-primary focus:ring-opacity-50">Consultar</button>
          </form>
        </section>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navigation />
      <section className="py-20 bg-cream min-h-screen">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-playfair text-3xl font-bold text-charcoal mb-6 text-center">Meus Agendamentos</h2>
          {editing ? (
            <div className="mb-8">
              <h3 className="font-playfair text-2xl font-bold text-charcoal mb-4 text-center">Editar Agendamento</h3>
              <BookingSection 
                editData={(() => {
                  if (!editing || servicesLoading || services.length === 0) return undefined;
                  // Busca o serviço pelo nome e local
                  const service = services.find(s => s.name === editing.serviceName && s.local === editing.local);
                  return {
                    id: editing.id,
                    serviceId: service?.id || 0,
                    serviceName: editing.serviceName,
                    servicePrice: service?.price || 0,
                    local: editing.local,
                    date: editing.date,
                    time: editing.time,
                    clientName: editing.clientName,
                    clientPhone: '', // Solicitar ao usuário se não estiver disponível
                    clientEmail: editing.clientEmail,
                    isFirstTime: false, // Valor padrão
                    notes: '', // Valor padrão
                  };
                })()}
                onEditFinish={() => { setEditing(null); setLoading(true); fetch(`/api/appointments?email=${encodeURIComponent(email)}`).then(res => res.json()).then(data => setAppointments(data)).finally(() => setLoading(false)); }} 
              />
              <button className="block mx-auto mb-4 px-6 py-3 bg-gray-200 text-charcoal rounded-xl font-semibold text-lg shadow hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-primary focus:ring-opacity-50" onClick={() => setEditing(null)}>Cancelar edição</button>
            </div>
          ) : loading ? (
            <p>Carregando...</p>
          ) : appointments.length === 0 ? (
            <p>Nenhum agendamento encontrado para este e-mail.</p>
          ) : (
            <ul className="space-y-4">
              {appointments.map(ag => (
                <li key={ag.id} className="bg-white rounded-xl shadow p-4 flex flex-col md:flex-row md:items-center md:justify-between">
                  <div>
                    <div><b>Serviço:</b> {ag.serviceName}</div>
                    <div><b>Local:</b> {ag.local}</div>
                    <div><b>Data:</b> {ag.date}</div>
                    <div><b>Horário:</b> {ag.time}</div>
                    <div><b>Status:</b> {ag.status || 'Pendente'}</div>
                  </div>
                  <button
                    className="mt-4 md:mt-0 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    onClick={() => setEditing(ag)}
                  >
                    Editar
                  </button>
                  <button
                    className="block mx-auto mt-2 text-xs px-3 py-1 rounded bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-primary focus:ring-opacity-50 italic"
                    onClick={async () => {
                      if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) return;
                      // Se for Irecê e serviço de cílios, redireciona para WhatsApp
                      const isIrece = ag.local.toLowerCase() === 'irece';
                      const isCilios = ag.serviceName.toLowerCase().includes('cílios') || ag.serviceName.toLowerCase().includes('cilios');
                      // Simulação: se status for 'Pago' ou 'Adiantamento', considera que pagou o adiantamento
                      const pagouAdiantamento = isIrece && isCilios && (ag.status?.toLowerCase().includes('pago') || ag.status?.toLowerCase().includes('adiantamento'));
                      if (pagouAdiantamento) {
                        window.open('https://wa.me/5574988117722?text=Olá! Preciso cancelar meu agendamento e já paguei o adiantamento.', '_blank');
                        return;
                      }
                      // Cancela normalmente: remove agendamento e libera horário
                      await fetch(`/api/appointments/${ag.id}`, { method: 'DELETE' });
                      // Opcional: liberar slot no backend, se necessário
                      setAppointments(appointments => appointments.filter(a => a.id !== ag.id));
                      alert('Agendamento cancelado com sucesso!');
                    }}
                  >
                    <span className="italic">Quer cancelar o agendamento?</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {/* Botões "Trocar e-mail" e "Voltar para o início" agrupados em container flex responsivo */}
          <div className="mt-8 flex flex-row flex-wrap gap-4 justify-center items-center w-full max-w-md mx-auto">
            <button className="flex-1 min-w-0 border-2 border-rose-primary text-rose-primary bg-white rounded-xl px-4 py-3 font-semibold text-base shadow hover:bg-rose-50 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-primary focus:ring-opacity-50" onClick={() => { setEmail(""); setEmailSubmitted(false); }}>Trocar e-mail</button>
            <button
              className="flex-1 min-w-0 bg-rose-primary hover:bg-deep-rose text-white rounded-xl px-4 py-3 font-semibold text-base shadow transition-colors focus:outline-none focus:ring-2 focus:ring-rose-primary focus:ring-opacity-50"
              onClick={() => navigate("/")}
            >
              Voltar para o início
            </button>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
