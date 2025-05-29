import { 
  services, 
  appointments, 
  contactMessages,
  availableSlots,
  type Service, 
  type InsertService,
  type Appointment, 
  type InsertAppointment,
  type ContactMessage,
  type InsertContactMessage,
  type AvailableSlot,
  type InsertAvailableSlot
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Services
  getServices(): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: number, service: InsertService): Promise<Service>;
  deleteService(id: number): Promise<void>;
  
  // Appointments
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  getAppointments(): Promise<Appointment[]>;
  getAppointmentsByDate(date: string): Promise<Appointment[]>;
  isTimeSlotAvailable(date: string, time: string): Promise<boolean>;
  
  // Contact Messages
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  getContactMessages(): Promise<ContactMessage[]>;
  
  // Available Slots Management
  createAvailableSlot(slot: InsertAvailableSlot): Promise<AvailableSlot>;
  getAvailableSlots(date: string): Promise<AvailableSlot[]>;
  updateSlotAvailability(id: number, isAvailable: boolean): Promise<void>;
  deleteAvailableSlot(id: number): Promise<void>;
  getAvailableTimes(date: string): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  // Services
  async getServices(): Promise<Service[]> {
    return await db.select().from(services);
  }

  async getService(id: number): Promise<Service | undefined> {
    const [service] = await db.select().from(services).where(eq(services.id, id));
    return service || undefined;
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db
      .insert(services)
      .values(service)
      .returning();
    return newService;
  }

  async updateService(id: number, service: InsertService): Promise<Service> {
    const [updatedService] = await db
      .update(services)
      .set(service)
      .where(eq(services.id, id))
      .returning();
    return updatedService;
  }

  async deleteService(id: number): Promise<void> {
    await db
      .delete(services)
      .where(eq(services.id, id));
  }

  // Appointments
  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const [appointment] = await db
      .insert(appointments)
      .values(insertAppointment)
      .returning();
    return appointment;
  }

  async getAppointments(): Promise<Appointment[]> {
    return await db.select().from(appointments);
  }

  async getAppointmentsByDate(date: string): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.date, date));
  }

  async isTimeSlotAvailable(date: string, time: string): Promise<boolean> {
    const existingAppointments = await db
      .select()
      .from(appointments)
      .where(eq(appointments.date, date));
    
    const timeSlotTaken = existingAppointments.some(
      appointment => appointment.time === time
    );
    return !timeSlotTaken;
  }

  async updateAppointment(id: number, data: InsertAppointment): Promise<Appointment> {
    const [updated] = await db
      .update(appointments)
      .set(data)
      .where(eq(appointments.id, id))
      .returning();
    return updated;
  }

  async deleteAppointment(id: number): Promise<void> {
    await db.delete(appointments).where(eq(appointments.id, id));
  }

  // Contact Messages
  async createContactMessage(insertMessage: InsertContactMessage): Promise<ContactMessage> {
    const [message] = await db
      .insert(contactMessages)
      .values(insertMessage)
      .returning();
    return message;
  }

  async getContactMessages(): Promise<ContactMessage[]> {
    return await db.select().from(contactMessages);
  }

  async updateContactMessage(id: number, data: InsertContactMessage): Promise<ContactMessage> {
    const [updated] = await db
      .update(contactMessages)
      .set(data)
      .where(eq(contactMessages.id, id))
      .returning();
    return updated;
  }

  async deleteContactMessage(id: number): Promise<void> {
    await db.delete(contactMessages).where(eq(contactMessages.id, id));
  }

  // Available Slots Management
  async createAvailableSlot(insertSlot: InsertAvailableSlot): Promise<AvailableSlot> {
    const [slot] = await db
      .insert(availableSlots)
      .values(insertSlot)
      .returning();
    return slot;
  }

  async getAvailableSlots(date: string): Promise<AvailableSlot[]> {
    return await db
      .select()
      .from(availableSlots)
      .where(eq(availableSlots.date, date));
  }

  async updateSlotAvailability(id: number, isAvailable: boolean): Promise<void> {
    await db
      .update(availableSlots)
      .set({ isAvailable })
      .where(eq(availableSlots.id, id));
  }

  async deleteAvailableSlot(id: number): Promise<void> {
    await db
      .delete(availableSlots)
      .where(eq(availableSlots.id, id));
  }

  async getAvailableTimes(date: string): Promise<string[]> {
    const dbSlots = await db
      .select()
      .from(availableSlots)
      .where(eq(availableSlots.date, date));
    
    const activeSlots = dbSlots.filter((slot: AvailableSlot) => slot.isAvailable);
    const bookedTimes = await db
      .select()
      .from(appointments)
      .where(eq(appointments.date, date));
    
    const bookedTimesList = bookedTimes.map(appointment => appointment.time);
    
    return activeSlots
      .filter((slot: AvailableSlot) => !bookedTimesList.includes(slot.time))
      .map((slot: AvailableSlot) => slot.time)
      .sort();
  }
}

export const storage = new DatabaseStorage();
