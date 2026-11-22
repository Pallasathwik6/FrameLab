/**
 * FrameLab Orders Database Engine
 * Persistent, thread-safe JSON-backed transactional database for orders & payments
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, '..', 'data', 'orders.json');

// Ensure database file exists
function ensureDbFile() {
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

// Read all orders
export function getAllOrders() {
  ensureDbFile();
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('[OrdersDB] Error reading orders:', err.message);
    return [];
  }
}

// Save all orders atomically
function saveAllOrders(orders) {
  ensureDbFile();
  const tempFile = `${DB_FILE}.tmp.${Date.now()}`;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(orders, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
    return true;
  } catch (err) {
    console.error('[OrdersDB] Error saving orders:', err.message);
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch (_) {}
    }
    return false;
  }
}

// Find order by FrameLab Order ID
export function getOrderById(orderId) {
  const orders = getAllOrders();
  return orders.find(o => o.id === orderId) || null;
}

// Find order by Razorpay Order ID
export function getOrderByRazorpayOrderId(rzpOrderId) {
  const orders = getAllOrders();
  return orders.find(o => o.razorpayOrderId === rzpOrderId) || null;
}

// Find order by Razorpay Payment ID
export function getOrderByPaymentId(paymentId) {
  const orders = getAllOrders();
  return orders.find(o => o.razorpayPaymentId === paymentId) || null;
}

// Create new Order
export function createOrder(orderData) {
  const orders = getAllOrders();
  const now = new Date().toISOString();

  const newOrder = {
    id: orderData.id || `FL-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
    razorpayOrderId: orderData.razorpayOrderId || null,
    razorpayPaymentId: null,
    razorpaySignature: null,
    status: orderData.status || 'created', // 'created', 'pending', 'paid', 'failed', 'cancelled'
    currency: orderData.currency || 'INR',
    items: orderData.items || [],
    pricing: {
      subtotal: orderData.pricing?.subtotal || 0,
      shippingFee: orderData.pricing?.shippingFee || 0,
      shippingMethod: orderData.pricing?.shippingMethod || 'Standard Insured Express',
      gstPercentage: 18,
      totalAmount: orderData.pricing?.totalAmount || 0, // In Rupees (₹)
      amountInPaise: Math.round((orderData.pricing?.totalAmount || 0) * 100) // For Razorpay
    },
    customer: {
      fullName: orderData.customer?.fullName || '',
      email: orderData.customer?.email || '',
      phone: orderData.customer?.phone || '',
      address: orderData.customer?.address || '',
      city: orderData.customer?.city || '',
      state: orderData.customer?.state || '',
      pincode: orderData.customer?.pincode || ''
    },
    paymentMethod: null,
    failureReason: null,
    events: [
      {
        type: 'ORDER_CREATED',
        timestamp: now,
        details: 'Order initialized on FrameLab secure backend'
      }
    ],
    createdAt: now,
    updatedAt: now
  };

  orders.unshift(newOrder); // newest first
  saveAllOrders(orders);
  return newOrder;
}

// Update existing Order
export function updateOrder(orderId, updates) {
  const orders = getAllOrders();
  const index = orders.findIndex(o => o.id === orderId || o.razorpayOrderId === orderId);

  if (index === -1) {
    return null;
  }

  const existing = orders[index];
  const now = new Date().toISOString();

  // Handle audit event logging
  const newEvents = existing.events ? [...existing.events] : [];
  if (updates.event) {
    newEvents.push({
      type: updates.event.type || 'STATUS_UPDATE',
      timestamp: now,
      details: updates.event.details || ''
    });
    delete updates.event;
  } else if (updates.status && updates.status !== existing.status) {
    newEvents.push({
      type: 'STATUS_TRANSITION',
      timestamp: now,
      details: `Status transitioned from ${existing.status} to ${updates.status}`
    });
  }

  const updatedOrder = {
    ...existing,
    ...updates,
    events: newEvents,
    updatedAt: now
  };

  orders[index] = updatedOrder;
  saveAllOrders(orders);
  return updatedOrder;
}
