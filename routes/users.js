
const express = require('express');
const router = express.Router();
const multer = require('multer'); 

const upload = multer({ storage: multer.memoryStorage() });

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


module.exports = router;
