import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

// Resolved from the server package root (npm scripts run with cwd = server/).
const SERVER_ROOT = process.cwd();

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
  arrivalConfirmed: boolean;
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
  username: string | null;
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
  licenseImage: string;
  status: "pending" | "approved" | "rejected";
  providerId: string | null;
  registered: boolean;
  createdAt: string;
}

export interface ApplicationTrackView {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  plate: string;
  speciality: string;
  status: Application["status"];
  providerId: string | null;
  registered: boolean;
  canRegister: boolean;
  createdAt: string;
}

// ------- Database Setup -------

const dbFile = path.join(SERVER_ROOT, "data", "roadrescue.db");

const dataDir = path.join(SERVER_ROOT, "data");
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

try {
  db.exec("ALTER TABLE applications ADD COLUMN providerId TEXT");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE applications ADD COLUMN registered INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE providers ADD COLUMN username TEXT");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE providers ADD COLUMN password TEXT");
} catch (e) {
  // Column already exists
}

try {
  db.exec("ALTER TABLE requests ADD COLUMN arrivalConfirmed INTEGER NOT NULL DEFAULT 0");
} catch (e) {
  // Column already exists
}

try {
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_providers_username ON providers(username) WHERE username IS NOT NULL");
} catch (e) {
  // Index already exists
}

// ------- Seed initial data from db.json if tables are empty -------

function seedFromJson() {
  const jsonPath = path.join(
    SERVER_ROOT,
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
    ...(row as Omit<RequestData, "assignedProvider" | "contacted" | "arrivalConfirmed">),
    assignedProvider: row.assignedProvider
      ? JSON.parse(row.assignedProvider as string)
      : null,
    contacted: row.contacted === 1,
    arrivalConfirmed: row.arrivalConfirmed === 1 || row.arrivalConfirmed === true,
  };
}

// ------- Provider Functions -------

function parseProvider(row: Record<string, unknown>): Provider {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    vehicle: row.vehicle as string,
    plate: row.plate as string,
    speciality: row.speciality as string,
    rating: row.rating as number,
    reviews: row.reviews as number,
    status: row.status as Provider["status"],
    avatar: row.avatar as string,
    username: (row.username as string | null) ?? null,
  };
}

export function getProviders(): Provider[] {
  return db
    .prepare(
      "SELECT id, name, phone, vehicle, plate, speciality, rating, reviews, status, avatar, username FROM providers"
    )
    .all()
    .map((row) => parseProvider(row as Record<string, unknown>));
}

export function getProviderById(id: string): Provider | null {
  const row = db
    .prepare(
      "SELECT id, name, phone, vehicle, plate, speciality, rating, reviews, status, avatar, username FROM providers WHERE id = ?"
    )
    .get(id) as Record<string, unknown> | undefined;
  return row ? parseProvider(row) : null;
}

export function getProviderByUsername(username: string): (Provider & { password: string | null }) | null {
  const row = db
    .prepare("SELECT * FROM providers WHERE username = ? COLLATE NOCASE")
    .get(username.trim()) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    ...parseProvider(row),
    password: (row.password as string | null) ?? null,
  };
}

export function isUsernameTaken(username: string): boolean {
  const row = db
    .prepare("SELECT id FROM providers WHERE username = ? COLLATE NOCASE")
    .get(username.trim());
  return !!row;
}

export function addProvider(
  provider: Omit<Provider, "id" | "rating" | "reviews" | "status" | "username">
): Provider {
  const id =
    "SP-" + Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(3, "0");
  const newProvider: Provider = {
    ...provider,
    id,
    rating: 0,
    reviews: 0,
    status: "Available",
    username: null,
  };
  db.prepare(`
    INSERT INTO providers (id, name, phone, vehicle, plate, speciality, rating, reviews, status, avatar, username, password)
    VALUES (@id, @name, @phone, @vehicle, @plate, @speciality, @rating, @reviews, @status, @avatar, @username, NULL)
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
        speciality=@speciality, rating=@rating, reviews=@reviews, status=@status, avatar=@avatar,
        username=@username
    WHERE id=@id
  `).run(updated);
  return updated;
}

