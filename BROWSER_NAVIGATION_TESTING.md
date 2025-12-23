# Browser Navigation (Back/Forward Button) Testing Guide

## 🎯 Overview

**Branch:** `INT-1136/broswer-navigation-for-refinements`

**Changes Made:**
- Added `popstate` event handler to `urlManager.ts` 
- Implemented two-way URL ↔ State synchronization
- Added infinite loop prevention mechanism
- Preserved `collectionId` and `paginationType` during navigation

---

## 🔧 What Was Fixed

### The Problem
When users clicked browser back/forward buttons, the URL updated but the UI remained stale:
- Search results didn't update
- Filter pills stayed active
- Navigation checkboxes remained checked
- Page numbers didn't reset

### The Root Cause
The URLManager only had **one-way** synchronization:
```
✅ User Action → State Update → URL Update (via pushState)
❌ Browser Back/Forward → URL Update → ??? (nothing listened to popstate)
```

### The Solution
Added `popstate` event listener that:
1. **Detects** browser navigation events
2. **Re-parses** URL parameters 
3. **Updates** searchInputStore with new state
4. **Preserves** values not in URL (collectionId, paginationType)
5. **Prevents** infinite loops via `isHandlingPopstate` flag
6. **Triggers** search via SearchManager's existing filter logic

---

## 🧪 Critical Testing Scenarios

### A. Search Page - Refinements

#### Test 1: Single Refinement Back/Forward
1. Search for "shirt"
2. Apply brand filter "AMI PARIS"
   - ✅ URL: `?gbi-query=shirt&refinement=brands%3AAMI+PARIS&...`
   - ✅ UI shows filtered results
   - ✅ Brand checkbox checked
   - ✅ Filter pill visible
3. Click **browser back** button
   - ✅ URL: `?gbi-query=shirt&refinement=&...`
   - ✅ UI shows unfiltered results
   - ✅ Brand checkbox unchecked
   - ✅ Filter pill removed
4. Click **browser forward** button
   - ✅ URL: `?gbi-query=shirt&refinement=brands%3AAMI+PARIS&...`
   - ✅ UI shows filtered results again
   - ✅ Brand checkbox checked again
   - ✅ Filter pill reappears

#### Test 2: Multiple Refinements Sequence
1. Search for "pants"
2. Apply color filter "Blue"
   - ✅ URL updates with `refinement=color%3ABlue`
3. Apply size filter "Large"  
   - ✅ URL updates with `refinement=color%3ABlue,size%3ALarge`
4. Click back button (should remove "Large")
   - ✅ URL: `refinement=color%3ABlue`
   - ✅ Only blue filter active
5. Click back button again (should remove "Blue")
   - ✅ URL: `refinement=`
   - ✅ No filters active
6. Click forward, forward (restore both)
   - ✅ Both filters restored in order

#### Test 3: Price Range Filter
1. Search for "jacket"
2. Set price range $50-$100
   - ✅ URL updates with price refinement
   - ✅ UI shows price filter active
3. Click back button
   - ✅ Price range clears
   - ✅ UI shows all prices
4. Click forward
   - ✅ Price range restores

---

### B. Collection Page - Refinements

#### Test 4: Collection + Refinement Navigation
1. Navigate to `/collections/mens-clothing`
   - ✅ Shows collection products
   - ✅ URL: `/collections/mens-clothing`
2. Apply color filter "Red"
   - ✅ URL: `/collections/mens-clothing?refinement=color%3ARed&...`
   - ✅ Filtered collection results
3. Click back button
   - ✅ URL: `/collections/mens-clothing`
   - ✅ Shows all collection products
   - ✅ Still on collection page (not global search)
4. Click forward
   - ✅ Red filter reapplied to collection

#### Test 5: Collection → Search Bar → Back
1. Start on `/collections/mens-clothing`
2. Type "hoodie" in header search bar and submit
   - ✅ URL: `/search?gbi-query=hoodie&...`
   - ✅ Global catalog search (not just collection)
   - ✅ `collectionId` cleared
