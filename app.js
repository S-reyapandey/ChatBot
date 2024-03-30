const express = require('express');
const port = process.env.PORT || 4025;
require('./src/index');

const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
    console.log(req.body);
    res.send("Hello post");
});

app.get('/', async (req, res) => {
    console.log(req.body);
    res.send("Hello get");
});

app.listen(port, async () => {
    console.log(`Connection is successful at ${port}`);
    
});