export function setProviderCredentials(
  id: string,
  username: string,
  passwordHash: string
): Provider | null {
  const existing = getProviderById(id);
  if (!existing) return null;

  db.prepare("UPDATE providers SET username = ?, password = ? WHERE id = ?").run(
    username.trim(),
    passwordHash,
    id
  );

  return getProviderById(id);
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
    "id" | "createdAt" | "status" | "assignedProvider" | "contacted" | "arrivalConfirmed"
  >
): RequestData {
  const id = "RR-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const newRequest: RequestData = {
    ...request,
    id,
    status: "received",
    assignedProvider: null,
    contacted: false,
    arrivalConfirmed: false,
    createdAt: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO requests
      (id, name, phone, email, service, vehicleType, vehicleMake, vehicleModel,
       vehicleYear, vehicleColor, location, landmark, notes, status,
       assignedProvider, contacted, arrivalConfirmed, createdAt)
    VALUES
      (@id, @name, @phone, @email, @service, @vehicleType, @vehicleMake, @vehicleModel,
       @vehicleYear, @vehicleColor, @location, @landmark, @notes, @status,
       @assignedProvider, @contacted, @arrivalConfirmed, @createdAt)
  `).run({
    ...newRequest,
    assignedProvider: null,
    contacted: 0,
    arrivalConfirmed: 0,
  });
  return newRequest;
}

export function updateRequest(
  id: string,
  updates: Partial<RequestData>,
  options?: { allowCustomerCompletion?: boolean; allowCustomerArrival?: boolean }
): RequestData | null {
  const existing = getRequestById(id);
  if (!existing) return null;

  if (updates.arrivalConfirmed && !options?.allowCustomerArrival) {
    throw new Error("ARRIVAL_REQUIRES_CUSTOMER");
  }

  if (updates.status === "completed" && !options?.allowCustomerCompletion) {
    throw new Error("COMPLETION_REQUIRES_CUSTOMER");
  }

  if (updates.status === "completed" && existing.status !== "arrived") {
    throw new Error("MUST_BE_ARRIVED");
  }

  if (updates.status === "arrived" && existing.status !== "arrived") {
    updates.arrivalConfirmed = false;
  }

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
        assignedProvider=@assignedProvider, contacted=@contacted,
        arrivalConfirmed=@arrivalConfirmed
    WHERE id=@id
  `).run({
    ...updated,
    assignedProvider: updated.assignedProvider
      ? JSON.stringify(updated.assignedProvider)
      : null,
    contacted: updated.contacted ? 1 : 0,
    arrivalConfirmed: updated.arrivalConfirmed ? 1 : 0,
  });

  return updated;
}

/** Customer confirms the technician has arrived at their location. */
export function confirmRequestArrival(id: string): RequestData | null {
  const existing = getRequestById(id);
  if (!existing || existing.status !== "arrived") return null;
  if (existing.arrivalConfirmed) return existing;
  return updateRequest(id, { arrivalConfirmed: true }, { allowCustomerArrival: true });
}

/** Mark a request completed after the customer confirms on the tracking page. */
export function confirmRequestCompletion(id: string): RequestData | null {
  const existing = getRequestById(id);
  if (!existing || existing.status !== "arrived") return null;
  if (!existing.arrivalConfirmed) return null;
  return updateRequest(id, { status: "completed" }, { allowCustomerCompletion: true });
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

function parseApplication(row: Record<string, unknown>): Application {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: row.phone as string,
    vehicle: row.vehicle as string,
    plate: row.plate as string,
    speciality: row.speciality as string,
    avatar: row.avatar as string,
    licenseId: row.licenseId as string,
    licenseImage: (row.licenseImage as string) || "",
    status: row.status as Application["status"],
    providerId: (row.providerId as string | null) ?? null,
    registered: row.registered === 1 || row.registered === true,
    createdAt: row.createdAt as string,
  };
}

export function toApplicationTrackView(app: Application): ApplicationTrackView {
  return {
    id: app.id,
    name: app.name,
    phone: app.phone,
    vehicle: app.vehicle,
    plate: app.plate,
    speciality: app.speciality,
    status: app.status,
    providerId: app.providerId,
    registered: app.registered,
    canRegister: app.status === "approved" && !app.registered && !!app.providerId,
    createdAt: app.createdAt,
  };
}

export function getApplications(): Application[] {
  return db
    .prepare("SELECT * FROM applications ORDER BY createdAt DESC")
    .all()
    .map((row) => parseApplication(row as Record<string, unknown>));
}

