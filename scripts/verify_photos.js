const fs = require('fs');
const path = require('path');

function verifyPhotos() {
  const restaurantsDir = path.join(__dirname, '..', 'data', 'restaurants');
  let totalFiles = 0;
  let updatedFiles = 0;
  let unsplashImages = 0;
  let sampleMappings = [];
  
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
          totalFiles++;
          const filePath = path.join(menuDir, menuFile);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          
          try {
            const menuItem = JSON.parse(fileContent);
            const itemName = menuItem.name || menuItem.item;
            const photoUrl = menuItem.photo;
            
            if (photoUrl && photoUrl.includes('unsplash.com')) {
              unsplashImages++;
              updatedFiles++;
              
              // Collect sample mappings
              if (sampleMappings.length < 15) {
                sampleMappings.push({
                  item: itemName,
                  photo: photoUrl.includes('unsplash.com') ? '✅ Unsplash' : '❌ Not Unsplash',
                  url: photoUrl
                });
              }
            } else if (photoUrl && !photoUrl.includes('unsplash.com')) {
              updatedFiles++;
            }
          } catch (parseError) {
            console.error(`Error parsing ${filePath}:`, parseError.message);
          }
        }
      }
    }
    
    console.log('=== PHOTO VERIFICATION REPORT ===');
    console.log(`Total menu files: ${totalFiles}`);
    console.log(`Files with updated photos: ${updatedFiles}`);
    console.log(`Files with Unsplash images: ${unsplashImages}`);
    console.log(`Percentage with Unsplash: ${((unsplashImages / totalFiles) * 100).toFixed(1)}%`);
    
    console.log('\n=== SAMPLE MAPPINGS ===');
    sampleMappings.forEach(mapping => {
      console.log(`${mapping.item} -> ${mapping.photo}`);
    });
    
    if (unsplashImages === totalFiles) {
      console.log('\n✅ SUCCESS: All images have been updated to Unsplash!');
    } else {
      console.log('\n⚠️  WARNING: Some images may not have been updated.');
    }
    
  } catch (error) {
    console.error('Error verifying photos:', error);
  }
}

if (require.main === module) {
  verifyPhotos();
}

module.exports = { verifyPhotos };
