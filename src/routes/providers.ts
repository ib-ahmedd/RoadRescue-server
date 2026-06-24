import { Router, Request, Response } from "express";
import {
  getProviders,
  getProviderById,
  addProvider,
  updateProvider,
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
