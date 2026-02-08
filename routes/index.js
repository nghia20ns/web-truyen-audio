const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

router.get('/', clientController.getHomePage);
router.get('/truyen/:id', clientController.getTruyenDetail);
router.get('/payment', clientController.getPayment);

module.exports = router;