const express = require('express');
const app = express();
require('dotenv').config()
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.j9zzvlf.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const productCollection = client.db("technocyDb").collection("products");
        const categoryCollection = client.db("technocyDb").collection("category");
        const userCollection = client.db("technocyDb").collection("users");
        const reviewsCollection = client.db("technocyDb").collection("reviews");
        const cartCollection = client.db("technocyDb").collection("carts");



        //middleware token Verify
        const tokenVerify = (req, res, next) => {
            console.log('token Verify', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized-Access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorized-Access' });
                }
                req.decoded = decoded;
                next();
            })
        }

        //middleware admin Verify
        const adminVerify = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden-Access' });
            }
            next();
        }

        //jwt related api
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token })
        })

        //category related api
        app.get('/category', async (req, res) => {
            const result = await categoryCollection.find().toArray();
            res.send(result)
        })

        //products related api
        app.get('/products', async (req, res) => {
            const limitProduct = Number(req.query.limit);
            const page = req.query.page;
            const query = {}
            const cursor = productCollection.find(query);
            const productCount = await productCollection.countDocuments();
            const pageCount = Math.ceil(productCount / limitProduct)
            const result = await cursor.skip(page * limitProduct).limit(limitProduct).toArray();
            res.send({ result, pageCount })
        })

        app.post('/products', async (req, res) => {
            const product = req.body;
            const result = await productCollection.insertOne(product);
            res.send(result);
        })

        app.get('/products/:id', tokenVerify, adminVerify, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productCollection.findOne(query);
            res.send(result);
        })
        app.patch('/products/:id', tokenVerify, adminVerify, async(req, res) => {
            const product = req.body;
            const id = req.params.id;
            const filter = {_id: new ObjectId(id)};
            const updateProduct ={
                $set : {
                    name: product.name,
                    price: product.price,
                    details: product.details,
                    image: product.image,
                    category: product.category,
                }
            }
            const result = await productCollection.updateOne(filter, updateProduct);
            res.send(result);
        })

        app.delete('/products/:id', tokenVerify, adminVerify, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await productCollection.deleteOne(query);
            res.send(result);
        })


        app.get('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await productCollection.findOne(query);
            res.send(result);
        })
        app.get('/products/category/:category', async (req, res) => {
            const categoryProduct = req.params.category;
            const query = { category: categoryProduct };
            const result = await productCollection.find(query).toArray();
            console.log(result);
            res.send(result);
        })

        //reviews related api
        app.get('/reviews', async (req, res) => {
            const result = await reviewsCollection.find().toArray();
            res.send(result)
        })



        //users collection
        app.get('/users', tokenVerify, adminVerify, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        })

        app.get('/users/admin/:email', tokenVerify, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Forbidden-Access' });
            };

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existUser = await userCollection.findOne(query);
            if (existUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        app.delete('/users/:id', tokenVerify, adminVerify, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        app.patch('/users/admin/:id', tokenVerify, adminVerify, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
        })


        //carts/menu collection
        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem);
            res.send(result)
        })
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result)
        })
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('technocy resources server is running')
})

app.listen(port, () => {
    console.log(`technocy resources server on port ${port}`);
})