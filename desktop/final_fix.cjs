const fs = require('fs');
const path = require('path');

const filePath = path.join('g:', 'textile-stock-management', 'desktop', 'src', 'pages', 'DeliveryChallans.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Fix missing brace for handleOpenEditModal
content = content.replace(
    /showNotification\('Failed to fetch rolls for editing', 'error'\);\s*\};/g,
    `showNotification('Failed to fetch rolls for editing', 'error');
        }
    };`
);

// Fix disabled property
content = content.replace(
    /disabled=\{\(!selectedBatch && !isEditing\) \|\| !partyName\}/g,
    `disabled={selectedRolls.length === 0 || !partyName}`
);

fs.writeFileSync(filePath, content);
console.log('Final fixes applied successfully.');
