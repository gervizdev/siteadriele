import { createServer, type Server } from "http";
import express, { Application, Request, Response } from "express";
import { storage } from "./storage.js";
import { insertAppointmentSchema, insertContactMessageSchema, insertAvailableSlotSchema, Appointment, insertAdminPushSubscriptionSchema } from "../shared/schema.js";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { MercadoPagoConfig, Preference } from "mercadopago"; // Importação direta do Preference para SDK v3
import fs from "fs";
import path from "path";
import { toZonedTime, format as formatTz } from "date-fns-tz";
import webpush from "web-push";
import fetch from "node-fetch";
import { gerarRelatorioMensalXLSX, gerarRelatorioAnualXLSX } from "./reports.js";
import FormData from "form-data";

// Carrega o Access Token do Mercado Pago das variáveis de ambiente
const mpAccessToken = process.env.MP_ACCESS_TOKEN;
if (!mpAccessToken) {
  console.error("FATAL ERROR: MP_ACCESS_TOKEN is not defined in environment variables.");
  // Em um cenário real, você pode querer que a aplicação não inicie ou lance um erro aqui.
  // Por agora, a aplicação continuará, mas a funcionalidade do MP falhará.
}

// Instância Mercado Pago (SDK v3.x)
const mpClient = new MercadoPagoConfig({
  accessToken: mpAccessToken || "FALLBACK_TOKEN_IF_YOU_MUST_BUT_NOT_RECOMMENDED", // Usa o token da env var
  // O fallback aqui é apenas para evitar erro de inicialização se a env var não estiver definida,
  // mas a funcionalidade do MP NÃO funcionará corretamente sem um token válido.
});

// Configuração do web-push com VAPID
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT;

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
  console.error("FATAL ERROR: VAPID keys or subject not set in environment variables.");
}

webpush.setVapidDetails(
  VAPID_SUBJECT!,
  VAPID_PUBLIC_KEY!,
  VAPID_PRIVATE_KEY!
);

// Configuração Telegram
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_IDS = process.env.TELEGRAM_CHAT_ID
  ? process.env.TELEGRAM_CHAT_ID.split(',').map(id => id.trim()).filter(Boolean)
  : [];

async function sendTelegramToAdmin(message: string) {
  console.log("[TELEGRAM] Tentando enviar mensagem para admins:", TELEGRAM_CHAT_IDS);
  if (!TELEGRAM_BOT_TOKEN || TELEGRAM_CHAT_IDS.length === 0) {
    console.error("[TELEGRAM] Token ou chat_ids não definidos");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  for (const chat_id of TELEGRAM_CHAT_IDS) {
    try {
      console.log(`[TELEGRAM] Enviando para chat_id: ${chat_id}`);
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id,
          text: message,
          parse_mode: "Markdown"
        })
      });
      const data = await resp.json();
      console.log(`[TELEGRAM] Resposta do Telegram para chat_id ${chat_id}:`, data);
    } catch (err) {
      console.error(`[TELEGRAM] Erro ao enviar mensagem para o Telegram (chat_id: ${chat_id}):`, err);
    }
  }
}

