import { Router, Request, Response } from "express";
import { getTechnicianBalanceSummary, getTechnicianCredits } from "../db";

const router = Router();

// GET /api/technician-credits/summary?providerId=SP-XXX
router.get("/summary", (req: Request, res: Response) => {
  const { providerId } = req.query;
  if (!providerId || typeof providerId !== "string") {
    res.status(400).json({ error: "Missing provider ID" });
    return;
  }

  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json(getTechnicianBalanceSummary(providerId));
});

// GET /api/technician-credits?providerId=SP-XXX
router.get("/", (req: Request, res: Response) => {
  const { providerId } = req.query;
  if (!providerId || typeof providerId !== "string") {
    res.status(400).json({ error: "Missing provider ID" });
    return;
  }

  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json(getTechnicianCredits(providerId));
});

export default router;
