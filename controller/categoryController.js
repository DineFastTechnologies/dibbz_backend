const { db } = require('../firebase');

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const categoriesSnapshot = await db.collection('categories').get();
    const categories = [];
    categoriesSnapshot.forEach(doc => {
      categories.push({ id: doc.id, ...doc.data() });
    });
    res.status(200).json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a specific category by ID
exports.getCategoryById = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const categoryDoc = await db.collection('categories').doc(categoryId).get();
    if (!categoryDoc.exists) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json({ id: categoryDoc.id, ...categoryDoc.data() });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new category
exports.createCategory = async (req, res) => {
  try {
    const newCategory = req.body;
    const categoryRef = await db.collection('categories').add(newCategory);
    res.status(201).json({ id: categoryRef.id, ...newCategory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a category
exports.updateCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    const updatedCategory = req.body;
    await db.collection('categories').doc(categoryId).update(updatedCategory);
    res.status(200).json({ id: categoryId, ...updatedCategory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a category
exports.deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;
    await db.collection('categories').doc(categoryId).delete();
    res.status(200).json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
