const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;


// middleware
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            // "https://cardoctor-bd.web.app",
            // "https://cardoctor-bd.firebaseapp.com",
        ],
        credentials: true,
    })
);
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.6ypdnj9.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // collection here
        const jobsCollections = client.db('successJobs').collection('jobs')
        const bidsCollections = client.db('successJobs').collection('bids')

        app.get('/jobs', async (req, res) => {
            const result = await jobsCollections.find().toArray()
            res.send(result)
        })
        // job details data include by id
        app.get('/job/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollections.findOne(query)
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('success jobs running')
})
app.listen(port, () => {
    console.log(`Success jobs server is running on port ${port}`)
})