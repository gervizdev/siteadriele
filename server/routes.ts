import { createServer, type Server } from "http";
import express, { Request, Response } from "express";
import { storage } from "./storage";
import { insertAppointmentSchema, insertContactMessageSchema, insertAvailableSlotSchema } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { MercadoPagoConfig } from "mercadopago";
import fs from "fs";
import path from "path";

// Instância Mercado Pago (SDK v2.x)
const mp = new MercadoPagoConfig({
  accessToken: "REDACTED_MP_TOKEN"
});

export async function registerRoutes(app): Promise<Server> {
  // Get all services
  app.get("/api/services", async (req: Request, res: Response) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  // Create new service
  app.post("/api/services", async (req: Request, res: Response) => {
    try {
      const { name, description, local, category, price } = req.body;
      if (!name || !description || !local || !category || typeof price !== "number" || price <= 0) {
        return res.status(400).json({ message: "Todos os campos são obrigatórios e o preço deve ser maior que zero" });
      }
      const newService = await storage.createService({ name, description, local, category, price });
      res.status(201).json(newService);
    } catch (error) {
      res.status(500).json({ message: "Erro ao criar serviço" });
    }
  });

  // Update service
  app.put("/api/services/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, description, local, category, price } = req.body;
      if (!name || !description || !local || !category || typeof price !== "number" || price <= 0) {
        return res.status(400).json({ message: "Todos os campos são obrigatórios e o preço deve ser maior que zero" });
      }
      const updatedService = await storage.updateService(Number(id), { name, description, local, category, price });
      res.json(updatedService);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar serviço" });
    }
  });

  // Delete service
  app.delete("/api/services/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteService(Number(id));
      res.json({ message: "Serviço deletado com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar serviço" });
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
        message: "Agendamento realizado com sucesso",
        appointment,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid appointment data", 
          errors: error.errors 
        });
      }
      res.status(500).json({ message: "Failed to create appointment" });
    }
  });

  // Editar agendamento
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
      res.status(500).json({ message: "Failed to update appointment" });
    }
  });

  // Excluir agendamento
  app.delete("/api/appointments/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteAppointment(Number(id));
      res.json({ message: "Agendamento excluído com sucesso" });
    } catch (error) {
      if (error instanceof Error && error.message.includes("não encontrado")) {
        return res.status(404).json({ message: "Agendamento não encontrado" });
      }
      console.error("Erro ao excluir agendamento:", error);
      res.status(500).json({ message: "Erro ao excluir agendamento" });
    }
  });

  // Get appointments (for admin purposes)
  app.get("/api/appointments", async (req: Request, res: Response) => {
    try {
      const appointments = await storage.getAppointments();
      res.json(appointments);
    } catch (error) {
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
      res.status(500).json({ message: "Failed to send contact message" });
    }
  });

  // Editar mensagem de contato
  app.put("/api/contact/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const validatedData = insertContactMessageSchema.parse(req.body);
      const updated = await storage.updateContactMessage(Number(id), validatedData);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          message: "Invalid contact message data",
          errors: error.errors,
        });
      }
      res.status(500).json({ message: "Failed to update contact message" });
    }
  });

  // Excluir mensagem de contato
  app.delete("/api/contact/:id", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteContactMessage(Number(id));
      res.json({ message: "Mensagem excluída com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir mensagem" });
    }
  });

  // Get contact messages (admin only)
  app.get("/api/contact", async (req: Request, res: Response) => {
    try {
      const messages = await storage.getContactMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contact messages" });
    }
  });

  // Simple stateless authentication for admin panel
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const admin = await storage.getAdminByUsername(username);
    if (!admin) {
      return res.status(401).json({ message: "Credenciais inválidas" });
    }
    const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
    if (passwordMatch) {
      // Não salva sessão, apenas responde OK
      res.json({ message: "Login successful" });
    } else {
      res.status(401).json({ message: "Credenciais inválidas" });
    }
  });

  // Check authentication status - sempre exige novo login
  app.get("/api/auth/check", async (req: Request, res: Response) => {
    // Nunca retorna autenticado, força login sempre
    res.status(401).json({ authenticated: false });
  });

  // Logout - apenas responde OK, não há sessão para limpar
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    res.json({ message: "Logout successful" });
  });

  // Admin routes for managing available slots
  app.get("/api/admin/slots/:date", async (req: Request, res: Response) => {
    try {
      const { date } = req.params;
      const slots = await storage.getAvailableSlots(date);
      res.json(slots);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

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
      res.status(500).json({ message: "Failed to create slot" });
    }
  });

  app.delete("/api/admin/slots/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAvailableSlot(id);
      res.json({ message: "Slot deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete slot" });
    }
  });

  // Rota para buscar depoimentos (testimonials) reais
  app.get("/api/testimonials", async (req: Request, res: Response) => {
    try {
      const messages = await storage.getContactMessages();
      // Só retorna os campos relevantes para depoimentos
      const testimonials = messages.map(msg => ({
        id: msg.id,
        name: msg.name,
        message: msg.message,
        rating: msg.rating,
        createdAt: msg.createdAt,
      }));
      res.json(testimonials);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch testimonials" });
    }
  });

  // Rota para criar preferência de pagamento Mercado Pago
  app.post("/api/mercadopago", async (req: Request, res: Response) => {
    const { title, price, quantity, payer, bookingData } = req.body;
    try {
      // Importação dinâmica para evitar erro de tipagem
      const { Preference } = await import("mercadopago");
      const preferenceClient = new Preference(mp);
      const preference = {
        items: [{
          id: String(bookingData?.serviceId || title || Date.now()), // id obrigatório
          title,
          unit_price: price / 100, // Mercado Pago espera valor em reais
          quantity,
        }],
        payer,
        back_urls: {
          success: "https://seusite.com/sucesso",
          failure: "https://seusite.com/erro",
          pending: "https://seusite.com/pendente"
        },
        auto_return: "approved",
        notification_url: "https://seusite.com/api/mercadopago/webhook", // Troque para sua URL real
        metadata: { bookingData }
      };
      const result = await preferenceClient.create({ body: preference });
      res.json({ preference_id: result.id, init_point: result.init_point });
    } catch (err) {
      // Log detalhado do erro Mercado Pago
      console.error("Erro Mercado Pago:", err);
      salvarLogMercadoPago(err);
      if (err && typeof err === 'object') {
        if ((err as any).message) console.error("Mensagem:", (err as any).message);
        if ((err as any).stack) console.error("Stack:", (err as any).stack);
        if ((err as any).response) {
          console.error("Response:", (err as any).response);
          if ((err as any).response.data) console.error("Response data:", (err as any).response.data);
          if ((err as any).response.body) console.error("Response body:", (err as any).response.body);
        }
        try {
          console.error("Erro serializado:", JSON.stringify(err, null, 2));
        } catch (e) {
          // Ignora erro de serialização
        }
      }
      res.status(500).json({ error: "Erro ao criar preferência", details: (err && (err as any).message) ? (err as any).message : String(err) });
    }
  });

  // Função utilitária para salvar logs detalhados
  function salvarLogMercadoPago(err: any) {
    try {
      const logsDir = path.join(__dirname, "logs");
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      const now = new Date();
      const fileName = `mercadopago-error-${now.toISOString().replace(/[:.]/g, "-")}.log`;
      const filePath = path.join(logsDir, fileName);
      let conteudo = "[" + now.toISOString() + "]\n";
      conteudo += "Mensagem: " + (err && err.message ? err.message : String(err)) + "\n";
      if (err && err.stack) conteudo += "Stack: " + err.stack + "\n";
      if (err && err.response) {
        conteudo += "Response: " + JSON.stringify(err.response, null, 2) + "\n";
        if (err.response.data) conteudo += "Response data: " + JSON.stringify(err.response.data, null, 2) + "\n";
        if (err.response.body) conteudo += "Response body: " + JSON.stringify(err.response.body, null, 2) + "\n";
      }
      try {
        conteudo += "Erro serializado: " + JSON.stringify(err, null, 2) + "\n";
      } catch {}
      fs.writeFileSync(filePath, conteudo, { encoding: "utf-8" });
    } catch (e) {
      console.error("Falha ao salvar log Mercado Pago:", e);
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
