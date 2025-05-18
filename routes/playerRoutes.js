import express from 'express';
import { createPlayer, getPlayer } from '../controllers/playerController.js';

const router = express.Router();

router.post('/players', createPlayer);
router.get('/players/:id', getPlayer);

export default router;
