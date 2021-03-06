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
    res.send(
      JSON.stringify({ success: false, reason: "itemid field missing" })
    );
    return;
  }

  if (newDescription === undefined) {
    newDescription = listing.get(listingId).description;
  }

  if (newPrice === undefined) {
    newPrice = listing.get(listingId).price;
  }

  listing.delete(listingId);
  listing.set(listingId, { price: newPrice, description: newDescription });

  listingDetails.delete(listingId);
  listingDetails.set(listingId, {
    price: newPrice,
    description: newDescription,
    itemId: listingId,
    sellerUsername: loggedUser
  });
  res.send(JSON.stringify({ success: true }));
});

// let userCart = new Map()
let cart = [];
app.post("/add-to-cart", (req, res) => {
  let parsed = JSON.parse(req.body);
  let givenToken = req.headers.token;
  let listingId = parsed.itemid;

  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }

  if (listingId === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "itemid field missing" })
    );
    return;
  }

  if (listing.has(listingId) == false) {
    res.send(JSON.stringify({ success: false, reason: "Item not found" }));
    return;
  }

  let description = listingDetails.get(listingId).description;
  // let itemId = listingDetails.get(listingId).itemId
  let buyer = tokenUsername.get(givenToken);
  let username = listingDetails.get(listingId).sellerUsername;
  let price = listingDetails.get(listingId).price;

  cart.push(
    { buyer: buyer },
    {
      price: price,
      description: description,
      itemId: listingId,
      sellerUsername: username
    }
  );

  res.send(JSON.stringify({ success: true }));
});

app.get("/cart", (req, res) => {
  let givenToken = req.headers.token;
  let buyerUsername = tokenUsername.get(givenToken);
  let filteredCart = [];

  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }

  for (let i = 0; i < cart.length; i++) {
    if (cart[i].buyer === buyerUsername) {
      filteredCart.push(cart[i + 1]);
    }
  }

  res.send(JSON.stringify({ success: true, cart: filteredCart }));
});

let soldItems = [];
let filteredCart_checkout = [];
let purchaseList = new Map();

app.post("/checkout", (req, res) => {
  let givenToken = req.headers.token;
  let buyerUsername = tokenUsername.get(givenToken);

  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }

  for (let i = 0; i < cart.length; i++) {
    if (cart[i].buyer === buyerUsername) {
      filteredCart_checkout.push({
        buyer: buyerUsername,
        itemId: cart[i + 1].itemId
      });
      soldItems.push(cart[i + 1].itemId);
    }
  }

  if (filteredCart_checkout.length === 0) {
    res.send(JSON.stringify({ success: false, reason: "Empty cart" }));
    return;
  }

  for (let i = 0; i < filteredCart_checkout.length; i++) {
    for (let j = 0; j < filteredCart_checkout.length; j++) {
      if (
        filteredCart_checkout[i].itemId == filteredCart_checkout[j].itemId &&
        i !== j &&
        filteredCart_checkout[i].buyer == buyerUsername
      ) {
        res.send(
          JSON.stringify({
            success: false,
            reason: "Item in cart no longer available"
          })
        );
        return;
      }
    }
  }

  res.send(JSON.stringify({ success: true }));
});

app.get("/purchase-history", (req, res) => {
  let givenToken = req.headers.token;
  let buyerUsername = tokenUsername.get(givenToken);
  let filteredCart = [];
  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }

  for (let i = 0; i < cart.length; i++) {
    if (cart[i].buyer === buyerUsername) {
      filteredCart.push(cart[i + 1]);
    }
  }

  res.send(JSON.stringify({ success: true, purchased: filteredCart }));
});

let chatLog = [];

app.post("/chat", (req, res) => {
  let givenToken = req.headers.token;

  let buyerUsername = tokenUsername.get(givenToken);

  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }

  let parsed = JSON.parse(req.body);
  let destination = parsed.destination;
  let contents = parsed.contents;

  if (destination === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "destination field missing" })
    );
    return;
  }

  if (contents === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "contents field missing" })
    );
    return;
  }

  let expectedPassword = passwords.get(destination);
  if (expectedPassword === undefined) {
    res.send(
      JSON.stringify({
        success: false,
        reason: "Destination user does not exist"
      })
    );
    return;
  }

  // let timeStamp = Date.now();
  chatLog.push(destination, { from: buyerUsername, contents: contents });
  res.send(JSON.stringify({ success: true }));
});

app.post("/chat-messages", (req, res) => {
  let givenToken = req.headers.token;
  let buyerUsername = tokenUsername.get(givenToken);

  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }

  let parsed = JSON.parse(req.body);
  let destination = parsed.destination;
  if (destination === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "destination field missing" })
    );
    return;
  }

  let expectedPassword = passwords.get(destination);
  if (expectedPassword === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "Destination user not found" })
    );
    return;
  }

  let filteredChatLog = [];
  for (let i = 0; i < chatLog.length; i++) {
    if (chatLog[i] === buyerUsername || chatLog[i] === destination) {
      filteredChatLog.push(chatLog[i + 1]);
    }
  }

  res.send(JSON.stringify({ success: true, messages: filteredChatLog }));
});

