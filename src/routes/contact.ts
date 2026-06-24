import { Router, Request, Response } from "express";
import { addContact, getContacts } from "../db";

const router = Router();

// GET /api/contact → retrieve all contact form messages (for admin dashboard)
router.get("/", (req: Request, res: Response) => {
  try {
    res.json(getContacts());
  } catch (error) {
    console.error("GET /api/contact error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/contact → submit a contact form message
router.post("/", (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Invalid email address" });
    return;
  }

  const newContact = addContact({ name, email, subject, message });

  res.status(201).json({
    success: true,
    message: "Thank you! Your message has been received.",
    contact: newContact,
  });
});

export default router;
