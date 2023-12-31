# Blog App

This is a simple blog app built with Node.js, Express, MongoDB, and EJS.

## Features

- Create, edit, delete blog posts
- View all posts or a single post
- User authentication
- Users can only delete their own posts
- Styled with Bootstrap

## Usage

### Install

```bash
npm install
```

### Configure

Create a .env file with your MongoDB connection string

```
CONNECTION_MONGO=YOUR_CONNECTION_STRING
```

### Run

```bash
npm start
```

The app will be served at http://localhost:3000

## Dependencies

- Express - web framework
- MongoDB - database
- Mongoose - MongoDB ODM
- EJS - templating engine
- Body-parser - parse request bodies
- Lodash - utility library
- Bootstrap - styling
- Passport - authentication
- Multer - handling file uploads

## New Functionality

- Users can register and login
- Authenticated users can create, edit, and delete posts
- Delete post button on post detail page
- Route and middleware to handle post deletion by ID
- Users can upload profile images
- Profile images are stored in MongoDB as binary data
- Persisted profile images across app restarts

## License

MIT
