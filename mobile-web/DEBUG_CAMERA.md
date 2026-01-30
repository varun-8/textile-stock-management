# Camera Debugging Guide

## Steps to Test Camera Initialization

1. **Open PWA in Browser**
   - Go to: `https://stock-system.local:5000/pwa`
   - Accept HTTPS certificate warning (self-signed)

2. **Open Browser Console (F12)**
   - Press `F12` to open Developer Tools
   - Click **Console** tab
   - Keep console visible while testing

3. **Navigate to Barcode Scanning**
   - Should be automatically in SCAN mode
   - Look at console for logs:
     - `📱 Initializing camera...`
     - `✅ DOM element ready, starting scanner...`
     - `⚙️ Calling scanner.render()...`
     - `✅ Scanner initialized successfully - camera should be visible now`

4. **Expected Behavior**
   - Camera should be visible in the center of screen
   - You should see a scanning box outline
   - You should be able to point at a barcode (CODE128 format like 26-40-0001)

5. **If Camera NOT Showing**
   - Look for error logs like:
     - `❌ Scanner initialization failed: ...`
     - `❌ Scanner element not found in DOM!`
   - Check if a **Manual Input Modal** appeared (with text input for barcode)
   - If modal appeared, camera initialization failed and fallback activated

6. **Manual Barcode Entry**
   - If camera fails, you can manually enter barcode
   - Click **SUBMIT** with barcode like `26-40-0001`
   - System should work normally

7. **Additional Diagnostics**
   - Open **Network** tab in DevTools
   - Check if `html5-qrcode` script loaded properly
   - Look for any fetch errors
   - Check that `/api/mobile/scan/:barcode` requests work

## Expected Console Logs (Good)

```
📱 Initializing camera...
✅ DOM element ready, starting scanner...
⚙️ Calling scanner.render()...
✅ Scanner initialized successfully - camera should be visible now
✅ Barcode scanned successfully: 26-40-0001
```

## Expected Console Logs (Camera Failed)

```
📱 Initializing camera...
✅ DOM element ready, starting scanner...
⚙️ Calling scanner.render()...
❌ Scanner initialization failed: NotAllowedError: Permission denied
💡 Showing manual input fallback...
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Camera not showing | Permissions denied | Click browser permission prompt, or go to Settings → Privacy → Camera → Allow stock-system.local |
| Scanner element not found | DOM not ready | Refresh page and wait for element to render |
| HTTPS certificate error | Self-signed cert | Click "Advanced" → "Proceed to stock-system.local" (unsafe) |
| Manual input modal appears | Camera permission denied or library error | Use manual input (keyboard) to enter barcode |
| Barcode not scanning after camera on | Wrong barcode format or library issue | Use manual input, or test with phone camera scanning |

## Current Implementation

- **Library**: html5-qrcode (v2.3.8)
- **Supported Formats**: CODE128, CODE39, EAN13, EAN8, UPCA, UPCE
- **Barcode Format Used**: CODE128 (e.g., 26-40-0001)
- **Fallback**: Manual keyboard input if camera fails
- **Initialization Method**: Delayed DOM check (50ms + 100ms fallback)
