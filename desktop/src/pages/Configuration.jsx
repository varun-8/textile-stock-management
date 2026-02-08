import React, { useState, useEffect, useCallback, memo } from 'react';
import { useConfig } from '../context/ConfigContext';
import { IconSettings, IconTrash, IconCloud } from '../components/Icons';

// Styled Components / Variables
const thStyle = {
    padding: '1rem 1.5rem', textAlign: 'left', fontWeight: '800', fontSize: '0.75rem',
    color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase'
};
const tdStyle = {
    padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', verticalAlign: 'middle'
};

const SizeTable = memo(({ sizes, onDelete }) => {
    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                    <tr>
                        <th style={thStyle}>SIZE CODE</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>TOTAL BARCODES</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>IN STOCK</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>DISPATCHED</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
                    {sizes.length === 0 ? (
                        <tr>
                            <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>📏</div>
                                No size codes configured. Add a size on the right to get started.
                            </td>
                        </tr>
                    ) : sizes.map((size, i) => {
                        const stats = size.stats || { generated: 0, inStock: 0, outStock: 0 };
                        const canDelete = stats.generated === 0 && stats.inStock === 0 && stats.outStock === 0;

                        return (
                            <tr key={size._id} style={{
                                borderBottom: '1px solid var(--border-color)',
                                background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                transition: 'all 0.2s'
                            }}>
                                <td style={{ ...tdStyle, fontWeight: '700', fontSize: '1rem', fontFamily: 'monospace', color: 'var(--text-primary)' }}>
                                    {size.code}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    <span style={{
                                        background: 'var(--bg-tertiary)', padding: '4px 12px', borderRadius: '12px',
                                        fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)'
                                    }}>
                                        {stats.generated}
                                    </span>
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {stats.inStock > 0 ? (
                                        <span style={{
                                            color: 'var(--success-color)', background: 'var(--success-bg)',
                                            padding: '4px 12px', borderRadius: '12px', fontWeight: '700', fontSize: '0.85rem'
                                        }}>
                                            {stats.inStock}
                                        </span>
                                    ) : <span style={{ opacity: 0.3 }}>-</span>}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'center' }}>
                                    {stats.outStock > 0 ? (
                                        <span style={{
                                            color: 'var(--accent-color)', background: 'var(--accent-bg)',
                                            padding: '4px 12px', borderRadius: '12px', fontWeight: '700', fontSize: '0.85rem'
                                        }}>
                                            {stats.outStock}
                                        </span>
                                    ) : <span style={{ opacity: 0.3 }}>-</span>}
                                </td>
                                <td style={{ ...tdStyle, textAlign: 'right' }}>
                                    {canDelete ? (
                                        <button
                                            onClick={() => onDelete(size._id)}
                                            style={{
                                                background: 'transparent', border: 'none', cursor: 'pointer',
                                                color: 'var(--text-secondary)', padding: '8px', borderRadius: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                            className="hover-danger"
                                            title="Delete Size"
                                        >
                                            <IconTrash />
                                        </button>
                                    ) : (
                                        <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-secondary)', opacity: 0.5, cursor: 'not-allowed' }} title="Cannot delete: Size is in use">
                                            LOCKED
                                        </span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            <style>{`
                .hover-danger:hover { background: var(--error-bg) !important; color: var(--error-color) !important; }
            `}</style>
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
            setError(`Failed to load sizes.`);
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
        <div style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }} className="animate-fade-in">

            {/* Header */}
            <header style={{
                padding: '1.5rem 2.5rem',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <IconSettings />
                    </div>
                    <div>
                        <div style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>ADMINISTRATION</div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                            System Configuration
                        </h1>
                    </div>
                </div>
            </header>

            <div style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '2rem', height: '100%' }}>

                    {/* Left Panel: Size Table */}
                    <div className="panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{
                            padding: '1.5rem', borderBottom: '1px solid var(--border-color)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Defined Article Sizes</h3>
                                <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Configure dimensions used for barcode generation and sorting.
                                </p>
                            </div>
                            <div style={{
                                padding: '6px 12px', borderRadius: '20px', background: 'var(--bg-tertiary)',
                                fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-primary)'
                            }}>
                                {sizes.length} Sizes Active
                            </div>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {loading ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading configuration...</div>
                            ) : (
                                <SizeTable sizes={sizes} onDelete={handleDelete} />
                            )}
                        </div>
                    </div>

                    {/* Right Panel: Add Form */}
                    <div className="panel" style={{ height: 'fit-content', position: 'sticky', top: 0, background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Add New Dimension</h3>
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Define a new size code for inventory items.
                            </p>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Size Code
                                    </label>
                                    <input
                                        type="text"
                                        value={newSize}
                                        onChange={e => setNewSize(e.target.value)}
                                        placeholder="e.g. 90x108"
                                        style={{
                                            width: '100%', padding: '0.9rem', borderRadius: '8px',
                                            border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
                                            color: 'var(--text-primary)', fontSize: '1rem', fontWeight: '600',
                                            fontFamily: 'monospace'
                                        }}
                                    />
                                </div>

                                <div style={{ height: '0.5rem' }}></div>

                                <button
                                    type="submit"
                                    disabled={adding || !newSize.trim()}
                                    className="btn btn-primary"
                                    style={{
                                        width: '100%', justifyContent: 'center', padding: '1rem',
                                        cursor: adding || !newSize.trim() ? 'not-allowed' : 'pointer',
                                        opacity: adding || !newSize.trim() ? 0.7 : 1
                                    }}
                                >
                                    {adding ? 'Adding Configuration...' : 'Add Size Configuration'}
                                </button>
                            </form>

                            {error && (
                                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--error-bg)', color: 'var(--error-color)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: '600' }}>
                                    ⚠️ {error}
                                </div>
                            )}
                        </div>
                        <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-tertiary)' }}>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
                                <strong>Tip:</strong> Size codes are unique identifiers. Once a size has associated stock data, it cannot be deleted to preserve audit integrity.
                            </p>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Configuration;
