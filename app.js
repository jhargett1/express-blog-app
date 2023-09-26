const express = require("express");
const passport = require("passport");
const localStrategy = require("passport-local").Strategy;
const session = require("express-session");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const _ = require("lodash");
require("dotenv").config();
const connectString = process.env.CONNECTION_MONGO;

const homeStartingContent =
  "Lacus vel facilisis volutpat est velit egestas dui id ornare. Semper auctor neque vitae tempus quam. Sit amet cursus sit amet dictum sit amet justo. Viverra tellus in hac habitasse. Imperdiet proin fermentum leo vel orci porta. Donec ultrices tincidunt arcu non sodales neque sodales ut. Mattis molestie a iaculis at erat pellentesque adipiscing. Magnis dis parturient montes nascetur ridiculus mus mauris vitae ultricies. Adipiscing elit ut aliquam purus sit amet luctus venenatis lectus. Ultrices vitae auctor eu augue ut lectus arcu bibendum at. Odio euismod lacinia at quis risus sed vulputate odio ut. Cursus mattis molestie a iaculis at erat pellentesque adipiscing.";
const aboutContent =
  "Hac habitasse platea dictumst vestibulum rhoncus est pellentesque. Dictumst vestibulum rhoncus est pellentesque elit ullamcorper. Non diam phasellus vestibulum lorem sed. Platea dictumst quisque sagittis purus sit. Egestas sed sed risus pretium quam vulputate dignissim suspendisse. Mauris in aliquam sem fringilla. Semper risus in hendrerit gravida rutrum quisque non tellus orci. Amet massa vitae tortor condimentum lacinia quis vel eros. Enim ut tellus elementum sagittis vitae. Mauris ultrices eros in cursus turpis massa tincidunt dui.";
const contactContent =
  "Scelerisque eleifend donec pretium vulputate sapien. Rhoncus urna neque viverra justo nec ultrices. Arcu dui vivamus arcu felis bibendum. Consectetur adipiscing elit duis tristique. Risus viverra adipiscing at in tellus integer feugiat. Sapien nec sagittis aliquam malesuada bibendum arcu vitae. Consequat interdum varius sit amet mattis. Iaculis nunc sed augue lacus. Interdum posuere lorem ipsum dolor sit amet consectetur adipiscing elit. Pulvinar elementum integer enim neque. Ultrices gravida dictum fusce ut placerat orci nulla. Mauris in aliquam sem fringilla ut morbi tincidunt. Tortor posuere ac ut consequat semper viverra nam libero.";

const app = express();
mongoose.connect(connectString);

const postSchema = new mongoose.Schema({
  title: String,
  content: String,
});

const userSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const Post = mongoose.model("Post", postSchema);
const User = mongoose.model("User", userSchema);

passport.use(
  new localStrategy(async (username, password, done) => {
    const user = await User.findOne({ username });
    if (!User) {
      return done(null, false);
    }
    if (password !== user.password) {
      return done(null, false);
    }
    return done(null, user);
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id);
  done(null, user);
});

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: "Secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

let posts = [];

// Check if user is logged in
function checkAuth(req, res, next) {
  if (req.user) {
    next();
  } else {
    res.redirect("/login");
  }
}

app.post("/register", async (req, res) => {
  const newUser = await User.create({
    username: req.body.username,
    password: req.body.password,
  });
  req.login(newUser, (err) => {
    res.redirect("/");
  });
});

app.post("/login", passport.authenticate("local"), (req, res) => {
  res.redirect("/");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.get("/register", (req, res) => {
  res.render("register");
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
    });
  }
});

app.get("/about", async (req, res) => {
  res.render("about", { aboutContent: aboutContent });
});

app.get("/contact", async (req, res) => {
  res.render("contact", { contactContent: contactContent });
});

app.get("/compose", async (req, res) => {
  res.render("compose");
});

app.post("/compose", async (req, res) => {
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
    .then((foundPost) => {
      if (foundPost) {
        res.render("post", {
          title: foundPost.title,
          content: foundPost.content,
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

app.listen(3000, async () => {
  console.log("Server started on port 3000");
});
