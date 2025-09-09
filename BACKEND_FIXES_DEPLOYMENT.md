# 🚀 Backend Fixes & Deployment Guide

## 🔍 Issues Fixed:

### ✅ **Issue 1: Restaurant Creation (404 Error)**
- **Problem**: `/api/restaurant` POST endpoint was missing
- **Fix**: Added `createNewRestaurant` function and route
- **Files Modified**:
  - `controller/restaurantCRUD.js` - Added `createNewRestaurant` function
  - `routes/restaurantRoutes.js` - Added `POST /` route

### ✅ **Issue 2: Menu Batch Creation (Future proofing)**
- **Problem**: No batch creation endpoint for multiple menu items
- **Fix**: Added `createMenuItems` function and route
- **Files Modified**:
  - `controller/menuController.js` - Added `createMenuItems` function
  - `routes/menus.js` - Added `POST /batch` route

### 🚧 **Issue 3: OTP Functionality (500 Error)**
- **Problem**: Missing Twilio environment variables in Vercel
- **Fix**: Need to add environment variables to Vercel

## 🔧 Deployment Steps:

### Step 1: Deploy Backend Changes
```bash
cd C:\Users\manav\OneDrive\Desktop\dibbz
git add .
git commit -m "Fix: Add restaurant creation and menu batch endpoints"
git push origin main
```

### Step 2: Add Twilio Environment Variables to Vercel
Go to your Vercel dashboard → Project Settings → Environment Variables and add:

```
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_VERIFY_SERVICE_SID=your_twilio_verify_service_sid
```

**To get these values:**
1. Go to [Twilio Console](https://console.twilio.com/)
2. **Account SID** & **Auth Token**: Found on the main dashboard
3. **Verify Service SID**: Go to Verify → Services → Create/Select a service

### Step 3: Redeploy After Environment Variables
After adding environment variables, Vercel will automatically redeploy.
Or manually trigger: `vercel --prod`

## 🧪 Testing After Deployment:

### Test Restaurant Creation:
```bash
curl -X POST https://dibbzproject.vercel.app/api/restaurant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Restaurant",
    "cuisine": "Indian",
    "address": "123 Test Street",
    "city": "Test City",
    "state": "Test State"
  }'
```

### Test OTP Sending:
```bash
curl -X POST https://dibbzproject.vercel.app/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+1234567890"}'
```

## 📋 New API Endpoints Added:

### Restaurant Creation
- **Endpoint**: `POST /api/restaurant`
- **Auth**: Required
- **Body**: Restaurant details (name, cuisine, address, etc.)
- **Response**: `{ restaurantId: "...", restaurant: {...} }`

### Menu Batch Creation
- **Endpoint**: `POST /api/restaurants/:restaurantId/menu/batch`
- **Auth**: Required (restaurant owner)
- **Body**: `{ menuItems: [{ name, description, price, category, isVeg, isAvailable, imageUrl }] }`
- **Response**: `{ message: "...", menuItems: [...] }`

## 🔍 Debugging:

If issues persist:
1. Check Vercel function logs in dashboard
2. Verify environment variables are set
3. Test endpoints individually with curl/Postman
4. Check browser console for detailed error logs

## 🚧 Development Mode:

The frontend will automatically fall back to mock mode if backend fails:
- **OTP**: Use `123456` for any phone number
- **Restaurant Creation**: Uses mock data
- **Menu Creation**: Uses mock data

This allows continued development while backend issues are resolved.
