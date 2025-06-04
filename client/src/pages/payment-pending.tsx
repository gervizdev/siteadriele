export default function PaymentPending() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-4">
      <h1 className="text-3xl font-bold text-yellow-700 mb-4">Pagamento pendente</h1>
      <p className="text-lg text-gray-700 mb-6">Seu pagamento está em análise ou aguardando confirmação. Assim que for aprovado, seu agendamento estará garantido.</p>
      <a href="/meus-agendamentos" className="px-6 py-2 bg-deep-rose text-white rounded shadow hover:bg-rose-700 transition">Ver meus agendamentos</a>
      <a href="/" className="mt-2 text-deep-rose underline">Voltar para a página inicial</a>
    </div>
  );
}
