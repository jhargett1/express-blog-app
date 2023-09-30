const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const multer = require("multer");
const AWS = require("aws-sdk");
const { CognitoIdentityServiceProvider } = require("aws-sdk");
const CognitoExpress = require("cognito-express");
const session = require("express-session");
require("dotenv").config();

const homeStartingContent =
  "Lacus vel facilisis volutpat est velit egestas dui id ornare. Semper auctor neque vitae tempus quam. Sit amet cursus sit amet dictum sit amet justo. Viverra tellus in hac habitasse. Imperdiet proin fermentum leo vel orci porta. Donec ultrices tincidunt arcu non sodales neque sodales ut. Mattis molestie a iaculis at erat pellentesque adipiscing. Magnis dis parturient montes nascetur ridiculus mus mauris vitae ultricies. Adipiscing elit ut aliquam purus sit amet luctus venenatis lectus. Ultrices vitae auctor eu augue ut lectus arcu bibendum at. Odio euismod lacinia at quis risus sed vulputate odio ut. Cursus mattis molestie a iaculis at erat pellentesque adipiscing.";

// Initialize AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

// Create a new instance of CognitoIdentityServiceProvider
const cognitoIdentityServiceProvider = new CognitoIdentityServiceProvider();

const cognitoExpress = new CognitoExpress({
  region: process.env.AWS_REGION,
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

let posts = [];

const authenticatedRoute = express.Router();

authenticatedRoute.use(async function (req, res, next) {
  let { accessToken, refreshToken } = req.session;

  // Refresh token if needed
  if (cognitoExpress.isTokenExpired(accessToken)) {
    const newAuth = await cognitoExpress.refresh(refreshToken);

    accessToken = newAuth.accessToken;
    refreshToken = newAuth.refreshToken;

    req.session.accessToken = accessToken;
    req.session.refreshToken = refreshToken;
  }

  // Fail if the token is not present in the header.
  if (!accessToken) {
    return res.status(401).send("Access Token missing from header");
  }

  cognitoExpress.validate(accessToken, function (err, response) {
    if (err) {
      // If API is not authenticated, return 401 with an error message.
      return res.status(401).send(err);
    } else {
      // If API has been authenticated, populate res.locals.user.
      res.locals.user = response;
      next();
    }
  });
});

// Register route with AWS Cognito and MongoDB
app.post("/register", async (req, res) => {
  try {
    // Create a new user in MongoDB
    const newUserMongo = await User.create({
      username: req.body.preferredUsername,
      password: req.body.password,
      preferredUsername: req.body.preferredUsername,
    });

    // Create a new user in AWS Cognito
    const params = {
      ClientId: process.env.AWS_COGNITO_APP_CLIENT_ID,
      Username: req.body.preferredUsername,
      Password: req.body.password, // User's password
      UserAttributes: [
        // Additional user attributes if needed
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

    cognitoIdentityServiceProvider.signUp(params, (err, data) => {
      if (err) {
        console.error(err);
        // Handle Cognito registration error (e.g., duplicate email)
        res.status(400).send("Registration failed. Please try again.");
      } else {
        // Cognito registration successful, you can handle it as needed
        console.log("Cognito registration successful:", data);

        // Perform additional actions if needed, such as sending a verification email

        // Redirect the user to the home page or a success page
        req.session.username = req.body.username;
        req.session.save();
        res.redirect("/verify");
      }
    });
  } catch (err) {
    console.error(err);
    // Handle MongoDB registration error
    res.status(400).send("Registration failed. Please try again.");
  }
});

app.get("/verify", async (req, res) => {
  const username = req.session.username;
  res.render("verify", { user: username });
});

app.post("/verify", async (req, res) => {
  try {
    const username = req.session.username;
    const code = req.body.verificationCode;

    console.log("Verifying user", username);

    const params = {
      ClientId: process.env.AWS_COGNITO_APP_CLIENT_ID,
      Username: username,
      ConfirmationCode: code,
    };

    console.log("params:", params);

    await cognitoIdentityServiceProvider.confirmSignUp(params).promise();

    const accessToken = await cognitoExpress
      .authenticate(username)
      .getPromise();

    req.session.accessToken = accessToken;
    req.session.refreshToken = auth.refreshToken;

    res.redirect("/");
  } catch (error) {
    console.error(error);
    console.log(error.__type);
    res.status(400).send("Email verification failed. Please try again.");
  }
});

app.post("/login", authenticatedRoute, (req, res) => {
  res.redirect("/");
});

app.get("/login", (req, res) => {
  res.render("login", { user: req.user });
});

app.get("/register", (req, res) => {
  res.render("register", { user: req.user || null });
});

app.get("/profile", authenticatedRoute, async (req, res) => {
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

app.listen(3000, async () => {
  console.log("Server started on port 3000");
});
