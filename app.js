const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const multer = require("multer");
const CognitoExpress = require("cognito-express");
require("dotenv").config();

const homeStartingContent =
  "Lacus vel facilisis volutpat est velit egestas dui id ornare. Semper auctor neque vitae tempus quam. Sit amet cursus sit amet dictum sit amet justo. Viverra tellus in hac habitasse. Imperdiet proin fermentum leo vel orci porta. Donec ultrices tincidunt arcu non sodales neque sodales ut. Mattis molestie a iaculis at erat pellentesque adipiscing. Magnis dis parturient montes nascetur ridiculus mus mauris vitae ultricies. Adipiscing elit ut aliquam purus sit amet luctus venenatis lectus. Ultrices vitae auctor eu augue ut lectus arcu bibendum at. Odio euismod lacinia at quis risus sed vulputate odio ut. Cursus mattis molestie a iaculis at erat pellentesque adipiscing.";

const cognitoExpress = new CognitoExpress({
  region: "us-east-1",
  cognitoUserPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
  tokenUse: "access",
  tokenExpiration: 3600,
});

const app = express();

mongoose
  .connect(process.env.CONNECTION_MONGO, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("DB Connected"))
  .catch((err) => console.error(err));

const postSchema = new mongoose.Schema({
  title: String,
  content: String,
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  preferredUsername: String,
  profileImage: {
    data: Buffer,
    contentType: String,
  },
});

const Post = mongoose.model("Post", postSchema);
const User = mongoose.model("User", userSchema);

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Set storage engine
const storage = multer.memoryStorage();

// Init upload
const upload = multer({
  storage: storage,
});

let posts = [];

const authenticatedRoute = express.Router();

app.post("/register", async (req, res) => {
  const newUser = await User.create({
    username: req.body.username,
    password: req.body.password,
    preferredUsername: req.body.preferredUsername,
  });
  req.login(newUser, (err) => {
    res.redirect("/");
  });
});

app.post("/login", (req, res) => {
  // Authenticate using CognitoExpress middleware directly
  const accessTokenFromClient = req.headers.accesstoken;

  if (!accessTokenFromClient) {
    return res.status(401).send("Access Token missing from header");
  }

  cognitoExpress.validate(accessTokenFromClient, function (err, response) {
    if (err) {
      return res.status(401).send(err);
    }

    // User authenticated, attach to response
    res.locals.user = response;

    // Proceed to your protected route logic here

    res.redirect("/");
  });
});

app.get("/login", (req, res) => {
  res.render("login", { user: req.user });
});

app.get("/register", (req, res) => {
  res.render("register", { user: req.user || null });
});

app.get("/profile", async (req, res) => {
  res.render("profile", { user: res.locals.user });
});

app.get("/", async (req, res) => {
  const allPosts = await Post.find({});

  if (allPosts.length === 0) {
    Post.insertMany(homeStartingContent);
    res.redirect("/");
  } else {
    res.render("home", {
      startingContent: homeStartingContent,
      posts: allPosts,
      user: res.locals.user,
    });
  }
});

authenticatedRoute.get("/compose", (req, res) => {
  res.render("compose", { user: res.locals.user });
});

authenticatedRoute.post("/compose", async (req, res) => {
  const post = new Post({
    title: req.body.postTitle,
    content: req.body.postBody,
  });

  post.save();

  res.redirect("/");
});

app.get("/posts/:postId", async (req, res) => {
  const requestedPostId = req.params.postId;

  Post.findById(requestedPostId)
    .then((post) => {
      if (post) {
        res.render("post", {
          title: post.title,
          content: post.content,
          id: post._id,
          user: req.user,
        });
      } else {
        res.redirect("/");
      }
    })
    .catch((err) => {
      console.log(err);
      res.redirect("/");
    });
});

app.post("/posts/:postId/delete", async (req, res) => {
  await Post.findByIdAndDelete(req.params.postId);
  res.redirect("/");
});

app.post("/profile/upload", upload.single("image"), async (req, res, next) => {
  try {
    if (!req.file) {
      // Handle the case where no file was uploaded
      res.redirect("/profile");
      return;
    }

    // Update the user's profileImage field
    req.user.profileImage = {
      data: req.file.buffer, // Use the buffer from multer
      contentType: req.file.mimetype, // Set the content type from multer
    };

    await req.user.save();

    res.redirect("/profile");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/logout", (req, res) => {
  req.logout(() => {
    res.redirect("/");
  });
});

// Attach the authenticatedRoute to your app
app.use("/authenticated", authenticatedRoute);
