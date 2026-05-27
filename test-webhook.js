/**
 * Test script to verify Clerk webhook endpoint locally
 * Run: node test-webhook.js
 */

const crypto = require('crypto');

const WEBHOOK_SECRET = 'whsec_x1NqZgMl4J6Ph/cFlg8O6IuAYakVrala';
const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/clerk';

// Mock Clerk user.created event
const mockEvent = {
  type: 'user.created',
  data: {
    id: 'user_test_123',
    email_addresses: [{ email_address: 'test@example.com' }],
    first_name: 'Test',
    last_name: 'User',
    image_url: 'https://example.com/image.jpg',
  },
};

// Generate Svix signature
function generateSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const msgId = `msg_${crypto.randomBytes(16).toString('hex')}`;

  // Remove the whsec_ prefix from secret
  const secretBytes = Buffer.from(secret.split('_')[1], 'base64');
  const signedContent = `${msgId}.${timestamp}.${payload}`;
  const signature = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');

  return {
    'svix-id': msgId,
    'svix-timestamp': timestamp.toString(),
    'svix-signature': `v1,${signature}`,
  };
}

async function testWebhook() {
  const payload = JSON.stringify(mockEvent);
  const headers = generateSignature(payload, WEBHOOK_SECRET);

  console.log('📤 Sending test webhook to:', WEBHOOK_URL);
  console.log('Event type:', mockEvent.type);
  console.log('Test email:', mockEvent.data.email_addresses[0].email_address);
  console.log('');

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: payload,
    });

    console.log('✅ Response status:', response.status);
    const responseText = await response.text();
    console.log('Response:', responseText);

    if (response.status === 200) {
      console.log('\n✨ Webhook test successful!');
      console.log('Check your database: SELECT * FROM users WHERE email = "test@example.com"');
    } else {
      console.log('\n❌ Webhook returned non-200 status');
    }
  } catch (error) {
    console.error('❌ Error sending webhook:', error.message);
    console.error('\nMake sure:');
    console.error('1. Your Next.js dev server is running on port 3000');
    console.error('2. The endpoint exists at /api/webhooks/clerk');
  }
}

testWebhook();
