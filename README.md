# Blog App

This is a simple blog app built with Node.js, Express, MongoDB, and EJS.

## Features

- Create, edit, delete blog posts
- View all posts or a single post
- User authentication
- Users can only delete their own posts
- Upload and display profile images
- Styled with Bootstrap

## Usage

### Prerequisites

Before you begin, make sure you have the following prerequisites installed:

- [Node.js](https://nodejs.org/)
- [MongoDB](https://www.mongodb.com/try/download/community)

### Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/your-username/blog-app.git
   cd blog-app
   ```

Install the required npm packages:

```bash
npm install
```

### Configuration

Create a .env file in the root directory of the project with the following environment variables:

```
CONNECTION_MONGO=YOUR_CONNECTION_STRING
AWS_REGION=YOUR_AWS_REGION
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
AWS_COGNITO_APP_CLIENT_ID=YOUR_AWS_COGNITO_APP_CLIENT_ID
AWS_COGNITO_USER_POOL_ID=YOUR_AWS_COGNITO_USER_POOL_ID
```

### Run

Start the application

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
