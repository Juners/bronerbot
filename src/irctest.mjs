import { WebSocket } from "ws";

import find7tvEmotesInMessage from "./find7tvEmotesInMessage.mjs";
import findChannelEmotesInMessage from "./findChannelEmotesInMessage.mjs";
import parseMessage from "./formatMessage.mjs";
import { getStoredEmoteData, updateEmoteUsage } from "./dbManagement.mjs";
import SECRETS from "./secrets.mjs";

// const BROADCASTER_ID = 1027570501; // Myself
const BROADCASTER_ID = 697578274; // Lina
const EMOTE_SET = "62d73f58d8e61c27b053c09a"; // Lina's emoteset

let emotesUsed = { twitch: {}, seventv: {} };

const error = (origin, error) => {
  const now = new Date();
  const time = `[${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}:${now.getMilliseconds()}]`;
  console.error(time, origin, error);
};

const log = (message) => {
  const now = new Date();
  const time = `[${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}:${now.getMilliseconds()}]`;
  console.log(time + " " + message);
};

// async function getAccessToken() {
//   try {
//     const response = await fetch(`https://id.twitch.tv/oauth2/token`, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         client_id: SECRETS.CLIENT_ID,
//         client_secret: "",
//         code:"", //TODO
//         grant_type:"authorization_code",
//         redirect_uri:"http://localhost:3000",
//       }),
//     });

//     const { access_token } = await response.json();

//     return access_token;
//   } catch (e) {
//     error("getAccesToken", e);
//     return null;
//   }
// }

async function validateAccessToken(token) {
  const { status, statusMessage } = await fetch(
    "https://id.twitch.tv/oauth2/validate",
    {
      headers: {
        Authorization: "OAuth " + token,
      },
    }
  );

  if (status === 401) {
    error("Token not valid", statusMessage);
    throw new Error();
  }
}

/**
 * @type {Object.<string, {id: string, name: string, animated: boolean, listed: boolean} }>}
 */
let seventvEmoteData = {};
let last7tvRetrieval = null;
function get7tvEmotes() {
  // Checking each minute
  // https://7tv.io/v3/emote-sets/62d73f58d8e61c27b053c09a
  if (
    last7tvRetrieval === null ||
    seventvEmoteData == null ||
    Date.now() - last7tvRetrieval > 60 * 1000
  ) {
    last7tvRetrieval = Date.now();

    // Queueing in parallel the update, so we don't block the storage of messages
    update7tvEmotesCached();
  }

  return seventvEmoteData;
}

async function update7tvEmotesCached() {
  try {
    const call = await fetch(`https://7tv.io/v3/emote-sets/${EMOTE_SET}`);

    const json = await call.json();
    const new7tvData = Object.fromEntries(
      json.emotes.map((emote) => [
        emote.name,
        {
          id: emote.id,
          animated: emote.data.animated,
          listed: emote.data.listed,
        },
      ])
    );

    if (JSON.stringify(seventvEmoteData) !== JSON.stringify(new7tvData)) {
      seventvEmoteData = new7tvData;
    }
  } catch (error) {
    error("update7tvEmotesCached", error);
  }
}

/**
 * @type {Object.<string, {tier: 1000|2000|3000, name: string, scale: ["1.0", "2.0", "3.0"], theme_mode: ["light", "dark"], format: ["static", "animated"]}}>}
 */
let twitchEmoteData = {};
let lastChannelRetrieval = null;
function getChannelEmotes() {
  // Checking each minute
  if (
    lastChannelRetrieval === null ||
    twitchEmoteData == null ||
    Date.now() - lastChannelRetrieval > 60 * 1000
  ) {
    lastChannelRetrieval = Date.now();

    // Queueing in parallel the update, so we don't block the storage of messages
    updateChannelEmotesCached();
  }

  return twitchEmoteData;
}

async function updateChannelEmotesCached() {
  try {
    const call = await fetch(
      `https://api.twitch.tv/helix/chat/emotes?broadcaster_id=${BROADCASTER_ID}`,
      {
        headers: {
          Authorization: `Bearer ${SECRETS.APP_TOKEN}`,
          "Client-Id": SECRETS.CLIENT_ID,
        },
      }
    );

    const json = await call.json();
    const newChannelData = Object.fromEntries(
      json.data.map((emote) => [
        emote.id,
        {
          tier: emote.tier,
          name: emote.name,
          scale: emote.scale,
          theme_mode: emote.theme_mode,
          format: emote.format,
        },
      ])
    );

    if (JSON.stringify(twitchEmoteData) !== JSON.stringify(newChannelData)) {
      twitchEmoteData = newChannelData;
    }
  } catch (error) {
    error("updateChannelEmotesCached", error);
  }
}

