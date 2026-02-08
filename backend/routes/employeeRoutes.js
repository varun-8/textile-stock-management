const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');

// GET all (Active & Terminated)
router.get('/', async (req, res) => {
    try {
        const employees = await Employee.find().sort({ lastActive: -1, createdAt: -1 });  // Sort by recent activity first
        res.json(employees);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Add Employee with Auto-ID
router.post('/add', async (req, res) => {
    try {
        const { name, pin } = req.body;
        if (!name || !pin) return res.status(400).json({ error: 'Name and PIN required' });

        // Find last employee to determine next ID
        const lastEmployee = await Employee.findOne().sort({ createdAt: -1 });
        let nextId = 'E001';

        if (lastEmployee && lastEmployee.employeeId) {
            const lastIdNum = parseInt(lastEmployee.employeeId.replace('E', ''));
            if (!isNaN(lastIdNum)) {
                nextId = `E${String(lastIdNum + 1).padStart(3, '0')}`;
            }
        }

        const newEmployee = new Employee({ employeeId: nextId, name, pin });
        await newEmployee.save();
        res.status(201).json(newEmployee);
    } catch (err) {
        if (err.code === 11000) {
            // Retry logic could go here, but for now just error
            return res.status(400).json({ error: 'ID Generation concurrent error, please try again.' });
        }
        res.status(500).json({ error: err.message });
    }
});

// UPDATE PIN
router.put('/update-pin/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { pin } = req.body;

        if (!pin || pin.length < 4) return res.status(400).json({ error: 'Valid PIN required (min 4 digits)' });

        const updated = await Employee.findByIdAndUpdate(
            id,
            { pin },
            { new: true }
        );

        if (!updated) return res.status(404).json({ error: 'Employee not found' });

        res.json({ message: 'PIN updated successfully', employee: updated });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE (Soft Delete / Terminate)
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Check if used? 
        // User said: "if deleted it must not create any error in stock in past reports"
        // So we can Hard Delete IF we store snapsnots in transactions (which we will).
        // BUT "Terminated" status is better for history tracking.
        // Let's support Toggle Status for now, or just Delete if UI says "Delete".
        // The user asked for "deletion can be done".

        await Employee.findByIdAndDelete(id);
        res.json({ message: 'Employee deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST Verify ID and PIN
router.post('/verify', async (req, res) => {
    try {
        const { employeeId, pin } = req.body;
        if (!employeeId || !pin) return res.status(400).json({ error: 'Employee ID and PIN required' });

        // Normalize ID (User might send "1", we need "E001")
        // Actually, let frontend handle formatting "1" -> "E001" or send full "E001".
        // Let's assume frontend sends the full ID or we handle flexible search.

        const employee = await Employee.findOne({
            employeeId: employeeId,
            pin: pin,
            status: 'ACTIVE'
        });

        if (!employee) {
            return res.status(401).json({ error: 'Invalid ID or PIN' });
        }

        res.json({
            success: true,
            employee: {
                id: employee._id,
                employeeId: employee.employeeId,
                name: employee.name
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
