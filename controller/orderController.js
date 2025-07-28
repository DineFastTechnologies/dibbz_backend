// src/controller/orderController.js

const axios = require('axios'); // For payment gateway calls (npm install axios if not already)
// MODIFIED: Import admin, db, bucket directly from the firebase.js file
const { admin, db, bucket } = require('../firebase'); 

// Helper to check if the authenticated user owns the target restaurant (for staff/admin actions)
// MODIFIED: Uses directly imported 'db'
const checkRestaurantOwnership = async (req, res, restaurantId) => {
const authenticatedUserId = req.user.uid;
const userDoc = await db.collection('users').doc(authenticatedUserId).get(); // Use directly imported 'db'
if (!userDoc.exists) {
res.status(403).send('Forbidden: User profile not found.');
return false;
}
const userRole = userDoc.data()?.role;
const ownedRestaurantId = userDoc.data()?.ownedRestaurantId;

if (userRole === 'admin') { // Admin can manage any restaurant
return true;
}
if (userRole === 'restaurant_owner' && ownedRestaurantId === restaurantId) {
return true; // Owner can manage their specific restaurant
}

res.status(403).send('Forbidden: Not authorized to manage this restaurant.');
return false;
};

// --- Payment Gateway Integration (Placeholder) ---
const initiatePayment = async (orderId, amount, userId) => {
console.log(`[Payment Placeholder] Initiating payment for Order ID: ${orderId}, Amount: ${amount}, User: ${userId}`);
// Replace with actual payment gateway API call
// Example: const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
// const paymentIntent = await stripe.paymentIntents.create({ amount: amount * 100, currency: 'inr', metadata: { order_id: orderId, user_id: userId } });
// return { paymentIntentId: paymentIntent.id, clientSecret: paymentIntent.client_secret, status: 'pending' };

// Simulate a payment gateway response
return {
paymentIntentId: `pi_${Date.now()}_${orderId}`,
clientSecret: `cs_${Date.now()}_${orderId}_secret_PLACEHOLDER`, // This would be sent to Flutter
redirectUrl: null,
status: 'pending',
};
};


// POST create a new order (can include pre-ordered food)
// MODIFIED: Uses directly imported 'db' and 'admin'
const createOrder = async (req, res) => {
const userId = req.user.uid;
const { restaurantId, items, bookingId, orderType = 'dine_in', specialInstructions } = req.body;

if (!restaurantId || !Array.isArray(items) || items.length === 0) {
return res.status(400).send('Missing required fields: restaurantId, items.');
}

try {
let totalAmount = 0;
const orderItems = [];

for (const item of items) {
const menuItemRef = db.collection('restaurants').doc(restaurantId).collection('menuItems').doc(item.menuItemId); // Use directly imported 'db'
const menuItemDoc = await menuItemRef.get();
if (!menuItemDoc.exists || !menuItemDoc.data().isAvailable) {
return res.status(400).send(`Menu item "${item.menuItemId}" not available.`);
}
const price = menuItemDoc.data().price;
const quantity = parseInt(item.quantity);
if (isNaN(quantity) || quantity <= 0) {
return res.status(400).send(`Invalid quantity for item "${item.menuItemId}".`);
}
totalAmount += price * quantity;
orderItems.push({
menuItemId: item.menuItemId,
name: menuItemDoc.data().name,
quantity: quantity,
price: price,
});
}

const prepaymentAmount = totalAmount * 0.50; // 50% deposit

const orderRef = db.collection('orders').doc(); // Use directly imported 'db'
const orderData = {
userId,
restaurantId,
items: orderItems,
totalAmount,
prepaymentAmount,
status: 'pending_payment',
orderType,
bookingId: bookingId || null,
specialInstructions: specialInstructions || '',
createdAt: admin.firestore.FieldValue.serverTimestamp(), // Use directly imported 'admin'
updatedAt: admin.firestore.FieldValue.serverTimestamp(),
paymentStatus: 'unpaid',
paymentIntentId: null,
};

await orderRef.set(orderData);

const paymentDetails = await initiatePayment(orderRef.id, prepaymentAmount, userId);
await orderRef.update({ paymentIntentId: paymentDetails.paymentIntentId });

res.status(201).json({
orderId: orderRef.id,
message: 'Order initiated. Please complete payment.',
prepaymentAmount,
paymentDetails,
});

} catch (error) {
console.error(`Error creating order for user ${userId}:`, error);
res.status(500).send('Failed to create order.');
}
};

// GET user's orders (past and upcoming)
// MODIFIED: Uses directly imported 'db'
const getUserOrders = async (req, res) => {
const userId = req.user.uid;

try {
const ordersSnapshot = await db.collection('orders') // Use directly imported 'db'
.where('userId', '==', userId)
.orderBy('createdAt', 'desc')
.get();
const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
res.status(200).json(orders);
} catch (error) {
console.error(`Error fetching orders for user ${userId}:`, error);
res.status(500).send('Failed to fetch orders.');
}
};