3. Click back button
   - ⚠️ **TRICKY CASE**: Should return to collection view
   - ✅ URL: `/collections/mens-clothing`
   - ✅ Collection products shown
   - ✅ `collectionId` restored? (verify this carefully)

---

### C. Pagination

#### Test 6: Standard Pagination Mode
1. Search for "shoes"
2. Click to page 2
   - ✅ URL: `?page=2&...`
   - ✅ Shows products 13-24
3. Click to page 3
   - ✅ URL: `?page=3&...`
   - ✅ Shows products 25-36
4. Click back button
   - ✅ URL: `?page=2&...`
   - ✅ Shows products 13-24 (not appended)
5. Click back again
   - ✅ URL: `?page=1&...`
   - ✅ Shows products 1-12

#### Test 7: "Show More" Pagination Mode
**⚠️ CRITICAL**: This is complex due to product appending

1. Search for "accessories"
2. Click "Show More" (page 2)
   - ✅ URL: `?page=2&...`
   - ✅ Products 1-24 visible (appended)
3. Click "Show More" again (page 3)
   - ✅ URL: `?page=3&...`
   - ✅ Products 1-36 visible (appended)
4. Click back button to page 2
   - ✅ URL: `?page=2&...`
   - ❓ **Expected**: Shows products 1-24
   - ❌ **Potential bug**: Might show wrong products due to append logic
   - **Verify carefully**: SearchManager should REPLACE, not append during popstate

---

### D. Sort & Page Size

#### Test 8: Sort Order Navigation
1. Search for "watches"
2. Change sort to "Price: Low to High"
   - ✅ URL: `?sort_by=price-asc&...`
3. Click back button
   - ✅ URL: `?sort_by=relevance&...`
   - ✅ Results re-sort to relevance

#### Test 9: Page Size Navigation
1. Search for "bags"
2. Change page size from 12 to 24
   - ✅ URL: `?pagesize=24&...`
   - ✅ Shows 24 products
3. Click back button
   - ✅ URL: `?pagesize=12&...`
   - ✅ Shows 12 products

---

### E. Edge Cases

#### Test 10: Null Search State
1. Search for "xyzabc123notfound"
   - ✅ 0 results shown
2. Add a refinement
   - ✅ Still 0 results
   - ✅ Filter pill visible
3. Click back button
   - ✅ Filter removed
   - ✅ Still 0 results for original query

#### Test 11: Rapid Back/Forward Clicking
1. Search for "test"
2. Apply filter, remove filter, apply different filter (create history)
3. **Rapidly** click back-back-forward-forward-back
   - ✅ No errors in console
   - ✅ UI eventually stabilizes to correct state
   - ✅ No duplicate search requests
   - ✅ Loading states handled correctly

#### Test 12: Direct URL Edit + Back Button
1. Search for "shirt" with refinement
2. Manually edit URL in browser bar: change `?gbi-query=shirt` to `?gbi-query=pants`
3. Press Enter
   - ✅ New search runs
4. Click back button
   - ✅ Returns to "shirt" search
   - ✅ Refinement state correct

---

### F. Theme-Specific Tests

#### Test 13: Empire Theme (if applicable)
1. Verify back/forward works on Empire theme
2. Check that nuclear fixes don't conflict with popstate handler

#### Test 14: Pillar Theme
1. Test all scenarios on Pillar theme
2. Verify data patches still apply correctly

---

## 🐛 Known Potential Issues to Watch For

### Issue 1: Infinite Loop
**Symptom:** Browser freezes, URL keeps changing rapidly
**Cause:** `isHandlingPopstate` flag not working
**Debug:** Check console for rapid fire logs

### Issue 2: CollectionId Lost
**Symptom:** Back button on collection page shows global search
**Cause:** `cachedSearchParams.collectionId` not preserved
**Debug:** Add console.log in popstate handler to check collectionId

