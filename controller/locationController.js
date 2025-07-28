// src/controller/locationController.js

const axios = require('axios'); // Ensure axios is installed: npm install axios
// MODIFIED: Import admin, db, bucket directly from the firebase.js file
const { admin, db, bucket } = require('../firebase'); 

// --- IMPORTANT: Google Maps Geocoding API Configuration ---
// Make sure you have enabled the "Geocoding API" in your Google Cloud Project.
const GOOGLE_GEOCODING_API_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_API_KEY = process.env.GEOCODING_API_KEY; // This should be your Google Maps API Key from your .env file

const lookupPincode = async (req, res) => {
const pincode = req.query.pincode;

 if (!pincode) {
return res.status(400).send('Pincode is required.');
}
// Basic validation for 6-digit Pincode (adjust if international or other formats are allowed)
if (!/^\d{6}$/.test(pincode)) {
return res.status(400).send('Invalid Pincode format. Must be 6 digits.');
}

try {
// Make request to Google Maps Geocoding API
const apiResponse = await axios.get(GOOGLE_GEOCODING_API_URL, {
params: {
address: pincode, // Pass the pincode as the address to the API
key: GOOGLE_API_KEY, // Your Google Maps API Key
region: 'in', // Restrict results to India, which can improve accuracy for Indian pincodes
// Optional: Filter by postal code component for more precise results.
// This tells Google to specifically look for results where the postal code matches.
components: 'postal_code:' + pincode
},
});

const data = apiResponse.data;

// Check for API status and results
if (!data || data.status !== 'OK' || !data.results || data.results.length === 0) {
let errorMessage = 'No data found for this Pincode.';
if (data.status === 'ZERO_RESULTS') {
errorMessage = 'Pincode not found or no results returned.';
} else if (data.error_message) {
errorMessage = `API Error: ${data.error_message}`;
}
return res.status(404).json({ message: errorMessage });
}

// --- Parse the Google Maps API response ---
// Google Maps API returns an array of results. We'll typically use the first, most relevant result.
const firstResult = data.results[0];

let city = '';
let state = '';
let village = ''; // This field often requires careful parsing from address_components
let latitude = firstResult.geometry.location.lat;
let longitude = firstResult.geometry.location.lng;

// Iterate through address_components to extract desired information
firstResult.address_components.forEach(component => {
// 'locality' typically represents a city or major town.
if (component.types.includes('locality')) {
city = component.long_name;
}
// 'administrative_area_level_1' is usually the state/province.
else if (component.types.includes('administrative_area_level_1')) {
state = component.long_name;
}
// For "village", it can vary. 'sublocality' or 'sublocality_level_1' are often smaller areas within a city/town.
// 'administrative_area_level_3' can sometimes be a district or a smaller administrative unit which might map to village for rural areas.
else if (component.types.includes('sublocality') || component.types.includes('sublocality_level_1')) {
if (!village) { // Only set if village hasn't been found by a more specific type
village = component.long_name;
}
}
// You might add more specific parsing for 'village' if your data requires it,
// inspecting results from various Indian pincodes.
});

// Fallback for village if it wasn't found in typical sublocality types.
// Sometimes a district might serve as the most granular "village" equivalent in the response.
// Or if `city` isn't found, then `locality` itself might be what you consider a `village`.
if (!village) {
firstResult.address_components.forEach(component => {
if (component.types.includes('administrative_area_level_3') && !city) { // If it's a district and no city was found, use it as village
village = component.long_name;
} else if (component.types.includes('neighborhood') && !city && !village) { // If no city/village found, check neighborhood
village = component.long_name;
}
});
}

const locationData = {
city: city,
state: state,
village: village, // Best effort to get village/district/sublocality
latitude: latitude,
longitude: longitude,
};

res.status(200).json(locationData);
} catch (error) {
console.error(`Error looking up Pincode ${pincode} with Google Maps API:`, error.message);
if (axios.isAxiosError(error) && error.response) {
// Axios error with a response from the server (Google Maps API in this case)
console.error('Google Maps API Response Data:', error.response.data);
const apiStatus = error.response.data.status;
const apiMessage = error.response.data.error_message || 'Unknown Google Maps API error.';

if (apiStatus === 'REQUEST_DENIED' || apiStatus === 'OVER_QUERY_LIMIT') {
// Specific handling for API key issues or exceeding limits
return res.status(403).send(`Google Maps API error: ${apiMessage}. Please check your API key, billing settings, and API restrictions.`);
}
return res.status(error.response.status).send(`External API error: ${apiMessage}`);
} else if (axios.isAxiosError(error) && error.request) {
// Axios error, request was made but no response was received
console.error('Google Maps API Request Error: No response received.');
return res.status(503).send('Could not connect to Google Maps API. Please check your network connection or API endpoint.');
} 
res.status(500).send('Failed to lookup Pincode due to an unexpected server error.');
}
};

module.exports = {
lookupPincode,
};