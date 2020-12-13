let express = require("express");
let app = express();
let morgan = require("morgan");
app.use(morgan("combined"));
let cors = require("cors");
app.use(cors());
let bodyParser = require("body-parser");
app.use(bodyParser.raw({ type: "*/*" }));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/views/index.html");
});

app.get("/sourcecode", (req, res) => {
  res.send(
    require("fs")
      .readFileSync(__filename)
      .toString()
  );
});

let passwords = new Map();
let usernameToken = new Map();
let tokenUsername = new Map();
let token = 0;
let currentUserToken = "";

app.post("/signup", (req, res) => {
  let parsed = JSON.parse(req.body);
  let username = parsed.username;
  let password = parsed.password;

  if (passwords.has(username)) {
    res.send(JSON.stringify({ success: false, reason: "Username exists" }));
    return;
  }
  if (password === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "password field missing" })
    );
    return;
  }
  if (username === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "username field missing" })
    );
    return;
  }

  passwords.set(username, password);
  res.send(JSON.stringify({ success: true }));
});

app.post("/login", (req, res) => {
  let parsed = JSON.parse(req.body);
  let username = parsed.username;
  let password = parsed.password;
  let expectedPassword = passwords.get(username);

  if (username === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "username field missing" })
    );
    return;
  }

  if (expectedPassword === undefined) {
    res.send(JSON.stringify({ success: false, reason: "User does not exist" }));
    return;
  }
  if (password === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "password field missing" })
    );
    return;
  }

  if (expectedPassword !== password) {
    res.send(JSON.stringify({ success: false, reason: "Invalid password" }));
    return;
  }

  // assign token
  token = "" + Date.now();
  currentUserToken = token;
  usernameToken.set(username, token);
  tokenUsername.set(token, username);
  res.send(JSON.stringify({ success: true, token: token }));
});

app.post("/change-password", (req, res) => {
  let parsed = JSON.parse(req.body);
  let oldPassword = parsed.oldPassword;
  let newPassword = parsed.newPassword;
  let username = parsed.username;
  let givenToken = req.headers.token;
  let expectedUsername = tokenUsername.get(givenToken);
  let expectedToken = tokenUsername.get(username);
  let expectedPassword = passwords.get(expectedUsername);

  if (givenToken === undefined) {
    res.send(JSON.stringify({ success: false, reason: "token field missing" }));
    return;
  }

  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }

  if (oldPassword !== expectedPassword) {
    res.send(
      JSON.stringify({ success: false, reason: "Unable to authenticate" })
    );
    return;
  }

  passwords.delete(expectedUsername);
  passwords.set(expectedUsername, newPassword);

  res.send(JSON.stringify({ success: true }));
});

let listing = new Map();
let listingDetails = new Map();

app.post("/create-listing", (req, res) => {
  let parsed = JSON.parse(req.body);
  let givenToken = req.headers.token;
  let price = parsed.price;
  let description = parsed.description;
  let loggedUser = tokenUsername.get(givenToken);

  if (givenToken === undefined) {
    res.send(JSON.stringify({ success: false, reason: "token field missing" }));
    return;
  }

  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }

  if (price === undefined) {
    res.send(JSON.stringify({ success: false, reason: "price field missing" }));
    return;
  }

  if (description === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "description field missing" })
    );
    return;
  }

  let listingId = createUUID();
  listing.set(listingId, { price: price, description: description });
  listingDetails.set(listingId, {
    price: price,
    description: description,
    itemId: listingId,
    sellerUsername: loggedUser
  });

  res.send(JSON.stringify({ success: true, listingId: listingId }));
});

