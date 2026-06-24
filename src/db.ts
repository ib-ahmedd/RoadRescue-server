import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------- Types -------

export interface Provider {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  speciality: string;
  rating: number;
  reviews: number;
  status: "Available" | "Dispatched" | "Offline";
  avatar: string;
}

export interface RequestData {
  id: string;
  name: string;
  phone: string;
  email: string;
  service: string;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  location: string;
  landmark: string;
  notes: string;
  status: "received" | "matched" | "en-route" | "arrived" | "completed";
  assignedProvider: Provider | null;
  contacted: boolean;
  createdAt: string;
}

export interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  requestId: string;
  customerName: string;
  customerPhone: string;
  reason: string;
  description: string;
  status: "open" | "reviewing" | "resolved";
  createdAt: string;
}

export interface Application {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  speciality: string;
  avatar: string;
  licenseId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

// ------- Database Setup -------

const dbFile = path.join(__dirname, "..", "data", "roadrescue.db");

// Ensure data directory exists
import fs from "fs";
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbFile);

// Enable WAL mode for better concurrent performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// ------- Schema -------

db.exec(`
  CREATE TABLE IF NOT EXISTS providers (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    phone       TEXT NOT NULL,
    vehicle     TEXT NOT NULL,
    plate       TEXT NOT NULL,
    speciality  TEXT NOT NULL,
    rating      REAL NOT NULL DEFAULT 0,
    reviews     INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'Available',
    avatar      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS requests (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    phone             TEXT NOT NULL,
    email             TEXT NOT NULL DEFAULT '',
    service           TEXT NOT NULL,
    vehicleType       TEXT NOT NULL,
    vehicleMake       TEXT NOT NULL DEFAULT '',
    vehicleModel      TEXT NOT NULL DEFAULT '',
    vehicleYear       TEXT NOT NULL DEFAULT '',
    vehicleColor      TEXT NOT NULL DEFAULT '',
    location          TEXT NOT NULL,
    landmark          TEXT NOT NULL DEFAULT '',
    notes             TEXT NOT NULL DEFAULT '',
    status            TEXT NOT NULL DEFAULT 'received',
    assignedProvider  TEXT,
    contacted         INTEGER NOT NULL DEFAULT 0,
    createdAt         TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id        TEXT PRIMARY KEY,
    name      TEXT NOT NULL,
    email     TEXT NOT NULL,
    subject   TEXT NOT NULL,
    message   TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS disputes (
    id            TEXT PRIMARY KEY,
    requestId     TEXT NOT NULL,
    customerName  TEXT NOT NULL,
    customerPhone TEXT NOT NULL,
    reason        TEXT NOT NULL,
    description   TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'open',
    createdAt     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS applications (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    phone         TEXT NOT NULL,
    vehicle       TEXT NOT NULL,
    plate         TEXT NOT NULL,
    speciality    TEXT NOT NULL,
    avatar        TEXT NOT NULL,
    licenseId     TEXT NOT NULL,
    licenseImage  TEXT NOT NULL DEFAULT '',
    status        TEXT NOT NULL DEFAULT 'pending',
    createdAt     TEXT NOT NULL
  );
`);

try {
  db.exec("ALTER TABLE applications ADD COLUMN licenseImage TEXT NOT NULL DEFAULT ''");
} catch (e) {
  // Column already exists, safe to ignore
}

// ------- Seed initial data from db.json if tables are empty -------

function seedFromJson() {
  const jsonPath = path.join(
    __dirname,
    "..",
    "..",
    "frontend",
    "src",
    "data",
    "db.json"
  );
  if (!fs.existsSync(jsonPath)) return;

  const providerCount = (
    db.prepare("SELECT COUNT(*) as c FROM providers").get() as { c: number }
  ).c;
  const requestCount = (
    db.prepare("SELECT COUNT(*) as c FROM requests").get() as { c: number }
  ).c;

  if (providerCount > 0 && requestCount > 0) return; // already seeded

  try {
    const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    if (providerCount === 0 && jsonData.providers?.length) {
      const insertProvider = db.prepare(`
        INSERT OR IGNORE INTO providers (id, name, phone, vehicle, plate, speciality, rating, reviews, status, avatar)
        VALUES (@id, @name, @phone, @vehicle, @plate, @speciality, @rating, @reviews, @status, @avatar)
      `);
      const seedProviders = db.transaction((providers: Provider[]) => {
        for (const p of providers) insertProvider.run(p);
      });
      seedProviders(jsonData.providers);
      console.log(`✅ Seeded ${jsonData.providers.length} providers from db.json`);
    }

    if (requestCount === 0 && jsonData.requests?.length) {
      const insertRequest = db.prepare(`
        INSERT OR IGNORE INTO requests
          (id, name, phone, email, service, vehicleType, vehicleMake, vehicleModel,
           vehicleYear, vehicleColor, location, landmark, notes, status,
           assignedProvider, contacted, createdAt)
        VALUES
          (@id, @name, @phone, @email, @service, @vehicleType, @vehicleMake, @vehicleModel,
           @vehicleYear, @vehicleColor, @location, @landmark, @notes, @status,
           @assignedProvider, @contacted, @createdAt)
      `);
      const seedRequests = db.transaction((requests: RequestData[]) => {
        for (const r of requests) {
          insertRequest.run({
            ...r,
            email: r.email || "",
            vehicleMake: r.vehicleMake || "",
            vehicleModel: r.vehicleModel || "",
            vehicleYear: r.vehicleYear || "",
            vehicleColor: r.vehicleColor || "",
            landmark: r.landmark || "",
            notes: r.notes || "",
            assignedProvider: r.assignedProvider
              ? JSON.stringify(r.assignedProvider)
              : null,
            contacted: r.contacted ? 1 : 0,
          });
        }
      });
      seedRequests(jsonData.requests);
      console.log(`✅ Seeded ${jsonData.requests.length} requests from db.json`);
    }
  } catch (err) {
    console.warn("⚠️  Could not seed from db.json:", err);
  }
}

