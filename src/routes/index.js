require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();
const router = express.Router();
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const fetch = require("node-fetch");
const FB = require("fb");

let con;

(function connectDb() {
  con = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB,
  });

  con.connect(function (err) {
    if (err) {
      console.log("Error connecting to databse, waiting 5 seconds to try again")
      return setTimeout(() => { connectDb() }, 5000)
    };
    console.log("connected to database!");
  });
})()

app.use(express.json());

app.use((req, res, next) => {
  console.log(`${req.method} -> ${req.originalUrl}`);

  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "OPTIONS, GET, PUT, POST, DELETE");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, x-mac"
  );
  res.header("Access-Control-Expose-Headers", "x-mac, x-host");

  next();
});

/* Get list of refresh tokens */
// let refresh_tokens = [];
// con.query(`SELECT refresh_token FROM users`, function (err, result, fields) {
//   if (err) throw err;

//   for (let i = 0; result.length > i; i++) {
//     refresh_tokens.push(result[i].refresh_token);
//   }
// });

/* ENDPOINTS */

/*
 ** POST
 */

/* Create user */
router.post("/new/user", cors(), async (req, res) => {
  const firstName = req.body.firstName;
  const lastName = req.body.lastName;
  const email = req.body.email;
  const password = req.body.password;
  const passwordRepeat = req.body.passwordRepeat;

  const saltRounds = 2;

  // console.log(req.body);
  if (password === passwordRepeat) {
    const hash = await bcrypt.hash(req.body.password, saltRounds);

    let user = {
      email: email,
    };

    const refreshToken = jwt.sign(user, process.env.REFRESH_TOKEN_SECRET);

    user = {
      firstName: firstName,
      lastName: lastName,
      email: email,
    };

    con.query(
      `INSERT INTO users(firstName, lastName, email, password, refresh_token) VALUES ('${firstName}', '${lastName}', '${email}', '${hash}', '${refreshToken}')`,
      function (err, result, fields) {
        if (err) throw err;
        // return res.json(result)
        console.log("User registered!");
        res.status(200).json({ user: user });
      }
    );
  } else {
    res.sendStatus(400);
  }
});

/* Login */

router.post("/login", cors(), async (req, loginRes) => {
  const email = req.body.email,
    password = req.body.password,
    userSocials = [],
    queryUser = `SELECT id, firstName, lastName, password, refresh_token FROM users WHERE email = '${email}'`;

  // console.log(req.body, "AccessToken: ", accessToken);

  con.query(queryUser, async (err, result, fields) => {
    if (err) throw err;

    if (result.length > 0) {
      const user = {
        id: result[0].id,
        firstName: result[0].firstName,
        lastName: result[0].lastName,
        email: email,
        password: result[0].password,
        refreshToken: result[0].refresh_token,
      };

      bcrypt.compare(password, user.password, (err, match) => {
        if (err) throw err;
        if (!match) return loginRes.json({ status: 401 });

        /* Remove password and refreshToken from user object */
        delete user.password;
        delete user.refreshToken;

        /* Get user social connections */
        con.query(
          `SELECT user_socials.social_id, user_socials.social_user_id, socials.name as social_name
            FROM user_socials
            LEFT JOIN socials
            ON user_socials.social_id = socials.id
            WHERE user_id = '${user.id}'`,
          function (err, result, fields) {
            if (err) throw err;

            if (result.length < 0)
              return console.log("User has NO social connections");

            for (let i = 0; i < result.length; i++) {
              userSocials.push(result[i]);
            }

            // const accessToken = generateAccessToken(user);
            const accessToken = generateAccessToken({ email: user.email });
            loginRes.json({
              status: 200,
              user: user,
              accessToken: accessToken,
              social_connections: userSocials,
            });
          }
        );
      });
    } else {
      /* Email doesn't exist in database */
      console.log("Invalid login attempt. (Email doesn't exist)");
      loginRes.json({ status: 401 });
      // loginRes.sendStatus(401);
    }
  });

  // res.sendStatus(200); // Sending this will redirect after login
});

/*
 ** Facebook login
 */
