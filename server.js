/**
 * FrameLab Luxury Eyewear - Full-Stack Application & Payment Server
 * Integrated with Razorpay Indian Payment Gateway (UPI, Cards, NetBanking, Wallets)
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PRODUCTS } from './js/products.js';
import { RazorpayService } from './server/razorpay-service.js';
import { 
  createOrder, 
  getOrderById, 
  getOrderByRazorpayOrderId, 
  updateOrder, 
  getAllOrders 
} from './server/orders-db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Simple, zero-dependency .env loader
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          let val = trimmed.slice(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      });
      console.log('[Server] Loaded environment configuration from .env');
    } catch (e) {
      console.warn('[Server] Notice reading .env:', e.message);
    }
  }
}
loadEnv();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const razorpayService = new RazorpayService();

// MIME types for static assets
const mimeTypes = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

// Helper: Parse incoming JSON body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(new Error('Invalid JSON payload'));
      }
    });
    req.on('error', reject);
  });
}

// Helper: Parse Raw Body for Webhook Signature Verification
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

// Helper: JSON response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Razorpay-Signature'
  });
  res.end(JSON.stringify(data));
}

// ==================== HTTP REQUEST ROUTER ====================
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Razorpay-Signature'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // ----------------------------------------------------
  // API: Get Public Gateway Configuration
  // ----------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/config') {
    return sendJson(res, 200, {
      success: true,
      config: razorpayService.getPublicConfig(),
      store: {
        freeShippingThreshold: parseInt(process.env.FREE_SHIPPING_THRESHOLD, 10) || 1999,
        expressShippingFee: parseInt(process.env.EXPRESS_PRIORITY_SHIPPING_FEE, 10) || 150
      }
    });
  }

  // ----------------------------------------------------
  // API: Create Razorpay Payment Order (Secure Server-Side)
  // ----------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/create-order') {
    try {
      const body = await parseJsonBody(req);
      const { items, customer, shippingMethod } = body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return sendJson(res, 400, { success: false, error: 'Shopping cart is empty' });
      }

      // 1. Server-Side Price & Item Validation against trusted product catalog
      let calculatedSubtotal = 0;
      const verifiedItems = [];

      for (const item of items) {
        const catalogProduct = PRODUCTS.find(p => p.id === item.id);
        if (!catalogProduct) {
          return sendJson(res, 400, { success: false, error: `Invalid product: ${item.name || item.id}` });
        }
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        const itemTotal = catalogProduct.price * qty;
        calculatedSubtotal += itemTotal;

        verifiedItems.push({
          id: catalogProduct.id,
          name: catalogProduct.name,
          price: catalogProduct.price,
          quantity: qty,
          color: item.color || catalogProduct.defaultColor,
          dimensions: catalogProduct.dimensions,
          image: item.image || catalogProduct.image,
          itemTotal
        });
      }

      // 2. Validate Customer Shipping Details
      if (!customer || !customer.fullName || !customer.phone || !customer.address || !customer.pincode) {
        return sendJson(res, 400, { 
          success: false, 
          error: 'Please fill in all required shipping fields (Name, Phone, Address, PIN code).' 
        });
      }

      // Phone validation (10 digits)
      const cleanPhone = String(customer.phone).replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        return sendJson(res, 400, { 
          success: false, 
          error: 'Please provide a valid 10-digit Indian mobile number.' 
        });
      }

      // PIN code validation (6 digits)
      const cleanPin = String(customer.pincode).replace(/\D/g, '');
      if (cleanPin.length !== 6) {
        return sendJson(res, 400, { 
          success: false, 
          error: 'Please provide a valid 6-digit postal PIN code.' 
        });
      }

      // 3. Shipping Fee Calculation
      const freeThreshold = parseInt(process.env.FREE_SHIPPING_THRESHOLD, 10) || 1999;
      let shippingFee = 0;
      let shippingName = 'Standard Insured Express';

      if (shippingMethod === 'priority') {
        shippingFee = parseInt(process.env.EXPRESS_PRIORITY_SHIPPING_FEE, 10) || 150;
        shippingName = 'Priority Air Courier';
      } else {
        shippingFee = calculatedSubtotal >= freeThreshold ? 0 : 99;
      }

      const totalAmount = calculatedSubtotal + shippingFee;
      const amountInPaise = Math.round(totalAmount * 100);

      // 4. Generate Internal Order in Database
      const internalOrder = createOrder({
        items: verifiedItems,
        pricing: {
          subtotal: calculatedSubtotal,
          shippingFee,
          shippingMethod: shippingName,
          totalAmount
        },
        customer: {
          ...customer,
          phone: cleanPhone,
          pincode: cleanPin
        }
      });

      // 5. Create Razorpay Payment Order via Gateway Service
      const rzpOrder = await razorpayService.createOrder({
        amountInPaise,
        currency: 'INR',
        receipt: internalOrder.id,
        notes: {
          internal_order_id: internalOrder.id,
          customer_name: customer.fullName,
          customer_phone: cleanPhone
        }
      });

      // 6. Update order with Razorpay Order ID
      updateOrder(internalOrder.id, {
        razorpayOrderId: rzpOrder.id,
        status: 'pending',
        event: {
          type: 'RAZORPAY_ORDER_CREATED',
          details: `Razorpay order ${rzpOrder.id} generated (${amountInPaise} paise)`
        }
      });

      console.log(`[Order] Created: ${internalOrder.id} -> Razorpay: ${rzpOrder.id} (₹${totalAmount})`);

      return sendJson(res, 200, {
        success: true,
        order: {
          id: internalOrder.id,
          razorpayOrderId: rzpOrder.id,
          amount: rzpOrder.amount,
          amountInRupees: totalAmount,
          currency: 'INR',
          keyId: razorpayService.keyId,
          customer: internalOrder.customer,
          items: internalOrder.items,
          pricing: internalOrder.pricing,
          isSimulated: Boolean(rzpOrder._isSimulated)
        }
      });

    } catch (err) {
      console.error('[API /api/create-order] Error:', err.message);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ----------------------------------------------------
  // API: Verify Razorpay Payment Signature (Cryptographic)
  // ----------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/verify-payment') {
    try {
      const body = await parseJsonBody(req);
      const { 
        orderId, 
        razorpay_order_id, 
        razorpay_payment_id, 
        razorpay_signature,
        paymentMethod 
      } = body;

      console.log(`[Payment] Verification request for Order: ${orderId}, RzpOrder: ${razorpay_order_id}, Payment: ${razorpay_payment_id}`);

      // 1. Fetch Order
      const order = getOrderById(orderId) || getOrderByRazorpayOrderId(razorpay_order_id);
      if (!order) {
        return sendJson(res, 404, { success: false, error: 'Order not found in database' });
      }

      // Check if already paid (idempotency check)
      if (order.status === 'paid') {
        return sendJson(res, 200, { 
          success: true, 
          message: 'Order is already marked as paid.', 
          order 
        });
      }

      // 2. Cryptographic Signature Verification
      let verification = razorpayService.verifyPaymentSignature({
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature
      });

      // In Test Mode only: Allow verified simulation if operating in local test sandbox
      if (!verification.isValid && razorpayService.isTestMode && body.isSimulated) {
        const testSig = razorpayService.generateTestSignature(razorpay_order_id, razorpay_payment_id);
        verification = { isValid: true, expectedSignature: testSig };
      }

      if (!verification.isValid) {
        console.error(`[Security Alert] Payment signature mismatch for order ${order.id}!`, verification.error);
        updateOrder(order.id, {
          status: 'failed',
          failureReason: 'Cryptographic signature mismatch',
          event: {
            type: 'SIGNATURE_VERIFICATION_FAILED',
            details: `Tamper alert: Received signature does not match HMAC-SHA256 digest.`
          }
        });
        return sendJson(res, 400, { 
          success: false, 
          error: 'Security verification failed: Payment signature does not match.' 
        });
      }

      // 3. Mark Order as Authenticated & Paid
      const updated = updateOrder(order.id, {
        status: 'paid',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: verification.expectedSignature || razorpay_signature,
        paymentMethod: paymentMethod || 'Online (UPI/Cards)',
        event: {
          type: 'PAYMENT_VERIFIED_SUCCESS',
          details: `Signature cryptographically verified. Payment ${razorpay_payment_id} captured.`
        }
      });

      console.log(`[Payment] Verified & Confirmed PAID: ${order.id} (Payment: ${razorpay_payment_id})`);

      return sendJson(res, 200, {
        success: true,
        message: 'Payment verified and captured successfully!',
        order: updated
      });

    } catch (err) {
      console.error('[API /api/verify-payment] Error:', err.message);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ----------------------------------------------------
  // API: Record Payment Failure / Cancellation
  // ----------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/payment-failed') {
    try {
      const body = await parseJsonBody(req);
      const { orderId, razorpay_order_id, errorCode, errorDescription, reason } = body;

      const order = getOrderById(orderId) || getOrderByRazorpayOrderId(razorpay_order_id);
      if (order && order.status !== 'paid') {
        const failureText = errorDescription || reason || 'Payment transaction failed or was cancelled';
        updateOrder(order.id, {
          status: 'failed',
          failureReason: failureText,
          event: {
            type: 'PAYMENT_FAILED',
            details: `Code: ${errorCode || 'N/A'} - ${failureText}`
          }
        });
        console.log(`[Payment] Marked Failed: ${order.id} (${failureText})`);
      }

      return sendJson(res, 200, { success: true, message: 'Failure recorded' });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // ----------------------------------------------------
  // API: Razorpay Webhook Handler
  // ----------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/webhook') {
    try {
      const signatureHeader = req.headers['x-razorpay-signature'];
      const rawBody = await getRawBody(req);

      // Verify Webhook Signature
      const isValid = razorpayService.verifyWebhookSignature(rawBody, signatureHeader);
      if (!isValid) {
        console.warn('[Webhook] Rejected invalid or unauthenticated webhook request');
        return sendJson(res, 400, { error: 'Invalid webhook signature' });
      }

      const eventData = JSON.parse(rawBody);
      const eventType = eventData.event;
      console.log(`[Webhook] Authenticated Razorpay Event: ${eventType}`);

      if (eventType === 'payment.captured' || eventType === 'order.paid') {
        const paymentEntity = eventData.payload.payment?.entity;
        const rzpOrderId = paymentEntity?.order_id || eventData.payload.order?.entity?.id;
        const paymentId = paymentEntity?.id;

        if (rzpOrderId) {
          const order = getOrderByRazorpayOrderId(rzpOrderId);
          if (order && order.status !== 'paid') {
            updateOrder(order.id, {
              status: 'paid',
              razorpayPaymentId: paymentId,
              paymentMethod: paymentEntity?.method || 'Razorpay Webhook',
              event: {
                type: 'WEBHOOK_PAYMENT_CAPTURED',
                details: `Webhook confirmed payment.captured for ${paymentId}`
              }
            });
            console.log(`[Webhook] Order ${order.id} updated to PAID`);
          }
        }
      } else if (eventType === 'payment.failed') {
        const paymentEntity = eventData.payload.payment?.entity;
        const rzpOrderId = paymentEntity?.order_id;
        if (rzpOrderId) {
          const order = getOrderByRazorpayOrderId(rzpOrderId);
          if (order && order.status !== 'paid') {
            updateOrder(order.id, {
              status: 'failed',
              failureReason: paymentEntity?.error_description || 'Payment failed on gateway',
              event: {
                type: 'WEBHOOK_PAYMENT_FAILED',
                details: `Payment failure webhook: ${paymentEntity?.error_description}`
              }
            });
          }
        }
      }

      return sendJson(res, 200, { status: 'ok', received: true });
    } catch (err) {
      console.error('[Webhook] Processing error:', err.message);
      return sendJson(res, 500, { error: err.message });
    }
  }

  // ----------------------------------------------------
  // API: Get Order Status / Tracking Receipt
  // ----------------------------------------------------
  if (req.method === 'GET' && pathname.startsWith('/api/order/')) {
    const orderId = pathname.replace('/api/order/', '').trim();
    const order = getOrderById(orderId) || getOrderByRazorpayOrderId(orderId);
    if (!order) {
      return sendJson(res, 404, { success: false, error: 'Order not found' });
    }
    return sendJson(res, 200, { success: true, order });
  }

  // ----------------------------------------------------
  // API: Get All Orders (for Admin/Testing Verification)
  // ----------------------------------------------------
  if (req.method === 'GET' && pathname === '/api/orders') {
    const orders = getAllOrders();
    return sendJson(res, 200, { success: true, count: orders.length, orders });
  }

  // ----------------------------------------------------
  // Static File Serving
  // ----------------------------------------------------
  let cleanUrl = pathname;
  if (cleanUrl === '/' || cleanUrl === '') cleanUrl = '/index.html';

  const decodedUrl = decodeURIComponent(cleanUrl);
  const filePath = path.normalize(path.join(__dirname, decodedUrl));

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end(`404 Not Found: ${cleanUrl}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
==================================================================
  FrameLab Haute Eyewear - Full-Stack Server Running
  URL: http://localhost:${PORT}/
  Mode: ${process.env.RAZORPAY_TEST_MODE !== 'false' ? 'Razorpay Test Mode 🟢' : 'Production 🔴'}
  Razorpay Key ID: ${process.env.RAZORPAY_KEY_ID || 'Not Configured'}
==================================================================
  `);
});
