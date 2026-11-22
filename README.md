# FrameLab &bull; Haute Eyewear & Biometric Frame Selector

> **Brand Ethos:** Luxury eyewear engineered for human facial geometry. Handcrafted from Japanese beta-titanium and Italian Mazzucchelli bio-acetate with integrated Razorpay payment gateway for Indian patrons.

---

## 📂 Project Locations On Your Computer

The entire project has been saved and organized in your user folders:

* **Desktop:** `C:\Users\sathwik palla\OneDrive\Desktop\FrameLab\`
* **Desktop Zip Archive:** `C:\Users\sathwik palla\OneDrive\Desktop\FrameLab-Full-Project.zip`
* **Documents:** `C:\Users\sathwik palla\Documents\FrameLab\`
* **Dev Scratch:** `C:\Users\sathwik palla\.gemini\antigravity\scratch\framelab\`

---

## 💎 Design System & Palette

* **Primary Deep Navy:** `#0B1325` (Midnight obsidian) and `#111E38` (Deep navy blue)
* **Warm Ivory & Cream:** `#FAF8F5`, `#F4EFEA`, `#EFE8DE`
* **Sand & Natural Beige:** `#E8DFD5`, `#D8CABA`
* **Copper-Orange Accents:** `#D97736`, `#C86228`, `#E08A4E` (Warm terracotta glow)
* **Typography:** Plus Jakarta Sans (Precision geometric sans), Playfair Display (Editorial serif accents), and Fira Code (ISO 8624 metrology)
* **Atmospheric Background:** Multi-layer floating ambient orbs, precision millimeter blueprint grid, ophthalmic lens calibration rings, and liquid 60fps cursor spotlight tracking.

---

## 📂 Architecture & Directory Structure

```
framelab/
├── index.html                 # Semantic HTML5, ARIA trees, ambient background, modals & drawers
├── package.json               # Node.js project configuration (type: "module")
├── server.js                  # Full-stack Node HTTP server with Razorpay API endpoints & static serving
├── test_checkout_flow.js      # Automated security & payment integration test suite
├── .env                       # Active server environment variables (Test Mode configured)
├── .env.example               # Template & setup instructions for Razorpay credentials
├── css/
│   └── styles.css             # Apple-inspired luxury UI system, CSS Grid, animations, glassmorphism
├── js/
│   ├── products.js            # 14 luxury eyewear models with realistic INR (₹) prices, specs, and swatches
│   ├── virtual-studio.js      # Vector-based face & glasses visualizer (morphotypes, skin tones, coatings)
│   ├── selector.js            # 4-step smart biometric frame matching engine & recommendation algorithm
│   └── app.js                 # Central controller, search, filters, cart, Razorpay checkout, background
├── server/
│   ├── orders-db.js           # Atomic transactional JSON database engine for orders
│   └── razorpay-service.js    # Razorpay client, HMAC-SHA256 signature verification, webhook handler
├── data/
│   └── orders.json            # Persistent storage for orders and payment status
└── assets/
    └── images/                # High-resolution eyewear photography and vector assets
```

---

## ⚡ Core Interactive Features

1. **Smart Multi-Step Frame Selector (`#selectorSection`):**
   * **Step 1: Face Shape** (Oval, Round, Square, Heart, Diamond) with custom illustrated vector morphotypes.
   * **Step 2: Style Aesthetic** (Minimal, Classic, Bold, Professional, Creative).
   * **Step 3: Material Craftsmanship** (Japanese Titanium, Italian Bio-Acetate, Stainless Steel, Transparent).
   * **Step 4: Investment Tier** (Under ₹2,000, ₹2,000–₹4,000, ₹4,000–₹7,000, Above ₹7,000).
   * **Dynamic Scoring Algorithm:** Calculates suitability match percentages and dynamically reveals curated recommendations.

2. **Interactive Virtual Studio (`#virtualStudioSection`):**
   * Real-time vector face illustration morphing across 5 face shapes and 5 complexion tones.
   * 6 Eyewear silhouettes (Panto Round, Tailored Square, Aviator Navigator, Sculpted Cat-Eye, Hexagon, Rimless).
   * 6 Frame finishes and 5 optical lens coatings.
   * Fine-tuning sliders: Frame scale (90%–115%) and bridge vertical alignment.
   * Optical symmetry datum line and pupillary distance toggle.

3. **Complete Razorpay Online Payment Gateway:**
   * **Full Indian Checkout:** Full Name, Email, 10-digit Indian Mobile, Street Address, City, State, 6-digit PIN code.
   * **Dynamic Shipping:** Standard Insured Express (FREE for orders over ₹1,999) or Priority Air Courier (₹150).
   * **Payment Methods:** UPI (Google Pay, PhonePe, Paytm, BHIM), Credit/Debit Cards, NetBanking (50+ banks).
   * **Cryptographic Verification:** Server-side HMAC-SHA256 signature verification prevents client tampering.
   * **Razorpay Test Sandbox Simulator:** Interactive in-app simulator for testing UPI, Cards, NetBanking, and failure scenarios.
   * **Tax Invoice Generation:** Official printable receipt with order ID, Razorpay payment reference, itemized specs, and 18% GST calculation.

4. **Curated Catalog & Faceted Filter Bar (`#catalogSection`):**
   * 14 distinct luxury models with realistic photography and prices in Indian Rupees (₹).
   * Instant search matching names, materials, colors, and styles.
   * Multi-facet filter combination (Material + Face Shape + Style + Budget + Sorter).
   * Dynamic color swatch switcher updating card photography in real time.

5. **Favorites & Bag Management (`localStorage`):**
   * Saved favorites survive browser refresh.
   * Slide-over bag drawer with quantity adjustments and checkout trigger.

---

## 🚀 How to Run the Server

Open PowerShell or Command Prompt:

```powershell
# 1. Navigate to the project folder
cd "C:\Users\sathwik palla\OneDrive\Desktop\FrameLab"

# 2. Start the full-stack server
node server.js
```

Then open your browser at **`http://localhost:3000`**.

---

## 🧪 Running Automated Tests

To test the complete checkout flow, price tamper resistance, cryptographic signature verification, and webhooks:

```powershell
node test_checkout_flow.js
```