seedFromJson();

// ------- Helper to parse a row's assignedProvider JSON -------

function parseRequest(row: Record<string, unknown>): RequestData {
  return {
    ...(row as Omit<RequestData, "assignedProvider" | "contacted">),
    assignedProvider: row.assignedProvider
      ? JSON.parse(row.assignedProvider as string)
      : null,
    contacted: row.contacted === 1,
  };
}

// ------- Provider Functions -------

export function getProviders(): Provider[] {
  return db.prepare("SELECT * FROM providers").all() as Provider[];
}

export function getProviderById(id: string): Provider | null {
  return (
    (db.prepare("SELECT * FROM providers WHERE id = ?").get(id) as Provider) ||
    null
  );
}

export function addProvider(
  provider: Omit<Provider, "id" | "rating" | "reviews" | "status">
): Provider {
  const id =
    "SP-" + Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(3, "0");
  const newProvider: Provider = {
    ...provider,
    id,
    rating: 0,
    reviews: 0,
    status: "Available",
  };
  db.prepare(`
    INSERT INTO providers (id, name, phone, vehicle, plate, speciality, rating, reviews, status, avatar)
    VALUES (@id, @name, @phone, @vehicle, @plate, @speciality, @rating, @reviews, @status, @avatar)
  `).run(newProvider);
  return newProvider;
}

