const fs = require('fs');
const path = require('path');

const filePath = path.join('g:', 'textile-stock-management', 'desktop', 'src', 'pages', 'DeliveryChallans.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace state
content = content.replace(
    /const \[outBatches, setOutBatches\] = useState\(\[\]\);\s*const \[selectedBatch, setSelectedBatch\] = useState\(null\);\s*const \[batchLoading, setBatchLoading\] = useState\(false\);\s*\/\/\s*Roll selection state \(new feature\)\s*const \[availableRolls, setAvailableRolls\] = useState\(\[\]\);\s*const \[selectedRolls, setSelectedRolls\] = useState\(\[\]\);\s*const \[loadingRolls, setLoadingRolls\] = useState\(false\);\s*const \[showRollSelection, setShowRollSelection\] = useState\(false\);/,
    `// Roll selection state
    const [availableRollsPool, setAvailableRollsPool] = useState([]);
    const [selectedDensity, setSelectedDensity] = useState('');
    const [availableRolls, setAvailableRolls] = useState([]);
    const [selectedRolls, setSelectedRolls] = useState([]);
    const [loadingRolls, setLoadingRolls] = useState(false);`
);

// 2. Replace handleBatchSelect and closeBatchAndRollSelection
content = content.replace(
    /\/\/ Load rolls from selected batch[\s\S]*?const closeBatchAndRollSelection = \(\) => {[\s\S]*?};/,
    `// Handle Density Selection
    const handleDensitySelect = (density) => {
        setSelectedDensity(density);
        const rollsForDensity = availableRollsPool.filter(r => {
            const parts = r.barcode.split('-');
            return parts.length > 1 && parts[1] === density;
        });
        setAvailableRolls(rollsForDensity);
        setSelectedRolls(rollsForDensity.map(r => r.barcode)); // Auto-select all
    };

    // Toggle roll selection
    const toggleRollSelection = (barcode) => {
        setSelectedRolls((prev) => {
            if (prev.includes(barcode)) {
                return prev.filter((item) => item !== barcode);
            }
            return [...prev, barcode];
        });
    };`
);

// 3. handleOpenCreateModal
content = content.replace(
    /setSelectedBatch\(null\);\s*setAvailableRolls\(\[\]\);\s*setSelectedRolls\(\[\]\);\s*setShowRollSelection\(false\);\s*setModalError\(''\);\s*setIsEditing\(false\);\s*setEditingDcId\(null\);\s*setIsCreateModalOpen\(true\);\s*await Promise\.all\(\[fetchOutBatches\(\), fetchDcTemplateConfig\(\), fetchDcTemplates\(\)\]\);/,
    `setSelectedDensity('');
        setAvailableRollsPool([]);
        setAvailableRolls([]);
        setSelectedRolls([]);
        setModalError('');
        setIsEditing(false);
        setEditingDcId(null);
        setIsCreateModalOpen(true);
        await Promise.all([fetchAllAvailableRolls(), fetchDcTemplateConfig(), fetchDcTemplates()]);`
);

// 4. handleOpenEditModal
content = content.replace(
    /setSelectedBatch\(\{[\s\S]*?\}\);\s*setModalError\(''\);\s*setIsCreateModalOpen\(true\);\s*setShowRollSelection\(true\);\s*await Promise\.all\(\[fetchDcTemplateConfig\(\), fetchDcTemplates\(\)\]\);\s*\/\/ Fetch unassigned rolls from this batch\s*try \{[\s\S]*?catch \(error\) \{[\s\S]*?\}\s*\}\s*;/m,
    `const density = dc.density || (dc.rolls && dc.rolls.length > 0 ? dc.rolls[0].barcode.split('-')[1] : '');
        setSelectedDensity(density);
        setModalError('');
        setIsCreateModalOpen(true);
        
        await Promise.all([fetchDcTemplateConfig(), fetchDcTemplates()]);
        
        try {
            const res = await withExponentialBackoff(() =>
                axios.get(\`\${apiUrl}/api/dc/available-rolls?density=\${density}\`, authHeaders)
            );
            const unassignedRolls = res.data || [];
            const dcRolls = dc.rolls || [];
            
            setAvailableRolls([...dcRolls, ...unassignedRolls]);
            setSelectedRolls(dcRolls.map(r => r.barcode));
        } catch (error) {
            console.error('Failed to fetch available rolls for editing:', error);
            showNotification('Failed to fetch rolls for editing', 'error');
        };`
);

// 5. handleSubmitDC
content = content.replace(
    /dcData\.batchId = selectedBatch\._id;/g,
    `dcData.density = selectedDensity;`
);

// 6. fetchOutBatches -> fetchAllAvailableRolls
content = content.replace(
    /const fetchOutBatches = async \(\) => \{[\s\S]*?axios\.get\(`\$\{apiUrl\}\/api\/sessions\/batch\/active-out\/list`, authHeaders\)[\s\S]*?setOutBatches\(res\.data \|\| \[\]\);\s*setSelectedBatch\(null\);[\s\S]*?setBatchLoading\(false\);\s*\}\s*\};/m,
    `const fetchAllAvailableRolls = async () => {
        try {
            setLoadingRolls(true);
            const res = await withExponentialBackoff(() =>
                axios.get(\`\${apiUrl}/api/dc/available-rolls\`, authHeaders)
            );
            setAvailableRollsPool(res.data || []);
            setSelectedDensity('');
            setPercentage('0');
        } catch (error) {
            console.error('Failed to fetch available rolls:', error);
            const message = getApiErrorMessage(error, 'Failed to load available rolls');
            setModalError(message);
            showNotification(message, 'error');
        } finally {
            setLoadingRolls(false);
        }
    };`
);