// let cachedGlobalEmoteData = null;
// let lastGlobalRetrieval = null;
// async function getGlobalEmotes() {
//   // idc enough about this ones, checking each hour
//   if (
//     lastGlobalRetrieval === null ||
//     cachedGlobalEmoteData == null ||
//     Date.now() - lastGlobalRetrieval > 60 * 60 * 1000
//   ) {
//     lastGlobalRetrieval = Date.now();

//     const call = await fetch(`https://api.twitch.tv/helix/chat/emotes/global`, {
//       headers: {
//         Authorization: `Bearer ${SECRETS.APP_TOKEN}`,
//         "Client-Id": SECRETS.CLIENT_ID,
//       },
//     });

//     cachedGlobalEmoteData = await call.json();
//   }

//   return cachedGlobalEmoteData;
// }

// TODO: I should save message-id in the db to prevent duplicates, need to check how cost effective this would be with AWS
let pendingToStore = {};
setInterval(() => {
  if (Object.keys(pendingToStore).length > 0) {
    const timeKey = new Date().setMilliseconds(0) - 1000; // 1s delay for storage
    let messages = pendingToStore[timeKey];
    if (messages) {
      updateEmotes(messages, timeKey)
        .then(() => {
          delete pendingToStore[timeKey];
        })
        .catch(() => {
          const newTimeKey = new Date().setMilliseconds(0) + 1000; // Moving it to the next try
          pendingToStore[newTimeKey];
        });
    }
  }
}, 1000);

async function updateEmotes(messages, timeKey) {
  try {
    const channelEmotes = getChannelEmotes();
    const seventvEmotes = get7tvEmotes();

    messages.forEach((messageJson) => {
      const message = JSON.parse(messageJson);
      findChannelEmotesInMessage(
        emotesUsed.twitch,
        channelEmotes,
        message.tags.emotes
      );

      find7tvEmotesInMessage(
        emotesUsed.seventv,
        seventvEmotes,
        message.parameters
      );
    });

    await updateEmoteUsage(JSON.stringify(emotesUsed), timeKey);

    return Promise.resolve();
  } catch (error) {
    return Promise.reject();
  }
}

/**
 * @this {WebSocket}
 */
async function onConnect() {
  get7tvEmotes();
  getChannelEmotes();
  emotesUsed = await getStoredEmoteData();

  log("WebSocket Client Connected");

  //   validateAccessToken(SECRETS.APP_TOKEN);

  this.send("CAP REQ :twitch.tv/tags twitch.tv/commands");
  this.send(`PASS oauth:${SECRETS.APP_TOKEN}`);
  this.send("NICK broner_bot");

  this.send("JOIN #nekrolina");

  this.on("close", function (code, desc) {
    log(`Socket closing with code ${code}. Message: ${desc}`);
    // TODO: Once it closes, restart it with increments of 2^attempt seconds
  });

  this.on("error", function (error) {
    log("Error recieved: " + error.message);
  });

  this.on("message", async function (data) {
    const utf8Data = new TextDecoder().decode(data);

    const message = parseMessage(utf8Data);
    if (!message) {
      log("Unkown message recived: " + JSON.stringify(data));

      return false;
    }

    if (message.command.command === "PING") {
      this.pong(message.parameters);
      log("ponging");
    } else if (message.command.command === "PRIVMSG") {
      // const globalEmotes = await getGlobalEmotes(); // TODO: Maybe use these? I can't really be bothered tbh

      const timeKey = new Date().setMilliseconds(0);
      if (!pendingToStore[timeKey]) {
        pendingToStore[timeKey] = [];
      }
      pendingToStore[timeKey].push(JSON.stringify(message));
    }

    log("Message recieved: " + JSON.stringify(message) + "\n\n");
  });
}

function wakeupHoney() {
  const client = new WebSocket("ws://irc-ws.chat.twitch.tv:80");

  client.on("error", function (error) {
    log("Connect Error: " + error.toString());
  });

  client.on("open", onConnect);

  // client.connect("ws://irc-ws.chat.twitch.tv:80");
}

wakeupHoney();

// const channelEmotes = await getChannelEmotes();
// const globalEmotes = await getGlobalEmotes();
// log(JSON.stringify(channelEmotes));
// log(JSON.stringify(globalEmotes));
// const sevenEmotes = await get7tvEmotes();
// console.debug(Object.keys(sevenEmotes).includes("peepoSit"))
