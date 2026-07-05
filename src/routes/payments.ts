import { Router, Request, Response } from "express";
import { getPayments, getPaymentSummary } from "../db";

const router = Router();

// GET /api/payments/summary → account balance totals
router.get("/summary", (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json(getPaymentSummary());
});

// GET /api/payments → all payment transactions (newest first)
router.get("/", (_req: Request, res: Response) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json(getPayments());
});

export default router;
