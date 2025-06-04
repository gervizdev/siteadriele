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

      // Restringe horários disponíveis para 24h de antecedência
      const minDateTime = new Date(nowBahia.getTime() + 24 * 60 * 60 * 1000); // 24h depois do agora
      const minDateStr = formatTz(minDateTime, "yyyy-MM-dd", { timeZone: TIMEZONE });
      const minTimeStr = formatTz(minDateTime, "HH:mm", { timeZone: TIMEZONE });

      const { local } = req.query;
      let availableTimes = await storage.getAvailableTimes(date, typeof local === 'string' ? local : undefined);

      // Se a data for igual à data mínima, filtra horários menores que a hora mínima
      if (date === minDateStr) {
        availableTimes = availableTimes.filter(time => time >= minTimeStr);
      }
      // Se a data for menor que a data mínima, não retorna horários
      if (date < minDateStr) {
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
      // Após criar o agendamento, dispara push notification para o admin
      await sendPushToAdmin({
        title: "Novo agendamento recebido!",
        body: `Cliente: ${validatedData.clientName} | Serviço: ${validatedData.serviceName} | Data: ${validatedData.date} ${validatedData.time}`,
        url: "/admin"
      });
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
      await storage.deleteAppointment(Number(id));
      res.json({ message: "Appointment deleted successfully" });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) { // Adaptar para a mensagem de erro real do seu storage
        return res.status(404).json({ message: "Appointment not found" });
      }
      console.error("Error deleting appointment:", error);
      res.status(500).json({ message: "Error deleting appointment" });
    }
  });

  // Get appointments (with optional email filter)
  app.get("/api/appointments", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      let appointments;
      if (email) {
        const allAppointments = await storage.getAppointments();
        const allServices = await storage.getServices();
        appointments = allAppointments.filter(a => a.clientEmail === email);
        // Corrige local vazio: se local não existir, tenta buscar pelo serviço
        appointments = appointments.map(a => {
          if (!(a as any).local && a.serviceId) {
            const service = allServices.find((s: any) => s.id === a.serviceId);
            return { ...a, local: service?.local || "" } as Appointment & { local: string };
          }
          return a;
        });
      } else {
        appointments = await storage.getAppointments();
      }
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
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
    const { title, price, quantity, payer, bookingData } = req.body;

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

    try {
      const preference = new Preference(mpClient); // Usa a instância mpClient configurada globalmente
      const unitPriceInReais = price / 100;
      const preferencePayload = {
        items: [{
          id: String(bookingData?.serviceId || bookingData?.id || title.replace(/\s+/g, '-') + '-' + Date.now()),
          title,
          unit_price: unitPriceInReais,
          quantity,
          currency_id: 'BRL',
        }],
        payer: {
          email: payer.email,
          name: payer.name,
        },
        back_urls: {
          success: `${process.env.YOUR_DOMAIN || 'http://localhost:3000'}/payment-success`,
          failure: `${process.env.YOUR_DOMAIN || 'http://localhost:3000'}/payment-failure`,
          pending: `${process.env.YOUR_DOMAIN || 'http://localhost:3000'}/payment-pending`
        },
        auto_return: "approved" as "approved" | "all",
        notification_url: `${process.env.YOUR_NOTIFICATION_DOMAIN || 'https://seu-webhook-real.com'}/api/mercadopago/webhook`,
        external_reference: String(bookingData?.id || `booking-${Date.now()}`),
        metadata: { bookingData }
      };
      console.log("Criando preferência Mercado Pago (rota /api/pagamento) com payload:", JSON.stringify(preferencePayload, null, 2));
      const result = await preference.create({ body: preferencePayload });
      console.log("Preferência Mercado Pago criada (rota /api/pagamento):", JSON.stringify(result, null, 2));
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

  const httpServer = createServer(app);
  return httpServer;
}