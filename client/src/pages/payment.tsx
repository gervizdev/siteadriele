import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { QuestionMarkIcon } from "../components/ui/question-mark-icon";
import { useToast } from "../hooks/use-toast";

export default function PaymentPage() {
  const [location, setLocation] = useLocation();
  const [waitingPayment, setWaitingPayment] = useState(true);
  const [preferenceId, setPreferenceId] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{qr_code: string, qr_code_base64: string, payment_id: string} | null>(null);
  const [showPix, setShowPix] = useState(false);
  const [loadingPix, setLoadingPix] = useState(false);
  const pixInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast ? useToast() : { toast: (args: any) => alert(args.description) };
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

  // Calcula valor do adiantamento com taxa, se vier do backend
  const valorAdiantamentoComTaxa = bookingData?.valorAdiantamentoComTaxa;
  const valorLiquidoDesejado = bookingData?.valorLiquidoDesejado;
  const taxaCartao = bookingData?.taxaCartao;

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

  const handlePix = async () => {
    setLoadingPix(true);
    setShowPix(true);
    setPixData(null);
    try {
      // Monta explicitamente o objeto payer sem o campo phone
      const payer = {
        email: bookingData.clientEmail,
        first_name: bookingData.clientName?.split(" ")[0] || bookingData.clientName,
        last_name: bookingData.clientName?.split(" ").slice(1).join(" ") || "-",
        identification: {
          type: "CPF",
          number: bookingData.clientCPF?.replace(/\D/g, "") || bookingData.clientCpf?.replace(/\D/g, "") || bookingData.cpf?.replace(/\D/g, "") || bookingData.document?.replace(/\D/g, "") || "00000000000"
        }
      };
      const resp = await fetch("/api/pagar-pix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: 30.00,
          description: `Adiantamento Agendamento: ${bookingData.serviceName}`,
          payer, // nunca inclui phone
          bookingData // <-- envia bookingData para o backend
        })
      });
      const data = await resp.json();
      if (data.qr_code) setPixData(data);
      else alert("Erro ao gerar Pix: " + (data.error || ""));
    } catch (e) {
      alert("Erro ao gerar Pix");
    }
    setLoadingPix(false);
  };
  const handleCopyPix = () => {
    if (pixData?.qr_code && pixInputRef.current) {
      pixInputRef.current.focus();
      pixInputRef.current.select();
      try {
        const success = document.execCommand('copy');
        if (success) {
          toast({ title: "Pix copiado!", description: "Chave Pix copiada! Abra seu app bancário e cole para pagar.", variant: "success" });
        } else {
          toast({ title: "Falha ao copiar", description: "Não foi possível copiar automaticamente. Selecione e copie o código manualmente.", variant: "destructive" });
        }
      } catch {
        toast({ title: "Falha ao copiar", description: "Não foi possível copiar automaticamente. Selecione e copie o código manualmente.", variant: "destructive" });
      }
    }
  };

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
            <p className="mb-2"><b>Preço Total:</b> R$ {(totalPrice / 100).toFixed(2).replace('.', ',')} - 30,00 = {(totalPrice / 100 -30).toFixed(2).replace('.', ',')}</p>
            {hasCiliosIrece ? (
              <div className="mt-2 p-3 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 text-xs">
                Para serviços de Cílios em Irecê, é necessário um adiantamento de <b>R$ {valorAdiantamentoComTaxa ? (valorAdiantamentoComTaxa/100).toFixed(2).replace('.', ',') : '30,00'}</b> (valor já inclui a taxa do cartão, se aplicável).<br />
                <span className="block mt-1">Você receberá o desconto de R$ 30,00 no dia do atendimento. O acréscimo é referente à taxa do Mercado Pago para pagamento com cartão.</span>
              </div>
            ) : null}
          </div>
          <div className="mb-6 flex flex-col gap-2">
            <button
              onClick={handlePix}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg transition-all shadow focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-opacity-50 flex items-center justify-center gap-2"
              disabled={loadingPix}
            >
              {loadingPix ? "Gerando Pix..." : "Gerar Pix (R$ 30,00)"}
            </button>
            <button
              onClick={() => { setShowPix(false); setPixData(null); }}
              className="w-full py-3 bg-gray-200 text-charcoal rounded-xl font-bold text-lg transition-all"
              style={{ display: showPix ? undefined : "none" }}
            >Cancelar Pix</button>
            {showPix && pixData && (
              <div className="mt-4 p-4 border rounded-xl bg-green-50 flex flex-col items-center">
                <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix" className="w-40 h-40 mx-auto mb-2" />
                <input
                  ref={pixInputRef}
                  type="text"
                  value={pixData.qr_code}
                  readOnly
                  className="w-full text-center p-2 border rounded mb-2 text-sm"
                />
                <button onClick={handleCopyPix} className="px-4 py-2 bg-green-600 text-white rounded font-semibold mb-2">Copiar código Pix</button>
                <div className="text-xs text-gray-600">Abra seu app bancário, escolha Pix Copia e Cola e cole o código acima.</div>
              </div>
            )}
            {/* Preço com taxa e aviso do Brick */}
            <div className="mt-4 p-3 rounded-xl bg-yellow-50 text-yellow-800 border border-yellow-200 text-sm text-center">
              <b>Outros métodos de pagamento:</b> Cartão de crédito/débito, saldo Mercado Pago, etc.<br />
              Valor com taxa: <b>R$ 31,58</b><br />
              
              <span className="block mt-1">Clique abaixo para pagar com cartão ou outros métodos.</span>
            </div>
          </div>
          {!showPix && (
            <div>
              <div id="wallet_container" className="my-6 flex justify-center" />
              <p className="mt-6 text-sm text-gray-500">Não feche esta janela até finalizar o pagamento.</p>
            </div>
          )}
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
