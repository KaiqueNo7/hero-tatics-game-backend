import { db } from '../models/db.js';

export const me = async (req, res) => {
  const { id } = req.user;

  try {
    const [rows] = await db.query('SELECT * FROM players WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Jogador não encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar jogador' });
  }
}
