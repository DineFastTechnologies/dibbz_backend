// test_firestore_query.js

// Import Firebase Admin SDK from your setup file
const { admin, db } = require('./firebase'); 

console.log("--- Starting Isolated Firestore Query Test ---");

// This line should log the project ID if firebase.js works correctly
console.log(`Test Script: Firebase Admin SDK initialized for Project ID: ${admin.app().options.projectId}`);

async function testQuery() {
    const restaurantId = "01"; // The specific restaurant ID we are having trouble with

    console.log(`Test Script: Attempting to query menu items for restaurant ID: "${restaurantId}"`);

    try {
        const menuItemsSnapshot = await db.collection('restaurants').doc(restaurantId).collection('menuItems')
                                            .orderBy('category', 'asc')
                                            .orderBy('name', 'asc')
                                            .get();

        const menuItems = menuItemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log(`Test Script: Query completed. Snapshot empty: ${menuItemsSnapshot.empty}, Snapshot size: ${menuItemsSnapshot.size}`);
        console.log(`Test Script: Found ${menuItems.length} menu items.`);

        if (menuItems.length > 0) {
            console.log("Test Script: Successfully retrieved menu items!");
            console.log("Test Script: First menu item data:", JSON.stringify(menuItems[0], null, 2));
        } else {
            console.log("Test Script: Query returned ZERO menu items. This contradicts manual console check.");
            const restaurantDocCheck = await db.collection('restaurants').doc(restaurantId).get();
            if (!restaurantDocCheck.exists) {
                console.log(`Test Script: ERROR: Restaurant document "${restaurantId}" DOES NOT EXIST.`);
            } else {
                console.log(`Test Script: INFO: Restaurant document "${restaurantId}" EXISTS, but 'menuItems' subcollection is EMPTY.`);
            }
        }
    } catch (error) {
        console.error("Test Script: An error occurred during the Firestore query:", error.message);
        console.error("Test Script: Check network connectivity, firewall, or if your service account has correct permissions.");
    } finally {
        console.log("--- Test Complete ---");
        // It's good practice to exit the Node.js process explicitly for standalone scripts
        // process.exit(0);
    }
}

testQuery().catch(console.error);