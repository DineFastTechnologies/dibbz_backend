// src/controller/tableController.js

// MODIFIED: Import admin and db directly from the firebase.js file
const { admin, db } = require('../firebase'); 

// Helper function to check if the authenticated user owns the target restaurant.
// MODIFIED: Uses directly imported 'db'
const checkRestaurantOwnership = async (req, res) => {
const restaurantId = req.params.restaurantId;
const authenticatedUserId = req.user.uid;

try {
const userDoc = await db.collection('users').doc(authenticatedUserId).get(); // Use directly imported 'db'
if (!userDoc.exists) {
res.status(403).send('Forbidden: User profile not found.');
return false;
}
const userRole = userDoc.data()?.role;
const ownedRestaurantId = userDoc.data()?.ownedRestaurantId;

if (userRole === 'admin') { // Admin can do anything
return true;
}
if (userRole === 'restaurant_owner' && ownedRestaurantId === restaurantId) {
return true; // Owner can manage their specific restaurant
}

res.status(403).send('Forbidden: You do not own this restaurant or lack permissions.');
return false;
} catch (error) {
console.error('Error checking restaurant ownership:', error);
res.status(500).send('Server error during ownership check.');
return false;
}
};


// GET all tables for a specific restaurant
// MODIFIED: Uses directly imported 'db'
const getTables = async (req, res) => {
const restaurantId = req.params.restaurantId;

try {
const tablesSnapshot = await db.collection('restaurants').doc(restaurantId).collection('tables') // Use directly imported 'db'
.orderBy('name', 'asc')
.get();
const tables = tablesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
res.status(200).json(tables);
} catch (error) {
console.error(`Error fetching tables for restaurant ${restaurantId}:`, error);
res.status(500).send('Failed to fetch tables.');
}
};

// CREATE a new table
// MODIFIED: Uses directly imported 'db' and 'admin'
const createTable = async (req, res) => {
if (!await checkRestaurantOwnership(req, res)) return; // Authorization check

const restaurantId = req.params.restaurantId;
const { name, capacity, status = 'available', isBookable = true } = req.body;

if (!name || !capacity) {
return res.status(400).send('Missing required fields: name, capacity.');
}
if (typeof capacity !== 'number' || capacity <= 0) {
return res.status(400).send('Capacity must be a positive number.');
}

try {
const newTableRef = await db.collection('restaurants').doc(restaurantId).collection('tables').add({ // Use directly imported 'db'
name,
capacity: parseInt(capacity),
status,
isBookable,
createdAt: admin.firestore.FieldValue.serverTimestamp(), // Use directly imported 'admin'
updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});
res.status(201).json({ id: newTableRef.id, message: 'Table created successfully!' });
} catch (error) {
console.error(`Error creating table for restaurant ${restaurantId}:`, error);
res.status(500).send('Failed to create table.');
}
};

// UPDATE a specific table
// MODIFIED: Uses directly imported 'db' and 'admin'
const updateTable = async (req, res) => {
if (!await checkRestaurantOwnership(req, res)) return; // Authorization check

const restaurantId = req.params.restaurantId;
const tableId = req.params.tableId;
const { name, capacity, status, isBookable } = req.body;

const updateData = {};
if (name !== undefined) updateData.name = name;
if (capacity !== undefined) {
const parsedCapacity = parseInt(capacity);
if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
return res.status(400).send('Invalid capacity provided.');
}
updateData.capacity = parsedCapacity;
}
if (status !== undefined) updateData.status = status;
if (isBookable !== undefined) updateData.isBookable = isBookable;
updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp(); // Use directly imported 'admin'

if (Object.keys(updateData).length <= 1 && updateData.updatedAt) {
return res.status(400).send('No relevant table data provided for update.');
}

try {
const tableRef = db.collection('restaurants').doc(restaurantId).collection('tables').doc(tableId); // Use directly imported 'db'
const doc = await tableRef.get();
if (!doc.exists) {
return res.status(404).send('Table not found.');
}

await tableRef.update(updateData);
res.status(200).send('Table updated successfully!');
} catch (error) {
console.error(`Error updating table ${tableId} for restaurant ${restaurantId}:`, error);
res.status(500).send('Failed to update table.');
}
};

// DELETE a specific table
// MODIFIED: Uses directly imported 'db'
const deleteTable = async (req, res) => {
if (!await checkRestaurantOwnership(req, res)) return; // Authorization check

const restaurantId = req.params.restaurantId;
const tableId = req.params.tableId;

try {
const tableRef = db.collection('restaurants').doc(restaurantId).collection('tables').doc(tableId); // Use directly imported 'db'
const doc = await tableRef.get();
if (!doc.exists) {
return res.status(404).send('Table not found.');
}

await tableRef.delete();
res.status(200).send('Table deleted successfully!');
} catch (error) {
console.error(`Error deleting table ${tableId} for restaurant ${restaurantId}:`, error);
res.status(500).send('Failed to delete table.');
}
};

module.exports = {
getTables,
createTable,
updateTable,
deleteTable,
};