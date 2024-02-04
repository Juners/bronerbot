import {
  DynamoDBClient,
  UpdateItemCommand,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";

const error = (origin, error) => {
  const now = new Date();
  const time = `[${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}:${now.getMilliseconds()}]`;
  console.error(time,  origin, error);
};

/**
 *
 * @param {DynamoDBClient} client
 * @param {bool} isLive
 * @returns
 */
async function writeEmoteUsage(client, date, emotes) {
  try {
    console.debug(emotes);
    const m = new Date().getMonth();
    const params = {
      TableName: "lina_emotes_data",
      Key: {
        month: { N: `${m}` },
      },
      UpdateExpression: "SET json = :val",
      ExpressionAttributeValues: {
        ":val": { S: emotes },
      },
    };

    const putCommand = new UpdateItemCommand(params);
    await client.send(putCommand);

    return true;
  } catch (e) {
    error("writeEmoteUsage", e);
    return null;
  }
}

export async function getEmoteUsage() {}

export async function updateEmoteUsage(emoteUsage, date) {
  const promise = new Promise((resolve, reject) => {
    const client = new DynamoDBClient({ region: "eu-west-1" });
    const success = writeEmoteUsage(client, date, emoteUsage);
    client.destroy();

    if (success) {
      resolve();
    } else {
      reject();
    }
  });

  return promise;
}

export async function getStoredEmoteData() {
  const client = new DynamoDBClient({ region: "eu-west-1" });

  try {
    const scanCommand = new ScanCommand({
      TableName: "lina_emotes_data",
      Limit: 1,
      ScanIndexForward: false,
    });

    const item = (await client.send(scanCommand)).Items[0];
    if (!item) return { twitch: {}, seventv: {} };

    const emoteData = { json: item.json.S };

    return JSON.parse(emoteData.json);
  } catch (e) {
    error("getStoredEmoteData", e);
    return JSON.stringify(e, null, 2);
  }
}
