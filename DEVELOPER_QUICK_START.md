# Mobile-Web Theme - Developer Quick Start

## For Developers

### Theme System Overview

The mobile-web app now uses a centralized CSS variable system matching the desktop application's premium indigo/slate design.

**Key Files**:
- `tailwind.config.js` - Color tokens
- `src/index.css` - CSS variables & component classes
- `src/context/MobileContext.jsx` - THEME constant (reference only)

### Using the Theme

#### 1. Tailwind Classes (Preferred)

```jsx
// Backgrounds
<div className="bg-primary">      // Main background (#0f172a)
<div className="bg-secondary">    // Cards/panels (#1e293b)
<div className="bg-surface">      // Tertiary (#334155)

// Text
<p className="text-textPrimary">      // Light (#f8fafc)
<p className="text-textSecondary">    // Muted (#94a3b8)

// Accents
<button className="btn-primary">   // Indigo button
<button className="btn-secondary"> // Secondary button

// Colors
<span className="text-accent">    // #6366f1
<span className="text-success">   // #10b981
<span className="text-warning">   // #f59e0b
<span className="text-error">     // #ef4444

// Borders
<div className="border border-border">

// Components
<div className="panel">           // Card/panel
<div className="glass">           // Modal/overlay
<div className="glass-card">      // Glass card
```

#### 2. CSS Variables (Custom Styling)

```css
/* In custom CSS */
color: var(--text-primary);        /* #f8fafc */
background: var(--bg-secondary);   /* #1e293b */
border-color: var(--border-color); /* #334155 */
box-shadow: var(--card-shadow);
font-family: var(--font-family);   /* Outfit */

/* Opacity variants */
background: var(--success-color);  /* #10b981 */
background: var(--error-bg);       /* rgba(239,68,68,0.1) */
```

#### 3. Opacity Classes

```jsx
// Accent variations
<div className="bg-accent/5">      // 5% opacity
<div className="bg-accent/10">     // 10% opacity
<div className="bg-accent/20">     // 20% opacity

// Text variations
<p className="text-textSecondary/75">  // 75% opacity

// Border variations
<div className="border border-border/50">
```

---

## Common Patterns

### Button Pattern
```jsx
// Primary action
<button className="btn-primary">
  Action Text
</button>

// Secondary action
<button className="btn-secondary">
  Secondary
</button>

// Danger action
<button className="bg-error text-white p-3 rounded-lg hover:bg-error/90">
  Delete
</button>
```

### Card Pattern
```jsx
// Standard card
<div className="panel">
  <h2 className="text-textPrimary font-bold">Title</h2>
  <p className="text-textSecondary">Description</p>
</div>

// Glass card (modal)
<div className="glass rounded-xl p-4">
  <p className="text-textPrimary">Content</p>
</div>
```

### Input Pattern
```jsx
<div>
  <label className="block text-xs font-bold text-textPrimary mb-2 uppercase">
    Label
  </label>
  <input
    className="w-full px-4 py-3 bg-primary border border-border rounded-lg text-textPrimary outline-none"
  />
</div>
```

### Alert Pattern
```jsx
// Success
<div className="bg-success/10 border border-success/30 rounded-lg p-4">
  <p className="text-sm font-semibold text-success">Success message</p>
</div>

// Error
<div className="bg-error/10 border border-error/30 rounded-lg p-4">
  <p className="text-sm font-semibold text-error">Error message</p>
</div>

// Warning
<div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
  <p className="text-sm font-semibold text-warning">Warning message</p>
</div>
```

### Modal Pattern
```jsx
<div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-lg flex items-center justify-center">
  <div className="glass rounded-xl p-6 w-full max-w-sm">
    <h2 className="text-lg font-bold text-textPrimary mb-4">Modal Title</h2>
    {/* Content */}
    <button className="w-full btn-primary">Action</button>
  </div>
</div>
```

---

## Adding New Features

### New Screen Template

```jsx
import React from 'react';
import { useMobile } from '../context/MobileContext';

const NewScreen = () => {
  const { /* hooks */ } = useMobile();

  return (
    <div className="min-h-screen bg-primary flex flex-col">
      {/* Background blobs (optional) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="absolute w-96 h-96 bg-accent/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <div className="relative bg-secondary border-b border-border p-6">
        <h1 className="text-3xl font-bold text-textPrimary">Screen Title</h1>
        <p className="text-textSecondary text-sm">Subtitle</p>
      </div>

      {/* Content */}
      <div className="relative flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-5">
          {/* Content here */}
          <button className="w-full btn-primary">Action</button>
        </div>
      </div>
    </div>
  );
};

export default NewScreen;
```

