import { createServer, type Server } from "http";
import express, { Request, Response } from "express";
import { storage } from "./storage";
import { insertAppointmentSchema, insertContactMessageSchema, insertAvailableSlotSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { MercadoPagoConfig, Preference } from "mercadopago"; // Importação direta do Preference para SDK v3
import fs from "fs";
import path from "path";

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

export async function registerRoutes(app: express.Express): Promise<Server> { // Tipagem de 'app' como express.Express
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
      const availableTimes = await storage.getAvailableTimes(date);
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
      const isAvailable = await storage.isTimeSlotAvailable(
        validatedData.date,
        validatedData.time
      );
      if (!isAvailable) {
        return res.status(409).json({
          message: "This time slot is no longer available. Please choose another time."
        });
      }
      const appointment = await storage.createAppointment(validatedData);
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

  // Get appointments
  app.get("/api/appointments", async (req: Request, res: Response) => {
    try {
      const appointments = await storage.getAppointments();
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching appointments:", error);
      res.status(500).json({ message: "Failed to fetch appointments" });
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

  // Rota para criar preferência de pagamento Mercado Pago
  app.post("/api/mercadopago", async (req: Request, res: Response) => {
    const { title, price, quantity, payer, bookingData } = req.body;

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

      // **IMPORTANTE**: Certifique-se que `price` é o valor correto.
      // Se o frontend envia `3000` para R$30,00 (centavos), então `price / 100` está correto.
      // Se o frontend envia `30.00` para R$30,00, então use apenas `price`.
      // Assumindo que o frontend envia em centavos (ex: 3000 para R$30,00)
      const unitPriceInReais = price / 100;

      const preferencePayload = {
        items: [{
          id: String(bookingData?.serviceId || bookingData?.id || title.replace(/\s+/g, '-') + '-' + Date.now()), // ID do item, mais robusto
          title,
          unit_price: unitPriceInReais,
          quantity,
          currency_id: 'BRL', // ESSENCIAL: Especificar a moeda
        }],
        payer: { // Garante que o email do pagador é fornecido
            email: payer.email,
            name: payer.name, // Opcional, mas bom ter
            // surname: payer.surname, // Opcional
            // phone: { area_code: "XX", number: "YYYYYYYYY" }, // Opcional
            // identification: { type: "CPF", number: "ZZZZZZZZZZZ" }, // Opcional, mas pode ser exigido
            // address: { street_name: "Street", street_number: 123, zip_code: "01234567" } // Opcional
        },
        back_urls: { // Substitua pelas suas URLs de produção REAIS
          success: `${process.env.YOUR_DOMAIN || 'http://localhost:3000'}/payment-success`, // Use variáveis de ambiente para o domínio
          failure: `${process.env.YOUR_DOMAIN || 'http://localhost:3000'}/payment-failure`,
          pending: `${process.env.YOUR_DOMAIN || 'http://localhost:3000'}/payment-pending`
        },
        auto_return: "approved" as "approved" | "all", // Tipagem para auto_return
        notification_url: `${process.env.YOUR_NOTIFICATION_DOMAIN || 'https://seu-webhook-real.com'}/api/mercadopago/webhook`, // URL de webhook REAL e pública
        external_reference: String(bookingData?.id || `booking-${Date.now()}`), // Referência externa para seu sistema
        metadata: { bookingData } // Dados adicionais que você queira associar
      };

      console.log("Criando preferência Mercado Pago com payload:", JSON.stringify(preferencePayload, null, 2));
      const result = await preference.create({ body: preferencePayload });

      console.log("Preferência Mercado Pago criada:", JSON.stringify(result, null, 2));
      res.json({ preference_id: result.id, init_point: result.init_point });

    } catch (err: any) { // Tipar err como any para acessar propriedades dinâmicas
      console.error("-----------------------------------------------------");
      console.error("Erro ao criar preferência Mercado Pago:");
      salvarLogMercadoPago(err); // Função de log que você já tem

      // Tenta extrair a mensagem de erro da API do Mercado Pago se disponível
      let errorMessage = "Erro desconhecido ao criar preferência de pagamento.";
      let errorDetails = err;

      if (err.cause && Array.isArray(err.cause) && err.cause.length > 0) {
        // O SDK v3 pode retornar 'cause' como um array de erros
        errorMessage = err.cause.map((c: any) => `${c.code}: ${c.description}`).join('; ');
        errorDetails = err.cause;
      } else if (err.response && err.response.data && err.response.data.message) {
        // Estrutura de erro comum em APIs
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

  const httpServer = createServer(app);
  return httpServer;
}