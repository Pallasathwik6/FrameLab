/**
 * FrameLab Payment Gateway & Checkout Flow - Automated Integration Test Suite
 * Tests Razorpay order creation, cryptographic verification, webhook processing,
 * database persistence, tamper prevention, and security validations.
 */

import http from 'http';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { RazorpayService } from './server/razorpay-service.js';
import { 
  createOrder, 
  getOrderById, 
  getOrderByRazorpayOrderId, 
  updateOrder, 
  getAllOrders 
} from './server/orders-db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    failedTests++;
  }
}

async function runUnitAndSecurityTests() {
  console.log('\n--- 1. Testing Razorpay Service & Security Cryptography ---');
  
  const testKeyId = 'rzp_test_5173FrameLab';
  const testSecret = 'sk_test_framelab_secret_2026';
  const testWebhookSecret = 'whsec_framelab_test_secret_2026';

  const rzpService = new RazorpayService({
    keyId: testKeyId,
    keySecret: testSecret,
    webhookSecret: testWebhookSecret,
    testMode: true
  });

  // Test 1: Public config leak prevention
  const publicConfig = rzpService.getPublicConfig();
  assert(publicConfig.keyId === testKeyId, 'Public config provides keyId');
  assert(!publicConfig.keySecret, 'Public config NEVER exposes keySecret');
  assert(!publicConfig.webhookSecret, 'Public config NEVER exposes webhookSecret');
  assert(publicConfig.currency === 'INR', 'Public config sets INR currency');

  // Test 2: Order Creation in Test Mode
  const testOrder = await rzpService.createOrder({
    amountInPaise: 449900,
    currency: 'INR',
    receipt: 'FL-TEST-001',
    notes: { customer: 'Aditya' }
  });
  assert(testOrder.amount === 449900, 'Order amount in paise correctly set to 449900');
  assert(testOrder.currency === 'INR', 'Order currency set to INR');
  assert(typeof testOrder.id === 'string' && testOrder.id.length > 5, 'Generated valid Razorpay order ID');

  // Test 3: Cryptographic Signature Verification (HMAC-SHA256)
  const orderId = testOrder.id;
  const paymentId = 'pay_test_99887766';
  
  // Genuine signature
  const genuineSignature = crypto
    .createHmac('sha256', testSecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  const validResult = rzpService.verifyPaymentSignature({
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: genuineSignature
  });
  assert(validResult.isValid === true, 'Valid HMAC-SHA256 signature is accepted');

  // Forged signature
  const forgedSignature = 'forged_deadbeef1234567890abcdef1234567890abcdef1234567890abcdef12345678';
  const forgedResult = rzpService.verifyPaymentSignature({
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: forgedSignature
  });
  assert(forgedResult.isValid === false, 'Tampered/Forged signature is rejected');

  // Missing parameter handling
  const incompleteResult = rzpService.verifyPaymentSignature({
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentId,
    razorpaySignature: ''
  });
  assert(incompleteResult.isValid === false, 'Missing signature rejected cleanly');

  // Test 4: Webhook Signature Verification
  const rawWebhookBody = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_wh_112233',
          order_id: orderId,
          amount: 449900,
          status: 'captured'
        }
      }
    }
  });

  const validWebhookSig = crypto
    .createHmac('sha256', testWebhookSecret)
    .update(rawWebhookBody)
    .digest('hex');

  assert(
    rzpService.verifyWebhookSignature(rawWebhookBody, validWebhookSig) === true,
    'Valid webhook signature verified'
  );
  assert(
    rzpService.verifyWebhookSignature(rawWebhookBody, 'invalid_webhook_sig') === false,
    'Invalid webhook signature rejected'
  );

  console.log('\n--- 2. Testing Orders Database & Idempotency ---');
  // Test Order DB
  const initialOrder = createOrder({
    items: [
      { id: 'kyoto-pantoscopic', name: 'The Kyoto Pantoscopic', price: 4499, quantity: 1 }
    ],
    pricing: {
      subtotal: 4499,
      shippingFee: 0,
      totalAmount: 4499
    },
    customer: {
      fullName: 'Vikram Mehta',
      email: 'vikram@example.com',
      phone: '9820098200',
      address: '42 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400020'
    }
  });

  assert(typeof initialOrder.id === 'string' && initialOrder.id.startsWith('FL-'), 'Internal Order ID generated with FL- prefix');
  assert(initialOrder.status === 'created', 'Initial order status is "created"');

  const fetchedOrder = getOrderById(initialOrder.id);
  assert(fetchedOrder && fetchedOrder.id === initialOrder.id, 'Order retrieved by internal ID');

  // Update order with Razorpay Order ID
  const updatedWithRzp = updateOrder(initialOrder.id, {
    razorpayOrderId: 'order_test_razorpay_123',
    status: 'pending'
  });
  assert(updatedWithRzp.status === 'pending', 'Order status updated to "pending"');

  const fetchedByRzp = getOrderByRazorpayOrderId('order_test_razorpay_123');
  assert(fetchedByRzp && fetchedByRzp.id === initialOrder.id, 'Order retrieved by Razorpay Order ID');

  // Mark as paid
  const paidOrder = updateOrder(initialOrder.id, {
    status: 'paid',
    razorpayPaymentId: 'pay_123456789',
    razorpaySignature: 'valid_sig_hash',
    paymentMethod: 'UPI'
  });
  assert(paidOrder.status === 'paid', 'Order status successfully transitioned to "paid"');
  assert(paidOrder.events.length >= 2, 'Audit event log appended status history');
}

