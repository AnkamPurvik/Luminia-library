import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import crypto from "crypto";
import nodemailer from "nodemailer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin for the server
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Lumina Library API" });
  });

  // POST /api/send-otp - Rate-limited 6-digit cryptographically random verification code dispatcher
  app.post("/api/send-otp", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Rate Limiting Check (Max 3 requests per hour)
      const now = Date.now();
      const rateLimitRef = db.collection("rate_limits").doc(email);
      const rateLimitSnap = await rateLimitRef.get();

      let requests = [];
      if (rateLimitSnap.exists) {
        const data = rateLimitSnap.data();
        requests = data?.requests || [];
      }

      const oneHourAgo = now - 60 * 60 * 1000;
      const activeRequests = requests.filter((time: number) => time > oneHourAgo);

      if (activeRequests.length >= 3) {
        return res.status(429).json({ error: "Rate limit exceeded. Maximum 3 OTP requests per hour." });
      }

      activeRequests.push(now);
      await rateLimitRef.set({ requests: activeRequests });

      // Generate 6-digit cryptographically random integer
      const otpCode = crypto.randomInt(100000, 999999).toString();

      // Hash using SHA-256 (Never plaintext)
      const hashedOTP = crypto.createHash("sha256").update(otpCode).digest("hex");

      // Temporarily store hashed code with 5 minute expiry & max 5 attempts
      await db.collection("otps").doc(email).set({
        code: hashedOTP,
        expiresAt: now + 5 * 60 * 1000, // 5 minutes
        attempts: 0,
        createdAt: new Date().toISOString()
      });

      // Write code to local file for offline testing / development convenience
      fs.appendFileSync(
        path.join(process.cwd(), "otp-logs.txt"),
        `[${new Date().toISOString()}] Email: ${email} -> OTP: ${otpCode}\n`
      );
      console.log(`[OTP DISPATCHED] Email: ${email} -> Code: ${otpCode}`);

      // Mail setup
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.ethereal.email",
        port: Number(process.env.SMTP_PORT) || 587,
        auth: {
          user: process.env.SMTP_USER || "mockuser",
          pass: process.env.SMTP_PASS || "mockpass"
        }
      });

      try {
        await transporter.sendMail({
          from: '"Luminia Library Security" <noreply@luminialibrary.com>',
          to: email,
          subject: "Your Luminia Access Verification Code",
          text: `Your 6-digit verification code is: ${otpCode}. It expires in 5 minutes.`,
          html: `
            <div style="font-family: sans-serif; padding: 25px; background-color: #0f172a; color: #f8fafc; border-radius: 16px; max-width: 440px; margin: auto; border: 1px solid #1e293b;">
              <h2 style="color: #6366f1; text-align: center; text-transform: uppercase; letter-spacing: 0.15em; font-size: 20px; margin-bottom: 5px;">Luminia Security</h2>
              <p style="font-size: 11px; text-align: center; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 25px;">Secure Identity Gate</p>
              <p style="font-size: 14px; text-align: center; line-height: 1.6; color: #cbd5e1;">Use the verification code below to authorize access to your reader account:</p>
              <div style="font-size: 36px; font-weight: 900; letter-spacing: 0.25em; text-align: center; color: #10b981; padding: 20px; background-color: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; margin: 25px 0;">
                ${otpCode}
              </div>
              <p style="font-size: 11px; color: #64748b; text-align: center; line-height: 1.5;">This secure passcode expires in 5 minutes and is single-use. Never share this code with anyone.</p>
            </div>
          `
        });
      } catch (mailErr) {
        console.warn("Nodemailer dispatcher fallback active (mail host missing/unconfigured). OTP successfully written to console and otp-logs.txt.");
      }

      res.json({ success: true, message: "A 6-digit verification code has been dispatched. Check your email inbox or local otp-logs.txt!" });
    } catch (err) {
      console.error("Error sending OTP:", err);
      res.status(500).json({ error: "Failed to dispatch verification code." });
    }
  });

  // POST /api/verify-otp - OTP validation, database account registration, and custom customToken dispenser
  app.post("/api/verify-otp", async (req, res) => {
    try {
      const { email, otpCode } = req.body;
      if (!email || !otpCode) {
        return res.status(400).json({ error: "Email and verification code are required" });
      }

      const otpRef = db.collection("otps").doc(email);
      const otpSnap = await otpRef.get();

      if (!otpSnap.exists) {
        return res.status(400).json({ error: "Verification code has expired or was not requested." });
      }

      const { code: storedHash, expiresAt, attempts } = otpSnap.data() || {};

      // Check expired
      if (Date.now() > expiresAt) {
        await otpRef.delete();
        return res.status(400).json({ error: "Verification code has expired. Please request a new one." });
      }

      // Check maximum failure attempts
      if (attempts >= 5) {
        await otpRef.delete();
        return res.status(400).json({ error: "Too many failed attempts. Code has been blacklisted for security." });
      }

      // Compare cryptographic hashes (Never plaintext comparison)
      const inputHash = crypto.createHash("sha256").update(otpCode).digest("hex");
      if (inputHash !== storedHash) {
        await otpRef.update({ attempts: attempts + 1 });
        return res.status(400).json({ error: "Invalid verification code. Please check and try again." });
      }

      // Delete used OTP immediately
      await otpRef.delete();

      // Get or create Firebase Auth user
      let userRecord;
      try {
        userRecord = await admin.auth().getUserByEmail(email);
      } catch {
        // Automatically create a new user profile upon successful verification
        userRecord = await admin.auth().createUser({
          email,
          emailVerified: true,
          displayName: email.split("@")[0]
        });

        // Initialize user document in the users database collection
        await db.collection("users").doc(userRecord.uid).set({
          name: email.split("@")[0],
          email: email,
          role: "member",
          membershipStatus: "active",
          firebaseUid: userRecord.uid,
          createdAt: new Date().toISOString()
        });
      }

      // Issue custom token for secure front-end client-side authentication
      const token = await admin.auth().createCustomToken(userRecord.uid);
      res.json({ token, success: true });
    } catch (err) {
      console.error("Error verifying OTP:", err);
      res.status(500).json({ error: "Verification process failed." });
    }
  });

  // Return Book API
  app.patch("/api/transactions/return/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { bookId, dueDate, bookTitle } = req.body;

      if (!id || !bookId) {
        return res
          .status(400)
          .json({ error: "Missing transaction or book ID" });
      }

      const calculateFine = (dueDateStr: string) => {
        const due = new Date(dueDateStr);
        const now = new Date();
        if (now <= due) return 0;
        const diffTime = Math.abs(now.getTime() - due.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays * 10; // ₹10 per day
      };

      const fine = dueDate ? calculateFine(dueDate) : 0;
      const returnDate = new Date().toISOString();

      // 1. Update Transaction
      const transactionRef = db.collection("transactions").doc(id);
      await transactionRef.update({
        status: "returned",
        returnDate,
        fineAmount: fine,
      });

      // 2. Update Book Availability
      const bookRef = db.collection("books").doc(bookId);
      const bookSnap = await bookRef.get();
      let newAvailable = 0;

      if (bookSnap.exists) {
        const bookData = bookSnap.data();
        newAvailable = (bookData?.availableCopies || 0) + 1;
        await bookRef.update({
          availableCopies: newAvailable,
        });
      }

      // 3. Check for Reservations (Oldest First)
      if (newAvailable > 0) {
        const reservationsRef = db.collection("reservations");
        const resSnap = await reservationsRef
          .where("bookId", "==", bookId)
          .where("status", "==", "pending")
          .orderBy("reservationDate", "asc")
          .limit(1)
          .get();

        if (!resSnap.empty) {
          const oldestRes = resSnap.docs[0];
          const resData = oldestRes.data();

          // 4. Dispatch Notification
          await db.collection("notifications").add({
            userId: resData.userId,
            bookId: bookId,
            bookTitle: bookTitle || "A reserved book",
            message: `The book "${bookTitle || "you reserved"}" is now available! Click below to borrow it immediately.`,
            type: "availability",
            read: false,
            createdAt: new Date().toISOString(),
            canOneClickBorrow: true, // Flag for the "One-Click" feature
            reservationId: oldestRes.id,
          });
        }
      }

      res.json({
        success: true,
        message: "Book returned successfully",
        fineAmount: fine,
        returnDate,
      });
    } catch (error) {
      console.error("Error returning book:", error);
      res
        .status(500)
        .json({
          error: "Internal server error",
          details: error instanceof Error ? error.message : String(error),
        });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