router.post("/auth/facebook", cors(), async (req, res) => {
  const userAccessToken = req.body.authResponse.accessToken;

  await FB.api(
    "/me",
    {
      access_token: userAccessToken,
      fields: "first_name,last_name,email,picture",
    },
    (fbRes) => {
      /* Check if user exists in database */
      const fbId = fbRes.id;
      const first_name = fbRes.first_name;
      const last_name = fbRes.last_name;
      const email = fbRes.email;
      const userSocials = [];
      // const profile_picture_url = fbRes.picture?.data?.url;

      if (!email)
        return res.status(400).json({ error: "Insufficient permissions." });

      /* Check if user exists in database */
      let queryUser = `SELECT id, firstName, lastName, refresh_token FROM users WHERE email = '${email}'`;

      con.query(queryUser, async function (err, result, fields) {
        if (err) throw err;

        if (result.length > 0) {
          /*
           ***
           *** TODO: If user exists, but has no facebookID, update facebookID!
           *** ... Use FacebookID to see if user is connected to a facebook account
           */

          console.log("Existing user signed in with Facebook");
          const user = {
            id: result[0].id,
            firstName: result[0].firstName,
            lastName: result[0].lastName,
            email: email,
            refreshToken: result[0].refresh_token,
          };

          /* Get user social connections */
          con.query(
            `SELECT user_socials.social_id, user_socials.social_user_id, socials.name as social_name
            FROM user_socials
            LEFT JOIN socials
            ON user_socials.social_id = socials.id
            WHERE user_id = '${user.id}'`,
            function (socials_err, socials_result, socials_fields) {
              if (socials_err) throw socials_err;

              if (socials_result.length < 0)
                return console.log("User has NO social connections");

              for (let i = 0; i < socials_result.length; i++) {
                userSocials.push(socials_result[i]);
              }

              // const accessToken = generateAccessToken(user);
              const accessToken = generateAccessToken({ email: user.email });
              res.status(200).json({
                user: user,
                accessToken: accessToken,
                social_connections: userSocials,
              });
            }
          );
        } else {
          /* Email doesn't exist in database, create new user */
          console.log("A new user signed up with Facebook");
          const refreshToken = jwt.sign(
            { email: email },
            process.env.REFRESH_TOKEN_SECRET
          );
          const randomPassword = generatePassword();
          const randomPasswordHash = await bcrypt.hash(randomPassword, 2);

          con.query(
            `INSERT INTO users(firstName, lastName, email, password, refresh_Token) VALUES ('${first_name}', '${last_name}', '${email}', '${randomPasswordHash}', '${refreshToken}')`,
            function (err, result, fields) {
              if (err) throw err;

              const user = {
                id: result.insertId,
                firstName: first_name,
                lastName: last_name,
                email: email,
                facebookID: fbId,
              };

              const accessToken = generateAccessToken({
                email: user.email,
              });

              /* Create new facebook connection? */
              // con.query(
              //   `INSERT INTO user_socials(social_id, user_id, social_user_id) VALUES ('2','${user.id}','${fbId}')`,
              //   function (err, result, fields) {
              //     // if (err) return res.status(400).json({ error: err });
              //     if (err) throw err;
              //     /* FIXME: måske fjern bruger fra database igen? :-) */
              //   }
              // );

              res.status(200).json({
                user: user,
                accessToken: accessToken,
              });
            }
          );
        }
      });
    }
  );
});

/* For SoMe users */
function generatePassword() {
  return Array(12)
    .fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz")
    .map(function (x) {
      return x[crypto.randomInt(0, 10000) % x.length];
    })
    .join("");
}

/* validate token */
router.post("/validate_token", cors(), authenticateToken, async (req, res) => {
  const accessToken = generateAccessToken({
    email: req.user.email,
  });
  res.status(200).json({ accessToken: accessToken });
});

/* Connect to Twitter */
router.post("/twitter/connect", cors(), async (req, res) => {
  const social_id = req.body.social_id;
  const user_id = req.body.user_id;
  const social_user_id = req.body.social_user_id;

  con.query(
    `INSERT INTO user_socials(social_id, user_id, social_user_id) VALUES (${social_id}, ${user_id}, ${social_user_id})`,
    function (err, result, fields) {
      if (err) return res.status(400).json({ error: err });
      res.status(200).json({ success: "Connection established" });
    }
  );
});

/* Connect to Facebook */
router.post("/facebook/connect", cors(), async (req, res) => {
  const userAccessToken = req.body.auth.authResponse.accessToken;
  const user_id = req.body.user_id;
  const social_id = req.body.social_id;
  const social_user_id = req.body.auth.authResponse.userID;

  await FB.api(
    "/me",
    {
      access_token: userAccessToken,
    },
    (fbRes) => {
      con.query(
        `INSERT INTO user_socials(social_id, user_id, social_user_id) VALUES (${social_id}, ${user_id}, ${social_user_id})`,
        function (err, result, fields) {
          if (err) return res.status(400).json({ error: err });
          return res.status(200).json({ success: "Connection established" });
        }
      );
    }
  );
});

/*
 ** DELETE
 */

/* Remove SoMe connection */
router.delete("/socials/disconnect", cors(), async (req, res) => {
  const social_id = req.body.social_id;
  const user_id = req.body.user_id;

  con.query(
    `DELETE FROM user_socials WHERE user_id = '${user_id}' AND social_id = '${social_id}'`,
    function (err, result, fields) {
      if (err) return res.status(400).json({ error: err });
      res.status(200).json({ success: "Connection removed" });
    }
  );
});

/*
 ** GET
 */

/* Get social medias */
router.get("/socials", (req, res) => {
  con.query(`SELECT * FROM socials WHERE 1`, function (err, result, fields) {
    if (err) throw err;
    if (result.length == 0)
      return res.status(404).json({ error: "No social medias were found )-:" });

    const socials = [];
    for (let i = 0; i < result.length; i++) {
      socials.push({ id: result[i].id, name: result[i].name });
    }

    res.status(200).json(socials);
  });
});

/* Get user SoMe connections */
router.get("/socials/user/:id", (req, res) => {
  /* Get social medias */
  const connections = [];
  con.query(
    `SELECT id, social_id, social_user_id FROM user_socials WHERE user_id = ${req.params.id}`,
    function (err, result, fields) {
      if (err) throw err;
      if (result.length == 0)
        return res.status(200).json({ null: "No connections" });

      for (let i = 0; i < result.length; i++) {
        connections.push({
          id: result[i].id,
          social_id: result[i].social_id,
          social_user_id: result[i].social_user_id,
        });
      }

      res.status(200).json(connections);
    }
  );
});

/* Methods */

function generateAccessToken(user) {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "2h" });
}

/*
 *** Middleware
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

module.exports = router;
