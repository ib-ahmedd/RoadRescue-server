import { Router, Request, Response } from "express";
import { getRequests, getRequestById, addRequest, updateRequest } from "../db";

const router = Router();

// GET /api/requests          → all requests (newest first)
// GET /api/requests?id=RR-XX → single request
router.get("/", (req: Request, res: Response) => {
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

// PATCH /api/requests → update a request (status, assignedProvider, contacted …)
router.patch("/", (req: Request, res: Response) => {
  const { id, ...updates } = req.body;
  if (!id) {
    res.status(400).json({ error: "Missing request ID" });
    return;
  }
  const updated = updateRequest(id, updates);
  if (!updated) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  res.json(updated);
});

export default router;
