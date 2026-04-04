# 📚 Luminia Library

**Luminia Library** is a state-of-the-art, AI-enhanced library management system built with high-fidelity aesthetics and modern web performance. Designed to provide a seamless experience for both members and administrators.

![Lumina Preview](https://via.placeholder.com/1200x600/6366f1/ffffff?text=Luminia+Library+Management+System)

---

## ✨ Features

### 🏢 For Administrators
*   **Time-Action Audit Log**: A precision vertical timeline tracking every book movement (borrow/return/overdue) with down-to-the-minute accuracy.
*   **AI Cataloging**: Instantly populate book metadata and high-resolution covers using Google Books & Open Library ISBN fetching.
*   **Late Fee Auto-Calculator**: Dynamic calculation of fines based on real-time overdue metrics.
*   **One-Click User Management**: Effortlessly swap roles, manage Lumina Pro upgrades, and view detailed user histories.
*   **Inventory Control**: Full CRUD operations for books with sophisticated visual stock indicators.

### 👤 For Members (OPAC)
*   **Advanced Search**: Instantly find titles through a global search powered by intelligent genre matching.
*   **Lumina Pro**: A premium subscription model offering unlimited borrowing, zero fines, and extended loan periods.
*   **One-Click Borrowing**: Borrow any available copy instantly or reserve it if stock is out.
*   **Smart Dashboard**: A personal command center showing active loans, due dates, and reservation status.

---

## 🛠️ Technology Stack

*   **Frontend**: React (TSX) + Vite 6
*   **Styling**: Tailwind CSS 4 + Motion (Motion for React)
*   **Database & Auth**: Firebase Firestore + Firebase Authentication
*   **Intelligence**: Integration with Google Books & Open Library APIs
*   **Deployment**: GitHub Pages (Static Hosting)

---

## 🚀 Quick Start

### Installation
```bash
# Clone the repository
git clone https://github.com/AnkamPurvik/Luminia-library.git

# Install dependencies
npm install

# Run the project locally
npm run dev
```

---

## 🛡️ Administrative Console
Accessing the admin console requires an account with `'admin'` role assigned in the Firestore `users` collection.
*   **Dashboard URL**: `/admin`
*   **Book Movement URL**: `/admin/book/:id`

---

## 📸 Project Context
This project was developed with a focus on **Premium UI/UX**, utilizing glassmorphism, vibrant color palettes, and interactive micro-animations to provide a professional, enterprise-grade feel.

---

*Developed with ❤️ by [Ankam Purvik](https://github.com/AnkamPurvik)*
