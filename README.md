# 💅 Adriele Lash - Sistema de Agendamento Online

Sistema de agendamento para estúdio de estética com pagamento via **PIX (Mercado Pago)** e notificações via **Telegram**.

🔗 **Em produção:** [adrielelash-site.fly.dev](https://adrielelash-site.fly.dev)

---

## Funcionalidades

**Cliente:** Agendamento online • Pagamento PIX • Consulta de agendamentos

**Admin:** Dashboard • Gestão de horários • Relatórios PDF/Excel • Bot Telegram • Controle de presença

---

## Stack

| Frontend | Backend | Infra |
|----------|---------|-------|
| React 18 + TypeScript | Express.js + TypeScript | Fly.io |
| Vite | Drizzle ORM | GitHub Actions |
| Tailwind CSS | PostgreSQL (Neon) | Docker |
| Radix UI | Mercado Pago SDK | |

---

## Executar localmente

```bash
git clone https://github.com/gervizdev/siteadriele.git
cd siteadriele
npm install
cp .env.example .env  # Configure suas credenciais
npm run db:push
npm run dev
```

---

## Autor

**Guilherme Gerviz** - [GitHub](https://github.com/gervizdev)

## Licença

MIT
