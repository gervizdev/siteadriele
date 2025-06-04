import { useEffect } from "react";
import { useLocation } from "wouter";

export default function PaymentSuccess() {
  // Limpa dados de agendamento do sessionStorage
  useEffect(() => {
    sessionStorage.removeItem("bookingData");
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-4">
      <h1 className="text-3xl font-bold text-green-700 mb-4">Pagamento aprovado!</h1>
      <p className="text-lg text-gray-700 mb-6">Seu pagamento foi confirmado com sucesso. Seu agendamento está garantido.</p>
      <a href="/meus-agendamentos" className="px-6 py-2 bg-deep-rose text-white rounded shadow hover:bg-rose-700 transition">Ver meus agendamentos</a>
    </div>
  );
}
