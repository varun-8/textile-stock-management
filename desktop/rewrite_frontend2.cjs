const fs = require('fs');
const path = require('path');

const filePath = path.join('g:', 'textile-stock-management', 'desktop', 'src', 'pages', 'DeliveryChallans.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add viewedBatchCode state
content = content.replace(
    /const \[selectedRolls, setSelectedRolls\] = useState\(\[\]\);/,
    `const [selectedRolls, setSelectedRolls] = useState([]);
    const [viewedBatchCode, setViewedBatchCode] = useState(null);`
);

// 2. Clear viewedBatchCode on modal open
content = content.replace(
    /setSelectedDensity\(''\);\s*setAvailableRollsPool\(\[\]\);/,
    `setSelectedDensity('');
        setViewedBatchCode(null);
        setAvailableRollsPool([]);`
);

// 3. handleDensitySelect sets viewedBatchCode to null
content = content.replace(
    /const handleDensitySelect = \(density\) => \{[\s\S]*?setSelectedRolls\(rollsForDensity\.map\(r => r\.barcode\)\); \/\/ Auto-select all\s*\};/,
    `const handleDensitySelect = (density) => {
        setSelectedDensity(density);
        setViewedBatchCode(null);
        const rollsForDensity = availableRollsPool.filter(r => {
            const parts = r.barcode.split('-');
            return parts.length > 1 && parts[1] === density;
        });
        setAvailableRolls(rollsForDensity);
        
        // Let's NOT auto-select all rolls here because that defeats the point of selecting specific batches.
        // If they switch density, clear selected rolls.
        setSelectedRolls([]); 
    };`
);

// 4. Update the Right Side UI
const rightSideUIRegex = /\{\/\* Right Side: Density & Roll Selection \*\/\}([\s\S]*?)\{\/\* End Right Side \*\/\}/;
const rightSideUIReplacement = `{/* Right Side: Density & Roll Selection */}
    <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {viewedBatchCode ? \`ROLLS IN \${viewedBatchCode}\` : 'AVAILABLE ROLLS'} ({selectedRolls.length} Selected)
            </h3>
            {viewedBatchCode ? (
                <button 
                    onClick={() => setViewedBatchCode(null)}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}
                >
                    ← Back to Batches
                </button>
            ) : (
                <select 
                    value={selectedDensity} 
                    onChange={e => handleDensitySelect(e.target.value)}
                    disabled={isEditing}
                    style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: '0.85rem' }}
                >
                    <option value="">Select Pick Density</option>
                    {Array.from(new Set(availableRollsPool.map(r => r.barcode.split('-')[1]).filter(Boolean))).sort().map(density => (
                        <option key={density} value={density}>{density} PPI</option>
                    ))}
                    {isEditing && selectedDensity && !availableRollsPool.some(r => r.barcode.split('-')[1] === selectedDensity) && (
                        <option value={selectedDensity}>{selectedDensity} PPI</option>
                    )}
                </select>
            )}
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            {!selectedDensity ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Please select a Pick Density from the dropdown above.</div>
            ) : loadingRolls ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading rolls...</div>
            ) : availableRolls.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No available rolls found for this density.</div>
            ) : !viewedBatchCode ? (
                // Show Batches List
                <div>
                    {(() => {
                        const batchGroups = {};
                        availableRolls.forEach(roll => {
                            const bcode = roll.batchCode || 'Unknown';
                            if (!batchGroups[bcode]) batchGroups[bcode] = { count: 0, metre: 0, selectedCount: 0 };
                            batchGroups[bcode].count++;
                            batchGroups[bcode].metre += parseFloat(roll.metre) || 0;
                            if (selectedRolls.includes(roll.barcode)) batchGroups[bcode].selectedCount++;
                        });
                        return Object.entries(batchGroups).map(([bcode, stats]) => (
                            <div 
                                key={bcode}
                                onClick={() => setViewedBatchCode(bcode)}
                                style={{
                                    padding: '1rem',
                                    borderBottom: '1px solid var(--border-color)',
                                    cursor: 'pointer',
                                    background: 'transparent',
                                    borderLeft: '3px solid transparent',
                                    transition: 'all 0.2s',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                }}
                            >
                                <div>
                                    <div style={{ fontWeight: '700', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>Batch: {bcode}</div>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Rolls: {stats.count} • Metre: {stats.metre.toFixed(2)}m</div>
                                </div>
                                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: stats.selectedCount > 0 ? 'var(--accent-color)' : 'var(--text-secondary)' }}>
                                    {stats.selectedCount} Selected &rarr;
                                </div>
                            </div>
                        ));
                    })()}
                </div>
            ) : (
                // Show Rolls Grid for the selected batch
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', padding: '1rem' }}>
                    {availableRolls.filter(r => (r.batchCode || 'Unknown') === viewedBatchCode).map((roll) => {
                        const isSelected = selectedRolls.includes(roll.barcode);
                        return (
                            <div 
                                key={roll.barcode}
                                onClick={() => toggleRollSelection(roll.barcode)}
                                style={{
                                    border: \`1px solid \${isSelected ? 'var(--accent-color)' : 'var(--border-color)'}\`,
                                    background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-secondary)',
                                    borderRadius: '8px',
                                    padding: '0.75rem',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.25rem',
                                    position: 'relative'
                                }}
                            >
                                <div style={{ fontWeight: '700', fontSize: '0.9rem', color: isSelected ? 'var(--accent-color)' : 'var(--text-primary)' }}>
                                    {roll.barcode}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {roll.metre}m • {roll.weight}kg
                                </div>
                                {isSelected && (
                                    <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', color: 'var(--accent-color)' }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    </div>
    {/* End Right Side */}`;

content = content.replace(rightSideUIRegex, rightSideUIReplacement);

fs.writeFileSync(filePath, content);
console.log('Done rewriting DeliveryChallans.jsx again');
