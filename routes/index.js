const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const adminController = require('../controllers/adminController');

router.get('/', clientController.getHomePage);
router.get('/truyen/:id', clientController.getTruyenDetail);
router.get('/payment', clientController.getPayment);

// --- THÊM ROUTE NÀY ---
router.post('/create-payment-link', clientController.createPaymentLink);
// ----------------------

router.get('/login', adminController.getLogin);
router.post('/login', adminController.postLogin);
router.get('/logout', adminController.logout);

module.exports = router;