### New Component Pattern

```jsx
const MyComponent = ({ title, message, type = 'info' }) => {
  const colors = {
    success: 'bg-success/10 text-success border-success/30',
    error: 'bg-error/10 text-error border-error/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    info: 'bg-accent/10 text-accent border-accent/30'
  };

  return (
    <div className={`rounded-lg p-4 border ${colors[type]}`}>
      <h3 className="font-bold text-sm mb-1">{title}</h3>
      <p className="text-xs opacity-75">{message}</p>
    </div>
  );
};
```

---

## Color Selection Guide

**Use `text-accent` (#6366f1) when you need**:
- Primary action buttons
- Important highlights
- Focus indicators
- Logo colors
- Key metrics

**Use `text-success` (#10b981) when you need**:
- Confirmation messages
- Positive feedback
- Completed actions
- Valid states
- Check marks

**Use `text-warning` (#f59e0b) when you need**:
- Caution messages
- Pending states
- Gaps/alerts
- Attention needed
- Important notices

**Use `text-error` (#ef4444) when you need**:
- Error messages
- Dangerous actions
- Failed states
- Deletions
- Critical issues

**Use `text-textSecondary` (#94a3b8) when you need**:
- Helper text
- Descriptions
- Disabled states
- Secondary info
- Placeholder text

---

## Animations Available

```jsx
// Fade in
<div className="animate-fade-in">Content</div>

// Scan laser effect
<div className="laser-line animate-scan"></div>

// Pulse slow
<div className="animate-pulse-slow">Pulsing</div>

// Slide up (see index.css keyframes)
<div className="animate-slide-up">Slides up</div>
```

---

## Common Issues & Solutions

### Issue: Colors look different on my device
**Solution**: Use CSS variables directly, not hardcoded colors. Ensures consistency.

### Issue: Input is not visible when focused
**Solution**: Input focus uses `rgba(99, 102, 241, 0.2)` ring. If not showing, check z-index.

### Issue: Button text is not readable
**Solution**: Accent text on dark background uses indigo `#6366f1`. Contrast ratio is 8.4:1 (AA).

### Issue: Modal is too dark/bright
**Solution**: Use `glass` class which applies proper backdrop blur and opacity.

### Issue: Border looks too bright/dim
**Solution**: Border color is `#334155`. If using opacity, use `.border-border/50` etc.

---

## Testing Colors

### Quick Test
Open browser console and run:
```javascript
// Get computed color
const elem = document.querySelector('.text-accent');
const color = window.getComputedStyle(elem).color;
console.log(color); // Should be rgb(99, 102, 241)
```

### Accessibility Check
1. Use WebAIM contrast checker: https://webaim.org/articles/contrast/
2. Test with colorblind simulator: https://www.color-blindness.com
3. Verify with axe DevTools browser extension

---

## VS Code Snippets

### Create `.vscode/tailwind.json`
```json
{
  "Tailwind Button": {
    "prefix": "twbtn",
    "body": [
      "<button className=\"w-full btn-primary\">",
      "  ${1:Action}",
      "</button>"
    ]
  },
  "Tailwind Card": {
    "prefix": "twcard",
    "body": [
      "<div className=\"panel\">",
      "  ${1:Content}",
      "</div>"
    ]
  },
  "Tailwind Alert": {
    "prefix": "twalert",
    "body": [
      "<div className=\"bg-${1|success,error,warning|}/10 border border-${1}/30 rounded-lg p-4\">",
      "  <p className=\"text-sm font-semibold text-${1}\">${2:Message}</p>",
      "</div>"
    ]
  }
}
```

---

## Resources

- **Color Palette**: `COLOR_PALETTE_GUIDE.md`
- **Theme Variables**: `THEME_REFERENCE.md`
- **Migration Guide**: `DESIGN_BEFORE_AFTER.md`
- **Tailwind Docs**: https://tailwindcss.com/docs
- **Outfit Font**: https://fonts.google.com/specimen/Outfit

---

## Quick Reference Card

```
PRIMARY COLORS
#0f172a - bg-primary         #1e293b - bg-secondary
#334155 - bg-surface         #6366f1 - text-accent

TEXT COLORS
#f8fafc - text-textPrimary   #94a3b8 - text-textSecondary

SEMANTIC
#10b981 - text-success       #f59e0b - text-warning
#ef4444 - text-error         #334155 - border-border

COMPONENTS
.btn-primary    .btn-secondary    .panel    .glass
```

---

**Version**: 2.0  
**Last Updated**: 2026-01-27  
**Status**: Production Ready ✅
