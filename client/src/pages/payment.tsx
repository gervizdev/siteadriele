import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { QuestionMarkIcon } from "../components/ui/question-mark-icon";

export default function PaymentPage() {
  const [location, setLocation] = useLocation();
  const [waitingPayment, setWaitingPayment] = useState(true);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  // bookingData agora vem do sessionStorage
  const [bookingData, setBookingData] = useState<any>(() => {
    try {
      const data = sessionStorage.getItem("bookingData");
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  });
  const totalPrice = bookingData?.servicePrice || 0;
  const hasCiliosIrece = bookingData?.local?.toLowerCase() === "irece" && bookingData?.serviceName?.toLowerCase().includes("cílios");

  useEffect(() => {
    if (!bookingData) {
      setLocation("/", { replace: true });
      return;
    }
    // Chama backend para criar preferência Mercado Pago
    fetch("/api/pagamento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `Adiantamento Agendamento: ${bookingData.serviceName}`,
        price: 3000,
        quantity: 1,
        payer: {
          name: bookingData.clientName,
          email: bookingData.clientEmail,
        },
        bookingData,
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Erro ao criar preferência de pagamento");
        return res.json();
      })
      .then((data) => {
        setPreferenceId(data.preference_id);
        setWaitingPayment(true);
      })
      .catch(() => {
        alert("Erro ao iniciar pagamento. Tente novamente.");
        setLocation("/", { replace: true });
      });
  }, [bookingData, setLocation]);

  useEffect(() => {
    if (waitingPayment && preferenceId && (window as any).MercadoPago) {
      const mpPublicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || (window as any).MERCADOPAGO_PUBLIC_KEY;
      const mp = new (window as any).MercadoPago(mpPublicKey, { locale: "pt-BR" });
      const bricksBuilder = mp.bricks();
      const walletContainerElement = document.getElementById("wallet_container");
      if (!walletContainerElement) return;
      bricksBuilder.create("wallet", "wallet_container", {
        initialization: { preferenceId },
        callbacks: {
          onReady: () => {},
          onError: () => {
            setWaitingPayment(false);
            setPreferenceId(null);
          },
        },
      });
    }
  }, [waitingPayment, preferenceId]);

  if (!bookingData) return null;

  return (
    <section className="py-20 bg-cream min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="bg-white rounded-3xl shadow-xl p-8 flex flex-col justify-center" style={{ minHeight: '700px' }}>
          <h2 className="font-playfair text-3xl font-bold text-charcoal mb-4">Resumo do Agendamento</h2>
          <div className="mb-6 text-left mx-auto max-w-md">
            <p className="mb-2"><b>Serviços:</b> {bookingData.serviceName}</p>
            <p className="mb-2"><b>Local:</b> {bookingData.local?.charAt(0).toUpperCase() + bookingData.local?.slice(1)}</p>
            <p className="mb-2"><b>Data:</b> {bookingData.date ? format(new Date(bookingData.date), "dd/MM/yyyy") : ""}</p>
            <p className="mb-2"><b>Horário:</b> {bookingData.time}</p>
            <p className="mb-2"><b>Cliente:</b> {bookingData.clientName} ({bookingData.clientEmail})</p>
            <p className="mb-2"><b>Preço Total:</b> R$ {(totalPrice / 100).toFixed(2).replace('.', ',')}</p>
            {hasCiliosIrece && (
              <div className="mt-2 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs">
                Para serviços de Cílios em Irecê, é necessário um adiantamento de <b>R$ 30,00</b>. O restante será pago no local.
              </div>
            )}
          </div>
          <div>
            <div id="wallet_container" className="my-6 flex justify-center" />
            <p className="mt-6 text-sm text-gray-500">Não feche esta janela até finalizar o pagamento.</p>
          </div>
          <button
            onClick={() => setLocation("/")}
            className="mt-2 px-4 py-2 bg-gray-200 text-charcoal rounded-lg hover:bg-gray-300"
          >
            Voltar
          </button>
        </div>
      </div>
    </section>
  );
}
