const express = require('express');
const { authJwt } = require('../middleware');
const adminController = require('../controllers/adminController');

const router = express.Router();

// Alle Routen erfordern Admin-Berechtigung
router.use(authJwt.verifyToken);
router.use(authJwt.isAdmin);

// Benutzerverwaltung
router.get('/users', adminController.getAllUsers);
router.post('/users', adminController.createUser);
router.delete('/users/:id', adminController.deleteUser);
router.put('/users/:id/role', adminController.updateUserRole);

module.exports = router;
