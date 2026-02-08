import React, { useState, useEffect } from 'react';
import { useConfig } from '../context/ConfigContext';
import { IconUsers, IconTrash, IconEye, IconEyeOff, IconEdit } from '../components/Icons';

const Employees = () => {
    const { apiUrl } = useConfig();
    const [employees, setEmployees] = useState([]);
    const [newName, setNewName] = useState('');
    const [newPin, setNewPin] = useState('');
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    // State for PIN visibility and editing
    const [visiblePins, setVisiblePins] = useState({});
    const [editingPinId, setEditingPinId] = useState(null);
    const [editPinValue, setEditPinValue] = useState('');

    useEffect(() => {
        fetchEmployees();
    }, []);

    const fetchEmployees = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${apiUrl}/api/employees`);
            if (res.ok) {
                const data = await res.json();
                setEmployees(data);
            } else {
                setError('Failed to load employees');
            }
        } catch (err) {
            console.error(err);
            setError('Network error');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newName.trim() || !newPin.trim()) return;

        setAdding(true);
        setError('');
        try {
            const res = await fetch(`${apiUrl}/api/employees/add`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim(), pin: newPin.trim() })
            });

            if (res.ok) {
                setNewName('');
                setNewPin('');
                fetchEmployees();
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to add employee');
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Are you sure you want to TERMINATE ${name}? Their access will be revoked but history preserved.`)) return;

        try {
            const res = await fetch(`${apiUrl}/api/employees/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchEmployees();
            } else {
                alert('Failed to terminate');
            }
        } catch (err) {
            alert('Failed to terminate employee');
        }
    };

    const togglePinVisibility = (id) => {
        setVisiblePins(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const startEditPin = (emp) => {
        setEditingPinId(emp._id);
        setEditPinValue('');
    };

    const saveNewPin = async (id) => {
        if (!editPinValue || editPinValue.length < 4) {
            alert('PIN must be at least 4 digits');
            return;
        }

        try {
            const res = await fetch(`${apiUrl}/api/employees/update-pin/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: editPinValue })
            });

            if (res.ok) {
                setEditingPinId(null);
                setEditPinValue('');
                fetchEmployees(); // Refresh to ensure data consistency
                alert('PIN Updated Successfully');
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to update PIN');
            }
        } catch (err) {
            console.error(err);
            alert('Network Error');
        }
    };

    return (
        <div style={{ padding: '2rem', height: '100%', overflowY: 'auto' }}>
            <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>

                {/* Header */}
                <div style={{ marginBottom: '3rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '12px',
                        background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <IconUsers />
                    </div>
                    <div>
                        <div style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>ADMINISTRATION</div>
                        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Employee Management</h1>
                    </div>
                </div>

                <div className="panel" style={{ padding: '2.5rem' }}>
                    <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>Registered Staff</h3>

                    {/* Add New Employee */}
                    <form onSubmit={handleAdd} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end' }}>
                        <div style={{ flex: 2 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</label>
                            <input
                                type="text"
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="John Doe"
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PIN</label>
                            <input
                                type="text"
                                value={newPin}
                                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                                placeholder="1234"
                                maxLength={6}
                                style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={adding || !newName.trim() || !newPin.trim()}
                            className="btn btn-primary"
                            style={{ padding: '0.8rem 1.5rem', height: '42px', display: 'flex', alignItems: 'center' }}
                        >
                            {adding ? 'Adding...' : 'Add Staff'}
                        </button>
                    </form>

                    {error && <div style={{ color: 'var(--error-color)', background: 'var(--error-bg)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</div>}

                    {/* Employee List */}
                    {loading ? (
                        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>Loading staff...</div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>ID</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Name</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>PIN</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Status</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)' }}>Joined</th>
                                        <th style={{ padding: '1rem', color: 'var(--text-secondary)', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employees.map(emp => (
                                        <tr key={emp._id} style={{ borderBottom: '1px solid var(--border-color)', opacity: emp.status === 'TERMINATED' ? 0.6 : 1 }}>
                                            <td style={{ padding: '1rem', fontFamily: 'monospace', fontWeight: 'bold' }}>{emp.employeeId || '-'}</td>
                                            <td style={{ padding: '1rem', fontWeight: 'bold' }}>{emp.name}</td>
                                            <td style={{ padding: '1rem' }}>
                                                {editingPinId === emp._id ? (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            maxLength={6}
                                                            value={editPinValue}
                                                            onChange={e => setEditPinValue(e.target.value.replace(/\D/g, ''))}
                                                            placeholder="New PIN"
                                                            style={{ width: '80px', padding: '4px', borderRadius: '4px', border: '1px solid var(--accent-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                                                        />
                                                        <button onClick={() => saveNewPin(emp._id)} style={{ background: 'var(--success-color)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', padding: '0 4px', fontSize: '0.8rem' }}>Save</button>
                                                        <button onClick={() => setEditingPinId(null)} style={{ background: 'var(--border-color)', border: 'none', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer', padding: '0 4px', fontSize: '0.8rem' }}>X</button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontFamily: 'monospace', minWidth: '40px' }}>
                                                            {visiblePins[emp._id] ? emp.pin : '••••'}
                                                        </span>
                                                        <button
                                                            onClick={() => togglePinVisibility(emp._id)}
                                                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                                                            title={visiblePins[emp._id] ? "Hide PIN" : "Show PIN"}
                                                        >
                                                            {visiblePins[emp._id] ? <IconEyeOff /> : <IconEye />}
                                                        </button>
                                                        {emp.status === 'ACTIVE' && (
                                                            <button
                                                                onClick={() => startEditPin(emp)}
                                                                style={{ background: 'transparent', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', display: 'flex' }}
                                                                title="Change PIN"
                                                            >
                                                                <IconEdit />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{
                                                    background: emp.status === 'ACTIVE' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(239, 83, 80, 0.1)',
                                                    color: emp.status === 'ACTIVE' ? '#4CAF50' : '#EF5350',
                                                    padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem'
                                                }}>
                                                    {emp.status}
                                                </span>
                                            </td>
                                            <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                                                {new Date(emp.createdAt).toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: '1rem', textAlign: 'right' }}>
                                                {emp.status === 'ACTIVE' && (
                                                    <button
                                                        onClick={() => handleDelete(emp._id, emp.name)}
                                                        style={{
                                                            background: 'transparent',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            color: 'var(--error-color)',
                                                            padding: '6px',
                                                            borderRadius: '6px'
                                                        }}
                                                        title="Terminate"
                                                    >
                                                        <IconTrash />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {employees.length === 0 && (
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                                No employees registered.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Employees;
