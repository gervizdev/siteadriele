import aboutImg from "./icons/about.jpeg";

export default function AboutSection() {
  return (
    <section id="about" className="py-20 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-12">
        <div className="flex-1">
          <img
            src={aboutImg}
            alt="Foto de Adriele Martins"
            className="rounded-2xl shadow-2xl w-full max-w-xs mx-auto md:mx-0"
          />
        </div>
        <div className="flex-1 space-y-6">
          <h2 className="font-playfair text-4xl font-bold text-deep-rose mb-4">QUEM SOU EU?</h2>
          <ul className="space-y-3 text-lg text-charcoal">
            <li className="flex items-start">
              <span className="text-rose-primary font-bold mr-2 mt-1">✦</span>
              Desvendar “quem sou eu?” é uma aventura incrível e desafiadora.
            </li>
            <li className="flex items-start">
              <span className="text-rose-primary font-bold mr-2 mt-1">✦</span>
              Nossa identidade é uma mistura única de experiências, sonhos e interações que está sempre em transformação.
            </li>
            <li className="flex items-start">
              <span className="text-rose-primary font-bold mr-2 mt-1">✦</span>
              Para uma empreendedora, essa pergunta é um reflexo da beleza e da complexidade de entender nossa própria essência, enquanto navegamos pelas mudanças e expectativas que surgem no caminho.
            </li>
            <li className="flex items-start">
              <span className="text-rose-primary font-bold mr-2 mt-1">✦</span>
              Cada resposta é um passo na descoberta de quem realmente somos e uma celebração da nossa constante evolução.
            </li>
            <li className="flex items-start">
              <span className="text-rose-primary font-bold mr-2 mt-1">✦</span>
              E essa é uma pequena descrição de “quem sou eu?”
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}