let shippedItems = new Map();

app.post("/ship", (req, res) => {
  let givenToken = req.headers.token;
  let givenUsername = tokenUsername.get(givenToken);
  let parsed = JSON.parse(req.body);
  let listingId = parsed.itemid;

  if (soldItems.includes(listingId) == false) {
    res.send(JSON.stringify({ success: false, reason: "Item was not sold" }));
    return;
  }

  if (shippedItems.has(listingId)) {
    res.send(
      JSON.stringify({ success: false, reason: "Item has already shipped" })
    );
    return;
  }

  if (
    listingDetails.has(listingId) == false ||
    listingDetails.get(listingId).sellerUsername !== givenUsername
  ) {
    res.send(
      JSON.stringify({
        success: false,
        reason: "User is not selling that item"
      })
    );
    return;
  }

  shippedItems.set(listingId, { status: "shipped" });
  res.send(JSON.stringify({ success: true }));
});

app.get("/status", (req, res) => {
  let givenItemId = req.query.itemid;

  if (soldItems.includes(givenItemId) == false) {
    res.send(JSON.stringify({ success: false, reason: "Item not sold" }));
    return;
  }

  if (shippedItems.has(givenItemId) == false) {
    res.send(JSON.stringify({ success: true, status: "not-shipped" }));
    return;
  }

  res.send(JSON.stringify({ success: true, status: "shipped" }));
});

let sellerReviews = new Map();
let sellerReviews2 = new Map();
let transactionID = 0;

app.post("/review-seller", (req, res) => {
  let givenToken = req.headers.token;
  let givenUsername = tokenUsername.get(givenToken);
  let parsed = JSON.parse(req.body);
  let numStars = parsed.numStars;
  let contents = parsed.contents;
  let itemId = parsed.itemid;
  let seller = listingDetails.get(itemId).sellerUsername;
  let sellerCheck = "";

  if (tokenUsername.has(givenToken) == false) {
    res.send(JSON.stringify({ success: false, reason: "Invalid token" }));
    return;
  }

  let filteredCart = [];
  let itemFind = [];
  for (let i = 0; i < cart.length; i++) {
    if (cart[i].buyer === givenUsername) {
      filteredCart.push(cart[i + 1]);
    }
  }

  let test = filteredCart.find(obj => obj.itemId == itemId);
  if (test !== undefined) {
    sellerCheck = test.sellerUsername;
  }

  if (filteredCart.includes(itemId) == false && sellerCheck !== seller) {
    res.send(
      JSON.stringify({
        success: false,
        reason: "User has not purchased this item"
      })
    );
    return;
  }

  if (sellerReviews2 !== undefined) {
    for (let j = 1; j <= sellerReviews2.size; j++) {
      if (sellerReviews2.get(j).itemId == itemId) {
        console.log("j", j);
        res.send(
          JSON.stringify({
            success: false,
            reason: "This transaction was already reviewed"
          })
        );
      }
    }
  }

  transactionID = transactionID + 1;
  sellerReviews.set(seller, {
    from: givenUsername,
    numStars: numStars,
    contents: contents
  });
  sellerReviews2.set(transactionID, {
    from: givenUsername,
    numStars: numStars,
    contents: contents,
    itemId: itemId,
    seller: seller
  });

  res.send(JSON.stringify({ success: true }));
});

let getSellerReviews = [];

app.get("/reviews", (req, res) => {
  let seller = req.query.sellerUsername;

  for (let i = 1; i <= sellerReviews2.size; i++) {
    if (sellerReviews2.get(i).seller == seller) {
      getSellerReviews.push({
        from: sellerReviews2.get(i).from,
        numStars: sellerReviews2.get(i).numStars,
        contents: sellerReviews2.get(i).contents
      });
    }
  }

  res.send(JSON.stringify({ success: true, reviews: getSellerReviews }));
});

app.get("/selling", (req, res) => {
  let seller = req.query.sellerUsername;

  if (seller === undefined) {
    res.send(
      JSON.stringify({ success: false, reason: "sellerUsername field missing" })
    );
    return;
  }

  let keys = Array.from(listingDetails.keys());

  let filteredsellingList = [];

  for (let i = 0; i < keys.length; i++) {
    if (listingDetails.get(keys[i]).sellerUsername == seller) {
      filteredsellingList.push({
        price: listingDetails.get(keys[i]).price,
        description: listingDetails.get(keys[i]).description,
        itemId: listingDetails.get(keys[i]).itemId,
        sellerUsername: listingDetails.get(keys[i]).sellerUsername
      });
    }
  }

  res.send(JSON.stringify({ success: true, selling: filteredsellingList }));
});

//SERVER PORTS, DO NOT DELETE
app.listen(process.env.PORT || 3000);

app.listen(4000, () => {
  console.log("server started");
});
