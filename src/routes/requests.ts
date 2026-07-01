import { Router, Request, Response } from "express";
import {
  getRequests,
  getRequestById,
  findActiveRequestByCredentials,
  addRequest,
  updateRequest,
  confirmRequestCompletion,
  confirmRequestArrival,
  submitQuote,
  reviewQuote,
  payQuote,
} from "../db";

const router = Router();

// GET /api/requests          → all requests (newest first)
// GET /api/requests?id=RR-XX → single request
// GET /api/requests?phone=&email=&service= → active request lookup
router.get("/", (req: Request, res: Response) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");

  const { id, phone, email, service } = req.query;

  if (phone && email && service) {
    const match = findActiveRequestByCredentials(
      phone as string,
      email as string,
      service as string
    );
    if (!match) {
      res.status(404).json({
        error: "No active request found. Check your phone, email, and service type, or submit a new request.",
      });
      return;
    }
    res.json(match);
    return;
  }

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
  const { name, phone, service, vehicleType, location, bookingFee, paymentStatus, paymentReference } =
    req.body;
  if (!name || !phone || !service || !vehicleType || !location) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  if (paymentStatus !== "paid" || !bookingFee || Number(bookingFee) <= 0) {
    res.status(400).json({ error: "Booking fee payment is required before dispatch" });
    return;
  }

  if (!paymentReference || typeof paymentReference !== "string") {
    res.status(400).json({ error: "Payment reference is required" });
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
    bookingFee: Number(bookingFee),
    paymentStatus: "paid",
    paymentReference,
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
    const existing = getRequestById(id);
    if (existing?.quoteStatus === "approved" || existing?.status === "awaiting-payment") {
      res.status(400).json({
        error: "Please pay the approved service quote before marking the job complete.",
      });
      return;
    }

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

// POST /api/requests/submit-quote → assigned technician submits on-site quote
router.post("/submit-quote", (req: Request, res: Response) => {
  const { id, providerId, technicianAssessment, quoteAmount } = req.body;
  if (!id || !providerId) {
    res.status(400).json({ error: "Missing request ID or provider ID" });
    return;
  }
  if (!technicianAssessment || quoteAmount == null) {
    res.status(400).json({ error: "Assessment and quote amount are required" });
    return;
  }

  try {
    const updated = submitQuote(id, providerId, { technicianAssessment, quoteAmount });
    if (!updated) {
      res.status(400).json({
        error:
          "Quote can only be submitted while assessing on site, by the assigned technician, with a detailed assessment and valid amount.",
      });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("POST /api/requests/submit-quote error:", err);
    res.status(500).json({ error: "Failed to submit quote." });
  }
});

// PATCH /api/requests/quote-approval → admin approves or rejects a pending quote
router.patch("/quote-approval", (req: Request, res: Response) => {
  const { id, action } = req.body;
  if (!id || !action) {
    res.status(400).json({ error: "Missing request ID or action" });
    return;
  }
  if (action !== "approve" && action !== "reject") {
    res.status(400).json({ error: "Action must be approve or reject" });
    return;
  }

  try {
    const updated = reviewQuote(id, action);
    if (!updated) {
      res.status(400).json({ error: "No pending quote found for this request." });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("PATCH /api/requests/quote-approval error:", err);
    res.status(500).json({ error: "Failed to review quote." });
  }
});

// POST /api/requests/pay-quote → customer pays an approved service quote
router.post("/pay-quote", (req: Request, res: Response) => {
  const { id, paymentReference } = req.body;
  if (!id || !paymentReference) {
    res.status(400).json({ error: "Missing request ID or payment reference" });
    return;
  }

  try {
    const updated = payQuote(id, paymentReference);
    if (!updated) {
      res.status(400).json({
        error: "Quote payment is only available for approved quotes with a valid reference.",
      });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error("POST /api/requests/pay-quote error:", err);
    res.status(500).json({ error: "Failed to process quote payment." });
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
    if (err instanceof Error && err.message === "MUST_BE_ON_SITE") {
      res.status(400).json({
        error: "The technician must be on site before the customer can confirm completion.",
      });
      return;
    }
    console.error("PATCH /api/requests error:", err);
    res.status(500).json({ error: "Failed to update request." });
  }
});

export default router;
