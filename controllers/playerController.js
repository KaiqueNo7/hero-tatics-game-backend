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

export const updatePlayerStats = async (req, res) => {
  const { result } = req.body;
  const playerId = req.user.id;

  if (!['win', 'loss'].includes(result)) {
    return res.status(400).json({ error: 'Resultado inválido. Use "win" ou "loss".' });
  }

  const column = result === 'win' ? 'wins' : 'losses';

  try {
    const [rows] = await db.query(
      `UPDATE players SET ${column} = ${column} + 1 WHERE id = ?`,
      [playerId]
    );

    if (rows.affectedRows === 0) {
      return res.status(404).json({ error: 'Jogador não encontrado.' });
    }

    return res.json({ message: `Estatística de ${result} atualizada com sucesso.` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar estatísticas.' });
  }
};