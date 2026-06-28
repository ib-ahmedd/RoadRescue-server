import { Router, Request, Response } from "express";
import { verifyPassword } from "../auth";
import {
  getProviders,
  getProviderById,
  addProvider,
  updateProvider,
  getProviderByUsername,
} from "../db";

const router = Router();

// GET /api/providers          → all providers
// GET /api/providers?id=SP-001 → single provider
router.get("/", (req: Request, res: Response) => {
  const { id } = req.query;
  if (id) {
    const provider = getProviderById(id as string);
    if (!provider) {
      res.status(404).json({ error: "Provider not found" });
      return;
    }
    res.json(provider);
    return;
  }
  res.json(getProviders());
});

// POST /api/providers/login → technician sign in
router.post("/login", (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required." });
    return;
  }

  const provider = getProviderByUsername(username);
  if (!provider || !provider.password || !verifyPassword(password, provider.password)) {
    res.status(401).json({ error: "Invalid username or password." });
    return;
  }

  const { password: _, ...publicProvider } = provider;
  res.json(publicProvider);
});

// POST /api/providers → add a new provider
router.post("/", (req: Request, res: Response) => {
  const { name, phone, vehicle, plate, speciality, avatar } = req.body;
  if (!name || !phone || !vehicle || !plate || !speciality || !avatar) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const newProvider = addProvider({ name, phone, vehicle, plate, speciality, avatar });
  res.status(201).json(newProvider);
});

// PATCH /api/providers → update a provider
router.patch("/", (req: Request, res: Response) => {
  const { id, ...updates } = req.body;
  if (!id) {
    res.status(400).json({ error: "Missing provider ID" });
    return;
  }
  const updated = updateProvider(id, updates);
  if (!updated) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  res.json(updated);
});

export default router;
