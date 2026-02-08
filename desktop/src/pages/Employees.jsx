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

    const thStyle = {
        padding: '1rem 1.5rem', textAlign: 'left', fontWeight: '800', fontSize: '0.75rem',
        color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase'
    };
    const tdStyle = {
        padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', verticalAlign: 'middle'
    };
    const labelStyle = {
        display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: '700',
        color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em'
    };
    const inputStyle = {
        width: '100%', padding: '0.9rem', borderRadius: '8px',
        border: '1px solid var(--border-color)', background: 'var(--bg-primary)',
        color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '500'
    };


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
                        <IconUsers />
                    </div>
                    <div>
                        <div style={{ color: 'var(--accent-color)', fontWeight: '700', fontSize: '0.75rem', letterSpacing: '0.1em', marginBottom: '0.2rem' }}>ADMINISTRATION</div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                            Employee Management
                        </h1>
                    </div>
                </div>
            </header>

            <div style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 350px', gap: '2rem', height: '100%' }}>

                    {/* Left: Employee List */}
                    <div className="panel" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Staff Roster</h3>
                            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>{employees.length} Registered</span>
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary)', zIndex: 10 }}>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                        <th style={thStyle}>ID</th>
                                        <th style={thStyle}>NAME</th>
                                        <th style={thStyle}>ACCESS PIN</th>
                                        <th style={thStyle}>LAST ACTIVE</th>
                                        <th style={thStyle}>LAST DEVICE</th>
                                        <th style={thStyle}>STATUS</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>ACTIONS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center' }}>Loading...</td></tr>
                                    ) : employees.length === 0 ? (
                                        <tr><td colSpan="7" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No employees found.</td></tr>
                                    ) : employees.map((emp, i) => (
                                        <tr key={emp._id} style={{
                                            borderBottom: '1px solid var(--border-color)',
                                            background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)',
                                            opacity: emp.status === 'TERMINATED' ? 0.6 : 1
                                        }}>
                                            <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: '700', color: 'var(--accent-color)' }}>{emp.employeeId || '-'}</td>
                                            <td style={{ ...tdStyle, fontWeight: '600', color: 'var(--text-primary)' }}>{emp.name}</td>
                                            <td style={tdStyle}>
                                                {editingPinId === emp._id ? (
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <input
                                                            autoFocus
                                                            type="text"
                                                            maxLength={6}
                                                            value={editPinValue}
                                                            onChange={e => setEditPinValue(e.target.value.replace(/\D/g, ''))}
                                                            placeholder="PIN"
                                                            style={{ width: '60px', padding: '4px', borderRadius: '4px', border: '1px solid var(--accent-color)', background: 'var(--bg-primary)', color: 'var(--text-primary)', outline: 'none' }}
                                                        />
                                                        <button onClick={() => saveNewPin(emp._id)} style={{ background: 'var(--success-color)', border: 'none', borderRadius: '4px', color: 'white', cursor: 'pointer', padding: '0 6px', fontSize: '0.7rem', fontWeight: 'bold' }}>✓</button>
                                                        <button onClick={() => setEditingPinId(null)} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-primary)', cursor: 'pointer', padding: '0 6px', fontSize: '0.7rem' }}>✕</button>
                                                    </div>
                                                ) : (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                                        <span style={{ fontFamily: 'monospace', fontSize: '1rem', letterSpacing: '2px', minWidth: '40px', color: 'var(--text-primary)' }}>
                                                            {visiblePins[emp._id] ? emp.pin : '••••'}
                                                        </span>
                                                        <div style={{ display: 'flex', gap: '4px', opacity: 0.5 }}>
                                                            <button
                                                                onClick={() => togglePinVisibility(emp._id)}
                                                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 0 }}
                                                            >
                                                                {visiblePins[emp._id] ? <IconEyeOff /> : <IconEye />}
                                                            </button>
                                                            {emp.status === 'ACTIVE' && (
                                                                <button
                                                                    onClick={() => startEditPin(emp)}
                                                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 0 }}
                                                                >
                                                                    <IconEdit />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ ...tdStyle, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {emp.lastActive ? new Date(emp.lastActive).toLocaleString() : <span style={{ opacity: 0.4 }}>Never</span>}
                                            </td>
                                            <td style={tdStyle}>
                                                {emp.lastScanner ? (
                                                    <span style={{
                                                        background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px',
                                                        fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-primary)', border: '1px solid var(--border-color)'
                                                    }}>
                                                        📱 {emp.lastScanner}
                                                    </span>
                                                ) : <span style={{ opacity: 0.4, fontSize: '0.8rem' }}>-</span>}
                                            </td>
                                            <td style={tdStyle}>
                                                <span style={{
                                                    padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: '800',
                                                    background: emp.status === 'ACTIVE' ? 'var(--success-bg)' : 'var(--error-bg)',
                                                    color: emp.status === 'ACTIVE' ? 'var(--success-color)' : 'var(--error-color)',
                                                    letterSpacing: '0.05em'
                                                }}>
                                                    {emp.status}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right' }}>
                                                {emp.status === 'ACTIVE' && (
                                                    <button
                                                        onClick={() => handleDelete(emp._id, emp.name)}
                                                        className="btn-icon-danger"
                                                        title="Terminate Access"
                                                    >
                                                        <IconTrash />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Right: Add Form */}
                    <div className="panel" style={{ height: 'fit-content', position: 'sticky', top: 0, background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
                        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Register New Staff</h3>
                            <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                Create access credentials for floor staff.
                            </p>
                        </div>
                        <div style={{ padding: '1.5rem' }}>
                            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                                <div>
                                    <label style={labelStyle}>Employee Name</label>
                                    <input
                                        type="text"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        placeholder="e.g. Michael Scott"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Access PIN (4-6 Digits)</label>
                                    <input
                                        type="text"
                                        value={newPin}
                                        onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                                        placeholder="e.g. 1985"
                                        maxLength={6}
                                        style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '2px', fontSize: '1.1rem' }}
                                    />
                                </div>

                                <div style={{ height: '1rem' }}></div>

                                <button
                                    type="submit"
                                    disabled={adding || !newName.trim() || !newPin.trim()}
                                    className="btn btn-primary"
                                    style={{ width: '100%', justifyContent: 'center', padding: '1rem', cursor: adding ? 'not-allowed' : 'pointer' }}
                                >
                                    {adding ? 'Creating Profile...' : 'Create Employee Profile'}
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
                                Note: Employees can use their ID and PIN to log in to any authorized scanner device on the floor.
                            </p>
                        </div>
                    </div>

                </div>
            </div>

            <style>{`
                .btn-icon-danger {
                    background: transparent; border: none; cursor: pointer;
                    color: var(--text-secondary); padding: 8px; borderRadius: 8px;
                    transition: all 0.2s;
                }
                .btn-icon-danger:hover {
                    background: var(--error-bg); color: var(--error-color);
                }
            `}</style>
        </div>
    );
};

export default Employees;