export function getApplicationById(id: string): Application | null {
  const row = db
    .prepare("SELECT * FROM applications WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
  return row ? parseApplication(row) : null;
}

export function addApplication(
  app: Omit<Application, "id" | "status" | "createdAt" | "providerId" | "registered">
): Application {
  const id = "APP-" + Math.random().toString(36).substring(2, 6).toUpperCase().padEnd(3, "0");
  const newApp: Application = {
    ...app,
    id,
    status: "pending",
    providerId: null,
    registered: false,
    createdAt: new Date().toISOString(),
  };
  db.prepare(`
    INSERT INTO applications (id, name, phone, vehicle, plate, speciality, avatar, licenseId, licenseImage, status, providerId, registered, createdAt)
    VALUES (@id, @name, @phone, @vehicle, @plate, @speciality, @avatar, @licenseId, @licenseImage, @status, @providerId, @registered, @createdAt)
  `).run({ ...newApp, registered: 0 });
  return newApp;
}

export function updateApplicationStatus(
  id: string,
  status: "approved" | "rejected"
): Application | null {
  const existing = getApplicationById(id);
  if (!existing) return null;

  db.prepare("UPDATE applications SET status = ? WHERE id = ?").run(status, id);

  let providerId = existing.providerId;

  if (status === "approved") {
    providerId = linkProviderForApprovedApplication(existing);
    db.prepare("UPDATE applications SET providerId = ? WHERE id = ?").run(providerId, id);
  }

  return getApplicationById(id);
}

function linkProviderForApprovedApplication(app: Application): string {
  const existingProv = db
    .prepare("SELECT id FROM providers WHERE name = ? AND phone = ?")
    .get(app.name, app.phone) as { id: string } | undefined;

  if (existingProv) return existingProv.id;

  const provider = addProvider({
    name: app.name,
    phone: app.phone,
    vehicle: app.vehicle,
    plate: app.plate,
    speciality: app.speciality,
    avatar: app.avatar,
  });
  return provider.id;
}

/** Ensures approved applications have a linked provider (fixes legacy rows). */
export function getApplicationForTracking(id: string): Application | null {
  const app = getApplicationById(id);
  if (!app) return null;

  if (app.status === "approved" && !app.providerId) {
    const providerId = linkProviderForApprovedApplication(app);
    db.prepare("UPDATE applications SET providerId = ? WHERE id = ?").run(providerId, app.id);
    return getApplicationById(id);
  }

  return app;
}

export function registerApplicationAccount(
  applicationId: string,
  username: string,
  passwordHash: string
): { application: Application; provider: Provider } | null {
  const app = getApplicationForTracking(applicationId);
  if (!app || app.status !== "approved" || app.registered || !app.providerId) {
    return null;
  }

  if (isUsernameTaken(username)) {
    throw new Error("USERNAME_TAKEN");
  }

  const provider = setProviderCredentials(app.providerId, username, passwordHash);
  if (!provider) return null;

  db.prepare("UPDATE applications SET registered = 1 WHERE id = ?").run(applicationId);

  const updatedApp = getApplicationById(applicationId);
  if (!updatedApp) return null;

  return { application: updatedApp, provider };
}

function seedApplications() {
  const count = (db.prepare("SELECT COUNT(*) as c FROM applications").get() as { c: number }).c;
  if (count > 0) return;

  const mockApps = [
    {
      id: "APP-001",
      name: "Musa Bello Towing",
      phone: "08033217654",
      vehicle: "Flatbed Truck (Isuzu FRR)",
      plate: "KAD-TOW1",
      speciality: "towing",
      avatar: "MB",
      licenseId: "KAD-9827361",
      licenseImage: "/mock_driver_license.jpg",
      status: "pending",
      providerId: null,
      registered: 0,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    },
    {
      id: "APP-002",
      name: "Fatima Yusuf Locksmith",
      phone: "08037890123",
      vehicle: "Utility Van (Toyota HiAce)",
      plate: "LAG-LS7",
      speciality: "lockout",
      avatar: "FY",
      licenseId: "LAG-3847291",
      licenseImage: "/mock_driver_license.jpg",
      status: "pending",
      providerId: null,
      registered: 0,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    }
  ];

  const insert = db.prepare(`
    INSERT INTO applications (id, name, phone, vehicle, plate, speciality, avatar, licenseId, licenseImage, status, providerId, registered, createdAt)
    VALUES (@id, @name, @phone, @vehicle, @plate, @speciality, @avatar, @licenseId, @licenseImage, @status, @providerId, @registered, @createdAt)
  `);

  for (const app of mockApps) {
    insert.run(app);
  }
  console.log(`✅ Seeded ${mockApps.length} technician applications.`);
}

// Run application seeder
seedApplications();

export default db;
