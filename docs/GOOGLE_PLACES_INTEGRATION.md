# Google Places API Integration

This document explains how to set up and use the Google Places API integration for the Wallzy app.

## Overview

The Google Places API integration allows users to search for places (like "McDonald's") and automatically categorize them into reward categories (like "dining") to find the best credit card for that purchase.

## Setup Requirements

### 1. Google Places API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Places API" and "Geocoding API" services
4. Create API credentials (API Key)
5. Set up API key restrictions for security

### 2. Supabase Configuration

1. Add the Google Places API key to Supabase secrets:

   ```
   GOOGLE_PLACES_KEY=your_google_places_api_key_here
   ```

2. Deploy the Supabase Edge Functions:

   ```bash
   # From the supabase/functions directory
   supabase functions deploy google_places_search
   supabase functions deploy google_places_details
   ```

3. Update the SQL functions with your project reference:
   ```sql
   -- Replace YOUR_PROJECT_REF with your actual Supabase project reference
   url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/google_places_search'
   ```

### 3. Database Setup

Run the SQL functions to create the necessary database functions:

```sql
-- Execute the google_places_search.sql file in your Supabase SQL editor
```

## How It Works

### 1. User Search Flow

1. User types a place name (e.g., "McDonald's") in the search bar
2. App calls `searchPlaceAndGetCategory()` function
3. Function calls Google Places API to find matching places
4. API returns place details including types (e.g., ["restaurant", "fast_food"])
5. App maps Google types to internal categories (e.g., "restaurant" → "dining")
6. App calls the existing card recommendation system with the category
7. User sees the best card for that place/category

### 2. Category Mapping

The system maps Google Places types to internal reward categories:

```typescript
const CATEGORY_MAPPING = {
  // Dining
  restaurant: "dining",
  fast_food: "dining",
  cafe: "dining",

  // Gas/EV
  gas_station: "gas_ev",
  electric_vehicle_charging_station: "gas_ev",

  // Groceries
  grocery_or_supermarket: "groceries",
  supermarket: "groceries",

  // And many more...
};
```

### 3. Fallback Mechanism

If Google Places API fails:

1. System falls back to direct category search
2. User can still search using predefined categories
3. No functionality is lost

## Usage Examples

### Search for a Restaurant

- User input: "McDonald's"
- Google Places returns: types: ["restaurant", "fast_food"]
- Mapped category: "dining"
- Result: Shows best card for dining purchases

### Search for a Gas Station

- User input: "Shell"
- Google Places returns: types: ["gas_station"]
- Mapped category: "gas_ev"
- Result: Shows best card for gas purchases

### Search for a Grocery Store

- User input: "Walmart"
- Google Places returns: types: ["grocery_or_supermarket", "department_store"]
- Mapped category: "groceries"
- Result: Shows best card for grocery purchases

## Error Handling

### API Errors

- Network issues: Shows user-friendly error message
- Invalid API key: Logs error and falls back to category search
- Rate limiting: Shows appropriate error message

### No Results

- No matching places: Shows "No places found" message
- No applicable category: Shows "No applicable reward category found"

### Invalid Input

- Empty search: Prevents search
- Invalid format: Shows validation error

## Testing

### Manual Testing

1. Open the dashboard
2. Tap the search bar
3. Type a place name (e.g., "Starbucks")
4. Verify the correct category is detected
5. Check that the best card is recommended

### Test Cases

- [ ] Search for well-known chains (McDonald's, Starbucks, etc.)
- [ ] Search for generic terms (gas station, grocery store)
- [ ] Search for places with multiple categories
- [ ] Test with invalid API key
- [ ] Test with no internet connection
- [ ] Test fallback to category search

## Security Considerations

### API Key Security

- Store API key in Supabase secrets, never in client code
- Set up API key restrictions in Google Cloud Console
- Monitor API usage and set up alerts

### Rate Limiting

- Google Places API has rate limits
- Implement caching if needed
- Monitor usage in Google Cloud Console

### Data Privacy

- Only send necessary data to Google Places API
- Don't store sensitive user data in logs
- Follow Google's API terms of service

## Troubleshooting

### Common Issues

1. **"Google Places API key not configured"**

   - Check that GOOGLE_PLACES_KEY is set in Supabase secrets
   - Verify the secret is properly deployed

2. **"No places found for this search"**

   - Check internet connection
   - Verify the search term is valid
   - Check Google Places API quota

3. **"No applicable reward category found"**

   - The place type isn't mapped to a reward category
   - Add the mapping to CATEGORY_MAPPING in googlePlacesService.ts

4. **Function deployment errors**
   - Check Supabase CLI is properly configured
   - Verify project reference is correct
   - Check function syntax and dependencies

### Debugging

Enable debug logging in the Edge Functions:

```typescript
console.log("Debug info:", { query, googlePlacesKey, response });
```

Check Supabase function logs:

```bash
supabase functions logs google_places_search
```

## Future Enhancements

1. **Caching**: Implement result caching to reduce API calls
2. **Autocomplete**: Add real-time search suggestions
3. **Location-based**: Use user location for more relevant results
4. **Multiple results**: Show multiple matching places with options
5. **Custom categories**: Allow users to define custom category mappings

## Dependencies

- Google Places API
- Supabase Edge Functions
- Supabase Database
- React Native (Expo)
- TypeScript
