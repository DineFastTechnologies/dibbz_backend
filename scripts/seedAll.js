const fs = require('fs');
const path = require('path');
const { admin, db } = require('../firebase');

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
    if (!details.details) return;
    const docRef = db.collection('restaurants').doc(id);
    batch.set(docRef, details.details); 
    if (details.menu) {
      Object.entries(details.menu).forEach(([menuId, menuItem]) => {
        const menuRef = docRef.collection('menu').doc(menuId);
        batch.set(menuRef, menuItem);
      });
    }
  });

  await batch.commit();
  console.log('Seeded all restaurant data!');
}

seedRestaurants().catch(console.error);