// GET a specific order detail
// MODIFIED: Uses directly imported 'db'
const getOrderDetail = async (req, res) => {
const userId = req.user.uid;
const orderId = req.params.orderId;

try {
const orderDoc = await db.collection('orders').doc(orderId).get(); // Use directly imported 'db'

if (!orderDoc.exists) {
return res.status(404).send('Order not found.');
}
if (orderDoc.data().userId !== userId) {
return res.status(403).send('Forbidden: You can only view your own orders.');
}

res.status(200).json({ id: orderDoc.id, ...orderDoc.data() });
} catch (error) {
console.error(`Error fetching order ${orderId} for user ${userId}:`, error);
res.status(500).send('Failed to fetch order details.');
}
};

// PUT update order status (e.g., by restaurant owner/staff)
// MODIFIED: Uses directly imported 'db' and 'admin'
const updateOrderStatus = async (req, res) => {
const orderId = req.params.orderId;
const { status } = req.body;

if (!status) {
return res.status(400).send('New status is required.');
}
const validStatuses = ['confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
if (!validStatuses.includes(status)) {
return res.status(400).send(`Invalid status. Must be one of: ${validStatuses.join(', ')}.`);
}

try {
const orderRef = db.collection('orders').doc(orderId); // Use directly imported 'db'
const orderDoc = await orderRef.get();
if (!orderDoc.exists) {
return res.status(404).send('Order not found.');
}

if (!await checkRestaurantOwnership(req, res, orderDoc.data().restaurantId)) {
return;
}

await orderRef.update({
status,
updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Use directly imported 'admin'
});

res.status(200).send('Order status updated successfully.');
} catch (error) {
console.error(`Error updating status for order ${orderId}:`, error);
res.status(500).send('Failed to update order status.');
}
};

// PATCH cancel an order (by user)
// MODIFIED: Uses directly imported 'db' and 'admin'
const cancelOrder = async (req, res) => {
const userId = req.user.uid;
const orderId = req.params.orderId;

try {
const orderRef = db.collection('orders').doc(orderId); // Use directly imported 'db'
const orderDoc = await orderRef.get();

if (!orderDoc.exists) {
return res.status(404).send('Order not found.');
}
if (orderDoc.data().userId !== userId) {
return res.status(403).send('Forbidden: You can only cancel your own order.');
}

const currentStatus = orderDoc.data().status;
if (['preparing', 'ready', 'completed', 'cancelled'].includes(currentStatus)) {
return res.status(400).send(`Order cannot be cancelled in '${currentStatus}' status.`);
}

await orderRef.update({
status: 'cancelled',
updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Use directly imported 'admin'
});

res.status(200).send('Order cancelled successfully.');
} catch (error) {
console.error(`Error cancelling order ${orderId} for user ${userId}:`, error);
res.status(500).send('Failed to cancel order.');
}
};


// POST endpoint for payment gateway to confirm payment (or frontend confirms successful payment)
// MODIFIED: Uses directly imported 'db' and 'admin'
const confirmPayment = async (req, res) => {
const orderId = req.params.orderId;
const { paymentIntentId, paymentStatus, transactionDetails } = req.body;

if (!paymentIntentId || !paymentStatus) {
return res.status(400).send('Missing payment confirmation details.');
}

try {
const orderRef = db.collection('orders').doc(orderId); // Use directly imported 'db'
const orderDoc = await orderRef.get();
if (!orderDoc.exists) {
return res.status(404).send('Order not found.');
}

let newOrderStatus = orderDoc.data().status;
if (paymentStatus === 'succeeded' && orderDoc.data().paymentStatus === 'unpaid') {
newOrderStatus = 'confirmed';
} else if (paymentStatus === 'failed') {
newOrderStatus = 'payment_failed';
}

await orderRef.update({
paymentStatus: paymentStatus === 'succeeded' ? '50%_paid' : 'failed',
status: newOrderStatus,
updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Use directly imported 'admin'
transactionDetails: transactionDetails || {},
});

if (orderDoc.data().bookingId) {
await db.collection('bookings').doc(orderDoc.data().bookingId).update({ // Use directly imported 'db'
status: newOrderStatus,
updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Use directly imported 'admin'
});
}

res.status(200).send('Payment confirmed and order/booking updated.');
} catch (error) {
console.error(`Error confirming payment for order ${orderId}:`, error);
res.status(500).send('Failed to confirm payment.');
}
};


module.exports = {
createOrder,
getUserOrders,
getOrderDetail,
updateOrderStatus,
cancelOrder,
confirmPayment,
};