const cors = require("cors");
const cookieParser = require("cookie-parser");
const axios = require("axios");
const express = require("express");
const app = express();
// REST API
app.use(cors());
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
  const cookie = existingToken || result.token || null;
  if (result && result.promoted) {
    res.json({ status: "pass", cookie });
  } else {
    let redirectUrl = `https://wait.crowdhandler.com/${result.slug}?url=${targetUrl}`;
    if (existingToken) {
      redirectUrl = `${redirectUrl}&ch-id=${existingToken}`;
    }
    const encoded = encodeURI(redirectUrl);
    res.json({ url: encoded, status: "redirect", cookie });
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
