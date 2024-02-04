import wsPkg from "websocket";

import find7tvEmotesInMessage from "./find7tvEmotesInMessage.mjs";
import parseMessage from "./formatMessage.mjs";
import { getStoredEmoteData, updateEmoteUsage } from "./dbManagement.mjs";
import SECRETS from "./secrets.mjs";

const { client: WebSocketClient } = wsPkg;

// const BROADCASTER_ID = 1027570501; // Myself
const BROADCASTER_ID = 697578274; // Lina
const EMOTE_SET = "62d73f58d8e61c27b053c09a"; // Lina's emoteset

const error = (origin, error) => {
  const now = new Date();
  const time = `[${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}:${now.getMilliseconds()}]`;
  console.error(time,  origin, error);
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
var seventvEmoteData = {};
var last7tvRetrieval = null;
async function get7tvEmotes() {
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
var twitchEmoteData = {};
var lastChannelRetrieval = null;
async function getChannelEmotes() {
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

// var cachedGlobalEmoteData = null;
// var lastGlobalRetrieval = null;
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
var pendingToStore = {};
setInterval(() => {
  if (Object.keys(pendingToStore).length > 0) {
    const timeKey = new Date().setMilliseconds(0) - 1000; // 1s delay for storage
    var storing = pendingToStore[timeKey];
    if (storing) {
      updateEmoteUsage(storing, timeKey).then(() => {
        delete pendingToStore[timeKey];
      });
    }
  }
}, 1000);

var emotesUsed = { twitch: {}, seventv: {} };
function onConnect(connection) {
  log("WebSocket Client Connected");

  //   validateAccessToken(SECRETS.APP_TOKEN);

  connection.sendUTF("CAP REQ :twitch.tv/tags twitch.tv/commands");
  connection.sendUTF(`PASS oauth:${SECRETS.APP_TOKEN}`);
  connection.sendUTF("NICK broner_bot");

  connection.sendUTF("JOIN #nekrolina");

  connection.on("close", function (code, desc) {
    log(`Socket closing with code ${code}. Message: ${desc}`);
    // TODO: Once it closes, restart it with increments of 2^attempt seconds
  });

  connection.on("error", function (error) {
    log("Error recieved: " + error.message);
  });

  connection.on("message", async function (data) {
    const message = parseMessage(data.utf8Data);
    if (!message) {
      log("Unkown message recived: " + JSON.stringify(data));

      return false;
    }

    if (message.command.command === "PING") {
      connection.pong(message.parameters);
      log("ponging");
    } else if (message.command.command === "PRIVMSG") {
      const channelEmotes = await getChannelEmotes();
      const seventvEmotes = await get7tvEmotes();
      // const globalEmotes = await getGlobalEmotes(); // TODO: Maybe use these? I can't really be bothered tbh

      // First, we get the channel twitch emotes
      Object.entries(message.tags.emotes || {}).forEach(
        ([emoteId, emotesPos]) => {
          if (channelEmotes[emoteId]) {
            if (emotesUsed.twitch[emoteId] === undefined) {
              emotesUsed.twitch[emoteId] = {
                realAmmount: 0,
                ammount: 0,
                data: {
                  ...channelEmotes[emoteId],
                },
              };
            }

            emotesUsed.twitch[emoteId].ammount++;
            emotesUsed.twitch[emoteId].realAmmount += emotesPos.length;
          }
        }
      );

      emotesUsed.seventv = find7tvEmotesInMessage(
        seventvEmotes,
        emotesUsed.seventv,
        message.parameters
      );

      const timeKey = new Date().setMilliseconds(0);
      pendingToStore[timeKey] = JSON.stringify(emotesUsed);
    }

    log("Message recieved: " + JSON.stringify(message) + "\n\n");
  });
}

function wakeupHoney() {
  const client = new WebSocketClient();

  client.on("connectFailed", function (error) {
    log("Connect Error: " + error.toString());
  });

  client.on("connect", async function (connection) {
    emotesUsed = await getStoredEmoteData();

    onConnect(connection);

    return false;
  });

  client.connect("ws://irc-ws.chat.twitch.tv:80");
}

wakeupHoney();

// const channelEmotes = await getChannelEmotes();
// const globalEmotes = await getGlobalEmotes();
// log(JSON.stringify(channelEmotes));
// log(JSON.stringify(globalEmotes));
// const sevenEmotes = await get7tvEmotes();
// console.debug(Object.keys(sevenEmotes).includes("peepoSit"))