### Issue 3: Show More Duplicate Products
**Symptom:** Products appear twice after back button
**Cause:** SearchManager appending instead of replacing
**Debug:** Check `paginationType` in search params during popstate

### Issue 4: Race Conditions
**Symptom:** Clicking back multiple times shows wrong state
**Cause:** Multiple searches in flight
**Debug:** Check `searchFx.pending` state, add delays between clicks

### Issue 5: SearchParamsUpdated Event Loop
**Symptom:** Web component remounts unexpectedly
**Cause:** `searchParamsUpdated` event dispatched during popstate
**Debug:** Check if `__didExternalMount` prevents issues

---

## 🔍 Debug Logging

Enable debug mode in Liquid initialization:
```javascript
GBISearchStateDriver.initUrlManager({
  defaultPagesize: defaultPagesize,
  source: source,
  paginationType: "{{ block.settings.page_handling_type }}",
  debug: true  // ← Enable this
});
```

Look for these log patterns:
```
✅ Good:
"URL Manager: popstate event detected - browser back/forward navigation"
"URL Manager: Parsed URL params from popstate: {...}"
"URL Manager: Updating store with popstate params: {...}"
"URL Manager: Skipping URL update during popstate handling"
"URL Manager: popstate handling complete"

❌ Bad (indicates issues):
"URL Manager: popstate event detected" (repeating rapidly)
"URL Manager: URL watcher triggered" (during popstate - should be skipped)
Multiple "Search Manager: searchFx triggered" in quick succession
```

---

## ✅ Success Criteria

All tests above should pass with:
- ✅ URL matches displayed state
- ✅ Search results update correctly  
- ✅ Filter UI (checkboxes, pills) syncs
- ✅ No console errors
- ✅ No infinite loops
- ✅ No duplicate search requests
- ✅ Loading states appear/disappear correctly
- ✅ Collection context preserved when appropriate
- ✅ Performance feels snappy (no lag)

---

## 📝 Testing Checklist

Copy this for your testing session:

```
Search Page Tests:
[ ] Single refinement back/forward
[ ] Multiple refinements sequence
[ ] Price range filter navigation
[ ] Sort order navigation
[ ] Page size navigation

Collection Page Tests:
[ ] Collection + refinement navigation
[ ] Collection → search bar → back button
[ ] Multiple filters on collection
[ ] Collection pagination + back

Pagination Tests:
[ ] Standard pagination back/forward
[ ] Show More pagination back/forward (critical!)
[ ] Mixed pagination + filters + back

Edge Cases:
[ ] Null search with filters
[ ] Rapid back/forward clicking
[ ] Direct URL edit + back
[ ] Browser refresh during navigation

Performance:
[ ] No infinite loops
[ ] No duplicate requests
[ ] Loading states correct
[ ] No memory leaks (check DevTools)
```

---

## 🚀 Next Steps After Testing

If issues found:
1. Note exact repro steps
2. Check debug logs for clues
3. Review `isHandlingPopstate` flag timing
4. Verify `cachedSearchParams` contains expected values
5. Check SearchManager filter conditions

If all tests pass:
1. Test on staging environment
2. Verify analytics/beacons still fire correctly
3. Check Shopify Admin preview
4. Test on mobile devices
5. Consider additional browser testing (Safari, Firefox, Edge)

---

## 💡 Implementation Notes

**Files Changed:**
- `rzlv-shopify-sdk/state-driver/src/urlManager.ts`

**Key Code Additions:**
1. `cachedSearchParams` variable (line ~95)
2. `isHandlingPopstate` flag (line ~108)  
3. `popstate` event listener (line ~210)

**Integration Points:**
- No changes needed in Svelte components
- No changes needed in search-state-manager.ts
- No changes needed in Liquid files
- Existing SearchManager filter logic handles triggered searches

**Backwards Compatibility:**
- ✅ All existing functionality preserved
- ✅ No breaking changes to API
- ✅ Only adds missing popstate handling
