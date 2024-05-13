const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 7000;


// middleware
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            // "http://localhost:5000",
            // "https://cardoctor-bd.web.app",
            // "https://cardoctor-bd.firebaseapp.com",
        ],
        credentials: true,
        optionsSuccessStatus: 200,
    })
);
app.use(express.json())
app.use(cookieParser())

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",

};
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;
    if (!token) return res.status(401).send({ message: 'unauthorized access' })
    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            if (err) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            req.user = decoded
            next()
        })
    }
}



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
        const applyCollections = client.db('successJobs').collection('apply')

        // jwt token generate:
        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
            res.cookie("token", token, cookieOptions).send({ success: true })
        })
        // clear browser cookies token
        app.get('/logout', (req, res) => {
            res.clearCookie("token", {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                maxAge: 0
            }).send({ success: true })
        })


        app.get('/jobs', async (req, res) => {
            const result = await jobsCollections.find().toArray()
            res.send(result)
        })
        // get all data by a user
        app.get('/jobs/:email', verifyToken, async (req, res) => {
            const tokenEmail = req.user.email;
            const email = req.params.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { 'buyer.email': email };
            const result = await jobsCollections.find(query).toArray()
            res.send(result);
        })


        // job details data include by id
        app.get('/job/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollections.findOne(query)
            res.send(result);
        })
        //save apply data in database
        app.post('/apply', async (req, res) => {
            const applyData = req.body;
            const result = await applyCollections.insertOne(applyData)
            res.send(result);
        })
        //save job data in database
        app.post('/job', async (req, res) => {
            const jobData = req.body;
            const result = await jobsCollections.insertOne(jobData)
            res.send(result);
        })
        // delete data from data base.
        app.delete('/job/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await jobsCollections.deleteOne(query)
            res.send(result)
        })

        // update data:
        app.put('/job/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const tokenEmail = req.user.email;
            const email = req.params.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const jobData = req.body
            const query = { _id: new ObjectId(id) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    ...jobData,
                },
            }
            const result = await jobsCollections.updateOne(query, updateDoc, options)
            res.send(result)
        })
        // all applied jobs by email
        app.get('/applied-jobs/:email', verifyToken, async (req, res) => {
            const tokenEmail = req.user.email;
            const email = req.params.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email };
            const result = await applyCollections.find(query).toArray()
            res.send(result);
        })
        // get all post job request for db by job owner 
        app.get('/applied-request/:email', verifyToken, async (req, res) => {
            const tokenEmail = req.user.email;
            const email = req.params.email;
            if (tokenEmail !== email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { 'buyer.email': email };
            const result = await applyCollections.find(query).toArray()
            res.send(result);
        })
        //jwt function here 

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