const admin = require("firebase-admin");
const db = admin.firestore();

/**
 * @desc Store a search query for a user and update global popular searches
 * @route POST /api/search
 * @body { userId: string, query: string }
 */
exports.storeSearch = async (req, res) => {
  try {
    const { userId, query } = req.body;

    if (!userId || !query) {
      return res.status(400).json({ error: "Missing userId or query" });
    }

    const userRef = db.collection("users").doc(userId);
    const userSearchesRef = userRef.collection("searches").doc("recent");

    let previousSearches = [];

    // Check if user search document exists
    const userSearchDoc = await userSearchesRef.get();

    if (userSearchDoc.exists) {
      const data = userSearchDoc.data();
      if (Array.isArray(data.queries)) {
        previousSearches = data.queries;
      }
    } else {
      // Initialize recent searches doc if it doesn't exist
      await userSearchesRef.set({
        queries: [],
        lastSearched: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Update user’s recent search list (with deduplication, max 10)
    const updatedSearches = [query, ...previousSearches.filter(q => q !== query)].slice(0, 10);

    await userSearchesRef.set({
      queries: updatedSearches,
      lastSearched: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Update global popular searches
    const globalRef = db.collection("global").doc("popular_searches");

    await db.runTransaction(async (transaction) => {
      const globalDoc = await transaction.get(globalRef);
      const currentData = globalDoc.exists ? globalDoc.data() : {};
      const queries = currentData.queries || {};
      const existingEntry = queries[query] || {};

      const updatedEntry = {
        count: (existingEntry.count || 0) + 1,
        lastSearchedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      transaction.set(globalRef, {
        queries: {
          [query]: updatedEntry
        }
      }, { merge: true });
    });

    return res.status(200).json({ message: "Search stored successfully" });

  } catch (error) {
    console.error("Error storing search:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
