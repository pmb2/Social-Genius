import { NextApiRequest, NextApiResponse } from 'next';
import { pool } from '@/services/postgres-service';
import bcrypt from 'bcrypt';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const { username, password, x_id, x_username } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const { rows } = await pool.query(
            'INSERT INTO users (username, password, x_account_id) VALUES ($1, $2, $3) RETURNING id',
            [username, hashedPassword, x_id]
        );

        const userId = rows[0].id;

        // Log in the user
        // (Implementation of session management is out of scope for this example)

        res.status(200).json({ message: 'User created' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create user' });
    }
}
