# Camera Troubleshooting Guide

## Current Status
- ✅ Build successful
- ✅ Code updated with html5-qrcode
- ✅ Manual input fallback added
- ⏳ Testing needed

## Quick Test Checklist

### Before Testing
- [ ] Browser updated (Chrome/Safari recommended)
- [ ] HTTPS certificate warning accepted
- [ ] Camera device available (webcam/phone camera)
- [ ] DevTools ready (F12)

### Testing Steps

1. **Open PWA**
   ```
   https://stock-system.local:5000/pwa
   ```
   Expected: Page loads, SCAN mode active, camera region visible

2. **Check Console Logs** (F12 → Console tab)
   ```
   Expected logs in order:
   📱 Initializing camera...
   ✅ DOM element ready, starting scanner...
   ⚙️ Calling scanner.render()...
   ✅ Scanner initialized successfully - camera should be visible now
   ```

3. **Verify Camera Visible**
   - Should see video feed in center
   - Should see blue scanning box outline
   - Should see "POINT AT BARCODE" text

4. **Test Barcode Scan**
   - Hold barcode near camera
   - Format: `YY-SZ-XXXX` (e.g., `26-40-0001`)
   - Console should log: `✅ Barcode scanned successfully: 26-40-0001`
   - ACTION buttons should appear

### If Camera NOT Visible

**Step 1: Check Console for Errors**
- Look for messages starting with `❌`
- Common errors:
  - `NotAllowedError` = Camera permission denied
  - `NotFoundError` = No camera device found
  - `NotSupportedError` = Browser doesn't support camera

**Step 2: Allow Camera Permission**
- Look for camera permission prompt (usually top of page)
- If no prompt: Settings → Privacy → Camera → Enable for stock-system.local
- Refresh page after allowing

**Step 3: Try Manual Input**
- Click ⌨️ keyboard button (top-left)
- Manual input modal should appear
- Type barcode manually: `26-40-0001`
- Click SUBMIT
- If this works: Camera permission issue
- If this fails: Backend/network issue

**Step 4: Check Browser Support**
| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Excellent | Works best |
| Safari | ✅ Good | May need permission |
| Firefox | ✅ Good | Works well |
| Edge | ✅ Good | Similar to Chrome |
| Safari (iOS) | ⚠️ Limited | May not have video stream |

**Step 5: Network Issues**
- Check Network tab (DevTools → Network)
- Look for failed requests to `/api/mobile/scan/`
- If fails: Check server IP in settings (⚙️)

### If Barcode NOT Scanning

**Issue 1: Wrong Format**
- Ensure barcode is CODE128
- Format should be: `YY-SZ-XXXX`
- Examples:
  - ✅ `26-40-0001` (correct)
  - ✅ `25-35-0050` (correct)
  - ❌ `QR-CODE-HERE` (wrong - this is QR, not barcode)

**Issue 2: Poor Lighting**
- Move to well-lit area
- Avoid shadows on barcode
- Use torch (💡 button) if available

**Issue 3: Wrong Distance**
- Keep barcode within scanning box
- Distance: 5-15cm from camera
- Try different angles

**Issue 3: Library Not Loaded**
- Check Network tab for `html5-qrcode` errors
- If bundle missing: Rebuild with `npm run build`
- Clear browser cache (Ctrl+Shift+Del)

### If Manual Input NOT Working

**Step 1: Verify Barcode Format**
```
Expected: YY-SZ-XXXX
Example:  26-40-0001

❌ Wrong:
- 26400001 (no dashes)
- 26-40-1 (wrong size format)
- abc-de-fghi (letters not allowed)
```

**Step 2: Check Server Connection**
- Click ⚙️ settings button (top-right)
- Verify IP: Should be `stock-system.local` or your server IP
- Click SAVE
- Try manual input again

**Step 3: Check Backend Status**
- Backend should be running: `npm run start`
- Port 5000 accessible
- HTTPS working (self-signed cert)

**Step 4: Check API Endpoint**
- Open Network tab (DevTools)
- Submit barcode
- Look for request: `/api/mobile/scan/{barcode}`
- Response should have:
  ```json
  {
    "status": "VALID",
    "gapDetected": false,
    "rollId": "..."
  }
  ```

### Complete Failure - Recovery Steps

**If nothing works at all:**

1. **Force Refresh**
   ```
   Ctrl+Shift+R (Windows)
   Cmd+Shift+R (Mac)
   ```
   This clears all caches and reloads fresh

2. **Check Backend Running**
   ```bash
   # Terminal/PowerShell
   cd g:\tex\backend
   npm run start
   # Should see: "Server running on https://stock-system.local:5000"
   ```

3. **Check Frontend Build**
   ```bash
   # Terminal/PowerShell
   cd g:\tex\mobile-web
   npm run build
   # Should see: "✓ built in X.XXs"
   ```

4. **Access PWA**
   ```
   https://stock-system.local:5000/pwa
   ```

5. **Check Browser Console** (F12)
   - Look for RED errors
   - Take screenshot
   - Check if `html5-qrcode` library loaded

### Expected Console Output (Good Case)

```
📱 Initializing camera...
✅ DOM element ready, starting scanner...
🎥 Starting barcode scanner...
📱 Scanner element ready, initializing Html5QrcodeScanner...
⚙️ Calling scanner.render()...
✅ Scanner initialized successfully - camera should be visible now
✅ Barcode scanned successfully: 26-40-0001
📦 Scanned: 26-40-0001
📡 API Response: {status: 'VALID', ...}
✅ Valid scan, showing ACTION buttons
```

### Expected Console Output (Camera Failed)

```
📱 Initializing camera...
✅ DOM element ready, starting scanner...
🎥 Starting barcode scanner...
📱 Scanner element ready, initializing Html5QrcodeScanner...
⚙️ Calling scanner.render()...
❌ Scanner initialization failed: NotAllowedError: Permission denied
💡 Showing manual input fallback...
```
(Manual input modal should appear)

### Debug Mode - Advanced

**To enable extra logging:**
1. Open DevTools Console (F12)
2. Paste this code:
```javascript
// This shows what's happening in the scanner
console.log('🔍 Debug: Checking barcode-scanner element');
const elem = document.getElementById('barcode-scanner');
console.log('Element exists?', !!elem);
console.log('Element HTML:', elem?.innerHTML.substring(0, 100));
console.log('Element styles:', window.getComputedStyle(elem));
```

3. Hit Enter
4. Check output - should show element details

### Quick Contact Info

If issues persist:
1. Take screenshot of error
2. Copy console errors (red text)
3. Note barcode format you're testing
4. Note browser and device type
5. Send for analysis

### Known Limitations

- ⚠️ Safari iOS: May not have full camera support
- ⚠️ Secure Context Required: Must use HTTPS (http won't work)
- ⚠️ Camera Permission: Required and must be granted
- ⚠️ Code128 Barcodes: Only types listed in library supported

### Performance Notes

- 🚀 Scanning FPS: 10 (fast)
- 📦 Bundle Size: ~780KB (includes html5-qrcode)
- 📱 Mobile: Optimized for mobile devices
- 🔋 Battery: Moderate due to constant camera stream

---

**Last Updated**: Post-Build (html5-qrcode v2.3.8)
**Status**: Ready for Testing
**Next Action**: Test on actual device and report camera behavior
