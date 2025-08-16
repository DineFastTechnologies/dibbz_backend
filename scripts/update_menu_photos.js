const fs = require('fs');
const path = require('path');

// High-quality image URLs for different food categories
const foodImages = {
  // Breads
  'kulcha': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'naan': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'paratha': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'roti': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'garlic_naan': 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  
  // Appetizers
  'pakora': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'samosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'paneer_tikka': 'https://images.unsplash.com/photo-1604908177527-d7429d9f2f3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'seekh_kebab': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  
  // Main Dishes
  'chicken_biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'biryani': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'fish_curry': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'mutton_rogan_josh': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'chicken_korma': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'tandoori_chicken': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'butter_chicken': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'chicken_tikka_masala': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  
  // Vegetarian Dishes
  'paneer_butter_masala': 'https://images.unsplash.com/photo-1604908177527-d7429d9f2f3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'kadai_paneer': 'https://images.unsplash.com/photo-1604908177527-d7429d9f2f3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'matar_paneer': 'https://images.unsplash.com/photo-1604908177527-d7429d9f2f3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'palak_paneer': 'https://images.unsplash.com/photo-1604908177527-d7429d9f2f3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'dal_makhani': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'dal_tadka': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'malai_kofta': 'https://images.unsplash.com/photo-1604908177527-d7429d9f2f3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'navratan_korma': 'https://images.unsplash.com/photo-1604908177527-d7429d9f2f3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  
  // Rice Dishes
  'veg_pulao': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'jeera_rice': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  
  // Side Dishes
  'raita': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'caesar_salad': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'soup': 'https://images.unsplash.com/photo-1547592166-23ac45744acd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  
  // Breakfast
  'poha': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'upma': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'idli': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'vada': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'masala_dosa': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'chole_bhature': 'https://images.unsplash.com/photo-1601050690597-df0568f70950?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  
  // Beverages
  'lassi': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'juice': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'masala_tea': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'choco_shake': 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  
  // Snacks & Fast Food
  'veggie_burger': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  'french_fries': 'https://images.unsplash.com/photo-1573089027230-3a5b3c4c1c3d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400',
  
  // Desserts
  'gulab_jamun': 'https://images.unsplash.com/photo-1551024506-0bccd828d307?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400'
};

// Function to get image URL for a food item
function getImageUrl(itemName) {
  // Try to find exact match first
  if (foodImages[itemName.toLowerCase()]) {
    return foodImages[itemName.toLowerCase()];
  }
  
  // Try to find partial matches
  for (const [key, url] of Object.entries(foodImages)) {
    if (itemName.toLowerCase().includes(key) || key.includes(itemName.toLowerCase())) {
      return url;
    }
  }
  
  // Default fallback image
  return 'https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=400';
}

// Function to process all menu files
function processMenuFiles() {
  const restaurantsDir = path.join(__dirname, '..', 'data', 'restaurants');
  const preview = [];
  
  try {
    const restaurantDirs = fs.readdirSync(restaurantsDir)
      .filter(dir => fs.statSync(path.join(restaurantsDir, dir)).isDirectory())
      .sort();
    
    for (const restaurantDir of restaurantDirs) {
      const menuDir = path.join(restaurantsDir, restaurantDir, 'menu');
      
      if (fs.existsSync(menuDir)) {
        const menuFiles = fs.readdirSync(menuDir)
          .filter(file => file.endsWith('.json'));
        
        for (const menuFile of menuFiles) {
          const filePath = path.join(menuDir, menuFile);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          try {
            const menuItem = JSON.parse(fileContent);
            const itemName = menuItem.name || menuItem.item;
            
            if (itemName) {
              const newPhotoUrl = getImageUrl(itemName);
              
              // Add to preview array
              preview.push({
                file: `${restaurantDir}/menu/${menuFile}`,
                item: itemName,
                photo: newPhotoUrl
              });
              
              // Update the JSON file with new photo URL
              menuItem.photo = newPhotoUrl;
              fs.writeFileSync(filePath, JSON.stringify(menuItem, null, 2));
            }
          } catch (parseError) {
            console.error(`Error parsing ${filePath}:`, parseError.message);
          }
        }
      }
    }
    
    return preview;
  } catch (error) {
    console.error('Error processing menu files:', error);
    return [];
  }
}

// Main execution
if (require.main === module) {
  console.log('Processing restaurant menu files...');
  const preview = processMenuFiles();
  
  console.log('\nPreview JSON array:');
  console.log(JSON.stringify(preview, null, 2));
  
  console.log(`\nProcessed ${preview.length} menu items across all restaurants.`);
  console.log('All JSON files have been updated with new photo URLs.');
}

module.exports = { processMenuFiles, getImageUrl };
