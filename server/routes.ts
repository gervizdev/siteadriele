import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAppointmentSchema, insertContactMessageSchema, insertAvailableSlotSchema } from "@shared/schema";
import { z } from "zod";

// Extend Express Request type to include session
declare module "express-session" {
  interface SessionData {
    isAuthenticated?: boolean;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all services
  app.get("/api/services", async (req, res) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  // Create new service
  app.post("/api/services", async (req, res) => {
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
  app.put("/api/services/:id", async (req, res) => {
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
  app.delete("/api/services/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteService(Number(id));
      res.json({ message: "Serviço deletado com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar serviço" });
    }
  });

  // Get available time slots for a specific date
  app.get("/api/available-times/:date", async (req, res) => {
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
  app.post("/api/appointments", async (req, res) => {
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
  app.put("/api/appointments/:id", async (req, res) => {
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
  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAppointment(Number(id));
      res.json({ message: "Agendamento excluído com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir agendamento" });
    }
  });

  // Get appointments (for admin purposes)
  app.get("/api/appointments", async (req, res) => {
    try {
      const appointments = await storage.getAppointments();
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch appointments" });
    }
  });

  // Create contact message
  app.post("/api/contact", async (req, res) => {
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
  app.put("/api/contact/:id", async (req, res) => {
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
  app.delete("/api/contact/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteContactMessage(Number(id));
      res.json({ message: "Mensagem excluída com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir mensagem" });
    }
  });

  // Get contact messages (admin only)
  app.get("/api/contact", async (req, res) => {
    try {
      const messages = await storage.getContactMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch contact messages" });
    }
  });

  // Simple in-memory authentication for admin panel
  let isAdminAuthenticated = false;

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (username === "admin" && password === "bellalashes2024") {
      isAdminAuthenticated = true;
      res.json({ message: "Login successful" });
    } else {
      res.status(401).json({ message: "Credenciais inválidas" });
    }
  });

  // Check authentication status
  app.get("/api/auth/check", async (req, res) => {
    if (isAdminAuthenticated) {
      res.json({ authenticated: true });
    } else {
      res.status(401).json({ authenticated: false });
    }
  });

  // Logout
  app.post("/api/auth/logout", async (req, res) => {
    isAdminAuthenticated = false;
    res.json({ message: "Logout successful" });
  });

  // Admin routes for managing available slots
  app.get("/api/admin/slots/:date", async (req, res) => {
    try {
      const { date } = req.params;
      const slots = await storage.getAvailableSlots(date);
      res.json(slots);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  app.post("/api/admin/slots", async (req, res) => {
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

  app.delete("/api/admin/slots/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteAvailableSlot(id);
      res.json({ message: "Slot deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete slot" });
    }
  });

  // Rota para buscar depoimentos (testimonials) reais
  app.get("/api/testimonials", async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