async function runHttpApiTests() {
  console.log('\n--- 3. Testing Full HTTP Server API Endpoints ---');

  const request = (method, path, body = null, headers = {}) => {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: '127.0.0.1',
        port: 3000,
        path: path,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ status: res.statusCode, data: parsed, headers: res.headers });
          } catch (_) {
            resolve({ status: res.statusCode, raw: data, headers: res.headers });
          }
        });
      });

      req.on('error', reject);
      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  };

  // 1. GET /api/config
  const cfgRes = await request('GET', '/api/config');
  assert(cfgRes.status === 200, 'GET /api/config returns 200 OK');
  assert(cfgRes.data.success === true, 'Config returns success: true');
  assert(cfgRes.data.config.testMode === true, 'Config indicates testMode is active');

  // 2. POST /api/create-order with empty cart
  const emptyRes = await request('POST', '/api/create-order', { items: [] });
  assert(emptyRes.status === 400, 'Empty cart rejected with 400 Bad Request');

  // 3. POST /api/create-order with forged lower price (Tamper Prevention)
  const tamperOrderRes = await request('POST', '/api/create-order', {
    items: [
      { id: 'fl-001', price: 10 } // Catalog price for The Kyoto Pure Titanium is ₹6,499!
    ],
    customer: {
      fullName: 'Security Auditor',
      email: 'security@example.com',
      phone: '9876543210',
      address: '10 Cyber Hub',
      city: 'Gurugram',
      state: 'Haryana',
      pincode: '122002'
    },
    shippingMethod: 'standard'
  });
  assert(tamperOrderRes.status === 200, 'Order created successfully');
  assert(tamperOrderRes.data.order.pricing.subtotal === 6499, 'Server overrode forged price (₹10) with catalog price (₹6,499)');
  assert(tamperOrderRes.data.order.amount === 649900, 'Razorpay amount is accurately calculated in paise (649900)');

  const createdOrder = tamperOrderRes.data.order;

  // 4. POST /api/verify-payment with invalid signature (Tamper Alert)
  const fraudVerifyRes = await request('POST', '/api/verify-payment', {
    orderId: createdOrder.id,
    razorpay_order_id: createdOrder.razorpayOrderId,
    razorpay_payment_id: 'pay_fraud_000000',
    razorpay_signature: 'invalid_fraudulent_signature'
  });
  assert(fraudVerifyRes.status === 400, 'Tampered payment signature rejected with 400');

  // 5. POST /api/verify-payment with valid signature in test mode
  const validVerifyRes = await request('POST', '/api/verify-payment', {
    orderId: createdOrder.id,
    razorpay_order_id: createdOrder.razorpayOrderId,
    razorpay_payment_id: 'pay_verified_111222',
    razorpay_signature: 'test_signature_mode',
    paymentMethod: 'UPI (success@razorpay)',
    isSimulated: true
  });
  assert(validVerifyRes.status === 200, 'Valid payment signature verified and captured with 200 OK');
  assert(validVerifyRes.data.order.status === 'paid', 'Order status marked as "paid" in database');

  // 6. Test Idempotency: verify already-paid order
  const repeatVerifyRes = await request('POST', '/api/verify-payment', {
    orderId: createdOrder.id,
    razorpay_order_id: createdOrder.razorpayOrderId,
    razorpay_payment_id: 'pay_verified_111222',
    razorpay_signature: 'test_signature_mode'
  });
  assert(repeatVerifyRes.status === 200, 'Idempotent request returns 200 without duplicate creation');
  assert(repeatVerifyRes.data.message.includes('already marked as paid'), 'Acknowledges order already paid');

  // 7. GET /api/order/:orderId
  const getOrderRes = await request('GET', `/api/order/${createdOrder.id}`);
  assert(getOrderRes.status === 200, 'GET /api/order/:id returns 200');
  assert(getOrderRes.data.order.id === createdOrder.id, 'Order matches created order ID');
  assert(getOrderRes.data.order.status === 'paid', 'Persisted order has status "paid"');

  // 8. POST /api/webhook with HMAC signature
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_framelab_test_secret_2026';
  
  // Create another order to test webhook capture
  const orderForWebhook = await request('POST', '/api/create-order', {
    items: [{ id: 'fl-002', quantity: 1 }],
    customer: {
      fullName: 'Pooja Hegde',
      email: 'pooja@example.com',
      phone: '9811122334',
      address: '7 Residency Road',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560025'
    }
  });

  const webhookOrder = orderForWebhook.data.order;
  const webhookPayload = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_webhook_captured_999',
          order_id: webhookOrder.razorpayOrderId,
          method: 'upi',
          status: 'captured'
        }
      }
    }
  });

  const webhookSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(webhookPayload)
    .digest('hex');

  const webhookRes = await request('POST', '/api/webhook', webhookPayload, {
    'X-Razorpay-Signature': webhookSig
  });
  assert(webhookRes.status === 200, 'Webhook processed successfully with 200 OK');

  // Verify the order was updated by webhook
  const updatedByWh = await request('GET', `/api/order/${webhookOrder.id}`);
  assert(updatedByWh.data.order.status === 'paid', 'Webhook confirmed and updated order status to "paid"');
}

async function main() {
  try {
    await runUnitAndSecurityTests();
    await runHttpApiTests();

    console.log('\n==================================================');
    console.log(`Test Execution Finished: ${passedTests} Passed, ${failedTests} Failed.`);
    console.log('==================================================\n');

    process.exit(failedTests === 0 ? 0 : 1);
  } catch (err) {
    console.error('Test Suite Failed with unexpected error:', err);
    process.exit(1);
  }
}

main();
