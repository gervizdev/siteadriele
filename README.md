# 💅 Adriele Lash - Sistema de Agendamento Online

Sistema de agendamento para estúdio de estética com pagamento via **PIX 
Secret details
Secret validity

Valid
Connection_uri

postgresql://postgres.xusepsmhmytfnwmbvplc:WgfYshOS7GVia3rp@aws-0-sa-east-1.pooler.supabase.com:6543/postgres


Scheme

postgresql


Username

postgres.xusepsmhmytfnwmbvplc


Password

WgfYshOS7GVia3rp


Host

aws-0-sa-east-1.pooler.supabase.com


Port

6543


Database

postgres


Secret analyzer
gervizdev/adrieleLash.Site

4b665d4
.env
@@ -0,0 +1 @@
DATABASE_URL=postgresql://postgres.xusepsmhmytfnwmbvplc:WgfYshOS7GVia3rp@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
 No newline at end of file(Mercado Pago)** e notificações via **Telegram**.

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
