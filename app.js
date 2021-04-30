const cors = require("cors");
const cookieParser = require("cookie-parser");
const axios = require("axios");
const express = require("express");
const app = express();
// REST API
var allowedDomains = ['https://dev.veoci.com', 'https://stage.veoci.com', 'https://veoci.com', 'http://localhost:8081'];
app.use(cors({
  origin: function (origin, callback) {
    // bypass the requests with no origin (like curl requests, mobile apps, etc )
    if (!origin) return callback(null, true);

    if (allowedDomains.indexOf(origin) === -1) {
      var msg = `This site ${origin} does not have an access. Only specific domains are allowed to access it.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const port = process.env.PORT || 3000;

let chKey;
let configLoaded = false;
try {
  const credsJson = require("./credentials/creds.json");
  chKey = credsJson["chKey"];
  configLoaded = true;
} catch (e) {
  // Do nothing
}

if (!chKey) {
  chKey = process.env.CHKEY;
}

app.get("/", (req, res) => {
  const msg = configLoaded ? "HELLO LOCALHOST" : "HELLO PRODUCTION";
  const chKeyDetected = !!chKey;
  res.send(`${msg}: CH key detected: ${chKeyDetected}`);
});

// CROWD HANDLER
app.post("/requests", async (req, res) => {
  const userIP = req.ip === "::1" ? "127.0.0.1" : req.ip;
  const userAgent = req.get("User-Agent");
  const userLang = req.get("Accept-Language") || "en";
  const targetUrl = req.body.targetUrl;
  if (!targetUrl || !chKey) {
    res.json({ message: "Bad Request: Not target url or key specified" });
    return;
  }
  const crowdHandlerParams = {
    url: targetUrl,
    ip: userIP,
    agent: userAgent,
    lang: userLang,
  };
  const existingToken = req.query["ch-id"] || req.cookies["ch-id"] || null;
  const disableCookie = req.query["disableCookie"] && req.query["disableCookie"] === 'true' ? true : false
  let result;
  try {
    if (existingToken) {
      const { data } = await crowdhandlerRequest.get(
        `requests/${existingToken}`,
        crowdHandlerParams
      );
      result = data.result;
    } else {
      const { data } = await crowdhandlerRequest.post(
        "requests",
        crowdHandlerParams
      );
      result = data.result;
    }
  } catch ({ response }) {
    console.log(response);
    let redirectUrl = `https://wait.crowdhandler.com?url=${targetUrl}&ch-public-key=${chKey}`;
    if (existingToken) {
      redirectUrl = `${redirectUrl}&ch-id=${existingToken}`;
    }
    const encoded = encodeURI(redirectUrl);
    res.json({ url: encoded, status: "redirect" });
    return;
  }
  // Now handle the queue-ing
  const cookie = result.token || null;
  if (result && result.promoted) {
    if (cookie && !disableCookie) {
      res.cookie('ch-id', cookie, { expires: new Date(Date.now() + 3600000) }) // cookie will be removed after 1 hours
    }
    res.json({ status: "pass", token: cookie });
  } else {
    let redirectUrl = `https://wait.crowdhandler.com/${result.slug}?url=${targetUrl}`;
    if (existingToken) {
      redirectUrl = `${redirectUrl}&ch-id=${existingToken}`;
    }
    const encoded = encodeURI(redirectUrl);
    if (cookie && !disableCookie) {
      res.cookie('ch-id', cookie, { expires: new Date(Date.now() + 3600000) }) // cookie will be removed after 1 hours
    }
    res.json({ url: encoded, status: "redirect", token: cookie });
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

// ========= FUNCTIONS ========
const baseURL = "https://api.crowdhandler.com/v1";
const auth = {
  username: chKey,
  password: "",
};
const headers = {
  "x-api-key": chKey,
};
const crowdhandlerRequest = {
  post: (url, params) => {
    return axios.post(`${baseURL}/${url}`, params, {
      auth,
    });
  },
  get: (url, params) => {
    return axios.get(`${baseURL}/${url}`, { params, headers });
  },
};
