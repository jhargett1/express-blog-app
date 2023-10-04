const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const multer = require("multer");
const {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
} = require("@aws-sdk/client-cognito-identity-provider");
const session = require("express-session");
require("dotenv").config();

const homeStartingContent =
  "Lacus vel facilisis volutpat est velit egestas dui id ornare. Semper auctor neque vitae tempus quam. Sit amet cursus sit amet dictum sit amet justo. Viverra tellus in hac habitasse. Imperdiet proin fermentum leo vel orci porta. Donec ultrices tincidunt arcu non sodales neque sodales ut. Mattis molestie a iaculis at erat pellentesque adipiscing. Magnis dis parturient montes nascetur ridiculus mus mauris vitae ultricies. Adipiscing elit ut aliquam purus sit amet luctus venenatis lectus. Ultrices vitae auctor eu augue ut lectus arcu bibendum at. Odio euismod lacinia at quis risus sed vulputate odio ut. Cursus mattis molestie a iaculis at erat pellentesque adipiscing.";

const app = express();

// Create a new instance of CognitoIdentityProviderClient
const client = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

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
app.use(
  session({
    secret: "secretkey",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// Set storage engine
const storage = multer.memoryStorage();

// Init upload
const upload = multer({
  storage: storage,
});

// Register route with AWS Cognito and MongoDB
app.post("/register", async (req, res) => {
  // Create a new user in AWS Cognito
  const params = {
    ClientId: process.env.AWS_COGNITO_APP_CLIENT_ID,
    Username: req.body.preferredUsername,
    Password: req.body.password,
    UserAttributes: [
      {
        Name: "preferred_username",
        Value: req.body.preferredUsername,
      },
      {
        Name: "email",
        Value: req.body.username,
      },
    ],
  };

  const command = new SignUpCommand(params);

  try {
    // Create a new user in MongoDB
    const newUserMongo = await User.create({
      username: req.body.username,
      password: req.body.password,
      preferredUsername: req.body.preferredUsername,
    });

    await client.send(command);

    // Store username in session
    req.session.username = req.body.preferredUsername;
    req.session.password = req.body.password;
    req.session.signInUsername = req.body.username;

    // Redirect to confirmation
    res.redirect("/verify");
  } catch (err) {
    // Handle errors
    console.error(err);
    res.status(500).send("Error signing up user");
  }
});

app.get("/verify", async (req, res) => {
  const username = req.session.username;
  res.render("verify", { user: username });
});

app.post("/verify", async (req, res) => {
  const username = req.session.username;
  const code = req.body.verificationCode;

  const params = {
    ClientId: process.env.AWS_COGNITO_APP_CLIENT_ID,
    Username: username,
    ConfirmationCode: code,
  };

  try {
    console.log("Verifying user", username);

    const command = new ConfirmSignUpCommand(params);

    // Send confirmation
    await client.send(command);

    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(400).send("Email verification failed. Please try again.");
  }
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const params = {
    ClientId: process.env.AWS_COGNITO_APP_CLIENT_ID,
    AuthFlow: "USER_PASSWORD_AUTH",
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password,
    },
  };

  const command = new InitiateAuthCommand(params);

  try {
    const response = await client.send(command);

    // Store the access token in the session
    req.session.accessToken = response.AuthenticationResult.AccessToken;
    req.session.username = username;

    // Redirect the user to the home page
    res.redirect("/");
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).send("Authentication failed");
  }
});

app.get("/login", (req, res) => {
  res.render("login", { user: req.user });
});

app.get("/register", (req, res) => {
  res.render("register", { user: req.user || null });
});

app.get("/profile", async (req, res) => {
  if (!req.session.username) {
    return res.redirect("/login");
  }

  const user = await User.findOne({ username: req.session.username });

  res.render("profile", { user });
});

app.get("/", async (req, res) => {
  if (!req.session.username) {
    return res.redirect("/login");
  }

  const allPosts = await Post.find({});

  if (allPosts.length === 0) {
    Post.insertMany(homeStartingContent);
    res.redirect("/");
  } else {
    res.render("home", {
      startingContent: homeStartingContent,
      posts: allPosts,
      user: req.session.username,
    });
  }
});

app.get("/compose", (req, res) => {
  if (!req.session.username) {
    return res.redirect("/login");
  }

  res.render("compose", {
    user: req.session.username,
  });
});

app.post("/compose", async (req, res) => {
  const post = new Post({
    title: req.body.postTitle,
    content: req.body.postBody,
  });

  try {
    await post.save();
    res.redirect("/");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error creating the post");
  }
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
          user: req.session.username,
        });
      } else {
        res.redirect("/");
      }
    })
    .catch((err) => {
      console.error(err);
      res.redirect("/");
    });
});

app.post("/posts/:postId/delete", async (req, res) => {
  await Post.findByIdAndDelete(req.params.postId);
  res.redirect("/");
});

app.post("/profile/upload", upload.single("image"), async (req, res, next) => {
  const username = req.session.username;

  if (!username) {
    return res.redirect("/login");
  }

  try {
    if (!req.file) {
      // Handle the case where no file was uploaded
      res.redirect("/profile");
      return;
    }

    const user = await User.findOne({ username });

    // Update the user's profileImage field
    user.profileImage = {
      data: req.file.buffer, // Use the buffer from multer
      contentType: req.file.mimetype, // Set the content type from multer
    };

    await user.save();

    res.redirect("/profile");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session: ", err);
    }
    res.redirect("/login");
  });
});

app.listen(3000, async () => {
  console.log("Server started on port 3000");
});