// 7. Render UI Left Side
content = content.replace(
    /<h3 style=\{\{ margin: '0 0 1rem', fontSize: '1rem' \}\}>\s*\{showRollSelection \? 'Selected Rolls Summary' : 'Selected Batch'\}\s*<\/h3>\s*\{selectedBatch \? \([\s\S]*?\) : \(\s*<span style=\{\{ color: 'var\(--text-secondary\)' \}\}>Select a batch from the right side<\/span>\s*\)\}/m,
    `<h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>
        Selected Rolls Summary
    </h3>
    {selectedDensity ? (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Pick Density:</span>
                <span style={{ fontWeight: 'bold' }}>{selectedDensity} PPI</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Selected Rolls:</span>
                <span style={{ fontWeight: 'bold' }}>{selectedRolls.length}/{availableRolls.length}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Selected Metre:</span>
                <span style={{ fontWeight: 'bold' }}>
                    {(() => {
                        const selectedMetre = availableRolls
                            .filter(roll => selectedRolls.includes(roll.barcode))
                            .reduce((sum, roll) => sum + (parseFloat(roll.metre) || 0), 0);
                        return selectedMetre.toFixed(2);
                    })()}m
                </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-color)', fontWeight: 'bold' }}>
                <span>With {percentage}% Adjustment:</span>
                <span>
                    {(() => {
                        const selectedMetre = availableRolls
                            .filter(roll => selectedRolls.includes(roll.barcode))
                            .reduce((sum, roll) => sum + (parseFloat(roll.metre) || 0), 0);
                        return (selectedMetre * (1 + parseFloat(percentage || 0) / 100)).toFixed(2);
                    })()}m
                </span>
            </div>
        </>
    ) : (
        <span style={{ color: 'var(--text-secondary)' }}>Select a pick density from the right side</span>
    )}`
);

// 8. Render UI Right Side
content = content.replace(
    /\{\/\* Right Side: Batch Selection or Roll Selection \*\/\}\s*<div style=\{\{ flex: 1, padding: '1\.5rem', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var\(--bg-primary\)' \}\}>[\s\S]*?\{\/\* End Right Side \*\/\}/m,
    `{/* Right Side: Density & Roll Selection */}
    <div style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>AVAILABLE ROLLS ({selectedRolls.length}/{availableRolls.length})</h3>
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
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            {!selectedDensity ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Please select a Pick Density from the dropdown above.</div>
            ) : loadingRolls ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading rolls...</div>
            ) : availableRolls.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No available rolls found for this density.</div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', padding: '1rem' }}>
                    {availableRolls.map((roll) => {
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
    {/* End Right Side */}`
);

fs.writeFileSync(filePath, content);
console.log('Done rewriting DeliveryChallans.jsx');
