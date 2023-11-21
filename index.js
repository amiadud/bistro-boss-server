const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();
const cookieParser = require('cookie-parser')
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

// middlewars
app.use(cors());
app.use(express.json());
app.use(cookieParser())

//verify token with middlewares //step:2
const logger = (req,res, next) => {
  if (!req.headers.authorization){
    return res.status(401).send({message: 'unauthorized access'});
  }
  next();
}

//step:3

const VerifyToken = (req, res, next) => {
  // console.log('inside verify token',req.headers.authorization.split(' ')[1]);
  const token = req.headers.authorization.split(' ')[1];
  // console.log(token);
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded)=> {
    if(err){
      return res.status(401).send({message: 'unauthorized access'});
    }
    req.decoded = decoded
    next();
  })
}


// const uri = `mongodb://localhost:27017/`
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.35itrev.mongodb.net/?retryWrites=true&w=majority`;

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
    const usersCollection = client.db('bistroDB').collection('users');
    const menuCollection = client.db('bistroDB').collection('menu');
    const cartCollection = client.db('bistroDB').collection('carts');
    
    app.get('/', (req, res) => {
        try{
            res.send("Stared my Bistro boss Server")
            
        }catch(err){
            console.log(err.message);
        }
    })

    
    //step:1
    app.post('/jwt', async(req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.SECRET_KEY, {expiresIn: '1h'} )
      res.send({ token })

    })

    // use verify admin after verifytoken

    const verifyAdmin = async(req, res, next) => {
      const email = req.decoded.email
      console.log('Admin Mail', email);
      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin){
        return res.status(403).send({message: 'forbidden access'});
      }
      next();
    }

    
    app.post('/users', async(req, res) =>{
      try{
      const itemUsers = req.body;
      // insert email if user already exists
      // you can do this many ways (1.. email unique, 2. upset 3. simple checking)

      const query = {email: itemUsers.email}
      const existingUser = await usersCollection.findOne(query);
      if(existingUser) {
        return res.send({message: "User already exists", insertedId: null})
      }
      const result = await usersCollection.insertOne(itemUsers);
      res.send(result);
      }catch(err){
        console.log(err.message);
    }  
    })
    
    
  app.get('/users',logger, VerifyToken, verifyAdmin,  async(req, res) => {
      try{
          const result = await usersCollection.find().toArray();
          res.send(result);  
      }catch(err){
          console.log(err.message);
      }
  })

  app.get('/user/admin/:email', VerifyToken,  async(req, res) => {
    const email = req.params.email
    if(email != req.decoded.email){
      return res.status(403).send({message: 'forbidden access'})
    }
    const query = {email: email}
    const user = await usersCollection.findOne(query)
    let admin = false;
    if(user){
      admin = user?.role === 'admin';
    }
    res.send({admin, message: 'true'})
  })

  app.patch('/users/admin/:id', VerifyToken, verifyAdmin, async(req, res) => {
    try{
      const id = req.params.id
    const filter = {_id: new ObjectId(id)}
    const updateDoc = {
      $set: {
        role: 'admin'
      }
    }
    const result = await usersCollection.updateOne(filter, updateDoc);
    res.send(result);
    }catch(err){
      console.log(err.message);
  }
  })

  app.delete('/users/:id', VerifyToken, verifyAdmin, async(req, res) => {
    try{
      const id = req.params.id
    const query = {_id: new ObjectId(id)};
    const result = await usersCollection.deleteOne(query);
    res.send(result);
    }catch(err){
      console.log(err.message);
  }
  })
  
    //menu related api

    app.post('/menu', VerifyToken, verifyAdmin, async(req, res) => {
      const item = req.body
      const result = await menuCollection.insertOne(item);
      res.send(result);
    })

    app.get('/menu', async(req, res) => {
        try{
            const result = await menuCollection.find().toArray();
            res.send(result); 
        }catch(err){
            console.log(err.message);
        }
    })

    app.get('/item/:id', async(req, res) => {
      try{
      const id = req.params.id
      const query = {_id: id}
      const result = await menuCollection.findOne(query);
      res.send(result);
      }catch(err){
        console.log(err.message);
    }
    })

    app.patch('/menu/:id', async(req, res) => {
      try{
        const id = req.params.id;
        const updateItem = req.body
        const filter = { _id: id }
        const updateDoc = {
          $set: {
            name: updateItem.name,
            category: updateItem.category,
            price: updateItem.price,
            recipe: updateItem.recipe,
            image: updateItem.image,
            
          }
        }
        const result = await menuCollection.updateOne(filter, updateDoc )
        res.send(result);

      }catch(err){
          console.log(err.message);
      }
    })



    app.get('/items', async(req, res) => {
      try{
        const query = req.query
        const page = query.page
        const perPage = 10
        const pageNumber = parseInt(page)
        const skip = pageNumber * perPage
        const result = await menuCollection.find().skip(skip).limit(perPage).toArray();
        const postCount = await menuCollection.countDocuments();
        res.json({result, postCount}); 
      }catch(err){
          console.log(err.message);
      }
  })

  app.delete('/items/:id', async(req, res) => {
    try{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    }catch(err){
      console.log(err.message);
    }
  })

    app.get('/menus', async(req, res) => {
        try{
            const query = req.query
            const page = query.page
            const category = query.category
            const categoryQuery = { category }
            const pageNumber = parseInt(page)
            const perPage = 6
            const skip = pageNumber * perPage
            const result = await menuCollection.find(categoryQuery).skip(skip).limit(perPage).toArray();
            const postCount = await menuCollection.countDocuments(categoryQuery);
            res.json({result, postCount});
            
        }catch(err){
            console.log(err.message);
        }
    })
    app.post('/carts', async(req, res) => {
      try{
      const cartItem = req.body
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
      }catch(err){
        console.log(err.message);
    }
    })

    app.get('/carts', async(req, res) => {
      try{
      const email = req.query.email
      const query = {email: email}
      const result = await cartCollection.find(query).toArray();
      res.send(result);
      }catch(err){
        console.log(err.message);
    }
    })

    app.delete('/carts/:id', async(req,res) =>{
      try{
      const id = req.params.id
      const query = {_id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query);
      res.send(result);
      }catch(err){
        console.log(err.message);
    }
    })

    
    
    // payment intent
    app.post('/create-payment-intent', async (req, res) => {
    const { price } = req.body;
    const amount = parseInt(price * 100);
    console.log(amount, 'amount inside the intent')

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      payment_method_types: ['card']
    });

    res.send({
      clientSecret: paymentIntent.client_secret
    })
     });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.listen(port, ()=> {
    console.log(` Server on port ${port}`);
})