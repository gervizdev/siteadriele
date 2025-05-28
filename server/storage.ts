import { 
  services, 
  appointments, 
  contactMessages,
  type Service, 
  type InsertService,
  type Appointment, 
  type InsertAppointment,
  type ContactMessage,
  type InsertContactMessage
} from "@shared/schema";

export interface IStorage {
  // Services
  getServices(): Promise<Service[]>;
  getService(id: number): Promise<Service | undefined>;
  
  // Appointments
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  getAppointments(): Promise<Appointment[]>;
  getAppointmentsByDate(date: string): Promise<Appointment[]>;
  isTimeSlotAvailable(date: string, time: string): Promise<boolean>;
  
  // Contact Messages
  createContactMessage(message: InsertContactMessage): Promise<ContactMessage>;
  getContactMessages(): Promise<ContactMessage[]>;
}

export class MemStorage implements IStorage {
  private services: Map<number, Service>;
  private appointments: Map<number, Appointment>;
  private contactMessages: Map<number, ContactMessage>;
  private currentServiceId: number;
  private currentAppointmentId: number;
  private currentContactMessageId: number;

  constructor() {
    this.services = new Map();
    this.appointments = new Map();
    this.contactMessages = new Map();
    this.currentServiceId = 1;
    this.currentAppointmentId = 1;
    this.currentContactMessageId = 1;
    
    // Initialize default services
    this.initializeDefaultServices();
  }

  private initializeDefaultServices() {
    const defaultServices: InsertService[] = [
      {
        name: "Clássico",
        description: "Extensão fio a fio para um look natural e elegante. Perfeito para o dia a dia.",
        price: 12000, // R$ 120.00 in cents
        duration: 120, // 2 hours
      },
      {
        name: "Volume",
        description: "Técnica 2D-3D para mais volume e densidade. Ideal para ocasiões especiais.",
        price: 18000, // R$ 180.00 in cents
        duration: 150, // 2.5 hours
      },
      {
        name: "Mega Volume",
        description: "Técnica 4D-6D para máximo volume e impacto. Look dramático e glamouroso.",
        price: 25000, // R$ 250.00 in cents
        duration: 180, // 3 hours
      },
    ];

    defaultServices.forEach(service => {
      const id = this.currentServiceId++;
      const serviceWithId: Service = { ...service, id };
      this.services.set(id, serviceWithId);
    });
  }

  async getServices(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  async getService(id: number): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const id = this.currentAppointmentId++;
    const appointment: Appointment = {
      ...insertAppointment,
      id,
      createdAt: new Date(),
    };
    this.appointments.set(id, appointment);
    return appointment;
  }

  async getAppointments(): Promise<Appointment[]> {
    return Array.from(this.appointments.values());
  }

  async getAppointmentsByDate(date: string): Promise<Appointment[]> {
    return Array.from(this.appointments.values()).filter(
      appointment => appointment.date === date
    );
  }

  async isTimeSlotAvailable(date: string, time: string): Promise<boolean> {
    const existingAppointment = Array.from(this.appointments.values()).find(
      appointment => appointment.date === date && appointment.time === time
    );
    return !existingAppointment;
  }

  async createContactMessage(insertMessage: InsertContactMessage): Promise<ContactMessage> {
    const id = this.currentContactMessageId++;
    const message: ContactMessage = {
      ...insertMessage,
      id,
      createdAt: new Date(),
    };
    this.contactMessages.set(id, message);
    return message;
  }

  async getContactMessages(): Promise<ContactMessage[]> {
    return Array.from(this.contactMessages.values());
  }
}

export const storage = new MemStorage();
