import express from 'express';
import applicationsRouter from './routes/applications';
import cors from 'cors';

const app = express();
const PORT = 8000;

if (!process.env.FRONTEND_URL) {
    throw new Error('Missing frontend URL');
}

app.use(cors({
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the Application Tracking API!');
});

// Register routes
app.use('/applications', applicationsRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});
