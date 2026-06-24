import { Router, Request, Response } from "express";
import {
  getApplications,
  getApplicationById,
  addApplication,
  updateApplicationStatus,
} from "../db";

const router = Router();

// GET /api/applications
router.get("/", (req: Request, res: Response) => {
  const { id } = req.query;
  if (id) {
    const app = getApplicationById(id as string);
    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    res.json(app);
    return;
  }
  res.json(getApplications());
});

// POST /api/applications → submit a new technician application
router.post("/", (req: Request, res: Response) => {
  const { name, phone, vehicle, plate, speciality, avatar, licenseId } = req.body;
  if (!name || !phone || !vehicle || !plate || !speciality || !avatar || !licenseId) {
    res.status(400).json({ error: "Missing required fields. All fields, including license/ID number, are required." });
    return;
  }
  const newApp = addApplication({ name, phone, vehicle, plate, speciality, avatar, licenseId });
  res.status(201).json(newApp);
});

// PATCH /api/applications → approve or reject an application
router.patch("/", (req: Request, res: Response) => {
  const { id, status } = req.body;
  if (!id || !status) {
    res.status(400).json({ error: "Missing application ID or status" });
    return;
  }
  if (status !== "approved" && status !== "rejected") {
    res.status(400).json({ error: "Status must be 'approved' or 'rejected'" });
    return;
  }
  const updated = updateApplicationStatus(id, status);
  if (!updated) {
    res.status(404).json({ error: "Application not found" });
    return;
  }
  res.json(updated);
});

export default router;
