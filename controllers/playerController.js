import { db } from '../models/db.js';

export const createPlayer = async (req, res) => {
  const { username, password, email, avatar } = req.body;

  if (!username || !password || !email) {
    return res.status(400).json({ error: 'Campos obrigatórios: username, password e email' });
  }
  
  try {
    const [result] = await db.query(
      'INSERT INTO players (username, password, email, avatar) VALUES (?, ?, ?, ?)',
      [username, password, email, avatar || null]
    );
  
    res.status(201).json({
      id: result.insertId,
      username,
      email,
      avatar: avatar || null,
      xp: 0,
      wins: 0,
      losses: 0,
      coins: 500,
      level: 1
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar jogador' });
  }
  
};

export const getPlayer = async (req, res) => {
  const { id } = req.params;

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
};
