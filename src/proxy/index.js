const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

//create express server
const app = express();

//conguration
//https://jsonplaceholder.typicode.com
//https://api.twitter.com
const API_SERVICE_URL = "https://api.twitter.com/2";

// info GET endpoint
app.get("/info", (request, response, next) => {
  request.query;
  response.send('{"name":"John", "age":30, "car":null}');
});

// authorization
app.use("", (request, response, next) => {
  if (request.headers.authorization) {
    next();
  } else {
    response.sendStatus(403);
  }
});

// proxy endpoints

//localhost:1337/proxy/twitter/users/:userid/following   rewritten to   <API_SERVICE_URL>/users/:userid/following
//
//Example of use
//curl -X GET "localhost:1337/proxy/twitter/users/1502211678418743299/following" -H "Authorization: Bearer AAAAAAAAAAAAAAAAAAAAAEVvaAEAAAAAhluPly2R0UNBm4o8Ht%2FlN2wXPIQ%3DCQMMFMSOPNbSkhgy6EkU8iuaoVxhwylMylJ5vHhxjLzLfFzKIb"
app.use(
  "/twitter/users/:userid/following",
  createProxyMiddleware({
    target: API_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      [`^/proxy/twitter`]: "",
    },
  })
);

//localhost:1337/proxy/twitter/users/:userid/tweets  rewritten to   <API_SERVICE_URL>/users/:userid/tweets
//
//Example of use
//curl -X GET "localhost:1337/proxy/twitter/users/1502211678418743299/tweets?tweet.fields=created_at&expansions=author_id&user.fields=created_at&max_results=5" -H "Authorization: Bearer AAAAAAAAAAAAAAAAAAAAAEVvaAEAAAAAhluPly2R0UNBm4o8Ht%2FlN2wXPIQ%3DCQMMFMSOPNbSkhgy6EkU8iuaoVxhwylMylJ5vHhxjLzLfFzKIb"
app.use(
  "/twitter/users/:userid/tweets",
  createProxyMiddleware({
    target: API_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      [`^/proxy/twitter`]: "",
    },
  })
);

/* Get user by username */
app.use(
  "/twitter/users/by/username/:username",
  createProxyMiddleware({
    target: API_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      [`^/proxy/twitter`]: "",
    },
  })
);

/* Get user by id */
app.use(
  "/twitter/users/:id",
  createProxyMiddleware({
    target: API_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      [`^/proxy/twitter`]: "",
    },
  })
);

/* Get single tweet by ID */
//api.twitter.com/2/tweets/:id
https: app.use(
  "/twitter/tweets/:id",
  createProxyMiddleware({
    target: API_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: {
      [`^/proxy/twitter`]: "",
    },
  })
);
module.exports = app;
