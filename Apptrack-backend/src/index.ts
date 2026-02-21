import express from 'express';

const app = express();
const PORT = 8000;
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the Application Tracking API!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
});