export function updateProvider(
  id: string,
  updates: Partial<Provider>
): Provider | null {
  const existing = getProviderById(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  db.prepare(`
    UPDATE providers
    SET name=@name, phone=@phone, vehicle=@vehicle, plate=@plate,
        speciality=@speciality, rating=@rating, reviews=@reviews, status=@status, avatar=@avatar
    WHERE id=@id
  `).run(updated);
  return updated;
}

// ------- Request Functions -------

export function getRequests(): RequestData[] {
  const rows = db
    .prepare("SELECT * FROM requests ORDER BY createdAt DESC")
    .all() as Record<string, unknown>[];
  return rows.map(parseRequest);
}

export function getRequestById(id: string): RequestData | null {
  const row = db
    .prepare("SELECT * FROM requests WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? parseRequest(row) : null;
}

export function addRequest(
  request: Omit<
    RequestData,
    "id" | "createdAt" | "status" | "assignedProvider" | "contacted"
  >
): RequestData {
  const id = "RR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const newRequest: RequestData = {
    ...request,
    id,
    status: "received",
    assignedProvider: null,
    contacted: false,
    createdAt: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO requests
      (id, name, phone, email, service, vehicleType, vehicleMake, vehicleModel,
       vehicleYear, vehicleColor, location, landmark, notes, status,
       assignedProvider, contacted, createdAt)
    VALUES
      (@id, @name, @phone, @email, @service, @vehicleType, @vehicleMake, @vehicleModel,
       @vehicleYear, @vehicleColor, @location, @landmark, @notes, @status,
       @assignedProvider, @contacted, @createdAt)
  `).run({
    ...newRequest,
    assignedProvider: null,
    contacted: 0,
  });
  return newRequest;
}

export function updateRequest(
  id: string,
  updates: Partial<RequestData>
): RequestData | null {
  const existing = getRequestById(id);
  if (!existing) return null;

  const updated: RequestData = { ...existing, ...updates };

  // If a provider was newly assigned, mark them as Dispatched
  if (
    updates.assignedProvider &&
    (!existing.assignedProvider ||
      existing.assignedProvider.id !== updates.assignedProvider.id)
  ) {
    db.prepare("UPDATE providers SET status = 'Dispatched' WHERE id = ?").run(
      updates.assignedProvider.id
    );
  }

  // If completed, release provider back to Available
  if (updates.status === "completed" && existing.assignedProvider) {
    db.prepare("UPDATE providers SET status = 'Available' WHERE id = ?").run(
      existing.assignedProvider.id
    );
  }

  db.prepare(`
    UPDATE requests
    SET name=@name, phone=@phone, email=@email, service=@service,
        vehicleType=@vehicleType, vehicleMake=@vehicleMake, vehicleModel=@vehicleModel,
        vehicleYear=@vehicleYear, vehicleColor=@vehicleColor, location=@location,
        landmark=@landmark, notes=@notes, status=@status,
        assignedProvider=@assignedProvider, contacted=@contacted
    WHERE id=@id
  `).run({
    ...updated,
    assignedProvider: updated.assignedProvider
      ? JSON.stringify(updated.assignedProvider)
      : null,
    contacted: updated.contacted ? 1 : 0,
  });

  return updated;
}

// ------- Contact Functions -------

export function getContacts(): ContactSubmission[] {
  return db
    .prepare("SELECT * FROM contacts ORDER BY createdAt DESC")
    .all() as ContactSubmission[];
}

export function addContact(
  contact: Omit<ContactSubmission, "id" | "createdAt">
): ContactSubmission {
  const newContact: ContactSubmission = {
    ...contact,
    id: "CT-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    createdAt: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO contacts (id, name, email, subject, message, createdAt)
    VALUES (@id, @name, @email, @subject, @message, @createdAt)
  `).run(newContact);
  return newContact;
}

// ------- Dispute Functions -------

export function getDisputes(): Dispute[] {
  return db
    .prepare("SELECT * FROM disputes ORDER BY createdAt DESC")
    .all() as Dispute[];
}

export function addDispute(
  dispute: Omit<Dispute, "id" | "createdAt" | "status">
): Dispute {
  const newDispute: Dispute = {
    ...dispute,
    id: "DS-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
    status: "open",
    createdAt: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO disputes (id, requestId, customerName, customerPhone, reason, description, status, createdAt)
    VALUES (@id, @requestId, @customerName, @customerPhone, @reason, @description, @status, @createdAt)
  `).run(newDispute);
  return newDispute;
}

export function updateDisputeStatus(
  id: string,
  status: Dispute["status"]
): Dispute | null {
  const existing = db.prepare("SELECT * FROM disputes WHERE id = ?").get(id) as Dispute | undefined;
  if (!existing) return null;
  db.prepare("UPDATE disputes SET status = ? WHERE id = ?").run(status, id);
  return { ...existing, status };
}

// ------- Application Functions -------

export function getApplications(): Application[] {
  return db
    .prepare("SELECT * FROM applications ORDER BY createdAt DESC")
    .all() as Application[];
}

export function getApplicationById(id: string): Application | null {
  return (
    (db.prepare("SELECT * FROM applications WHERE id = ?").get(id) as Application) ||
    null
  );
}

export function addApplication(
  app: Omit<Application, "id" | "status" | "createdAt">
): Application {
  const id = "APP-" + Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(3, "0");
  const newApp: Application = {
    ...app,
    id,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO applications (id, name, phone, vehicle, plate, speciality, avatar, licenseId, licenseImage, status, createdAt)
    VALUES (@id, @name, @phone, @vehicle, @plate, @speciality, @avatar, @licenseId, @licenseImage, @status, @createdAt)
  `).run(newApp);
  return newApp;
}

export function updateApplicationStatus(
  id: string,
  status: "approved" | "rejected"
): Application | null {
  const existing = getApplicationById(id);
  if (!existing) return null;

  db.prepare("UPDATE applications SET status = ? WHERE id = ?").run(status, id);

  // If approved, create corresponding active provider
  if (status === "approved") {
    // Check if provider already exists to prevent duplicate key
    const existingProv = db.prepare("SELECT * FROM providers WHERE name = ? AND phone = ?").get(existing.name, existing.phone);
    if (!existingProv) {
      addProvider({
        name: existing.name,
        phone: existing.phone,
        vehicle: existing.vehicle,
        plate: existing.plate,
        speciality: existing.speciality,
        avatar: existing.avatar,
      });
    }
  }

  return { ...existing, status };
}

function seedApplications() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM applications").get() as { c: number }).c;
  if (count > 0) return;

  const mockApps = [
    {
      id: "APP-001",
      name: "John Wayne Towing",
      phone: "+1 (555) 321-7654",
      vehicle: "Flatbed Truck (Dodge Ram 5500)",
      plate: "JW-TOW-1",
      speciality: "towing",
      avatar: "JW",
      licenseId: "DL-9827361",
      licenseImage: "/mock_driver_license.jpg",
      status: "pending",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(), // 4 hours ago
    },
    {
      id: "APP-002",
      name: "Sarah Jenkins Locksmith",
      phone: "+1 (555) 789-0123",
      vehicle: "Utility Van (Ford Transit)",
      plate: "LOCK-SJ7",
      speciality: "lockout",
      avatar: "SJ",
      licenseId: "DL-3847291",
      licenseImage: "/mock_driver_license.jpg",
      status: "pending",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    }
  ];

  const insert = db.prepare(`
    INSERT INTO applications (id, name, phone, vehicle, plate, speciality, avatar, licenseId, licenseImage, status, createdAt)
    VALUES (@id, @name, @phone, @vehicle, @plate, @speciality, @avatar, @licenseId, @licenseImage, @status, @createdAt)
  `);

  for (const app of mockApps) {
    insert.run(app);
  }
  console.log(`✅ Seeded ${mockApps.length} technician applications.`);
}

// Run application seeder
seedApplications();

export default db;
