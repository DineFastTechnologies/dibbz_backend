// controller/categoryController.js
const { admin, db } = require('../firebase');

exports.getCategories = async (req, res) => {
  try {
    const categoriesSnapshot = await db.collection('categories').get();
    const categories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(categories);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const categoryDoc = await db.collection('categories').doc(id).get();
    if (!categoryDoc.exists) {
      return res.status(404).json({ success: false, error: 'Category not found' });
    }
    res.json({ id: categoryDoc.id, ...categoryDoc.data() });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createCategory = async (req, res) => {
  const { name, imageUrl } = req.body;
  try {
    const newCategory = await db.collection('categories').add({
      name,
      imageUrl,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ id: newCategory.id });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, imageUrl } = req.body;
  try {
    await db.collection('categories').doc(id).update({
      name,
      imageUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection('categories').doc(id).delete();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
