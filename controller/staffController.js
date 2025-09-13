// Staff Management Controller
const { db } = require('../firebase');
const { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, getDoc } = require('firebase/firestore');

// Helper to check if the authenticated user owns the target restaurant
const checkRestaurantOwnership = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user owns this restaurant
    const restaurantRef = doc(db, 'restaurants', restaurantId);
    const restaurantDoc = await getDoc(restaurantRef);
    
    if (!restaurantDoc.exists()) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const restaurantData = restaurantDoc.data();
    if (restaurantData.ownerId !== userId) {
      return res.status(403).json({ error: 'Access denied. You do not own this restaurant.' });
    }

    req.restaurantData = restaurantData;
    next();
  } catch (error) {
    console.error('Error checking restaurant ownership:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/restaurants/:restaurantId/staff - Add new staff member
const addStaffMember = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, email, phone, role } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !role) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, email, phone, role' 
      });
    }

    // Validate role
    const validRoles = ['manager', 'cashier', 'waiter', 'kitchen_staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be one of: ' + validRoles.join(', ') 
      });
    }

    // Check if staff member already exists with this email
    const staffRef = collection(db, 'restaurants', restaurantId, 'staff');
    const existingStaffQuery = query(staffRef, where('email', '==', email));
    const existingStaffSnapshot = await getDocs(existingStaffQuery);
    
    if (!existingStaffSnapshot.empty) {
      return res.status(409).json({ 
        error: 'Staff member with this email already exists' 
      });
    }

    // Create staff member
    const staffData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      role,
      restaurantId,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(staffRef, staffData);
    
    console.log('✅ Staff member added:', { id: docRef.id, ...staffData });
    
    res.status(201).json({
      message: 'Staff member added successfully',
      staffMember: {
        id: docRef.id,
        ...staffData
      }
    });
  } catch (error) {
    console.error('Error adding staff member:', error);
    res.status(500).json({ error: 'Failed to add staff member' });
  }
};

// GET /api/restaurants/:restaurantId/staff - Get all staff members for a restaurant
const getStaffMembers = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { includeInactive = false } = req.query;

    const staffRef = collection(db, 'restaurants', restaurantId, 'staff');
    let staffQuery = staffRef;
    
    // Filter by active status if not including inactive
    if (includeInactive !== 'true') {
      staffQuery = query(staffRef, where('isActive', '==', true));
    }

    const staffSnapshot = await getDocs(staffQuery);
    const staffMembers = staffSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
    }));

    console.log(`✅ Retrieved ${staffMembers.length} staff members for restaurant ${restaurantId}`);
    
    res.json({
      staffMembers,
      count: staffMembers.length
    });
  } catch (error) {
    console.error('Error getting staff members:', error);
    res.status(500).json({ error: 'Failed to get staff members' });
  }
};

// GET /api/restaurants/:restaurantId/staff/:staffId - Get specific staff member
const getStaffMemberById = async (req, res) => {
  try {
    const { restaurantId, staffId } = req.params;

    const staffRef = doc(db, 'restaurants', restaurantId, 'staff', staffId);
    const staffDoc = await getDoc(staffRef);

    if (!staffDoc.exists()) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const staffData = {
      id: staffDoc.id,
      ...staffDoc.data(),
      createdAt: staffDoc.data().createdAt?.toDate?.() || staffDoc.data().createdAt,
      updatedAt: staffDoc.data().updatedAt?.toDate?.() || staffDoc.data().updatedAt
    };

    console.log('✅ Retrieved staff member:', staffData);
    
    res.json({ staffMember: staffData });
  } catch (error) {
    console.error('Error getting staff member:', error);
    res.status(500).json({ error: 'Failed to get staff member' });
  }
};

// PUT /api/restaurants/:restaurantId/staff/:staffId - Update staff member
const updateStaffMember = async (req, res) => {
  try {
    const { restaurantId, staffId } = req.params;
    const { name, email, phone, role, isActive } = req.body;

    // Validate role if provided
    if (role) {
      const validRoles = ['manager', 'cashier', 'waiter', 'kitchen_staff'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ 
          error: 'Invalid role. Must be one of: ' + validRoles.join(', ') 
        });
      }
    }

    // Check if staff member exists
    const staffRef = doc(db, 'restaurants', restaurantId, 'staff', staffId);
    const staffDoc = await getDoc(staffRef);

    if (!staffDoc.exists()) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Check if email is being changed and if it conflicts with existing staff
    if (email && email !== staffDoc.data().email) {
      const staffRef = collection(db, 'restaurants', restaurantId, 'staff');
      const existingStaffQuery = query(staffRef, where('email', '==', email));
      const existingStaffSnapshot = await getDocs(existingStaffQuery);
      
      if (!existingStaffSnapshot.empty) {
        return res.status(409).json({ 
          error: 'Staff member with this email already exists' 
        });
      }
    }

    // Prepare update data
    const updateData = {
      updatedAt: new Date()
    };

    if (name) updateData.name = name.trim();
    if (email) updateData.email = email.toLowerCase().trim();
    if (phone) updateData.phone = phone.trim();
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    await updateDoc(staffRef, updateData);
    
    console.log('✅ Staff member updated:', { id: staffId, ...updateData });
    
    res.json({
      message: 'Staff member updated successfully',
      staffMember: {
        id: staffId,
        ...updateData
      }
    });
  } catch (error) {
    console.error('Error updating staff member:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
};

// DELETE /api/restaurants/:restaurantId/staff/:staffId - Delete staff member
const deleteStaffMember = async (req, res) => {
  try {
    const { restaurantId, staffId } = req.params;
    const { permanent = false } = req.query;

    const staffRef = doc(db, 'restaurants', restaurantId, 'staff', staffId);
    const staffDoc = await getDoc(staffRef);

    if (!staffDoc.exists()) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if (permanent === 'true') {
      // Permanently delete the document
      await deleteDoc(staffRef);
      console.log('✅ Staff member permanently deleted:', staffId);
    } else {
      // Soft delete - mark as inactive
      await updateDoc(staffRef, {
        isActive: false,
        updatedAt: new Date()
      });
      console.log('✅ Staff member deactivated:', staffId);
    }
    
    res.json({
      message: permanent === 'true' ? 'Staff member permanently deleted' : 'Staff member deactivated'
    });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    res.status(500).json({ error: 'Failed to delete staff member' });
  }
};

module.exports = {
  addStaffMember,
  getStaffMembers,
  getStaffMemberById,
  updateStaffMember,
  deleteStaffMember,
  checkRestaurantOwnership
};
