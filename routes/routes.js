import express from 'express';
import { register, login } from '../controllers/authController.js';
import { me } from '../controllers/playerController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';
import { HERO_DATA } from "../models/heroes.js";

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

router.get('/hero-tactics-game/login', (req, res) => {
  res.sendFile('login.html', { root: './public' });
});

router.get('/hero-tactics-game/', authenticateToken, (req, res) => {
  res.json({ message: `Olá, ${req.user.username}!`, user: req.user });
});

router.get('/validate-token', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

router.get('/me', authenticateToken, me);

router.get('/heroes', (req, res) => {
  res.json(HERO_DATA);
});

export default router;
