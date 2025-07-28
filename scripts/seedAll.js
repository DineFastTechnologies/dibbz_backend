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
      results[path.basename(file, '.json')] = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    }
  });
  return results;
}

async function seedRestaurants() {
  const dataDir = path.join(__dirname, '../data/restaurants');
  const restaurants = readJsonFilesRecursively(dataDir);

  const batch = db.batch();
  Object.entries(restaurants).forEach(([id, details]) => {
    if (!details.details) {
      console.warn(`Skipping restaurant directory ${id}: No details.json found.`);
      return; // Skip directories without a details.json
    }
    const docRef = db.collection('restaurants').doc(id);
    batch.set(docRef, details.details);

    if (details.menu) {
      Object.entries(details.menu).forEach(([menuId, menuItem]) => {
        // --- CRITICAL CORRECTION HERE ---
        const menuRef = docRef.collection('menuItems').doc(menuId); // <-- CHANGED from 'menu' to 'menuItems'
        // --- END CRITICAL CORRECTION ---
        batch.set(menuRef, menuItem);
      });
    }
  });

  try {
    await batch.commit();
    console.log('🌱 Seeded all restaurant and menu data!');
  } catch (error) {
    console.error("❌ Error seeding Firestore:", error);
  }
}

// --- ADDED: Function to seed Users data (from previous steps) ---
async function seedUsers() {
  const usersDataPath = path.join(__dirname, '../data/users.json');
  try {
    const users = JSON.parse(fs.readFileSync(usersDataPath, 'utf8'));
    const batch = db.batch();

    users.forEach(user => {
      // Use the 'id' from JSON as the Firestore document ID (recommended for seed data matching Auth UID)
      const docRef = db.collection('users').doc(user.id);
      batch.set(docRef, {
        ...user,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        // Add default fields if not present in JSON, and adjust to match users.js model
        // Ensure these are correctly mapped from your JSON or set defaults
        displayName: user.displayName || user.name.split(' ')[0],
        profileImageUrl: user.profileImageUrl || '',
        bio: user.bio || '',
        phoneNumber: user.contactInfo.phone || '',
        email: user.contactInfo.email || '',
        role: user.role || 'customer', // Use role from JSON if present, else 'customer'
        ownedRestaurantId: user.ownedRestaurantId || null, // Link owner to a restaurant
        likedRestaurantIds: user.likedRestaurantIds || [], // Initialize liked restaurants
      });
    });

    await batch.commit();
    console.log('🌱 Seeded user data to Firestore!');
  } catch (error) {
    console.error('❌ Error seeding user data:', error);
  }
}

// --- ADDED: Function to seed Bookings data (from previous steps) ---
async function seedBookings() {
  const bookingsDataPath = path.join(__dirname, '../data/bookings.json');
  try {
    const bookings = JSON.parse(fs.readFileSync(bookingsDataPath, 'utf8'));
    const batch = db.batch();

    bookings.forEach(booking => {
      // Use the 'id' from JSON as the Firestore document ID
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


// --- MODIFIED: Run all seeding functions ---
async function seedAllData() {
  console.log('Starting full data seeding...');
  await seedRestaurants();
  await seedUsers(); // Call user seed function
  await seedBookings(); // Call booking seed function
  console.log('Full data seeding complete!');
}

seedAllData().catch(console.error); // Execute the main seeding function