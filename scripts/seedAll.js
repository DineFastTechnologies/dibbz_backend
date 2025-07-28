// scripts/seedAll.js
const fs = require('fs');
const path = require('path');
const { admin, db } = require('../firebase'); // Assuming firebase.js is at root

function readJsonFilesRecursively(dir) {
  let results = {};
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      results[file] = readJsonFilesRecursively(fullPath);
    } else if (file.endsWith('.json')) {
      // --- ADDED LOGS ---
      console.log(`[readJson] Reading file: ${fullPath}`);
      // --- END ADDED LOGS ---
      results[path.basename(file, '.json')] = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    }
  });
  return results;
}

async function seedRestaurants() {
  const dataDir = path.join(__dirname, '../data/restaurants');
  // --- ADDED LOGS ---
  console.log(`[seedRestaurants] Data directory being read: ${dataDir}`);
  // --- END ADDED LOGS ---

  const restaurants = readJsonFilesRecursively(dataDir);

  // --- ADDED LOGS ---
  console.log(`[seedRestaurants] Restaurants object loaded:`, JSON.stringify(restaurants, null, 2));
  console.log(`[seedRestaurants] Number of top-level restaurant folders found: ${Object.keys(restaurants).length}`);
  // --- END ADDED LOGS ---


  const batch = db.batch();
  let seededRestaurantCount = 0;
  let seededMenuItemCount = 0;

  Object.entries(restaurants).forEach(([folderId, details]) => { // 'folderId' here is "01", "02"
    // --- ADDED LOGS ---
    console.log(`[seedRestaurants] Processing restaurant folder ID: ${folderId}`);
    // --- END ADDED LOGS ---

    if (!details.details || !details.details.id) { 
      console.warn(`[seedRestaurants] Skipping restaurant directory ${folderId}: No details.json or missing 'id' field in details.`);
      return; 
    }
    // --- CRITICAL CORRECTION HERE ---
    const docId = details.details.id; // <-- THIS IS THE LINE TO CHANGE: Use the 'id' field from the JSON details
    const docRef = db.collection('restaurants').doc(docId); // <-- Use docId for Firestore document ID
    // --- END CRITICAL CORRECTION ---

    // --- ADDED LOGS ---
    console.log(`[seedRestaurants] Preparing to seed restaurant document with Firestore ID: "${docId}" from folder "${folderId}"`);
    console.log(`[seedRestaurants] Restaurant details for "${docId}":`, JSON.stringify(details.details, null, 2));
    // --- END ADDED LOGS ---

    batch.set(docRef, details.details);
    seededRestaurantCount++;

    if (details.menu) {
      // --- ADDED LOGS ---
      console.log(`[seedRestaurants] Found 'menu' object for "${docId}". Number of menu items in JSON: ${Object.keys(details.menu).length}`);
      // --- END ADDED LOGS ---

      Object.entries(details.menu).forEach(([menuId, menuItem]) => {
        const menuRef = docRef.collection('menuItems').doc(menuId); 
        batch.set(menuRef, menuItem);
        seededMenuItemCount++;
        // --- ADDED LOGS ---
        console.log(`[seedRestaurants]   - Adding menu item "${menuId}" for restaurant "${docId}"`);
        // --- END ADDED LOGS ---
      });
    } else {
        console.log(`[seedRestaurants] No 'menu' object found in details for restaurant ID: "${docId}". No menu items will be seeded.`);
    }
  });

  try {
    await batch.commit();
    console.log(`🌱 Seeded ${seededRestaurantCount} restaurant(s) and ${seededMenuItemCount} menu item(s) to Firestore!`);
  } catch (error) {
    console.error("❌ Error seeding Firestore:", error);
  }
}

// Function to seed Users data (from previous steps)
async function seedUsers() {
  const usersDataPath = path.join(__dirname, '../data/users.json');
  console.log(`[seedUsers] User data path: ${usersDataPath}`);
  try {
    const users = JSON.parse(fs.readFileSync(usersDataPath, 'utf8'));
    console.log(`[seedUsers] Number of users found in JSON: ${users.length}`);

    const batch = db.batch();
    users.forEach(user => {
      const docRef = db.collection('users').doc(user.id);
      batch.set(docRef, {
        ...user,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        displayName: user.displayName || user.name.split(' ')[0],
        profileImageUrl: user.profileImageUrl || '',
        bio: user.bio || '',
        phoneNumber: user.contactInfo.phone || '',
        email: user.contactInfo.email || '',
        role: user.role || 'customer',
        ownedRestaurantId: user.ownedRestaurantId || null,
        likedRestaurantIds: user.likedRestaurantIds || [],
      });
    });

    await batch.commit();
    console.log('🌱 Seeded user data to Firestore!');
  } catch (error) {
    console.error('❌ Error seeding user data:', error);
  }
}

// Function to seed Bookings data (from previous steps)
async function seedBookings() {
  const bookingsDataPath = path.join(__dirname, '../data/bookings.json');
  console.log(`[seedBookings] Booking data path: ${bookingsDataPath}`);
  try {
    const bookings = JSON.parse(fs.readFileSync(bookingsDataPath, 'utf8'));
    console.log(`[seedBookings] Number of bookings found in JSON: ${bookings.length}`);
    const batch = db.batch();

    bookings.forEach(booking => {
      const docRef = db.collection('bookings').doc(booking.id);
      batch.set(docRef, {
        ...booking,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    console.log('🌱 Seeded booking data to Firestore!');
  } catch (error) {
    console.error('❌ Error seeding booking data:', error);
  }
}

// Run all seeding functions
async function seedAllData() {
  console.log('Starting full data seeding...');
  await seedRestaurants();
  await seedUsers();
  await seedBookings();
  console.log('Full data seeding complete!');
}

seedAllData().catch(console.error);