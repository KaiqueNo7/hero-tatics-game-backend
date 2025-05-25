import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../models/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'segredo_forte';

export const register = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'username e password são obrigatórios.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      'INSERT INTO players (username, email, password) VALUES (?, null, ?)',
      [username, hashedPassword]
    );

    res.status(201).json({ message: 'Jogador registrado com sucesso', id: result.insertId });
  }catch (err) {
    console.error('Erro ao registrar jogador:', err.message);
    res.status(500).json({ error: 'Erro ao registrar jogador', details: err.message });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ error: 'username e password são obrigatórios' });

  try {
    const [rows] = await db.query('SELECT * FROM players WHERE username = ?', [username]);

    if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

    const user = rows[0];

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Senha incorreta' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: '2d',
    });

    res.json({ token, user: { id: user.id, username: user.username, avatar: user.avatar } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro no login' });
  }
};