// ATENÇÃO: Tipagem 'any' para evitar conflito de sobrecarga do Express com handlers async no TypeScript
export function registerRoutes(app: any): Server {
  // Get all services
  app.get("/api/services", async (req: Request, res: Response) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  // Create new service
  app.post("/api/services", async (req: Request, res: Response) => {
    try {
      const { name, description, local, category, price } = req.body;
      if (!name || !description || !local || !category || typeof price !== "number" || price <= 0) {
        return res.status(400).json({ message: "All fields are required and price must be greater than zero" });
      }
      const newService = await storage.createService({ name, description, local, category, price });
      res.status(201).json(newService);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ message: "Error creating service" });
    }
  });

  // Update service
  app.put("/api/services/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, local, category, price } = req.body;
      if (!name || !description || !local || !category || typeof price !== "number" || price <= 0) {
        return res.status(400).json({ message: "All fields are required and price must be greater than zero" });
      }
      const updatedService = await storage.updateService(Number(id), { name, description, local, category, price });
      res.json(updatedService);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Error updating service" });
    }
  });

  // Delete service
  app.delete("/api/services/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteService(Number(id));
      res.json({ message: "Service deleted successfully" });
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Error deleting service" });
    }
  });

  // Get available time slots for a specific date
  app.get("/api/available-times/:date", async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }

      // Timezone fix: sempre usar America/Bahia para referência de horários
      const TIMEZONE = "America/Bahia";
      const nowBahia = toZonedTime(new Date(), TIMEZONE);
      const todayStr = formatTz(nowBahia, "yyyy-MM-dd", { timeZone: TIMEZONE });
      const currentTime = formatTz(nowBahia, "HH:mm", { timeZone: TIMEZONE });

      // Restringe horários disponíveis para 8h de antecedência
      const minDateTime = new Date(nowBahia.getTime() + 8 * 60 * 60 * 1000); // 8h depois do agora
      const { local } = req.query;
      let availableTimes = await storage.getAvailableTimes(date, typeof local === 'string' ? local : undefined);

      // Converte datas para objetos Date para comparação correta
      const reqDate = new Date(date + 'T00:00:00-03:00'); // Assume America/Bahia
      const minDate = new Date(minDateTime.getFullYear(), minDateTime.getMonth(), minDateTime.getDate());
      // Só aplica o filtro de horário mínimo se a data for igual ao dia mínimo
      if (reqDate.getTime() === minDate.getTime()) {
        const minTimeStr = formatTz(minDateTime, "HH:mm", { timeZone: TIMEZONE });
        availableTimes = availableTimes.filter(time => time >= minTimeStr);
      }
      // Nunca bloqueia datas futuras (mesmo de outro mês/ano)
      // Só bloqueia se a data for antes do dia mínimo
      if (reqDate < minDate) {
        availableTimes = [];
      }

      res.json(availableTimes);
    } catch (error) {
      console.error("Error fetching available times:", error);
      res.status(500).json({ message: "Failed to fetch available times" });
    }
  });

  // Create new appointment
  app.post("/api/appointments", async (req: Request, res: Response) => {
    try {
      const validatedData = insertAppointmentSchema.parse(req.body);
      // NÃO checa mais isTimeSlotAvailable, assume que só pode agendar se o slot está disponível
      const appointment = await storage.createAppointment(validatedData);
      // Marca o slot como indisponível
      const slots = await storage.getAvailableSlots(validatedData.date);
      const slot = slots.find(s => s.time === validatedData.time);
      if (slot) {
        await storage.updateSlotAvailability(slot.id, false);
      }
      // Após criar o agendamento, dispara apenas Telegram (remove push notification)
      // Busca o local do serviço pelo serviceId
      let local = '-';
      try {
        const service = await storage.getService(validatedData.serviceId);
        if (service && service.local) local = service.local;
      } catch (e) {
        console.error('Erro ao buscar local do serviço para notificação Telegram:', e);
      }
      await sendTelegramToAdmin(
        `*Novo agendamento recebido!*
\n*Cliente:* ${validatedData.clientName}
*E-mail:* ${validatedData.clientEmail}
*Telefone:* ${validatedData.clientPhone || '-'}
*Serviço:* ${validatedData.serviceName}
*Data:* ${validatedData.date}
*Horário:* ${validatedData.time}
*Local:* ${local}
${validatedData.notes ? `*Observações:* ${validatedData.notes}` : ''}`
      );
      res.status(201).json({
        message: "Appointment created successfully",
        appointment,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid appointment data",
          errors: error.errors
        });
      }
      console.error("Error creating appointment:", error);
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  // Update appointment
  app.put("/api/appointments/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertAppointmentSchema.parse(req.body);
      const updated = await storage.updateAppointment(Number(id), validatedData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid appointment data",
          errors: error.errors,
        });
      }
      console.error("Error updating appointment:", error);
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  // Delete appointment
  app.delete("/api/appointments/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const isAdmin = req.query.admin === 'true';
      // Busca o agendamento
      const appointment = (await storage.getAppointments()).find(a => a.id === Number(id));
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      // Busca o serviço relacionado
      const service = await storage.getService(appointment.serviceId);
      const isCilios = service && service.category && service.category.toLowerCase().includes("cílios");
      const isIrece = service && service.local && service.local.toLowerCase() === "irecê";
      if (isCilios && isIrece && !isAdmin) {
        // Monta mensagem e URL do WhatsApp
        const msg =
          `Olá! Preciso cancelar meu agendamento e já paguei o adiantamento.\n` +
          `*Serviço:* ${appointment.serviceName}\n` +
          `*Data:* ${appointment.date}\n` +
          `*Horário:* ${appointment.time}\n` +
          `*Local:* ${(service?.local || '-') }\n` +
          `*Nome:* ${appointment.clientName}`;
        const whatsappUrl = `https://wa.me/5574988117722?text=${encodeURIComponent(msg)}`;
        return res.status(403).json({
          message: "O cancelamento de agendamentos de cílios em Irecê só pode ser feito via WhatsApp. Clique em OK para ser redirecionado.",
          whatsappUrl
        });
      }
      // Exclui o slot correspondente ao agendamento (ignora caixa e acento)
      const normalize = (str: string) => str?.normalize('NFD').replace(/[^\w\s]/g, '').toLowerCase().trim();
      const slots = await storage.getAvailableSlots(appointment.date);
      const slotToDelete = slots.find(s =>
        s.time === appointment.time &&
        normalize(s.local) === normalize(service?.local || "")
      );
      if (slotToDelete) {
        await storage.deleteAvailableSlot(slotToDelete.id);
      }
      await storage.deleteAppointment(Number(id));
      res.json({ message: "Appointment deleted successfully" });
    } catch (err) {
      if (err instanceof Error && err.message.includes("not found")) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      console.error("Error deleting appointment:", err);
      res.status(500).json({ message: "Error deleting appointment" });
    }
  });

  // Get appointments (sempre inclui o local do serviço)
  app.get("/api/appointments", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      let appointments = await storage.getAppointments();
      const allServices = await storage.getServices();
      // Sempre inclui o local do serviço correspondente
      appointments = appointments.map(a => {
        if (!(a as any).local && a.serviceId) {
          const service = allServices.find((s: any) => s.id === a.serviceId);
          return { ...a, local: service?.local || "" } as Appointment & { local: string };
        }
        // Se já tem local, mantém
        return a;
      });
      if (email) {
        appointments = appointments.filter(a => a.clientEmail === email);
      }
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  // Buscar agendamentos por nome da cliente
  app.get("/api/appointments/search", async (req: Request, res: Response) => {
    try {
      const { name } = req.query;
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "Nome é obrigatório" });
      }
      const results = await storage.getAppointmentsByClientName(name);
      res.json(results);
    } catch (error) {
      console.error("Erro ao buscar agendamentos por nome:", error);
      res.status(500).json({ message: "Erro ao buscar agendamentos" });
    }
  });

  // Get appointment by id
  app.get("/api/appointments/:id", async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (!id) return res.status(400).json({ message: "ID inválido" });
      const appointment = (await storage.getAppointments()).find(a => a.id === id);
      if (!appointment) return res.status(404).json({ message: "Agendamento não encontrado" });
      res.json(appointment);
    } catch (error) {
      console.error("Error fetching appointment by id:", error);
      res.status(500).json({ message: "Failed to fetch appointment" });
    }
  });

  // Create contact message
  app.post("/api/contact", async (req: Request, res: Response) => {
    try {
      const validatedData = insertContactMessageSchema.parse(req.body);
      const message = await storage.createContactMessage(validatedData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid contact message data",
          errors: error.errors
        });
      }
      console.error("Error creating contact message:", error);
      res.status(500).json({ message: "Failed to send contact message" });
    }
  });

  // Update contact message
  app.put("/api/contact/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertContactMessageSchema.parse(req.body); // Reutiliza o schema de inserção se a atualização for igual
      const updated = await storage.updateContactMessage(Number(id), validatedData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid contact message data",
          errors: error.errors,
        });
      }
      console.error("Error updating contact message:", error);
      res.status(500).json({ message: "Failed to update contact message" });
    }
  });

  // Delete contact message
  app.delete("/api/contact/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteContactMessage(Number(id));
      res.json({ message: "Message deleted successfully" });
    } catch (error) {
      console.error("Error deleting contact message:", error);
      res.status(500).json({ message: "Error deleting message" });
    }
  });

  // Get contact messages
  app.get("/api/contact", async (req: Request, res: Response) => {
    try {
      const messages = await storage.getContactMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching contact messages:", error);
      res.status(500).json({ message: "Failed to fetch contact messages" });
    }
  });

  // Admin login
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const admin = await storage.getAdminByUsername(username);
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
    if (passwordMatch) {
      res.json({ message: "Login successful" }); // Stateless, no session token needed for this example
    } else {
      res.status(401).json({ message: "Invalid credentials" });
    }
  });

  // Check auth status (always forces re-login for this stateless example)
  app.get("/api/auth/check", async (req: Request, res: Response) => {
    res.status(401).json({ authenticated: false });
  });

  // Logout (stateless)
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    res.json({ message: "Logout successful" });
  });

  // Admin: Get available slots for a date
  app.get("/api/admin/slots/:date", async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const slots = await storage.getAvailableSlots(date);
      res.json(slots);
    } catch (error) {
      console.error("Error fetching admin slots:", error);
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  // Admin: Create an available slot
  app.post("/api/admin/slots", async (req: Request, res: Response) => {
    try {
      const validatedData = insertAvailableSlotSchema.parse(req.body);
      const slot = await storage.createAvailableSlot(validatedData);
      res.status(201).json(slot);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid slot data",
          errors: error.errors
        });
      }
      console.error("Error creating admin slot:", error);
      res.status(500).json({ message: "Failed to create slot" });
    }
  });

  // Admin: Delete an available slot
  app.delete("/api/admin/slots/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAvailableSlot(id);
      res.json({ message: "Slot deleted successfully" });
    } catch (error) {
      console.error("Error deleting admin slot:", error);
      res.status(500).json({ message: "Failed to delete slot" });
    }
  });

  // Admin: Delete all slots for a given date
  app.delete("/api/admin/slots", async (req: Request, res: Response) => {
    try {
      const { date } = req.query;
      if (!date || typeof date !== "string") {
        return res.status(400).json({ message: "Data não informada" });
      }
      const slots = await storage.getAvailableSlots(date);
      for (const slot of slots) {
        await storage.deleteAvailableSlot(slot.id);
      }
      res.json({ message: `Todos os horários de ${date} foram apagados.` });
    } catch (error) {
      console.error("Erro ao apagar todos os slots do dia:", error);
      res.status(500).json({ message: "Erro ao apagar todos os horários do dia" });
    }
  });

  // Get testimonials (public)
  app.get("/api/testimonials", async (req: Request, res: Response) => {
    try {
      const messages = await storage.getContactMessages(); // Assuming testimonials are stored as contact messages with ratings
      const testimonials = messages
        .filter(msg => typeof msg.rating === 'number' && msg.rating > 0) // Filtra por mensagens que têm uma avaliação válida
        .map(msg => ({
          id: msg.id,
          name: msg.name,
          message: msg.message,
          rating: msg.rating,
          createdAt: msg.createdAt,
        }));
      res.json(testimonials);
    } catch (error) {
      console.error("Error fetching testimonials:", error);
      res.status(500).json({ message: "Failed to fetch testimonials" });
    }
  });

  // Rota para criar preferência de pagamento Mercado Pago (nova rota)
  app.post("/api/pagamento", async (req: Request, res: Response) => {
    let { title, price, quantity, payer, bookingData } = req.body;

    if (!payer || !payer.email || typeof payer.email !== 'string' || payer.email.trim() === "") {
      console.error("BACKEND VALIDATION: Tentativa de criar preferência MP sem email do pagador válido. Payer recebido:", payer);
      return res.status(400).json({ error: "O email do pagador é obrigatório para processar o pagamento." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // Regex simples para formato de email
    if (!emailRegex.test(payer.email)) {
      console.error("BACKEND VALIDATION: Tentativa de criar preferência MP com email do pagador mal formatado:", payer.email);
      return res.status(400).json({ error: "O formato do email do pagador é inválido." });
    }
    // Validação básica dos dados recebidos (adapte conforme necessidade)
    if (!title || typeof price !== 'number' || price <= 0 || typeof quantity !== 'number' || quantity <= 0 || !payer || !payer.email) {
      return res.status(400).json({ error: "Dados inválidos para criar preferência de pagamento." });
    }
    if (!mpAccessToken) { // Verifica novamente se o token está carregado
      console.error("Tentativa de criar preferência MP sem Access Token configurado.");
      return res.status(500).json({ error: "Configuração do servidor de pagamento incompleta."});
    }

    try {    // Ajuste para repassar taxa do cartão ao cliente (apenas para adiantamento cílios/Irecê)
      // Considera que price está em centavos (ex: 3000 = R$ 30,00)
      const isCiliosIrece = bookingData?.local?.toLowerCase() === "irecê" && bookingData?.serviceName?.toLowerCase().includes("cílios");
      const isAdiantamento = title?.toLowerCase().includes("adiantamento");
      // Taxa Mercado Pago padrão cartão: 4,97% (0,0497)
      const TAXA_CARTAO = 0.0497;
      // Ajuste: valor fixo do adiantamento com taxa para cartão (R$ 31,58)
      // Taxa Mercado Pago padrão cartão: 4,97% (0,0497)
      // Para receber R$ 30,00 líquidos: 30 / 0.9503 = 31,58 (arredondado)
      const VALOR_ADIANTAMENTO_CARTAO = 3158; // em centavos (R$ 31,58)
      if (isCiliosIrece && isAdiantamento) {
        price = VALOR_ADIANTAMENTO_CARTAO;
        bookingData.valorAdiantamentoComTaxa = VALOR_ADIANTAMENTO_CARTAO;
        bookingData.valorLiquidoDesejado = 3000;
        bookingData.taxaCartao = TAXA_CARTAO;
      }

      // Determina categoria e descrição do serviço para o Mercado Pago
      const categoryId = bookingData?.category_id || bookingData?.category || 'services'; // fallback para 'services'
      const description = bookingData?.serviceDescription || bookingData?.description || title;
      // Telefone do cliente (formato internacional recomendado pelo MP: +5511999999999)
      let payerPhone = payer.phone || bookingData?.clientPhone || '';
      let payerPhoneObj = undefined;
      if (payerPhone) {
        // Extrai apenas dígitos
        const onlyDigits = payerPhone.replace(/\D/g, '');
        let area_code = '';
        let number = '';
        if (onlyDigits.length === 11) {
          area_code = onlyDigits.substring(0, 2);
          number = onlyDigits.substring(2);
        } else if (onlyDigits.length === 13 && onlyDigits.startsWith('55')) {
          area_code = onlyDigits.substring(2, 4);
          number = onlyDigits.substring(4);
        }
        if (area_code && number) {
          payerPhoneObj = { area_code, number };
        }
      }

      const preference = new Preference(mpClient); // Usa a instância mpClient configurada globalmente
      const unitPriceInReais = price / 100;
      const preferencePayload = {
        items: [{
          id: String(bookingData?.serviceId || bookingData?.id || title.replace(/\s+/g, '-') + '-' + Date.now()),
          title,
          unit_price: unitPriceInReais,
          quantity,
          currency_id: 'BRL',
          category_id: categoryId,
          description: description,
        }],
        payer: {
          email: payer.email,
          name: payer.name,
          ...(payerPhoneObj ? { phone: payerPhoneObj } : {}),
        },
        back_urls: {
          success: `${process.env.YOUR_DOMAIN || 'http://localhost:3000'}/payment-success`,
          failure: `${process.env.YOUR_DOMAIN || 'http://localhost:3000'}/payment-failure`,
          pending: `${process.env.YOUR_DOMAIN || 'http://localhost:3000'}/payment-pending`
        },
        auto_return: "approved" as "approved" | "all",
        notification_url: `${process.env.YOUR_NOTIFICATION_DOMAIN || 'https://seu-webhook-real.com'}/api/mercadopago/webhook`,
        external_reference: String(bookingData?.id || `booking-${Date.now()}`),
        metadata: { bookingData },
        payment_methods: {
          excluded_payment_types: [{ id: "ticket" }], // Remove boleto
          excluded_payment_methods: [], // Não exclui cartão, pix ou saldo
        }
      };
      console.log("Criando preferência Mercado Pago (rota /api/pagamento) com payload:", JSON.stringify(preferencePayload, null, 2));
      const result = await preference.create({ body: preferencePayload });
      console.log("Preferência Mercado Pago criada (rota /api/pagamento):", JSON.stringify(result, null, 2));
      // Não retorna mais sandbox_init_point, só init_point (produção)
      res.json({ preference_id: result.id, init_point: result.init_point });
    } catch (err: any) {
      console.error("-----------------------------------------------------");
      console.error("Erro ao criar preferência Mercado Pago (rota /api/pagamento):");
      salvarLogMercadoPago(err);
      let errorMessage = "Erro desconhecido ao criar preferência de pagamento.";
      let errorDetails = err;
      if (err.cause && Array.isArray(err.cause) && err.cause.length > 0) {
        errorMessage = err.cause.map((c: any) => `${c.code}: ${c.description}`).join('; ');
        errorDetails = err.cause;
      } else if (err.response && err.response.data && err.response.data.message) {
        errorMessage = err.response.data.message;
        errorDetails = err.response.data;
      } else if (err.message) {
        errorMessage = err.message;
      }
      res.status(err.status || 500).json({
        error: "Falha ao criar preferência de pagamento",
        message: errorMessage,
        details: errorDetails
      });
    }
  });

  // Função utilitária para salvar logs detalhados do Mercado Pago
  function salvarLogMercadoPago(err: any) {
    try {
      const logsDir = path.join(__dirname, "..", "logs"); // Ajuste o caminho se __dirname for dentro de 'src'
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-");
      const fileName = `mercadopago-error-${timestamp}.log`;
      const filePath = path.join(logsDir, fileName);

      let logContent = `[${now.toISOString()}]\n`;
      logContent += `Error Message: ${err.message || 'N/A'}\n`;
      if (err.status) logContent += `Status Code: ${err.status}\n`;
      if (err.stack) logContent += `Stack: ${err.stack}\n`;

      // Detalhes específicos do erro do Mercado Pago (SDK v3)
      if (err.cause) { // 'cause' é comum no SDK v3 para detalhar erros da API
        logContent += `Cause: ${JSON.stringify(err.cause, null, 2)}\n`;
      }
      // Se o erro for de uma resposta HTTP (ex: axios, fetch)
      if (err.response) {
        logContent += `Response Status: ${err.response.status}\n`;
        logContent += `Response Data: ${JSON.stringify(err.response.data || err.response.body, null, 2)}\n`;
      }
      // Fallback para serialização completa do erro
      try {
        logContent += `Full Error Object: ${JSON.stringify(err, null, 2)}\n`;
      } catch (serializationError) {
        logContent += `Full Error Object: (Could not serialize - ${serializationError})\n`;
      }
      logContent += "-----------------------------------------------------\n";

      fs.appendFileSync(filePath, logContent, { encoding: "utf-8" }); // Usar appendFileSync para adicionar a um log diário, ou writeFileSync para um novo por erro
      console.log(`Log de erro do Mercado Pago salvo em: ${filePath}`);
    } catch (logSavingError) {
      console.error("Falha CRÍTICA ao salvar log do Mercado Pago:", logSavingError);
    }
  }

  // Armazenamento simples da subscription do admin (em memória para início)
  let adminPushSubscription: any = null;

  // Endpoint para salvar a subscription do admin (agora no banco)
  app.post("/api/admin-push-subscription", async (req: Request, res: Response) => {
    try {
      const { endpoint, keys, username } = req.body;
      if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
        return res.status(400).json({ message: "Dados de subscription incompletos" });
      }
      // username pode ser passado no body, ou usar 'admin' padrão
      const sub = insertAdminPushSubscriptionSchema.parse({
        username: username || "admin",
        endpoint,
        keys_p256dh: keys.p256dh,
        keys_auth: keys.auth,
      });
      await storage.addAdminPushSubscription(sub);
      res.status(201).json({ message: "Subscription salva com sucesso" });
    } catch (err) {
      res.status(400).json({ message: "Erro ao salvar subscription", error: String(err) });
    }
  });

  // Função utilitária para enviar push notification a todos os admins
  async function sendPushToAdmin(notification: { title: string; body: string; url?: string }) {
    const subs = await storage.getAllAdminPushSubscriptions();
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
          },
          JSON.stringify({
            title: notification.title,
            body: notification.body,
            url: notification.url,
          })
        );
      } catch (err) {
        // Se subscription inválida, remove do banco
        const error: any = err;
        if (error && (error.statusCode === 410 || error.statusCode === 404)) {
          await storage.deleteAdminPushSubscriptionByEndpoint(sub.endpoint);
        }
        console.error("Erro ao enviar push notification ao admin:", err);
      }
    }
  }

  // Endpoint para expor a chave pública VAPID
  app.get("/api/push-public-key", (req: Request, res: Response) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  // Webhook Mercado Pago: recebe notificações de pagamento
  app.post("/api/mercadopago/webhook", async (req: Request, res: Response) => {
    try {
      // Mercado Pago pode enviar notificações como x-www-form-urlencoded ou JSON
      const body = req.body || {};
      const topic = body.topic || req.query.topic;
      const paymentId = body.id || req.query.id;
      console.log("[MP WEBHOOK] Recebido:", JSON.stringify(body), req.query);

      if ((topic === 'payment' || body.type === 'payment') && paymentId) {
        const mpToken = process.env.MP_ACCESS_TOKEN;
        const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
        const resp = await fetch(url, {
          headers: { Authorization: `Bearer ${mpToken}` }
        });
        const payment = await resp.json();
        console.log("[MP WEBHOOK] Detalhes do pagamento:", payment);
        if (payment.status === 'approved' && payment.metadata && (payment.metadata.bookingData || payment.metadata.booking_data)) {
          // Suporte a ambos formatos: camelCase (bookingData) e snake_case (booking_data)
          let rawBookingData = payment.metadata.bookingData || payment.metadata.booking_data;
          // Se vier em snake_case, converte para camelCase
          if (payment.metadata.booking_data) {
            const snakeToCamel = (str: string) => str.replace(/_([a-z])/g, g => g[1].toUpperCase());
            const convertKeys = (obj: any) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [snakeToCamel(k), v]));
            rawBookingData = convertKeys(rawBookingData);
          }
          let bookingData: any;
          try {
            bookingData = insertAppointmentSchema.parse(rawBookingData);
          } catch (err) {
            console.error('[MP WEBHOOK] Dados de bookingData inválidos:', err, rawBookingData);
            return res.status(400).json({ error: 'Dados de agendamento inválidos no metadata do pagamento', details: err });
          }
          // Busca se já existe agendamento igual (mesmo e-mail, data, hora, serviço)
          const allAppointments = await storage.getAppointments();
          const exists = allAppointments.find(a =>
            a.clientEmail === bookingData.clientEmail &&
            a.date === bookingData.date &&
            a.time === bookingData.time &&
            a.serviceId === bookingData.serviceId
          );
          let appointment = exists;
          if (!exists) {
            // Cria o agendamento
            try {
              appointment = await storage.createAppointment(bookingData);
              // Marca o slot como indisponível
              const slots = await storage.getAvailableSlots(bookingData.date);
              const slot = slots.find(s => s.time === bookingData.time);
              if (slot) {
                await storage.updateSlotAvailability(slot.id, false);
              }
            } catch (err) {
              console.error('[MP WEBHOOK] Erro ao criar agendamento após pagamento:', err);
              return res.status(500).json({ error: 'Erro ao criar agendamento após pagamento' });
            }
          }
          // Busca o local do serviço pelo serviceId, se necessário
          let local = '-';
          if ('local' in bookingData && bookingData.local) {
            local = bookingData.local;
          } else if (bookingData.serviceId) {
            try {
              const service = await storage.getService(bookingData.serviceId);
              if (service && service.local) local = service.local;
            } catch (e) {
              console.error('Erro ao buscar local do serviço para notificação Telegram (webhook):', e);
            }
          }
          await sendTelegramToAdmin(
            `*Pagamento aprovado! Novo agendamento confirmado:*
*Cliente:* ${bookingData.clientName}
*E-mail:* ${bookingData.clientEmail}
*Telefone:* ${bookingData.clientPhone || '-'}
*Serviço:* ${bookingData.serviceName}
*Data:* ${bookingData.date}
*Horário:* ${bookingData.time}
*Local:* ${local}
${bookingData.notes ? `*Observações:* ${bookingData.notes}` : ''}`
          );
          await sendPushToAdmin({
            title: "Novo agendamento confirmado!",
            body: `Cliente: ${bookingData.clientName}\nServiço: ${bookingData.serviceName}\nData: ${bookingData.date} ${bookingData.time}`,
            url: "/admin"
          });
        }
        // Se não houver bookingData no metadata, tenta buscar pelo external_reference
        if (payment.status === 'approved' && (!payment.metadata || !payment.metadata.bookingData) && payment.external_reference) {
          try {
            const appointmentId = Number(payment.external_reference.replace('booking-', ''));
            const allAppointments = await storage.getAppointments();
            const appointment = allAppointments.find(a => a.id === appointmentId);
            if (appointment) {
              // Busca o local do serviço pelo serviceId
              let local = '-';
              if ('local' in appointment && typeof (appointment as any).local === 'string' && (appointment as any).local) {
                local = (appointment as any).local;
              } else if (appointment.serviceId) {
                try {
                  const service = await storage.getService(appointment.serviceId);
                  if (service && service.local) local = service.local;
                } catch (e) {
                  console.error('Erro ao buscar local do serviço para notificação Telegram (webhook):', e);
                }
              }
              await sendTelegramToAdmin(
                `*Pagamento aprovado! Novo agendamento confirmado:*
*Cliente:* ${appointment.clientName}
*E-mail:* ${appointment.clientEmail}
*Telefone:* ${appointment.clientPhone || '-'}
*Serviço:* ${appointment.serviceName}
*Data:* ${appointment.date}
*Horário:* ${appointment.time}
*Local:* ${local}
${appointment.notes ? `*Observações:* ${appointment.notes}` : ''}`
              );
            } else {
              console.error('[MP WEBHOOK] Agendamento não encontrado para external_reference:', payment.external_reference);
            }
          } catch (err) {
            console.error('[MP WEBHOOK] Erro ao buscar agendamento pelo external_reference:', err);
          }
        }
      }
      res.status(200).json({ received: true });
    } catch (err) {
      console.error('[MP WEBHOOK] Erro ao processar webhook:', err);
      res.status(500).json({ error: 'Erro ao processar webhook' });
    }
  });

  // Endpoint para gerar pagamento Pix (copia e cola)
  app.post("/api/pagar-pix", async (req: Request, res: Response) => {
    try {
      // Valor fixo do Pix: R$ 30,00
      const amount = 30.00;
      const { description, payer, bookingData } = req.body;
      if (!amount || !description || !payer || !payer.email || !payer.first_name || !payer.last_name || !payer.identification) {
        return res.status(400).json({ error: "Dados obrigatórios ausentes para gerar Pix." });
      }
      const mpToken = process.env.MP_ACCESS_TOKEN;
      if (!mpToken) return res.status(500).json({ error: "Access Token do Mercado Pago não configurado." });
      const notificationUrl = process.env.MP_WEBHOOK_URL || process.env.YOUR_NOTIFICATION_DOMAIN + "/api/mercadopago/webhook";
      // Remove phone do objeto payer se vier do frontend
      const { email, first_name, last_name, identification } = payer;
      const paymentPayload = {
        transaction_amount: amount,
        description,
        payment_method_id: "pix",
        payer: {
          email,
          first_name,
          last_name,
          identification // { type: 'CPF', number: '...' }
        },
        notification_url: notificationUrl,
        ...(bookingData ? { metadata: { bookingData } } : {}) // Adiciona metadata se vier do frontend
      };
      // Loga o payload enviado ao Mercado Pago para debug
      console.log("[PIX] Payload enviado ao Mercado Pago:", JSON.stringify(paymentPayload, null, 2));
      // Salva o payload em arquivo para debug completo
      try {
        const logsDir = path.join(__dirname, "..", "logs");
        if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
        const now = new Date();
        const timestamp = now.toISOString().replace(/[:.]/g, "-");
        const fileName = `pix-payload-${timestamp}.log`;
        const filePath = path.join(logsDir, fileName);
        fs.writeFileSync(filePath, JSON.stringify(paymentPayload, null, 2), { encoding: "utf-8" });
        console.log(`[PIX] Payload salvo em: ${filePath}`);
      } catch (e) {
        console.error("[PIX] Falha ao salvar payload em arquivo:", e);
      }
      const resp = await fetch("https://api.mercadopago.com/v1/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${mpToken}`,
          "X-Idempotency-Key": `${Date.now()}-${Math.random().toString(36).substring(2, 15)}` // Gera um valor único por requisição
        },
        body: JSON.stringify(paymentPayload)
      });
      const data = await resp.json();
      if (!data.point_of_interaction || !data.point_of_interaction.transaction_data) {
        // Loga resposta completa do Mercado Pago para debug
        try {
          const logsDir = path.join(__dirname, "..", "logs");
          if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
          const now = new Date();
          const timestamp = now.toISOString().replace(/[:.]/g, "-");
          const fileName = `mercadopago-error-pix-${timestamp}.log`;
          const filePath = path.join(logsDir, fileName);
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { encoding: "utf-8" });
          console.error(`[PIX] Erro Mercado Pago salvo em: ${filePath}`);
        } catch (e) {
          console.error("[PIX] Falha ao salvar erro Mercado Pago em arquivo:", e);
        }
        return res.status(500).json({ error: "Erro ao gerar Pix.", details: data });
      }
      res.json({
        qr_code: data.point_of_interaction.transaction_data.qr_code,
        qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64,
        payment_id: data.id
      });
    } catch (err) {
      res.status(500).json({ error: "Erro interno ao gerar Pix.", details: String(err) });
    }
  });

  // Endpoint para consultar status do pagamento pelo payment_id
  app.get('/api/pagamento-status', async (req: any, res: any) => {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'payment_id ausente' });
    try {
      const mpToken = process.env.MP_ACCESS_TOKEN;
      const url = `https://api.mercadopago.com/v1/payments/${id}`;
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${mpToken}` }
      });
      const data = await resp.json();
      res.json({ status: data.status, status_detail: data.status_detail });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao consultar status do pagamento' });
    }
  });

  // Atualizar se a cliente compareceu
  app.patch("/api/appointments/:id/showed-up", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { showedUp } = req.body;
      if (typeof showedUp !== "boolean") {
        return res.status(400).json({ message: "Campo showedUp deve ser boolean" });
      }
      const updated = await storage.updateAppointmentShowedUp(Number(id), showedUp);
      res.json(updated);
    } catch (error) {
      console.error("Erro ao atualizar presença da cliente:", error);
      res.status(500).json({ message: "Erro ao atualizar presença da cliente" });
    }
  });

  // Webhook do Telegram para comandos de relatório
  app.post("/api/telegram-webhook", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      const message = body.message;
      if (!message || !message.text) return res.sendStatus(200);
      const chatId = message.chat.id;
      const text = message.text.trim();
      // Regex para /mês YYYY-MM ou /ano YYYY
      const mesMatch = text.match(/^\/m[êe]s\s+(\d{4}-\d{2})$/i);
      const anoMatch = text.match(/^\/ano\s+(\d{4})$/i);
      // Se usuário enviar apenas /mes ou /mês
      if (/^\/m[êe]s$/i.test(text)) {
        const now = new Date();
        const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `Por favor, envie o comando no formato:\n/mes ${mesAtual}`
          })
        });
        return res.sendStatus(200);
      }
      // Se usuário enviar apenas /ano
      if (/^\/ano$/i.test(text)) {
        const now = new Date();
        const anoAtual = `${now.getFullYear()}`;
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: `Por favor, envie o comando no formato:\n/ano ${anoAtual}`
          })
        });
        return res.sendStatus(200);
      }
      // ...existing code...
      if (mesMatch) {
        const mes = mesMatch[1];
        const appointments = await storage.getAppointments();
        const services = await storage.getServices();
        const ags = appointments.filter(a => a.date.slice(0, 7) === mes && new Date(`${a.date}T${a.time}`) < new Date());
        if (ags.length === 0) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: `Nenhum agendamento encontrado para o mês ${mes}.` })
          });
          return res.sendStatus(200);
        }
        const filePath = await gerarRelatorioMensalXLSX(ags, mes, services, true);
        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append("document", fs.createReadStream(filePath), { filename: `relatorio-mensal-${mes}.xlsx` });
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
          method: "POST",
          body: formData as any
        });
        return res.sendStatus(200);
      } else if (anoMatch) {
        const ano = anoMatch[1];
        const appointments = await storage.getAppointments();
        const services = await storage.getServices();
        const ags = appointments.filter(a => a.date.slice(0, 4) === ano && new Date(`${a.date}T${a.time}`) < new Date());
        if (ags.length === 0) {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: `Nenhum agendamento encontrado para o ano ${ano}.` })
          });
          return res.sendStatus(200);
        }
        const filePath = await gerarRelatorioAnualXLSX(ags, ano, services, true);
        const formData = new FormData();
        formData.append("chat_id", chatId);
        formData.append("document", fs.createReadStream(filePath), { filename: `relatorio-anual-${ano}.xlsx` });
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
          method: "POST",
          body: formData as any
        });
        return res.sendStatus(200);
      } else {
        // Comando não reconhecido
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: "Comando não reconhecido. Use /mês YYYY-MM ou /ano YYYY." })
        });
        return res.sendStatus(200);
      }
    } catch (err) {
      console.error("[TELEGRAM WEBHOOK] Erro:", err);
      res.sendStatus(500);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}