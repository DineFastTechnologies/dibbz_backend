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

/**
 * @desc Get the top 10 recent searches of a specific user
 * @route GET /api/search/recent/:userId
 */

exports.getRecentSearches = async (req, res) => {
    try {
      const { userId } = req.params;
  
      if (!userId) {
        return res.status(400).json({ error: "Missing userId in params" });
      }
  
      const userSearchesRef = db.collection("users").doc(userId).collection("searches").doc("recent");
      const doc = await userSearchesRef.get();
  
      if (!doc.exists) {
        return res.status(404).json({ message: "No recent searches found for this user" });
      }
  
      const data = doc.data();
      const recentQueries = data.queries || [];
  
      return res.status(200).json({
        userId,
        recentSearches: recentQueries,
        lastSearched: data.lastSearched || null
      });
    } catch (error) {
      console.error("Error fetching recent searches:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };

  /**
 * @desc Get top N popular searches across all users
 * @route GET /api/search/popular?limit=10
 */
exports.getPopularSearches = async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 10;
  
      const globalRef = db.collection("global").doc("popular_searches");
      const globalDoc = await globalRef.get();
  
      if (!globalDoc.exists) {
        return res.status(404).json({ message: "No popular searches found" });
      }
  
      const data = globalDoc.data();
      const queries = data.queries || {};
  
      // Convert to array, sort by count descending
      const sorted = Object.entries(queries)
        .map(([term, info]) => ({
          term,
          count: info.count || 0,
          lastSearchedAt: info.lastSearchedAt || null
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
  
      return res.status(200).json({ popularSearches: sorted });
    } catch (error) {
      console.error("Error fetching popular searches:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };
  