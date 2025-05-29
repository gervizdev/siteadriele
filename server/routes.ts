import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertAppointmentSchema, insertContactMessageSchema } from "@shared/schema";
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

  // Get available time slots for a specific date
  app.get("/api/available-times/:date", async (req, res) => {
    try {
      const { date } = req.params;
      
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
      }

      // Available time slots (9:00 AM to 6:00 PM, excluding lunch 12:00-13:00)
      const allTimeSlots = [
        "09:00", "10:30", "13:00", "14:30", "16:00"
      ];

      // Check which slots are available
      const availableSlots = [];
      for (const time of allTimeSlots) {
        const isAvailable = await storage.isTimeSlotAvailable(date, time);
        if (isAvailable) {
          availableSlots.push(time);
        }
      }

      res.json(availableSlots);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch available times" });
    }
  });

  // Create new appointment
  app.post("/api/appointments", async (req, res) => {
    try {
      const validatedData = insertAppointmentSchema.parse(req.body);
      
      // Check if the time slot is still available
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
      res.status(201).json(appointment);
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
    
    // Simple authentication - you can change these credentials
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

  const httpServer = createServer(app);
  return httpServer;
}
