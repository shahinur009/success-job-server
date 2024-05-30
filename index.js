const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5002;


// middleware
app.use(
    cors({
        origin: [
            "http://localhost:5173",
            "https://success-jobs-7e686.web.app",
            "https://success-jobs-7e686.firebaseapp.com",
        ],
        credentials: true,
        optionsSuccessStatus: 200,
    })
);
app.use(express.json())
app.use(cookieParser())
app.use(bodyParser.json());

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",

};
const verifyToken = (req, res, next) => {
    const token = req.cookies?.token;

    console.log(token)
    console.log("==================")
    if (!token) return res.status(401).send({ message: 'unauthorized access' })
    if (token) {
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
            console.log(err)
            if (err) {
                return res.status(401).send({ message: 'unauthorized access' })
            }
            console.log(decoded)
            req.user = decoded
        })
    }
    next()
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
        const userCollections = client.db('successJobs').collection('users')
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
        //user related api
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user?.email }
            const existingUser = await userCollections.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist', insertedId: null })
            }
            const result = await userCollections.insertOne(user)
            res.send(result);
        })

        app.get('/jobs', async (req, res) => {
            const { search } = req.body;
            const query = search
                ? { job_title: { $regex: search, $options: 'abc' } }
                : {};
            const result = await jobsCollections.find(query).toArray()
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
            console.log(applyData)
            const query = {
                email: applyData.email,
                jobId: applyData.jobId
            }
            const alreadyApplied = await applyCollections.findOne(query)
            console.log(alreadyApplied)
            if (alreadyApplied) {
                return res.status(400).send('You already applied this job')
            }

            const result = await applyCollections.insertOne(applyData)

            // update applied job count
            const updateDoc = {
                $inc: { applicants_number: 1 },
            }
            const jobQuery = { _id: new ObjectId(applyData.jobId) }

            const updateAppliedCount = await jobsCollections.updateOne(jobQuery, updateDoc)
            console.log(updateAppliedCount)
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
        app.put('/job/:id/:email', verifyToken, async (req, res) => {
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
            if (req.query.filter && req.query.filter != 'undefined') {
                query['category'] = req.query.filter
            }
            let result = await applyCollections.find(query).toArray()
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

        // get all jobs data from database for pagination 
        app.get('/all-jobs', async (req, res) => {
            const size = parseInt(req.query.size);
            const page = parseInt(req.query.page) - 1;
            // console.log(size, page)
            let query = {};
            if (req.query.search) {
                query = { job_title: { $regex: new RegExp(req.query.search, 'i') } };
            }
            console.log(query)
            const result = await jobsCollections.find(query).skip(size * page).limit(size).toArray()
            res.send(result)
        })

        // filter here
        app.get('/applied-jobs', async (req, res) => {
            const filter = req.query.filter;
            let query = {}
            if (filter) query = { category: filter }
            // console.log(size, page)
            const result = await jobsCollections.find(query).toArray()
            res.send(result)
        })
        // get all jobs data from database for counting pagination 
        app.get('/jobs-count', async (req, res) => {
            const count = await jobsCollections.countDocuments()
            res.send({ count })
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch();


app.get('/', (req, res) => {
    res.send('success jobs running on server')
})
app.listen(port, () => {
    console.log(`Success jobs server is running on port ${port}`)
})