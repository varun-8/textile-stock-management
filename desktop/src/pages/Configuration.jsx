import React, { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { IconSettings } from '../components/Icons';

const Configuration = () => {
    const { apiUrl } = useConfig();
    const [sizes, setSizes] = useState([]);
    const [newSize, setNewSize] = useState('');
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchSizes();
    }, []);

    const fetchSizes = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/sizes`);
            const data = await res.json();
            setSizes(data);
        } catch (err) {
            console.error(err);
            setError('Failed to load sizes');
        } finally {
            setLoading(false);
        }
    };

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

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this size?')) return;

        try {
            await fetch(`${apiUrl}/api/sizes/${id}`, { method: 'DELETE' });
            fetchSizes();
        } catch (err) {
            alert('Failed to delete size');
        }
    };

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

                    {/* Size List */}
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Loading current configuration...</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem' }}>
                            {sizes.map(size => (
                                <div key={size._id} style={{
                                    background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: '10px',
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>{size.code}</span>
                                    <button
                                        onClick={() => handleDelete(size._id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', opacity: 0.6, fontSize: '1.2rem' }}
                                        title="Remove Size"
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                            {sizes.length === 0 && (
                                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', background: 'rgba(0,0,0,0.02)', borderRadius: '12px', color: 'var(--text-secondary)' }}>
                                    No sizes configured. Add a size code to get started.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Configuration;
