const Inquiry = require('../models/Inquiry');
const t = require('../utils/i18n');

// POST /admin/inquiries (Public)
exports.createInquiry = async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;
        const lang = req.lang || 'en';
        
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ success: false, message: t('fields_required', lang) });
        }

        const inquiry = await Inquiry.create({
            name,
            email,
            phone,
            subject,
            message
        });

        res.status(201).json({
            success: true,
            message: t('inquiry_success', lang),
            data: inquiry
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// GET /admin/inquiries (Admin only)
exports.getAllInquiries = async (req, res) => {
    try {
        const inquiries = await Inquiry.find().sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: inquiries });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// PATCH /admin/inquiries/:id/status (Admin only)
exports.updateInquiryStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const inquiry = await Inquiry.findByIdAndUpdate(req.params.id, { status }, { new: true });
        if (!inquiry) return res.status(404).json({ success: false, message: "Inquiry not found" });
        res.status(200).json({ success: true, message: "Status updated", data: inquiry });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
