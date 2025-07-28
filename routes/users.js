// src/routes/users.js
const express = require('express');
const router = express.Router();
const multer = require('multer'); // Used for image uploads

// Configure Multer for in-memory storage.
// This means the file content will be stored in a buffer in req.file.buffer.
const upload = multer({ storage: multer.memoryStorage() });

// --- Existing Profile Endpoints ---

// 1. GET User Profile
// Endpoint: GET /api/users/:userId
router.get('/:userId', async (req, res) => {
  const targetUserId = req.params.userId;
  const authenticatedUserId = req.user.uid;

  if (targetUserId !== authenticatedUserId) {
    return res.status(403).send('Forbidden: You can only view your own profile.');
  }

  try {
    const userDoc = await req.db.collection('users').doc(targetUserId).get();

    if (!userDoc.exists) {
      const authUser = await req.admin.auth().getUser(targetUserId);
      const newProfile = {
        name: authUser.displayName || '',
        displayName: authUser.email ? authUser.email.split('@')[0] : 'dibbz_user',
        email: authUser.email || '',
        phoneNumber: authUser.phoneNumber || '',
        profileImageUrl: authUser.photoURL || '',
        bio: '',
        role: 'customer', // Default role for new users
        likedRestaurantIds: [], // Initialize liked restaurants for new users
        createdAt: req.admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: req.admin.firestore.FieldValue.serverTimestamp(),
      };
      await req.db.collection('users').doc(targetUserId).set(newProfile);
      return res.status(200).json({ id: targetUserId, ...newProfile });
    }

    res.status(200).json({ id: userDoc.id, ...userDoc.data() });
  } catch (error) {
    console.error(`Error fetching user profile for ${targetUserId}:`, error);

    if (error.code === 'auth/user-not-found') {
      return res.status(404).send('User not found in Firebase Authentication.');
    }
    res.status(500).send('Server error while fetching profile.');
  }
});

// 2. PUT Update User Profile (Text Data)
// Endpoint: PUT /api/users/:userId
router.put('/:userId', async (req, res) => {
  const targetUserId = req.params.userId;
  const authenticatedUserId = req.user.uid;

  if (targetUserId !== authenticatedUserId) {
    return res.status(403).send('Forbidden: You can only update your own profile.');
  }

  const { name, displayName, bio, phoneNumber } = req.body;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (displayName !== undefined) updateData.displayName = displayName;
  if (bio !== undefined) updateData.bio = bio;
  if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
  updateData.updatedAt = req.admin.firestore.FieldValue.serverTimestamp();

  if (Object.keys(updateData).length <= 1 && updateData.updatedAt) {
     return res.status(400).send('No relevant profile data provided for update.');
  }

  try {
    await req.db.collection('users').doc(targetUserId).update(updateData);
    res.status(200).send('Profile updated successfully.');
  } catch (error) {
    console.error(`Error updating user profile for ${targetUserId}:`, error);
    res.status(500).send('Failed to update profile.');
  }
});

// 3. POST Update User Profile Image
// Endpoint: POST /api/users/:userId/profile-image
router.post('/:userId/profile-image', upload.single('image'), async (req, res) => {
  const targetUserId = req.params.userId;
  const authenticatedUserId = req.user.uid;

  if (targetUserId !== authenticatedUserId) {
    return res.status(403).send('Forbidden: You can only update your own profile image.');
  }
  if (!req.file) {
    return res.status(400).send('No image file provided.');
  }

  const fileBuffer = req.file.buffer;
  const originalName = req.file.originalname;
  const contentType = req.file.mimetype;
  const fileName = `profile_${authenticatedUserId}_${Date.now()}.${originalName.split('.').pop()}`;
  const destinationPath = `users/${authenticatedUserId}/profile_pictures/${fileName}`;

  const file = req.bucket.file(destinationPath);

  try {
    const userDoc = await req.db.collection('users').doc(authenticatedUserId).get();
    const oldImageUrl = userDoc.data()?.profileImageUrl;

    if (oldImageUrl && oldImageUrl.includes(req.bucket.name) && oldImageUrl.includes(`/users/${authenticatedUserId}/profile_pictures/`)) {
      try {
        const oldFilePath = oldImageUrl.split(`${req.bucket.name}/`)[1];
        await req.bucket.file(oldFilePath).delete();
        console.log(`Deleted old profile image: ${oldFilePath}`);
      } catch (deleteError) {
        console.warn('Could not delete old profile image:', deleteError.message);
      }
    }

    await file.save(fileBuffer, {
      metadata: { contentType: contentType },
      public: true
    });

    const newImageUrl = `https://storage.googleapis.com/${req.bucket.name}/${destinationPath}`;

    await req.db.collection('users').doc(authenticatedUserId).update({
      profileImageUrl: newImageUrl,
      updatedAt: req.admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      message: 'Profile image updated successfully!',
      url: newImageUrl,
    });
  } catch (error) {
    console.error('Error uploading/updating profile image:', error);
    res.status(500).send('Failed to update profile image.');
  }
});