function createUUID() {
  return "xxxyxx".replace(/[xy]/g, function(c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

app.get("/listing", (req, res) => {
  let givenListingId = req.query.listingId;
  // let listingLookup = listing.get(givenListingId)

  if (listing.has(givenListingId) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid listing id" }));
    return;
  }

 
  res.send(
    JSON.stringify({
      success: true,
      listing: listingDetails.get(givenListingId)
    })
  );
});

app.post("/modify-listing", (req, res) => {
  let parsed = JSON.parse(req.body);
  let givenToken = req.headers.token;
  let listingId = parsed.itemid;
  let newPrice = parsed.price;
  let newDescription = parsed.description;
  let loggedUser = tokenUsername.get(givenToken);
  
   if (listingId === undefined) {
    res.send(JSON.stringify({ success: false, reason: "itemid field missing" }));
    return;
  }

  if (newDescription  === undefined) {
    newDescription = listing.get(listingId).description
  }
  
   if (newPrice  === undefined) {
    newPrice = listing.get(listingId).price
  }
  
  listing.delete(listingId)
    listing.set(listingId, { price: newPrice, description: newDescription });
  
  listingDetails.delete(listingId)
    listingDetails.set(listingId, {
    price: newPrice,
    description: newDescription,
    itemId: listingId,
    sellerUsername: loggedUser
  });
  res.send(JSON.stringify({ success: true }));
});

// let userCart = new Map()
let cart = []
app.post("/add-to-cart", (req, res) => {
  
  let parsed = JSON.parse(req.body);
  let givenToken = req.headers.token;
  let listingId = parsed.itemid;


  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }
  
  if (listingId === undefined) {
    res.send(JSON.stringify({ success: false, reason: "itemid field missing" }));
    return;
  }
  
  if (listing.has(listingId) == false) {
    res.send(JSON.stringify({ success: false, reason: "Item not found" }));
    return;
  }
  
  let description = listingDetails.get(listingId).description
  // let itemId = listingDetails.get(listingId).itemId
  let buyer = tokenUsername.get(givenToken)
  let username = listingDetails.get(listingId).sellerUsername
  let price = listingDetails.get(listingId).price
  
 
  cart.push({buyer: buyer},{price:price, description:description , itemId: listingId  , sellerUsername: username})

  res.send(JSON.stringify({ success: true }));
});


app.get("/cart", (req, res) => {
  let givenToken = req.headers.token;
  let buyerUsername = tokenUsername.get(givenToken)
  let filteredCart = []
  
  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }
 

  
  for (let i = 0; i < cart.length; i++){
    if (cart[i].buyer === buyerUsername){
      filteredCart.push(cart[i+1]);
    }
  }
  
  res.send(JSON.stringify({ success: true, cart: filteredCart}));
});
  
  let soldItems = []
  let filteredCart_checkout = []
  let purchaseList = new Map()
app.post("/checkout", (req, res) => {
  let givenToken = req.headers.token;
  console.log("givenToken", givenToken)
  let buyerUsername = tokenUsername.get(givenToken)
  
  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }
  
  for (let i = 0; i < cart.length; i++){
    if (cart[i].buyer === buyerUsername){
      filteredCart_checkout.push({buyer: buyerUsername, itemId: cart[i+1].itemId});
      soldItems.push(cart[i+1].itemId)
    }
  }
  console.log("filteredCart_checkout", filteredCart_checkout)
  if (filteredCart_checkout.length === 0) {
    res.send(JSON.stringify({ success: false, reason: "Empty cart" }));
    return;
  }
  console.log("soldItems", soldItems)
  // for (let i = 0; i < soldItems.length; i++){
  //   for (let j = 0; j < soldItems.length; j++){
  //     if (soldItems[i] == soldItems[j] && i !== j){
  //     res.send(JSON.stringify({ success: false, reason: "Item in cart no longer available" }));
  //     return;
  // }
  //     }
  //   }
  
   for (let i = 0; i < filteredCart_checkout.length; i++){
    for (let j = 0; j < filteredCart_checkout.length; j++){
      if (filteredCart_checkout[i].itemId == filteredCart_checkout[j].itemId && i !== j && filteredCart_checkout[i].buyer ==  buyerUsername){
      res.send(JSON.stringify({ success: false, reason: "Item in cart no longer available" }));
      return;
  }
      }
    }

  
  res.send(JSON.stringify({ success: true}));
});

app.get("/purchase-history", (req, res) => {
  let givenToken = req.headers.token;
  let buyerUsername = tokenUsername.get(givenToken)
  let filteredCart = []
if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }
 
 for (let i = 0; i < cart.length; i++){
    if (cart[i].buyer === buyerUsername){
      filteredCart.push(cart[i+1]);
    }
  }
  
 res.send(JSON.stringify({ success: true, purchased: filteredCart}));
});

app.post("/chat", (req, res) => {
  let givenToken = req.headers.token;
  
  let buyerUsername = tokenUsername.get(givenToken)
  
  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }
  
  let parsed = JSON.parse(req.body);
  let destination = parsed.destination
  let contents = parsed.contents
  
  if (destination === undefined) {
    res.send(JSON.stringify({ success: false, reason: "destination field missing" }));
    return;
  }
  
  if (contents  === undefined) {
    res.send(JSON.stringify({ success: false, reason: "contents field missing" }));
    return;
  }
  
  let expectedPassword = passwords.get(destination);
  if (expectedPassword === undefined) {
    res.send(JSON.stringify({ success: false, reason: "Destination user does not exist" }));
    return;
  }
  
  res.send(JSON.stringify({ success: true }));
});

app.post("/chat-messsages", (req, res) => {
  
  res.send(JSON.stringify({ success: true }));
});


//SERVER PORTS, DO NOT DELETE
app.listen(process.env.PORT || 3000);

app.listen(4000, () => {
  console.log("server started");
});
