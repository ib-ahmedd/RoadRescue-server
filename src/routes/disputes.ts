import { Router, Request, Response } from "express";
import { addDispute, getDisputes, updateDisputeStatus } from "../db";

const router = Router();

// GET /api/disputes → list all disputes (admin)
router.get("/", (_req: Request, res: Response) => {
  try {
    res.json(getDisputes());
  } catch (err) {
    console.error("GET /api/disputes error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/disputes → user submits a dispute
router.post("/", (req: Request, res: Response) => {
  const { requestId, customerName, customerPhone, reason, description } = req.body;

  if (!requestId || !customerName || !customerPhone || !reason || !description) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const dispute = addDispute({ requestId, customerName, customerPhone, reason, description });
  res.status(201).json({ success: true, dispute });
});

// PATCH /api/disputes → update dispute status (admin)
router.patch("/", (req: Request, res: Response) => {
  const { id, status } = req.body;

  if (!id || !["open", "reviewing", "resolved"].includes(status)) {
    res.status(400).json({ error: "Invalid id or status" });
    return;
  }

  const updated = updateDisputeStatus(id, status);
  if (!updated) {
    res.status(404).json({ error: "Dispute not found" });
    return;
  }

  res.json(updated);
});

export default router;