// 4. DELETE User Profile (Highly sensitive operation!)
// Endpoint: DELETE /api/users/:userId
router.delete('/:userId', async (req, res) => {
    const targetUserId = req.params.userId;
    const authenticatedUserId = req.user.uid;

    if (targetUserId !== authenticatedUserId) {
        return res.status(403).send('Forbidden: You can only delete your own profile.');
    }

    try {
        const userDocRef = req.db.collection('users').doc(targetUserId);

        const batch = req.db.batch();
        batch.delete(userDocRef);

        const ordersSnapshot = await req.db.collection('orders').where('userId', '==', targetUserId).get();
        ordersSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Firestore data for user ${targetUserId} deleted.`);

        const imagePrefix = `users/${targetUserId}/profile_pictures/`;
        const [files] = await req.bucket.getFiles({ prefix: imagePrefix });
        if (files.length > 0) {
            await Promise.all(files.map(file => file.delete()));
            console.log(`Deleted ${files.length} profile pictures for user ${targetUserId} from Cloud Storage.`);
        }

        await req.admin.auth().deleteUser(targetUserId);
        console.log(`Deleted user ${targetUserId} from Firebase Authentication.`);

        res.status(200).send('User profile and all associated data deleted successfully.');
    } catch (error) {
        console.error(`Error deleting user profile ${targetUserId}:`, error);

        if (error.code === 'auth/user-not-found') {
            return res.status(404).send('User not found in Firebase Authentication.');
        }
        res.status(500).send('Failed to delete profile. Check server logs for details.');
    }
});

// --- User's Saved Locations Endpoints ---

// 5. GET All User Saved Locations
// Endpoint: GET /api/users/:userId/locations
router.get('/:userId/locations', async (req, res) => {
  const targetUserId = req.params.userId;
  const authenticatedUserId = req.user.uid;

  if (targetUserId !== authenticatedUserId) {
    return res.status(403).send('Forbidden: You can only view your own locations.');
  }

  try {
    const locationsSnapshot = await req.db.collection('users').doc(targetUserId).collection('savedLocations').get();
    const locations = locationsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(locations);
  } catch (error) {
    console.error(`Error fetching saved locations for user ${targetUserId}:`, error);
    res.status(500).send('Failed to fetch saved locations.');
  }
});

// 6. POST Add a New Custom Location for User
// Endpoint: POST /api/users/:userId/locations
router.post('/:userId/locations', async (req, res) => {
  const targetUserId = req.params.userId;
  const authenticatedUserId = req.user.uid;

  if (targetUserId !== authenticatedUserId) {
    return res.status(403).send('Forbidden: You can only add locations to your own profile.');
  }

  const { name, address, latitude, longitude, isDefault = false, category = 'Others', pincode, city, state, village } = req.body;

  if (!name || !address || latitude == null || longitude == null) {
    return res.status(400).send('Missing required location fields: name, address, latitude, longitude.');
  }
  const validCategories = ["Home", "Work", "Friends and Family", "Others"];
  if (!validCategories.includes(category)) {
      return res.status(400).send('Invalid category provided. Must be one of: Home, Work, Friends and Family, Others.');
  }

  try {
    const newLocationRef = req.db.collection('users').doc(targetUserId).collection('savedLocations').doc();
    await newLocationRef.set({
      name,
      address,
      latitude,
      longitude,
      isDefault,
      category,
      pincode: pincode || null, // Store explicit pincode
      city: city || null,       // Store explicit city
      state: state || null,     // Store explicit state
      village: village || null, // Store explicit village
      createdAt: req.admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: req.admin.firestore.FieldValue.serverTimestamp(),
    });

    if (isDefault) {
      const existingDefaults = await req.db.collection('users').doc(targetUserId)
                                         .collection('savedLocations')
                                         .where('isDefault', '==', true)
                                         .get();
      const batch = req.db.batch();
      existingDefaults.docs.forEach(doc => {
        if (doc.id !== newLocationRef.id) {
          batch.update(doc.ref, { isDefault: false });
        }
      });
      await batch.commit();
    }

    res.status(201).json({ id: newLocationRef.id, message: 'Location added successfully!' });
  } catch (error) {
    console.error(`Error adding location for user ${targetUserId}:`, error);
    res.status(500).send('Failed to add location.');
  }
});

// 7. PUT Update a User Saved Location
router.put('/:userId/locations/:locationId', async (req, res) => {
  const targetUserId = req.params.userId;
  const authenticatedUserId = req.user.uid;
  const locationId = req.params.locationId;

  if (targetUserId !== authenticatedUserId) {
    return res.status(403).send('Forbidden: You can only update your own locations.');
  }

  const { name, address, latitude, longitude, isDefault, category, pincode, city, state, village } = req.body;
  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (address !== undefined) updateData.address = address;
  if (latitude !== undefined) updateData.latitude = latitude;
  if (longitude !== undefined) updateData.longitude = longitude;
  if (isDefault !== undefined) updateData.isDefault = isDefault;
  if (pincode !== undefined) updateData.pincode = pincode;
  if (city !== undefined) updateData.city = city;
  if (state !== undefined) updateData.state = state;
  if (village !== undefined) updateData.village = village;
  if (category !== undefined) {
      const validCategories = ["Home", "Work", "Friends and Family", "Others"];
      if (!validCategories.includes(category)) {
          return res.status(400).send('Invalid category provided. Must be one of: Home, Work, Friends and Family, Others.');
      }
      updateData.category = category;
  }
  updateData.updatedAt = req.admin.firestore.FieldValue.serverTimestamp();

  if (Object.keys(updateData).length <= 1 && updateData.updatedAt) {
    return res.status(400).send('No relevant location data provided for update.');
  }

  try {
    const locationRef = req.db.collection('users').doc(targetUserId).collection('savedLocations').doc(locationId);
    const doc = await locationRef.get();
    if (!doc.exists) {
      return res.status(404).send('Location not found.');
    }

    await locationRef.update(updateData);

    if (isDefault === true) {
      const existingDefaults = await req.db.collection('users').doc(targetUserId)
                                         .collection('savedLocations')
                                         .where('isDefault', '==', true)
                                         .get();
      const batch = req.db.batch();
      existingDefaults.docs.forEach(doc => {
        if (doc.id !== locationId) {
          batch.update(doc.ref, { isDefault: false });
        }
      });
      await batch.commit();
    }

    res.status(200).send('Location updated successfully!');
  } catch (error) {
    console.error(`Error updating location ${locationId} for user ${targetUserId}:`, error);
    res.status(500).send('Failed to update location.');
  }
});

// 8. DELETE a User Saved Location
router.delete('/:userId/locations/:locationId', async (req, res) => {
  const targetUserId = req.params.userId;
  const authenticatedUserId = req.user.uid;
  const locationId = req.params.locationId;

  if (targetUserId !== authenticatedUserId) {
    return res.status(403).send('Forbidden: You can only delete your own locations.');
  }

  try {
    const locationRef = req.db.collection('users').doc(targetUserId).collection('savedLocations').doc(locationId);
    const doc = await locationRef.get();
    if (!doc.exists) {
      return res.status(404).send('Location not found.');
    }

    await locationRef.delete();
    res.status(200).send('Location deleted successfully!');
  }
  catch (error) {
    console.error(`Error deleting location ${locationId} for user ${targetUserId}:`, error);
    res.status(500).send('Failed to delete location.');
  }
});

// 9. PATCH Set a Location as Primary
router.patch('/:userId/locations/:locationId/set-primary', async (req, res) => {
  const targetUserId = req.params.userId;
  const authenticatedUserId = req.user.uid;
  const locationId = req.params.locationId;

  if (targetUserId !== authenticatedUserId) {
    return res.status(403).send('Forbidden: You can only update your own locations.');
  }

  try {
    const userLocationsRef = req.db.collection('users').doc(targetUserId).collection('savedLocations');

    const targetLocRef = userLocationsRef.doc(locationId);
    const targetLocDoc = await targetLocRef.get();

    if (!targetLocDoc.exists) {
      return res.status(404).send('Location not found.');
    }

    const batch = req.db.batch();

    const existingDefaults = await userLocationsRef.where('isDefault', '==', true).get();
    existingDefaults.docs.forEach(doc => {
      if (doc.id !== locationId) {
        batch.update(doc.ref, { isDefault: false });
      }
    });

    batch.update(targetLocRef, {
      isDefault: true,
      updatedAt: req.admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    res.status(200).send('Primary location set successfully.');
  } catch (error) {
    console.error(`Error setting primary location ${locationId} for user ${targetUserId}:`, error);
    res.status(500).send('Failed to set primary location.');
  }
});


module.exports = router;