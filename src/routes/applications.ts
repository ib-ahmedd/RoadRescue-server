import { Router, Request, Response } from "express";
import { hashPassword } from "../auth";
import {
  getApplications,
  getApplicationForTracking,
  addApplication,
  updateApplicationStatus,
  registerApplicationAccount,
  toApplicationTrackView,
} from "../db";

const router = Router();

// GET /api/applications
router.get("/", (req: Request, res: Response) => {
  const { id } = req.query;
  if (id) {
    const app = getApplicationForTracking(id as string);
    if (!app) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    res.json(toApplicationTrackView(app));
    return;
  }
  res.json(getApplications());
});

// POST /api/applications → submit a new technician application
router.post("/", (req: Request, res: Response) => {
  try {
    const { name, phone, vehicle, plate, speciality, avatar, licenseId, licenseImage } = req.body;
    if (!name || !phone || !vehicle || !plate || !speciality || !avatar || !licenseId) {
      res.status(400).json({ error: "Missing required fields. All fields, including license/ID number, are required." });
      return;
    }
    if (
      !licenseImage ||
      typeof licenseImage !== "string" ||
      !licenseImage.startsWith("data:image/")
    ) {
      res.status(400).json({
        error: "A photo of your valid driver's license or government ID is required.",
      });
      return;
    }
    if (licenseImage.length > 8_000_000) {
      res.status(400).json({ error: "License photo is too large. Please use an image under 5 MB." });
      return;
    }
    const newApp = addApplication({
      name,
      phone,
      vehicle,
      plate,
      speciality,
      avatar,
      licenseId,
      licenseImage,
    });
    res.status(201).json(toApplicationTrackView(newApp));
  } catch (err) {
    console.error("POST /api/applications error:", err);
    res.status(500).json({ error: "Failed to submit application. Please try again." });
  }
});

// POST /api/applications/register → create technician login after approval
router.post("/register", (req: Request, res: Response) => {
  try {
    const { applicationId, username, password, confirmPassword } = req.body;

    if (!applicationId || !username || !password || !confirmPassword) {
      res.status(400).json({ error: "All fields are required." });
      return;
    }

    if (password !== confirmPassword) {
      res.status(400).json({ error: "Passwords do not match." });
      return;
    }

    if (username.trim().length < 3) {
      res.status(400).json({ error: "Username must be at least 3 characters." });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters." });
      return;
    }

    const app = getApplicationForTracking(applicationId);
    if (!app) {
      res.status(404).json({ error: "Application not found." });
      return;
    }

    if (app.status !== "approved") {
      res.status(400).json({ error: "Your application must be approved before you can register." });
      return;
    }

    if (app.registered) {
      res.status(400).json({ error: "An account has already been registered for this application." });
      return;
    }

    const result = registerApplicationAccount(applicationId, username, hashPassword(password));
    if (!result) {
      res.status(400).json({ error: "Unable to register account for this application." });
      return;
    }

    res.status(201).json({
      message: "Account created successfully. You can now sign in to the technician portal.",
      application: toApplicationTrackView(result.application),
      providerId: result.provider.id,
      username: result.provider.username,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "USERNAME_TAKEN") {
      res.status(409).json({ error: "That username is already taken. Please choose another." });
      return;
    }
    console.error("POST /api/applications/register error:", err);
    res.status(500).json({ error: "Failed to register account. Please try again." });
  }
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
  res.json(toApplicationTrackView(updated));
});

export default router;
