import { Router, Request, Response } from "express";
import {
  getRequests,
  getRequestById,
  addRequest,
  updateRequest,
  confirmRequestCompletion,
  confirmRequestArrival,
} from "../db";

const router = Router();

// GET /api/requests          → all requests (newest first)
// GET /api/requests?id=RR-XX → single request
router.get("/", (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");

  const { id } = req.query;
  if (id) {
    const data = getRequestById(id as string);
    if (!data) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(data);
    return;
  }
  res.json(getRequests());
});

// POST /api/requests → submit a new rescue request
router.post("/", (req: Request, res: Response) => {
  const { name, phone, service, vehicleType, location } = req.body;
  if (!name || !phone || !service || !vehicleType || !location) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const newRequest = addRequest({
    name,
    phone,
    email: req.body.email || "",
    service,
    vehicleType,
    vehicleMake: req.body.vehicleMake || "",
    vehicleModel: req.body.vehicleModel || "",
    vehicleYear: req.body.vehicleYear || "",
    vehicleColor: req.body.vehicleColor || "",
    location,
    landmark: req.body.landmark || "",
    notes: req.body.notes || "",
  });

  res.status(201).json(newRequest);
});

// POST /api/requests/confirm-arrival → customer confirms technician is on site
router.post("/confirm-arrival", (req: Request, res: Response) => {
  const { id } = req.body;
  if (!id) {
    res.status(400).json({ error: "Missing request ID" });
    return;
  }

  try {
    const updated = confirmRequestArrival(id);
    if (!updated) {
      res.status(400).json({
        error: "Arrival can only be confirmed after the technician has marked themselves as arrived.",
      });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("POST /api/requests/confirm-arrival error:", err);
    res.status(500).json({ error: "Failed to confirm arrival." });
  }
});

// POST /api/requests/confirm-completion → customer confirms job is done
router.post("/confirm-completion", (req: Request, res: Response) => {
  const { id } = req.body;
  if (!id) {
    res.status(400).json({ error: "Missing request ID" });
    return;
  }

  try {
    const updated = confirmRequestCompletion(id);
    if (!updated) {
      res.status(400).json({
        error: "Please confirm the technician has arrived before marking the job complete.",
      });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("POST /api/requests/confirm-completion error:", err);
    res.status(500).json({ error: "Failed to confirm completion." });
  }
});

// PATCH /api/requests → update a request (status, assignedProvider, contacted …)
router.patch("/", (req: Request, res: Response) => {
  const { id, ...updates } = req.body;
  if (!id) {
    res.status(400).json({ error: "Missing request ID" });
    return;
  }

  try {
    const updated = updateRequest(id, updates);
    if (!updated) {
      res.status(404).json({ error: "Request not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    if (err instanceof Error && err.message === "COMPLETION_REQUIRES_CUSTOMER") {
      res.status(403).json({
        error: "Only the customer can mark this job as completed from the tracking page.",
      });
      return;
    }
    if (err instanceof Error && err.message === "ARRIVAL_REQUIRES_CUSTOMER") {
      res.status(403).json({
        error: "Only the customer can confirm technician arrival from the tracking page.",
      });
      return;
    }
    if (err instanceof Error && err.message === "MUST_BE_ARRIVED") {
      res.status(400).json({
        error: "The technician must arrive before the customer can confirm completion.",
      });
      return;
    }
    console.error("PATCH /api/requests error:", err);
    res.status(500).json({ error: "Failed to update request." });
  }
});

export default router;
