import React, { useState, useEffect, useCallback, memo } from 'react';
import { useConfig } from '../context/ConfigContext';
import { IconSettings } from '../components/Icons';

// Memoized Table Component
const SizeTable = memo(({ sizes, onDelete }) => {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                        <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Size Code</th>
                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Barcodes Generated</th>
                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>In Stock</th>
                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Dispatched (Out)</th>
                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sizes.map(size => {
                        const stats = size.stats || { generated: 0, inStock: 0, outStock: 0 };
                        const canDelete = stats.generated === 0 && stats.inStock === 0 && stats.outStock === 0;

                        return (
                            <tr key={size._id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{size.code}</td>
                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                    <span style={{
                                        background: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem'
                                    }}>
                                        {stats.generated}
                                    </span>
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--success-color)' }}>
                                    {stats.inStock > 0 ? (
                                        <span style={{ fontWeight: 'bold' }}>{stats.inStock}</span>
                                    ) : '-'}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    {stats.outStock > 0 ? stats.outStock : '-'}
                                </td>
                                <td style={{ padding: '1rem', textAlign: 'right' }}>
                                    <button
                                        onClick={() => onDelete(size._id)}
                                        disabled={!canDelete}
                                        style={{
                                            background: canDelete ? 'var(--error-bg)' : 'transparent',
                                            border: 'none',
                                            cursor: canDelete ? 'pointer' : 'not-allowed',
                                            color: canDelete ? 'var(--error-color)' : 'var(--text-muted)',
                                            opacity: canDelete ? 1 : 0.3,
                                            padding: '6px 12px',
                                            borderRadius: '6px',
                                            fontWeight: 'bold',
                                            fontSize: '0.8rem'
                                        }}
                                        title={canDelete ? "Remove Size" : "Cannot delete: Size is in use"}
                                    >
                                        {canDelete ? 'DELETE' : 'IN USE'}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                    {sizes.length === 0 && (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                No sizes configured. Add a size code to get started.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
});

const Configuration = () => {
    const { apiUrl } = useConfig();
    const [sizes, setSizes] = useState([]);
    const [newSize, setNewSize] = useState('');
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    const fetchSizes = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/sizes`);
            const data = await res.json();
            setSizes(data);
        } catch (err) {
            console.error(err);
            console.log('Fetch URL:', `${apiUrl}/api/sizes`);
            setError(`Failed to load sizes from ${apiUrl}. Backend might be down or URL incorrect.`);
        } finally {
            setLoading(false);
        }
    }, [apiUrl]);

    useEffect(() => {
        fetchSizes();
    }, [fetchSizes]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newSize.trim()) return;

        setAdding(true);
        setError('');
        try {
            const res = await fetch(`${apiUrl}/api/sizes/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: newSize.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                setNewSize('');
                fetchSizes();
            } else {
                setError(data.error || 'Failed to add size');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = useCallback(async (id) => {
        if (!window.confirm('Are you sure you want to delete this size?')) return;

        try {
            await fetch(`${apiUrl}/api/sizes/${id}`, { method: 'DELETE' });
            fetchSizes();
        } catch (err) {
            alert('Failed to delete size');
        }
    }, [apiUrl, fetchSizes]);

    return (
        <div style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
            <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <IconSettings />
                    </div>
                    <div>
                        <div style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>ADMINISTRATION</div>
                        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>System Configuration</h1>
                    </div>
                </div>

                <div className="panel" style={{ padding: '2.5rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>Article Size Codes</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                        Manage the available size codes for barcode generation and reporting. Deleting a size will not affect historical data but will remove it from new selections.
                    </p>

                    {/* Add New Size */}
                    <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Size Code</label>
                            <input
                                type="text"
                                value={newSize}
                                onChange={e => setNewSize(e.target.value)}
                                placeholder="e.g. 40"
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={adding || !newSize.trim()}
                            className="btn btn-primary"
                            style={{ padding: '0.8rem 1.5rem', height: '42px', display: 'flex', alignItems: 'center' }}
                        >
                            {adding ? 'Adding...' : 'Add Size'}
                        </button>
                    </form>

                    {error && <div style={{ color: 'var(--error-color)', background: 'var(--error-bg)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</div>}

                    {/* Size List Table */}
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Loading current configuration...</div>
                    ) : (
                        <SizeTable sizes={sizes} onDelete={handleDelete} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Configuration;
