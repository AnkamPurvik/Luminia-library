import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };

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
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "Lumina Library API" });
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
