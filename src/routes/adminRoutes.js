const express = require('express');
const { verifyToken, isAdmin } = require('../middleware/authJwt');
const adminController = require('../controllers/adminController');

const router = express.Router();

// Alle Routen erfordern Admin-Berechtigung
router.use(verifyToken);
router.use(isAdmin);

// Benutzerverwaltung
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/role', adminController.updateUserRole);

module.exports = router;
